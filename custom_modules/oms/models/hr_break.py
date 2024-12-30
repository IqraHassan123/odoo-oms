from odoo import fields, models, api, exceptions, _
from datetime import timedelta

class BreakSchedule(models.Model):
    _name = "break.schedule"
    _description = "Break Schedule"
    employee_id = fields.Many2one('hr.employee', string="Employee", required=False, ondelete='cascade', index=True, default=lambda self: self.env.user.employee_id)
    start_time=fields.Datetime(string='Start Time', required=False, default=fields.Datetime.now)
    end_time=fields.Datetime(string='End Time', required=False)
    type = fields.Selection(
        string='Break Type', selection=[
            ('prayer', 'Prayer'), ('lunch', 'Lunch'),
        ],
        required=True, default='prayer'
    )

    break_hours = fields.Float(string="Break Hours", compute="_compute_break_hours", store=True)

    @api.depends('start_time', 'end_time')
    def _compute_break_hours(self):
        for record in self:
            if record.end_time and record.start_time:
                if record.end_time < record.start_time:
                    record.end_time = False
                    raise exceptions.ValidationError(_("End Time must be greater than Start Time"))
            if record.start_time and record.type and record.end_time:
                duration = record.end_time - record.start_time
                record.break_hours = duration.total_seconds() / 3600
            else:
                record.break_hours = 0.0
    
    def end_break(self):
        self.end_time = fields.Datetime.now()
        return True

    @api.model
    def create(self, values):
        if values.get("end_time") and values.get("start_time"):    
            if values["end_time"] < values["start_time"]:
                raise exceptions.ValidationError(_("End Time must be greater than Start Time"))

        return super(BreakSchedule, self).create(values)

    def write(self, vals):
        if vals.get("end_time") and vals.get("start_time"):
            if vals["end_time"] < vals["start_time"]:
                raise exceptions.ValidationError(_("End Time must be greater than Start Time"))

        return super(BreakSchedule, self).write(vals)
