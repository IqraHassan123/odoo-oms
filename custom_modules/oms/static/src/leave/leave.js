/** @odoo-module */

import { useService } from "@web/core/utils/hooks";
const { Component, onWillStart, useState } = owl;
import { user } from "@web/core/user";
import { registry } from "@web/core/registry";

import { MyLeaves } from "./my_leaves/my_leaves";
import { ManageLeaves } from "./manage_leaves/manage_leaves";
import { SideBar } from "../js/sections/sidebar/sidebar";

export class Leave extends Component {
  static template = "custom.oms.leave";
  static components = { MyLeaves, ManageLeaves, SideBar };

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");
    this.state = useState({
      is_a_manager: false,
      employee_info: {},
      employee_ids: [],
    });

    onWillStart(async () => {
      await this.get_employee_info();
      await this.get_employees_to_manage();
      this.state.is_a_manager = await this.is_a_manager();
    });
  }

  async get_employee_info() {
    const user_id = user.partnerId;
    const user_info = await this.orm.searchRead("res.partner", [
      ["id", "=", user_id],
    ]);
    const _partner_info = user_info[0];
    const employee_id = _partner_info.employee_ids[0];
    const employee_info = await this.orm.searchRead("hr.employee", [
      ["id", "=", employee_id],
    ]);
    const _employee_info = employee_info[0];

    this.state.employee_info = _employee_info;
  }
  async is_a_manager() {
    const manager = await this.orm.searchRead("hr.employee", [
      ["leave_manager_id", "=", user.userId],
    ]);
    return manager.length > 0;
  }

  async get_employees_to_manage() {
    const employees = await this.orm.searchRead("hr.employee", [
      ["leave_manager_id", "=", user.userId],
    ]);
    const _em = employees.map((emp) => emp.id);
    this.state.employee_ids = _em;
  }

  async apply_leave() {
    const action = {
      type: "ir.actions.act_window",
      res_model: "hr.leave",
      views: [[false, "form"]],
      target: "new",
    };
    this.action.doAction(action);
  }

  openDashboard() {
    this.action.doAction({
      type: "ir.actions.client",
      tag: "oms.main_view",
    });
  }

  openLeave() {
    this.action.doAction({
      type: "ir.actions.client",
      tag: "oms.leave_view",
    });
  }
}

registry.category("actions").add("oms.leave_view", Leave);
