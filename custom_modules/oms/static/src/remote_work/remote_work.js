/** @odoo-module */

const { Component, useState, onWillStart } = owl;
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";

import { registry } from "@web/core/registry";
import { SideBar } from "../js/sections/sidebar/sidebar";
import { MyRemoteWork } from "./components/my_remote_work";
import { ManageRemoteWork } from "./components/manage_remote_work";

const leave_status = {
  draft: "To Submit",
  confirm: "To Approve",
  refuse: "Refused",
  validate1: "Second Approval",
  validate: "Approved",
};

export class RemoteWork extends Component {
  static template = "custom.oms.remote_work";
  static components = { SideBar, MyRemoteWork, ManageRemoteWork };

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");

    this.state = useState({
      employee_info: {},
      remote_applications: [],
      is_a_manager: true,
      total_applications: 0,
      employee_ids: [],
      remote_work_time_off_id: 0,
    });

    onWillStart(async () => {
      await this.get_employee_info();
      await this.get_remote_applications();
      await this.get_employees_to_manage();
      await this.find_remote_work_time_off_id();
      this.state.is_a_manager = await this.is_a_manager();
    });
  }

  async find_remote_work_time_off_id() {
    // const remote_work_time_off = await this.orm.searchRead("hr.leave.type", [
    //   ["name", "=", "Remote Work"],
    // ]);
    this.state.remote_work_time_off_id = 10;
    // this.state.remote_work_time_off_id = remote_work_time_off[0].id;
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

  async get_remote_applications() {
    let _applications = [];
    let applications = await this.orm.searchRead("hr.leave", [
      ["employee_id", "=", this.state.employee_info.id],
    ]);
    applications = this.filter_applications_for(applications);

    const leave_manager = this.state.employee_info.leave_manager_id[1];
    applications.forEach((application) => {
      _applications.push({
        id: application.id,
        leave_type: application.holiday_status_id[1],
        date: `${application.date_from.slice(
          0,
          10
        )} :: ${application.date_to.slice(0, 10)}`,
        duration: application.number_of_days,
        status: leave_status[application.state],
        leave_manager: leave_manager,
        description: application.name,
      });
    });

    this.state.remote_applications = _applications;
    this.state.total_applications = _applications.length;
  }

  filter_applications_for(applications) {
    return applications.filter(
      (app) => app.holiday_status_id[1] === "Remote Work"
    );
  }

  async onClickApplyForRemote() {
    this.action.doAction(
      {
        type: "ir.actions.act_window",
        res_model: "hr.leave",
        views: [[false, "form"]],
        target: "new",
        domain: [["holiday_status_id", "=", this.state.remote_work_time_off_id]],
      },
      {
        additionalContext: {
          default_holiday_status_id: this.state.remote_work_time_off_id,
          default_employee_id: this.state.employee_info.id,
        },
        additionalDomain: [["holiday_status_id", "=", this.state.remote_work_time_off_id]],
        onClose: async () => {
          await this.get_remote_applications();
        },
      }
    );
  }

  async get_employees_to_manage() {
    const employees = await this.orm.searchRead("hr.employee", [
      ["leave_manager_id", "=", user.userId],
    ]);
    const _em = employees.map((emp) => emp.id);
    this.state.employee_ids = _em;
  }

  openDashboard() {
    this.action.doAction({
      type: "ir.actions.client",
      tag: "oms.main_view",
    });
  }

  openRemoteWork() {
    this.action.doAction({
      type: "ir.actions.client",
      tag: "oms.remote_work_view",
    });
  }
}

registry.category("actions").add("oms.remote_work_view", RemoteWork);
