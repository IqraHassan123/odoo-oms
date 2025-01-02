from odoo import models, fields, api
from odoo.exceptions import UserError


class RemoteWork(models.Model):
    _name = "oms.remote.work"
    _description = "Remote Work"
    employee_id = fields.Many2one("hr.employee", string="Employee", required=True, default=lambda self: self.env.user.employee_id)
    start_date = fields.Date(string="Start Date", required=True)
    end_date = fields.Date(string="End Date", required=True)
    reason = fields.Text(string="Reason", required=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], string='Status', default='draft', required=True)

    @api.model
    def action_approve(self):
        if not self.env.user.has_group('oms.group_remote_work_manager'):
            raise UserError("You do not have permission to approve remote work requests.")
        for record in self:
            if record.state != 'draft':
                raise UserError("Only draft requests can be approved.")
            record.state = 'approved'

    @api.model
    def action_reject(self):
        if not self.env.user.has_group('oms.group_remote_work_manager'):
            raise UserError("You do not have permission to reject remote work requests.")
        for record in self:
            if record.state != 'draft':
                raise UserError("Only draft requests can be rejected.")
            record.state = 'rejected'

    @api.model
    def action_reset_to_draft(self):
        if not self.env.user.has_group('oms.group_remote_work_manager'):
            raise UserError("You do not have permission to reset requests to draft.")
        for record in self:
            if record.state not in ['approved', 'rejected']:
                raise UserError("Only approved or rejected requests can be reset to draft.")
            record.state = 'draft'