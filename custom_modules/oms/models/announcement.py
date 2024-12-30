from odoo import models, api, fields

class Announcement(models.Model):
    _name = 'oms.announcement'
    _description = 'Announcement'

    name = fields.Char('Title', required=True)
    description = fields.Text('Description')
    is_active = fields.Boolean('Active', default=True)
    date = fields.Date('Date', default=fields.Date.today)
