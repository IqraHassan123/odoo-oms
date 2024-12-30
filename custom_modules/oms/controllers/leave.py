import traceback
from datetime import datetime, timedelta
from inspect import trace

from odoo import http, fields
from odoo.exceptions import UserError
from odoo.http import request, Response
import json


class EmployeeLeaveAPI(http.Controller):

    @http.route('/api/employee/leave', auth='public', methods=['POST'], csrf=False, http="json")
    def create_leave(self, **kwargs):
        try:
            data = json.loads(request.httprequest.data)
            print("Received Payload:", data)

            employee_id = data.get('employee_id')
            leave_type_id = data.get('leave_type_id')
            start_date = data.get('start_date')
            end_date = data.get('end_date')

            if not (employee_id and leave_type_id and start_date and end_date):
                return json.dumps({"error": "Missing required parameters."})

            leave_type = request.env['hr.leave.type'].sudo().browse(int(leave_type_id))
            if not leave_type.exists():
                return json.dumps({"error": "Invalid leave type."})

            try:
                start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
                end_datetime = datetime.strptime(end_date, "%Y-%m-%d")

                print("===startdate", start_datetime)
                print("===enddate", end_datetime)
            except ValueError:
                print(traceback.format_exc())
                return json.dumps({"error": "Invalid date format. Use YYYY-MM-DD."})

            if start_datetime > end_datetime:
                return json.dumps({"error": "Start date cannot be after end date."})

            overlapping_leaves = request.env['hr.leave'].sudo().search([
                ('employee_id', '=', employee_id),
                ('state', 'in', ['validate', 'validate1']),  # Only check approved/confirmed leaves
                ('request_date_from', '<=', end_datetime),
                ('request_date_to', '>=', start_datetime)
            ])

            if overlapping_leaves:
                overlapping_periods = []
                for leave in overlapping_leaves:
                    overlapping_periods.append({
                        'leave_id': leave.id,
                        'request_date_from': leave.request_date_from.strftime('%Y-%m-%d') if leave.request_date_from else None,
                        'request_date_end': leave.request_date_to.strftime('%Y-%m-%d') if leave.request_date_from else None,
                    })
                return json.dumps({
                    "error": "Employee has overlapping leave for the following dates:",
                    "overlapping_periods": overlapping_periods
                })


            request.env["hr.leave"].sudo().create({
                'employee_id': employee_id,
                'holiday_status_id': leave_type_id,
                'request_date_from': start_datetime,
                'request_date_to': end_datetime,
            })

            return json.dumps({"success": True})

        except Exception as e:

            print("EXEC: ", traceback.print_exc())
            print("Error:", str(e))
            return json.dumps({"error": "An unexpected error occurred."})



    @http.route('/api/employee/leaves', auth='public', methods=['GET'], csrf=False,http='json')
    def get_leave_history(self, **kwargs):
        print(f"Query Parameters Received: {kwargs}")

        """Retrieve Leave History"""
        try:
            employee_id = kwargs.get('employee_id')
            year=kwargs.get('year',datetime.now().year)

            print(f"Received Employee ID: {employee_id}")

            if not employee_id:
                return json.dumps({"error": "Employee ID must be provided."})
            try:
                year=int(year)
            except ValueError:
                return json.dumps({"error": "Invalid year format. Year must be numeric."})
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"

            domain = [
                ('employee_id', '=', int(employee_id)),
                ('request_date_from', '>=', start_date),
                ('request_date_to', '<=', end_date),
            ]
            print(f"Search Domain: {domain}")

            leaves = request.env['hr.leave'].sudo().search(domain)
            print(f"Found Leaves: {leaves}")

            leave_data = [{
                'id': leave.id,
                'type': leave.holiday_status_id.name,
                'request_date_from': leave.request_date_from.strftime('%Y-%m-%d') if leave.request_date_from else None,
                'request_date_end': leave.request_date_to.strftime('%Y-%m-%d') if leave.request_date_from else None,
                'state': leave.state,
            } for leave in leaves]

            return json.dumps({"leaves": leave_data})

        except Exception as e:
            print("EXEC: ", traceback.print_exc())
            print("Error:", str(e))
            return json.dumps({"error": "An unexpected error occurred."})

    @http.route('/api/employee/balance', auth='public', methods=['GET'], csrf=False)
    def get_leave_balance(self, **kwargs):
        employee_id = kwargs.get('employee_id')
        year = kwargs.get('year', datetime.now().year)  # Default to current year if no year is provided

        if not employee_id:
            return json.dumps({"error": "Employee ID must be provided."})
 
        try:
            year = int(year)
        except ValueError:
            return json.dumps({"error": "Invalid year format. Year must be numeric."})

        # Define the start and end dates for the requested year
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        # Fetch employee's allocated leave for the year
        allocation_rules = request.env['hr.leave.allocation'].sudo().search([
            ('employee_id', '=', int(employee_id)),
            ('date_from', '>=', start_date),
            ('date_to', '<=', end_date)
        ])

        # Calculate the total leave allocation for the year
        allocation_data = []
        for allocation in allocation_rules:
            leave_type = allocation.holiday_status_id
            allocated_leaves = allocation.number_of_days
            taken_leaves = request.env['hr.leave'].sudo().search([
                ('employee_id', '=', employee_id),
                ('holiday_status_id', '=', leave_type.id),
                ('state', 'in', ['validate', 'validate1']),
                ('request_date_from', '>=', start_date),
                ('request_date_to', '<=', end_date)
            ])

            # Calculate total days taken
            total_taken = sum((leave.request_date_to - leave.request_date_from).days + 1 for leave in taken_leaves)

            remaining_balance = allocated_leaves - total_taken

            allocation_data.append({
                'leave_type': leave_type.name,
                'allocated_leaves': allocated_leaves,
                'taken_leaves': total_taken,
                'remaining_leaves': remaining_balance
            })

        return json.dumps({"balances": allocation_data})

    @http.route('/api/employee/leave/cancel', http='json', auth='user', methods=['POST'], csrf=False)
    def cancel_leave(self, leave_id):
        """Cancel a Leave Request"""
        leave = request.env['hr.leave'].sudo().browse(int(leave_id))
        if not leave:
            return {"error": "Leave request not found"}
        if leave.state in ['validate', 'refuse']:
            return {"error": "Cannot cancel an approved or refused leave request"}
        leave.action_refuse()
        return {"success": True, "message": "Leave request canceled successfully"}



