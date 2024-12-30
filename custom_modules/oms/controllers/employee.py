from odoo import http
from odoo.http import request, Response
import json


class EmployeeController(http.Controller):

    @http.route('/api/all/employees', auth='public', http='json', methods=['GET'])
    def get_employees(self, **kwargs):
        employees = request.env['hr.employee'].search([])  # Get all employees
        employee_data = []
        for employee in employees:
            employee_data.append({
                'employee_id': employee.id,
                'name': employee.name,
                'job_title': employee.job_title,
                'department': employee.department_id.name,
            })
        return Response(json.dumps({"employee": employee_data}), content_type='application/json')

    @http.route('/api/employees/create', auth='public', http='json', methods=['POST'],csrf=False)
    def create_employee(self, **kwargs):
        data = json.loads(request.httprequest.data)
        employee = request.env['hr.employee'].create({
            'name': data['name'],
            'job_title': data['job_title'],
            'department_id': data['department_id'],
        })
        return Response(json.dumps({'id': employee.id, 'name': employee.name}))

    @http.route('/api/employee/<int:employee_id>', auth='public', http='json', methods=['GET'])
    def get_employee(self, employee_id, **kwargs):
        employee = request.env['hr.employee'].browse(employee_id)
        if not employee.exists():
            return {'error': 'Employee not found'}
        employee_data= {
            'employee_id': employee.id,
            'name': employee.name,
            'job_title': employee.job_title,
            'department': employee.department_id.name,
        }
        return Response(json.dumps(employee_data))

    @http.route('/api/update/employees/<int:employee_id>', auth='public', http='json', methods=['PUT'],csrf=False)
    def update_employee(self, employee_id, **kwargs):
        data = json.loads(request.httprequest.data)
        employee = request.env['hr.employee'].browse(employee_id)
        if not employee.exists():
            return {'error': 'Employee not found'}
        employee.write({
            'name': data.get('name', employee.name),
            'job_title': data.get('job_title', employee.job_title),
            'department_id': data.get('department_id', employee.department_id.id),
        })
        return Response(json.dumps({'employee_id': employee.id, 'name': employee.name}))

    @http.route('/api/delete/employees/<int:employee_id>', auth='public', http='json', methods=['DELETE'],csrf=False)
    def delete_employee(self, employee_id, **kwargs):
        employee = request.env['hr.employee'].browse(employee_id)
        if not employee.exists():
            return {'error': 'Employee not found'}
        employee.unlink()
        return Response(json.dumps({'status': 'Employee deleted successfully'}))
