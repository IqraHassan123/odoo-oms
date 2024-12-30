/** @odoo-module */

const { Component, useState, onWillStart } = owl;
import { useService } from "@web/core/utils/hooks";

const leave_status = {
  draft: "To Submit",
  confirm: "To Approve",
  refuse: "Refused",
  validate1: "Second Approval",
  validate: "Approved",
};

export class ManageRemoteWork extends Component {
  static template = "custom.oms.remote_work.manage_remote_work";

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");
    this.state = useState({ remote_applications_to_manage: [] });

    onWillStart(async () => {
      if (!this.props.is_a_manager) {
        return;
      }
      await this.get_remote_leaves_to_manage();
    });
  }

  filter_applications_for(applications) {
    return applications.filter(
      (app) => app.holiday_status_id[1] === "Remote Work"
    );
  }

  async get_remote_leaves_to_manage() {
    try {
      let leaves = await this.orm.searchRead("hr.leave", [
        ["employee_id", "in", this.props.employee_ids],
      ]);
      leaves = this.filter_applications_for(leaves);

      const leaves_to_manage = [];
      leaves.forEach((leave) => {
        leaves_to_manage.push({
          id: leave.id,
          employee_name: leave.employee_id[1],
          leave_type: leave.holiday_status_id[1],
          duration: `${leave.date_from.slice(0, 10)} :: ${leave.date_to.slice(
            0,
            10
          )}`,
          status: leave_status[leave.state],
          description: leave.name,
        });
      });

      this.state.remote_applications_to_manage = leaves_to_manage;
    } catch (error) {
      console.error("Error fetching leave data: ", error);
    }
  }

  openLeaveDetails(id) {
    this.action.doAction({
      type: "ir.actions.act_window",
      res_model: "hr.leave",
      views: [[false, "form"]],
      target: "new",
      res_id: id,
    });
  }

  async approveLeave(id) {
    const leave_id = id;
    const res = await this.orm.call("hr.leave", "action_approve", [leave_id]);
    if (res) {
      await this.get_remote_leaves_to_manage();
    }
  }

  async rejectLeave(id) {
    const leave_id = id;
    const res = await this.orm.call("hr.leave", "action_refuse", [leave_id]);
    if (res) {
      await this.get_remote_leaves_to_manage();
    }
  }
}