"Admin Site  Leave API"
class AdminLeaveAPI(http.Controller):

    @http.route('/api/admin/leaves', http='json', auth='user', methods=['GET'], csrf=False)
    def get_all_leaves(self, **kwargs):
        """Retrieve All Leave Requests"""
        domain = []
        employee_id = kwargs.get('employee_id')
        status = kwargs.get('status')
        if employee_id:
            domain.append(('employee_id', '=', int(employee_id)))
        if status:
            domain.append(('state', '=', status))
        leaves = request.env['hr.leave'].sudo().search(domain)
        leave_data = [{
            'id': leave.id,
            'employee': leave.employee_id.name,
            'type': leave.holiday_status_id.name,
            'start_date':  leave.request_date_from.strftime('%Y-%m-%d') if leave.request_date_from else None,
            'end_date':  leave.request_date_to.strftime('%Y-%m-%d') if leave.request_date_to else None,
            'state': leave.state,
        } for leave in leaves]
        return Response(json.dumps({"leaves": leave_data}), content_type='application/json')



class LeaveController(http.Controller):
    @http.route('/api/admin/leave', http='json', auth='public', methods=['PUT'], csrf=False)
    def manage_leave(self, **kwargs):
        """Approve/Reject a Leave Request"""

        # Fetch parameters from the request
        leave_id = kwargs.get('leave_id')
        action = kwargs.get('action')

        # Validate input parameters
        if not leave_id or not action:
            return {"error": "Missing required parameters 'leave_id' or 'action'"}

        try:
            leave_id = int(leave_id)
        except ValueError:
            return {"error": "Invalid leave_id, must be an integer"}

        leave = request.env['hr.leave'].sudo().browse(leave_id)

        if not leave.exists():
            return {"error": "Leave request not found"}
        if action == 'approve':
            leave.action_approve()
        elif action == 'reject':
            leave.action_refuse()
        else:
            return {"error": "Invalid action. Use 'approve' or 'reject'"}

        return {"success": True, "status": leave.state}

    @http.route('/api/admin/leave', type='json', auth='user', methods=['DELETE'], csrf=False)
    def delete_leave(self, leave_id):
        """Delete a Leave Request"""
        leave = request.env['hr.leave'].sudo().browse(int(leave_id))
        if not leave:
            return {"error": "Leave request not found"}
        leave.unlink()
        return {"success": True, "message": "Leave request deleted"}
