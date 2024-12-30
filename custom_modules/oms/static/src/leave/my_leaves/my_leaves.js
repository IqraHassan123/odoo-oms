/** @odoo-module */

import { useService } from "@web/core/utils/hooks";
const { Component, onWillStart, useState } = owl;
import { user } from "@web/core/user";
import { registry } from "@web/core/registry";

const leave_status = {
  draft: "To Submit",
  confirm: "To Approve",
  refuse: "Refused",
  validate1: "Second Approval",
  validate: "Approved",
};

export class MyLeaves extends Component {
  static template = "custom.oms.leave.my_leaves";

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");
    this.state = useState({
      leaves: [],
      employee_info: {},
      total_leaves: 0,
    });

    onWillStart(async () => {
      await this.get_employee_info();
      await this.get_info();
      await this.sync_leaves();
    });
  }

  async get_info() {
    try {
      const data = await this.orm.searchRead("hr.leave", [
        ["employee_id", "=", this.state.employee_info.id],
      ]);
      const leaves = [];
      const leave_manager = this.state.employee_info.leave_manager_id[1];
      data.forEach((leave) => {
        if (leave.holiday_status_id[1] === "Remote Work") {
          return;
        }
        leaves.push({
          id: leave.id,
          leave_type: leave.holiday_status_id[1],
          duration: leave.number_of_days,
          status: leave_status[leave.state],
          leave_manager: leave_manager,
        });
      });
      this.state.leaves = leaves;
      this.state.total_leaves = leaves.length;
    } catch (error) {
      if (this.sync_l) {
        clearInterval(this.sync_l);
      }
      console.error("Error fetching leave data: ", error);
    }
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

  async sync_leaves() {
    this.sync_l = setInterval(async () => {
      try {
        await this.get_info();
      } catch (error) {
        console.error("Error syncing leaves: ", error);
        clearInterval(this.sync_l);
      }
    }, 1000);
  }
}
