/** @odoo-module */

const { Component, onWillStart, useState, onMounted } = owl;
import { registry } from "@web/core/registry";
import { session } from "@web/session";
import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";

import { Hero } from "./sections/hero/hero";
import { EmployeeStatus } from "./sections/employee_status/employee";
import { Bottom } from "./sections/bottom/bottom";
import { SideBar } from "./sections/sidebar/sidebar";

export class Oms extends Component {
  static template = "custom.oms.main";
  static components = { Hero, EmployeeStatus, Bottom, SideBar };

  setup() {
    this.orm = useService("orm");
    this.state = useState({
      partner_info: {},
      employee_info: {},
      attendance_info: [],
      attendance_info_today: [],
    });

    // onMounted(async () => {
    //   await this.get_info();
    // })
    onWillStart(async function () {
      await this.get_info();
    });
  }

  async get_info() {
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

    this.state.partner_info = _partner_info;
    this.state.employee_info = _employee_info;

    const _attendance_info = await this.get_attendance_info();
    const _attendance_info_today = await this.get_attendance_info_today();

    this.state.attendance_info = _attendance_info;
    this.state.attendance_info_today = _attendance_info_today;
  }

  async get_attendance_info() {
    const employee_id = this.state.employee_info.id;
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    const domain = [
      ["employee_id", "=", employee_id],
      ["check_in", ">=", firstDayOfMonth.toISOString()],
      ["check_in", "<=", lastDayOfMonth.toISOString()],
    ];

    const attendance_info = await this.orm.searchRead("hr.attendance", domain);
    return attendance_info;
  }

  async get_attendance_info_today() {
    const employee_id = this.state.employee_info.id;
    const today = new Date();
    let today_str = today.toISOString();
    let today_str_date = today_str.slice(0, 10);

    let attendance_info = await this.orm.searchRead("hr.attendance", [
      ["employee_id", "=", employee_id],
    ]);
    attendance_info = attendance_info.filter((attendance) => {
      const check_in = attendance.check_in;
      const check_in_date = check_in.slice(0, 10);
      if (check_in_date === today_str_date) {
        return attendance;
      }
    });
    return attendance_info;
  }
}

registry.category("actions").add("oms.main_view", Oms);
