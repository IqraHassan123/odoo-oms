/** @odoo-module */

import { useService } from "@web/core/utils/hooks";
const { Component, useState, onWillStart } = owl;

const leave_status = {
  draft: "To Submit",
  confirm: "To Approve",
  refuse: "Refused",
  validate1: "Second Approval",
  validate: "Approved",
};

export class ManageLeaves extends Component {
  static template = "custom.oms.leave.manage_leaves";

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");

    this.state = useState({
      leaves_to_manage: [],
    });

    onWillStart(async () => {
      if (!this.props.is_a_manager) {
        return;
      }
      await this.get_leaves_to_manage();
    });
  }

  async get_leaves_to_manage() {
    try {
      const leaves = await this.orm.searchRead("hr.leave", [
        ["employee_id", "in", this.props.employee_ids],
      ]);
      const leaves_to_manage = [];
      leaves.forEach((leave) => {
        if (leave.holiday_status_id[1] === "Remote Work") {
          return;
        }
        leaves_to_manage.push({
          id: leave.id,
          employee_name: leave.employee_id[1],
          leave_type: leave.holiday_status_id[1],
          duration: leave.number_of_days,
          status: leave_status[leave.state],
          description: leave.name,
        });
      });
      this.state.leaves_to_manage = leaves_to_manage;
    } catch (error) {
      console.error("Error fetching leave data: ", error);
    }
  }

  openLeaveDetails() {
    this.action.doAction({
      type: "ir.actions.act_window",
      res_model: "hr.leave",
      views: [[false, "form"]],
      target: "new",
    });
  }

  async approveLeave(id) {
    const leave_id = id;
    const res = await this.orm.call("hr.leave", "action_approve", [leave_id]);
    if (res) {
      await this.get_leaves_to_manage();
    }
  }

  async rejectLeave(id) {
    const leave_id = id;
    const res = await this.orm.call("hr.leave", "action_refuse", [leave_id]);
    if (res) {
      await this.get_leaves_to_manage();
    }
  }
}
