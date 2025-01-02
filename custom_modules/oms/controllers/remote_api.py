import logging

from odoo import http,fields
from odoo.http import request, Response
import json

#class RemoteWorkCheckinAPI(http.Controller):
#
#     @http.route('/api/remote_work/check_in', http='json', auth='public', methods=['POST'], csrf=False)
#     def remote_check_in(self):
#         employee = request.env.user.employee_id
#         if not employee:
#             return {'error': 'Employee not found'}
#
#         _logger = logging.getLogger(__name__)
#         _logger.info(f"Employee ID: {employee.id}")
#
#         attendance = request.env['hr.attendance'].search([
#             ('employee_id', '=', employee.id),
#             ('check_out', '=', False)
#         ], limit=1)
#
#         if attendance:
#             return {'error': 'Already checked in'}
#
#         request.env['hr.attendance'].create({
#             'employee_id': employee.id,
#             'check_in': fields.Datetime.now(),
#             'is_remote': True,
#         })
#         return Response(json.dumps({'status': 'Checked in for remote work', 'employee_id': employee.id}))
#
#     @http.route('/api/remote_work/check_out', http='json', auth='public', methods=['POST'], csrf=False)
#     def remote_check_out(self):
#         employee = request.env.user.employee_id
#         if not employee:
#             return {'error': 'Employee not found'}
#
#
#         attendance = request.env['hr.attendance'].search([
#             ('employee_id', '=', employee.id),
#             ('check_out', '=', False)
#         ], limit=1)
#
#         if not attendance:
#             return {'error': 'No active check-in record'}
#
#         attendance.write({'check_out': fields.Datetime.now()})
#         return Response(json.dumps({'status': 'Checked out from remote work', 'employee_id': employee.id}))
#
#
#     @http.route('/api/remote_work/records', http='json', auth='public', methods=['GET'], csrf=False)
#     def fetch_remote_work_records(self, employee_id=None):
#         domain = [('is_remote', '=', True)]
#         if employee_id:
#             domain.append(('employee_id', '=', employee_id))
#
#         records = request.env['hr.attendance'].search(domain)
#         attendance_list = []
#         for record in records:
#             attendance_list.append({
#                 'employee_id': record.employee_id.id,
#                 'employee_name': record.employee_id.name,
#                 'check_in': record.check_in.strftime('%Y-%m-%d %H:%M:%S') if record.check_in else None,
#                 'check_out': record.check_out.strftime('%Y-%m-%d %H:%M:%S') if record.check_out else None,
#                 'is_remote': record.is_remote,
#             })
#
#         return Response(json.dumps({'remote_work_records': attendance_list}))

class RemoteWorkAPI(http.Controller):

    @http.route('/api/remote_work/request', http='json', auth='public', methods=['POST'], csrf=False)
    def request_homeworking(self, **kwargs):
        data = json.loads(request.httprequest.data)

        employee_id = data.get('employee_id')
        start_date = data.get('start_date')
        end_date=data.get('end_date')
        reason = data.get('reason')


        if not employee_id or not start_date or not end_date:
            return request.make_response(
                json.dumps({'error': 'employee_id and start end date are required'}),
                headers={'Content-Type': 'application/json'},
                status=400
            )


        employee = request.env['hr.employee'].sudo().browse(employee_id)
        if not employee.exists():
            return request.make_response(
                json.dumps({'error': 'Employee not found'}),
                headers={'Content-Type': 'application/json'},
                status=404
            )


        try:
            homeworking_request = request.env['oms.remote.work'].sudo().create({
                'employee_id': employee.id,
                'start_date': start_date,
                'end_date': end_date,
                'reason': reason,
                'state': 'draft',
            })

            return request.make_response(
                json.dumps({
                    'success': True,
                    'request_id': homeworking_request.id,
                    'employee_id': employee_id,
                    'start_date': start_date,
                    'end_date': end_date,
                    'reason': reason,
                    'state': homeworking_request.state,
                }),
                headers={'Content-Type': 'application/json'},
                status=201
            )

        except Exception as e:
            return request.make_response(
                json.dumps({'error': str(e)}),
                headers={'Content-Type': 'application/json'},
                status=500
            )


    @http.route('/api/remote_work/get', http='json', auth='public', methods=['GET'], csrf=False)
    def get_homeworking_requests(self, **kwargs):
        state = kwargs.get('state')

        domain = []
        if state:
            domain.append(('state', '=', state))

        requests = request.env['oms.remote.work'].sudo().search(domain)

        data = []
        for hw_request in requests:
            data.append({
                'request_id': hw_request.id,
                'employee_id': hw_request.employee_id.id,
                'employee_name': hw_request.employee_id.name,
                'start_date': hw_request.start_date.strftime('%Y-%m-%d') if hw_request.start_date else None,
                'end_date': hw_request.end_date.strftime('%Y-%m-%d') if hw_request.end_date else None,
                'reason': hw_request.reason,
                'state': hw_request.state,
            })

        return Response(json.dumps({'homeworking_requests': data}))

