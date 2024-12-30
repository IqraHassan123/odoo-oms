/** @odoo-module */

const { Component, onWillStart, useState } = owl;
import { useService } from "@web/core/utils/hooks";

const clearBreadcrumbs = false;
export class SideBar extends Component {
  static template = "custom.oms.sidebar";

  setup() {
    this.action = useService("action");
    onWillStart(async () => {});
  }

  async onClickDashboard() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.main_view",
      },
      {
        clearBreadcrumbs: clearBreadcrumbs,
      }
    );
  }

  async onClickLeave() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.leave_view",
        target: "self",
      },
      {
        clearBreadcrumbs: clearBreadcrumbs,
      }
    );
  }

  async onClickSettings() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.settings_view",
      },
      {
        clearBreadcrumbs: clearBreadcrumbs,
      }
    );
  }

  async onClickEmployees() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.employees_view",
      },
      {
        clearBreadcrumbs: clearBreadcrumbs,
      }
    );
  }

  async onClickAttendance() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.attendance_view",
      },
      {
        clearBreadcrumbs: clearBreadcrumbs,
      }
    );
  }

  async onClickRemoteWork() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.remote_work_view",
      },
      {
        clearBreadcrumbs: clearBreadcrumbs,
      }
    );
  }

  async onClickResignation() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.resignation_view",
      },
      {
        clearBreadcrumbs: clearBreadcrumbs,
      }
    );
  }
}
