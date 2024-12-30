/** @odoo-module */

const { Component, useState, useRef } = owl;
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";

import { SideBar } from "../js/sections/sidebar/sidebar";

export class Settings extends Component {
  static template = "custom.oms.settings";
  static components = { SideBar };

  setup() {
    this.charRef = useRef("button");
    this.state = useState({
      name: "",
      phone: "",
    });

    this.orm = useService("orm");
    this.actionService = useService("action");
  }

  async saveChanges(e) {
    e.preventDefault();
    const submit_button = this.charRef.el;
    submit_button.disabled = true;

    if (!this.state.name && !this.state.phone) {
      this.send_notification("Error", "Please fill all fields");
      submit_button.disabled = false;
      return;
    }

    try {
      const { name, phone } = this.state;
      const values = {};
      if (name) {
        values.name = name;
      }
      if (phone) {
        values.phone = phone;
      }

      const user_id = user.userId;
      const user_info = await this.orm.searchRead("res.users", [
        ["id", "=", user_id],
      ]);
      const _partner_info = user_info[0];
      const employee_id = _partner_info?.employee_ids[0];
      const employee_info = await this.orm.searchRead("hr.employee", [
        ["id", "=", employee_id],
      ]);
      const _employee_info = employee_info[0];

      await this.orm.write("hr.employee", [_employee_info.id], values);
      this.send_notification("Success", "Changes saved successfully");
    } catch (e) {
      this.send_notification("Error", "An error occurred while saving changes");
    }

    this.state.name = "";
    this.state.phone = "";
    submit_button.disabled = false;
  }

  openDashboard() {
    this.actionService.doAction({
      type: "ir.actions.client",
      tag: "oms.main_view",
    });
  }

  openSettings() {
    this.actionService.doAction({
      type: "ir.actions.client",
      tag: "oms.settings_view",
    });
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

registry.category("actions").add("oms.settings_view", Settings);
