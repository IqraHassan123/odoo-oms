from odoo import models, api, fields

class Resignation(models.Model):
    _name = "oms.resignation"
    _description = "Resignation"

    name = fields.Char(string="Name", required=True)
    employee_id = fields.Many2one("hr.employee", string="Employee", required=True, default=lambda self: self.env.user.employee_id)
    notice_period = fields.Integer(string="Notice Period", required=True)
    resignation_date = fields.Date(string="Resignation Date", required=True)
    reason = fields.Text(string="Reason", required=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], string='Status', default='draft', required=True)
    
    @api.model
    def create(self, vals):
        if vals.get('name', 'New') == 'New':
            vals['name'] = self.env['ir.sequence'].next_by_code('oms.resignation') or 'New'
        return super(Resignation, self).create(vals)

    def action_approve(self):
        self.state = 'approved'

    def action_reject(self):
        self.state = 'rejected'

    def action_reset_draft(self):
        self.state = 'draft'

