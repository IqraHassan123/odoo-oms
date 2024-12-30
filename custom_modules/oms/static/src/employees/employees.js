/** @odoo-module */

const { Component, useState, onWillStart } = owl;
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";

import { SideBar } from "../js/sections/sidebar/sidebar";

export class Employees extends Component {
  static template = "custom.oms.employees";
  static components = { SideBar };

  setup() {
    this.orm = useService("orm");
    this.actionService = useService("action");
    this.state = useState({
      employees: [],
    });

    onWillStart(async function () {
      await this.get_employees();
    });
  }

  async get_employees() {
    const current_logged_in_employee = await this.orm.searchRead("hr.employee", [
      ["user_id", "=", user.userId],
    ]);

    const curr_job_title = current_logged_in_employee[0].job_id[1];
    console.log("current_logged_in_employee", current_logged_in_employee);

    let domain = [];
    if (curr_job_title === "Chief Executive Officer") {
      domain = [];
    } else {
      domain = [["id", "=", current_logged_in_employee[0].id]];
    }

    let employees = await this.orm.searchRead("hr.employee", domain);

    employees.sort((a, b) => a.id - b.id);

    employees.forEach((employee) => {
      employee.avatar_char = employee.name[0];
      employee.contact_details =
        employee.work_email || employee.work_phone || employee.mobile_phone;
      employee.joining_date = employee.create_date.split(" ")[0];
      employee.role = employee.job_id[1];
      employee.superviser = employee.parent_id[1];
    });

    this.state.employees = employees;
  }

  async action_view_employee(id) {
    await this.actionService.doAction({
      type: "ir.actions.act_window",
      res_model: "hr.employee",
      views: [[false, "form"]],
      res_id: id,
      target: "new",
    });
  }

  async action_delete_employee(id) {
    await this.orm.unlink("hr.employee", [id]);
    await this.get_employees();
    this.send_notification("Success", "Employee deleted successfully");
  }

  async onClickDashboard() {
    await this.actionService.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.main_view",
      },
      {
        clearBreadcrumbs: false,
      }
    );
  }

  async onClickApp(tag) {
    await this.actionService.doAction(
      {
        type: "ir.actions.client",
        tag: tag,
      },
      {
        clearBreadcrumbs: false,
      }
    );
  }

  async send_notification(title, message) {
    const parms = {
      type: "ir.actions.client",
      tag: "display_notification",
      params: {
        title: `${title}`,
        message: `${message}`,
        sticky: false,
      },
    };

    this.actionService.doAction(parms);
  }
}

registry.category("actions").add("oms.employees_view", Employees);
