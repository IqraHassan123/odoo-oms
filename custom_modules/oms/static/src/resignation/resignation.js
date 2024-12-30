/** @odoo-module */

const { Component, useState, onWillStart } = owl;
import { useService } from "@web/core/utils/hooks";
import { SideBar } from "../js/sections/sidebar/sidebar";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { MyResignations } from "./components/my_resignations";

export class Resignation extends Component {
  static template = "custom.oms.resignation";
  static components = { SideBar, MyResignations };

  setup() {
    this.orm = useService("orm");
    this.actionService = useService("action");
    this.state = useState({
      showModal: false,
      _notice_period: 0,
      _reason: "",
      employee_id: 0,
    });

    onWillStart(async () => {
      const employee_id = await this.get_employee_id();
      this.state.employee_id = employee_id;
    });
  }

  toggleModal() {
    this.state.showModal = !this.state.showModal;
  }

  async applyForResignation() {
    const { _notice_period, _reason } = this.state;
    if (!_notice_period || !_reason) {
      this.send_notification("Error", "Please fill all fields");
      return;
    }

    await this.orm.create("oms.resignation", [
      {
        notice_period: _notice_period,
        reason: _reason,
        state: "draft",
        resignation_date: new Date(),
      },
    ]);

    this.send_notification(
      "Success",
      "Resignation request submitted successfully"
    );
    this.toggleModal();
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

  async get_employee_id() {
    const user_id = user.userId;
    const user_info = await this.orm.searchRead("res.users", [
      ["id", "=", user_id],
    ]);
    const _partner_info = user_info[0];
    const employee_id = _partner_info?.employee_ids[0];
    return employee_id;
  }

  openDashboard() {
    this.actionService.doAction({
      type: "ir.actions.client",
      tag: "oms.main_view",
    });
  }

  openResgination() {
    this.actionService.doAction({
      type: "ir.actions.client",
      tag: "oms.resignation_view",
    });
  }
}

registry.category("actions").add("oms.resignation_view", Resignation);
