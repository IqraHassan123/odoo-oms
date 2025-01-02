from odoo import http
from odoo.http import request, Response
import json


class EmployeeController(http.Controller):

    @http.route('/api/all/employees', auth='public', http='json', methods=['GET'])
    def get_employees(self, **kwargs):
        user = request.env.user
        print("== User:", user)

        if not user.employee_ids:
            print("No employee linked to user")
            return Response(
                json.dumps({"error": "You do not have permission to view employee data.abcde"}),
                content_type='application/json',
                status=403
            )

        employee = user.employee_ids[0]
        user_role = employee.job_id.name if employee.job_id else None
        print("User Role:", user_role)

        allowed_roles = ['Human Resources Manager', 'Chief Executive Officer']

        if user_role not in allowed_roles:
            own_employee_data={
                'employee_id': employee.id,
                'name': employee.name,
                'job_id': employee.job_id.name if employee.job_id else None,
                'department': employee.department_id.name if employee.department_id else None,
            }
            print("Access Denied for Role:", user_role)
            return Response(
                json.dumps({"employee": own_employee_data}),
                content_type='application/json',
                status=200
            )

        employees = request.env['hr.employee'].search([])
        print("Employees Found:", employees)
        employee_data = []
        for employee in employees:
            employee_data.append({
                'employee_id': employee.id,
                'name': employee.name,
                'job_title': employee.job_id.name if employee.job_id else None,
                'department': employee.department_id.name if employee.department_id else None,
            })

        print("Employee Data:", employee_data)
        return Response(
            json.dumps({"employees": employee_data}),
            content_type='application/json',
            status=200
        )


    @http.route('/api/employees/create', auth='public', http='json', methods=['POST'],csrf=False)
    def create_employee(self, **kwargs):
     try:
        data = json.loads(request.httprequest.data)
        name=data.get('name')
        job_title=data.get('job_title')
        department_id=data.get('department_id')
        if not name or not job_title or not department_id:
            return Response(
                json.dumps({'error': 'Missing required fields: name, department_id'}),
                content_type='application/json',
                status=400
            )
        department = request.env['hr.department'].sudo().browse(department_id)
        if not department.exists():
            return Response(
                json.dumps({'error': 'Invalid department_id'}),
                content_type='application/json',
                status=400
            )

        employee = request.env['hr.employee'].sudo().create({
            'name': data['name'],
            'job_title': data['job_title'],
            'department_id': data['department_id'],
        })
        return Response(json.dumps({'id': employee.id, 'name': employee.name}))

     except Exception as e:
      return Response(
        json.dumps({'error': str(e)}),
        content_type='application/json',
        status=500
      )

    # @http.route('/api/employee/<int:employee_id>', auth='public', http='json', methods=['GET'])
    # def get_employee(self, employee_id, **kwargs):
    #     employee = request.env['hr.employee'].browse(employee_id)
    #     if not employee.exists():
    #         return {'error': 'Employee not found'}
    #     employee_data= {
    #         'employee_id': employee.id,
    #         'name': employee.name,
    #         'job_title': employee.job_title,
    #         'department': employee.department_id.name,
    #     }
    #     return Response(json.dumps(employee_data))

    @http.route('/api/update/employees/<int:employee_id>', auth='public', http='json', methods=['PUT'],csrf=False)
    def update_employee(self, employee_id,**kwargs):
        data = json.loads(request.httprequest.data)
        employee = request.env['hr.employee'].sudo().browse(employee_id)
        if not employee.exists():
            return Response(
                json.dumps({'error': 'Employee not found'}),
                content_type='application/json',
                status=404
            )
        employee.write({
            'name': data.get('name', employee.name),
            'job_title': data.get('job_title', employee.job_title),
            'department_id': data.get('department_id', employee.department_id.id),
        })
        return Response(json.dumps({'employee_id': employee.id, 'name': employee.name}))

    @http.route('/api/delete/employees/<int:employee_id>', auth='public', http='json', methods=['DELETE'],csrf=False)
    def delete_employee(self, employee_id, **kwargs):
        employee = request.env['hr.employee'].sudo().browse(employee_id)
        if not employee.exists():
            return {'error': 'Employee not found'}
        employee.unlink()
        return Response(json.dumps({'status': 'Employee deleted successfully'}))
