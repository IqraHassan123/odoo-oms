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
            employee_id = request.httprequest.args.get('employee_id')
            year=request.httprequest.args.get('year',datetime.now().year)

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
        year = kwargs.get('year', datetime.now().year)

        if not employee_id:
            return json.dumps({"error": "Employee ID must be provided."})
 
        try:
            year = int(year)
        except ValueError:
            return json.dumps({"error": "Invalid year format. Year must be numeric."})

        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        allocation_rules = request.env['hr.leave.allocation'].sudo().search([
            ('employee_id', '=', int(employee_id)),
            ('date_from', '>=', start_date),
            ('date_to', '<=', end_date)
        ])

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
        leave = request.env['hr.leave'].sudo().browse(int(leave_id))
        if not leave:
            return {"error": "Leave request not found"}
        if leave.state in ['validate', 'refuse']:
            return {"error": "Cannot cancel an approved or refused leave request"}
        leave.action_refuse()
        return {"success": True, "message": "Leave request canceled successfully"}



"Admin Site  Leave API"
class AdminLeaveAPI(http.Controller):

    @http.route('/api/admin/leaves', http='json', auth='public', methods=['GET'], csrf=False)
    def get_all_leaves(self, **kwargs):
        user=request.env.user

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

# class LeaveController(http.Controller):
#     @http.route('/api/manage/leave', http='json', auth='public', methods=['PUT'], csrf=False)
#     def manage_leave(self, **kwargs):
#         """Approve/Reject a Leave Request"""
#
#         # Extract employee_id from the request body
#         employee_id = kwargs.get('employee_id')
#         if not employee_id:
#             return Response(
#                 json.dumps({"error": "Employee ID is required."}),
#                 content_type='application/json',
#                 status=400
#             )
#
#         # Validate employee_id
#         try:
#             employee_id = int(employee_id)
#         except ValueError:
#             return {"error": "Invalid employee_id, must be an integer"}
#
#         employee = request.env['hr.employee'].sudo().browse(employee_id)
#         if not employee.exists():
#             return {"error": "Employee not found"}
#
#         # Role validation
#         user_role = employee.job_id.name if employee.job_id else None
#         allowed_roles = ['Human Resources Manager']
#         if user_role not in allowed_roles:
#             return Response(
#                 json.dumps({"error": "You do not have permission to manage leave requests."}),
#                 content_type='application/json',
#                 status=403
#             )
#
#         # Extract and validate leave_id and action
#         leave_id = kwargs.get('leave_id')
#         action = kwargs.get('action')
#         if not leave_id or not action:
#             return {"error": "Missing required parameters 'leave_id' or 'action'"}
#
#         try:
#             leave_id = int(leave_id)
#         except ValueError:
#             return {"error": "Invalid leave_id, must be an integer"}
#
#         leave = request.env['hr.leave'].sudo().browse(leave_id)
#         if not leave.exists():
#             return {"error": "Leave request not found"}
#
#         # Perform the action
#         if action == 'approve':
#             leave.action_approve()
#         elif action == 'reject':
#             leave.action_refuse()
#         else:
#             return {"error": "Invalid action. Use 'approve' or 'reject'"}
#
#         # Return success response
#         return {"success": True, "status": leave.state}

class LeaveController(http.Controller):
    @http.route('/api/manage/leave', http='json', auth='public', methods=['PUT'], csrf=False)
    def manage_leave(self, **kwargs):
        """Approve/Reject a Leave Request"""
        try:
            data = json.loads(request.httprequest.data)
            print("Received Data:", data)

            employee_id = data.get('employee_id')
            if not employee_id:
                return Response(
                    json.dumps({"error": "Employee ID is required."}),
                    content_type='application/json',
                    status=400
                )

            employee_id = int(employee_id)
            employee = request.env['hr.employee'].sudo().browse(employee_id)
            if not employee.exists():
                return Response(
                    json.dumps({"error": "Employee not found"}),
                    content_type='application/json',
                    status=404
                )

            manager = employee.parent_id
            print("===Manager:", manager)

            if not manager:
                return Response(
                    json.dumps({"error": "Employee does not have a manager assigned."}),
                    content_type='application/json',
                    status=400
                )

            current_user = request.env.user
            if current_user.id != manager.user_id.id:
                user_role = employee.job_id.name if employee.job_id else None
                allowed_roles = ['Human Resources Manager', 'Chief Executive Officer']
                if user_role not in allowed_roles:
                    return Response(
                        json.dumps({"error": "You do not have permission to manage leave requests."}),
                        content_type='application/json',
                        status=403
                    )

            leave_id = data.get('leave_id')
            action = data.get('action')
            if not leave_id or not action:
                return Response(
                    json.dumps({"error": "Missing required parameters 'leave_id' or 'action'."}),
                    content_type='application/json',
                    status=400
                )
            leave_id = int(leave_id)
            leave = request.env['hr.leave'].sudo().browse(leave_id)
            if not leave.exists():
                return Response(
                    json.dumps({"error": "Leave request not found"}),
                    content_type='application/json',
                    status=404
                )

            if action == 'approve':
                leave.action_approve()
            elif action == 'reject':
                leave.action_refuse()
            else:
                return Response(
                    json.dumps({"error": "Invalid action. Use 'approve' or 'reject'."}),
                    content_type='application/json',
                    status=400
                )

            return Response(
                json.dumps({"success": True, "status": leave.state}),
                content_type='application/json',
                status=200
            )

        except Exception as e:
            return Response(
                json.dumps({"error": f"An unexpected error occurred: {str(e)}"}),
                content_type='application/json',
                status=500
            )

    @http.route('/api/employee/leaves', auth='user', methods=['GET'], csrf=False, http='json')
    def get_employee_leaves(self, **kwargs):
        try:
            employee_id = request.env.user.employee_id.id
            employee = request.env['hr.employee'].sudo().browse(employee_id)

            if not employee.exists():
                return Response(
                    json.dumps({"error": "Employee not found"}),
                    content_type='application/json',
                    status=404
                )

            manager = employee.parent_id

            if not manager:
                return Response(
                    json.dumps({"error": "Employee does not have a manager assigned."}),
                    content_type='application/json',
                    status=400
                )

            leaves = request.env['hr.leave'].sudo().search([('employee_id', '=', employee.id)])

            leave_data = [{
                'id': leave.id,
                'type': leave.holiday_status_id.name,
                'request_date_from': leave.request_date_from.strftime('%Y-%m-%d') if leave.request_date_from else None,
                'request_date_end': leave.request_date_to.strftime('%Y-%m-%d') if leave.request_date_from else None,
                'state': leave.state,
            } for leave in leaves]

            return Response(
                json.dumps({"leaves": leave_data}),
                content_type='application/json',
                status=200
            )

        except Exception as e:
            return Response(
                json.dumps({"error": f"An unexpected error occurred: {str(e)}"}),
                content_type='application/json',
                status=500
            )

    @http.route('/api/admin/leave', type='json', auth='user', methods=['DELETE'], csrf=False)
    def delete_leave(self, leave_id):
        leave = request.env['hr.leave'].sudo().browse(int(leave_id))
        if not leave:
            return {"error": "Leave request not found"}
        leave.unlink()
        return {"success": True, "message": "Leave request deleted"}
