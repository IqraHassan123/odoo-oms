from odoo import models, fields
import pytz
from datetime import datetime

class EmployeeModelExtended(models.Model):
    _inherit = 'hr.employee'

    def _compute_hours_today(self):
        now = fields.Datetime.now()
        now_utc = pytz.utc.localize(now)

        for employee in self:
            tz = pytz.timezone(employee.tz or 'UTC')
            now_tz = now_utc.astimezone(tz)
            start_tz = now_tz.replace(hour=0, minute=0, second=0, microsecond=0)
            start_naive = start_tz.astimezone(pytz.utc).replace(tzinfo=None)
            earliest_break = self.env['break.schedule'].search([
                ('employee_id', '=', employee.id),
                ('start_time', '>=', start_naive),
                ('start_time', '<=', now)
            ], order='start_time asc', limit=1)
            today_start_naive = earliest_break.start_time or start_naive
            attendances = self.env['hr.attendance'].search([
                ('employee_id', '=', employee.id),
                ('check_in', '>=', start_naive),
                ('check_in', '<=', now)
            ], order='check_in asc')
            break_times = self.env['break.schedule'].search([
                ('employee_id', '=', employee.id),
                ('start_time', '>=', today_start_naive),
            ])

            for break_time in break_times:
                is_break_time_none = False
                if not break_time.end_time:
                    continue # IF NOT END TIME, SKIP CALCULATING BREAK HOURS, CALCULATE IT WHEN END TIME IS SET
                    is_break_time_none = True
                    break_time.update({"end_time": now})
                
                break_time.update({"break_hours": (break_time.end_time - break_time.start_time).total_seconds() / 3600.0})
                if is_break_time_none:
                    break_time.update({"end_time": False})
                
            total_break_hours_today = sum(break_time.break_hours for break_time in break_times)

            worked_hours = 0
            last_attendance_worked_hours = 0

            for attendance in attendances:
                attendance_duration = (attendance.check_out or now) - max(attendance.check_in, start_naive)
                attendance_worked_hours = attendance_duration.total_seconds() / 3600.0

                worked_hours += attendance_worked_hours
                last_attendance_worked_hours = attendance_worked_hours

            worked_hours -= total_break_hours_today
            hours_previously_today = worked_hours - last_attendance_worked_hours

            employee.last_attendance_worked_hours = last_attendance_worked_hours
            employee.hours_previously_today = max(0, hours_previously_today)
            employee.hours_today = max(0, worked_hours)

            # print("Hours today ========>", employee.hours_today)

    def get_day_bounds(self):
        dt = datetime.now()
        start_of_day = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        return (start_of_day.strftime("%Y-%m-%d %H:%M:%S"), end_of_day.strftime("%Y-%m-%d %H:%M:%S"))