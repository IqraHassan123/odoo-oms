from odoo import http

route = http.route
class Controller(http.Controller):
    
    @route('/oms/hello', auth='public')
    def hello(self):
        return "Hello, world"
    



