from odoo import models, api, fields, _

class HRAttendance(models.Model):
    _inherit = 'hr.attendance'
    
    worked_time_detailed = fields.Char(string='Worked Time Detailed', compute='_compute_worked_time_detailed', store=True, readonly=True)
    is_remote = fields.Boolean(string="Remote Work", default=False)
    @api.depends('worked_hours')
    def _compute_worked_time_detailed(self):
        for attendance in self:
            if attendance.worked_hours:
                total_seconds = int(attendance.worked_hours * 3600)
                hours, remainder = divmod(total_seconds, 3600)
                minutes, seconds = divmod(remainder, 60)
                attendance.worked_time_detailed = f"{hours:02}:{minutes:02}:{seconds:02}"
            else:
                attendance.worked_time_detailed = "00:00:00"
