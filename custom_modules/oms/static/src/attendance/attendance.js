/** @odoo-module */

const { Component, onWillStart, useState, onMounted } = owl;
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";

import { SideBar } from "../js/sections/sidebar/sidebar";
import { Calendar } from "./components/calendar";

const CONSTANTS = {
  MONTHLY_REQUIRED_HOURS: 160,
  REQUIRED_DAILY_HOURS: 8,
};

export class Attendance extends Component {
  static template = "custom.oms.attendance";
  static components = { SideBar, Calendar };

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");
    this.state = useState({
      total_productive_time_today: "00:00:00",
      activities: [],
      employee_info: {},
      statistics: {
        today: 0,
        this_week: 0,
        this_month: 0,
        remaining_for_month: 0,
        overtime_for_month: 0,
      },
      search_term: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`, // REM: starts from zero
      _search_term: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`, // REM: starts from zero

      total_break_time_prayer: "00:00:00",
      total_break_time_lunch: "00:00:00",
    });

    onWillStart(async () => {
      await this.getEmployeeInfo();
    });

    onMounted(async () => {
      await this.onMountFunction();
    });
  }

  async onMountFunction() {
    await Promise.all([this.getActivities()]);
    this.computeProductiveTime();
    this.computeStatistics();
    await this.getActivities();
    await this.compute_break_times();
    this.render_total_productive_time();
  }

  async getEmployeeInfo() {
    const user_id = user.userId;
    const user_info = await this.orm.searchRead("res.users", [
      ["id", "=", user_id],
    ]);
    const employee_id = user_info[0]?.employee_ids[0];
    const employee_info = await this.orm.searchRead("hr.employee", [
      ["id", "=", employee_id],
    ]);
    this.state.employee_info = employee_info[0];
  }

  computeProductiveTime() {
    const hours_today = this.state.employee_info.hours_today || 0;
    const in_secs = hours_today * 3600;
    this.state.total_productive_time_today = this.convertSecondsToTime(in_secs);
    this.state.statistics.today = hours_today.toFixed(2);
  }

  convertSecondsToTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining_seconds = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remaining_seconds
      .toFixed(0)
      .toString()
      .padStart(2, "0")}`;
  }

  async getActivities() {
    const employee_id = this.state.employee_info.id;
    const today_str_date = new Date().toISOString().slice(0, 10);

    let attendance_info = await this.orm.searchRead("hr.attendance", [
      ["employee_id", "=", employee_id],
    ]);
    const today_attendance_info = attendance_info.filter((attendance) => {
      return attendance.check_in.slice(0, 10) === today_str_date;
    });

    this.state.activities = today_attendance_info.flatMap((attendance) => {
      const check_in_time = new Date(attendance.check_in).toLocaleTimeString();
      const check_out_time = attendance.check_out
        ? new Date(attendance.check_out).toLocaleTimeString()
        : "N/A";

      return [
        { activity: "Checked In", time: check_in_time },
        ...(check_out_time !== "N/A"
          ? [{ activity: "Checked Out", time: check_out_time }]
          : []),
      ];
    });
  }

  async computeStatistics() {
    this.state.statistics.this_month =
      this.state.employee_info.hours_last_month.toFixed(2) || 0;

    const employee_id = this.state.employee_info.id;
    const today = new Date();
    const today_str_date = today.toISOString().slice(0, 10);
    const monday_str_date = this.getMonday(today).toISOString().slice(0, 10);

    let attendance_info = await this.orm.searchRead("hr.attendance", [
      ["employee_id", "=", employee_id],
    ]);
    const this_week_sunday_date = new Date(monday_str_date);
    this_week_sunday_date.setDate(this_week_sunday_date.getDate() + 6);
    const this_week_sunday_str_date = this_week_sunday_date.toISOString().slice(0, 10);

    const this_week_attendance_info = attendance_info.filter((attendance) => {
      const check_in_date = attendance.check_in.slice(0, 10);
      return (
        check_in_date >= monday_str_date && check_in_date <= this_week_sunday_str_date
        // && check_in_date <= today_str_date
      );
    });

    console.log("this_week_attendance_info", this_week_attendance_info);

    const this_week_hours = this_week_attendance_info.reduce(
      (total, attendance) => {
        const check_in = new Date(attendance.check_in);
        const check_out = attendance.check_out
          ? new Date(attendance.check_out)
          : null;
        return total + (check_out ? (check_out - check_in) / 3600000 : 0);
      },
      0
    );

    this.state.statistics.this_week = this_week_hours.toFixed(2);

    let remaining_hours =
      CONSTANTS.MONTHLY_REQUIRED_HOURS - this.state.statistics.this_month;

    remaining_hours = remaining_hours > 0 ? remaining_hours.toFixed(2) : 0;

    this.state.statistics.remaining_for_month =
      parseInt(remaining_hours).toFixed(2);

    let overtime_for_month =
      this.state.statistics.this_month - CONSTANTS.MONTHLY_REQUIRED_HOURS;
    overtime_for_month =
      overtime_for_month > 0 ? overtime_for_month.toFixed(2) : 0;
    this.state.statistics.overtime_for_month = overtime_for_month;
  }

  getMonday(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  onClickSearch(e) {
    e.preventDefault();
    this.state.search_term = this.state._search_term;
  }

  onClickReset(e) {
    e.preventDefault();
    this.state._search_term = `${new Date().getFullYear()}-${
      new Date().getMonth() + 1
    }`;
  }
  async compute_break_times() {
    const employee_id = this.state.employee_info.id;
    const start_time = new Date();
    start_time.setHours(0, 0, 0, 0);
    const break_data = await this.orm.searchRead("break.schedule", [
      ["employee_id", "=", employee_id],
      ["start_time", ">=", start_time],
    ]);

    const prayer_breaks = break_data.filter(
      (break_) => break_.type === "prayer"
    );
    const lunch_breaks = break_data.filter((break_) => break_.type === "lunch");

    let total_break_time_prayer = 0;
    prayer_breaks.forEach((break_) => {
      const start_time = new Date(break_.start_time);
      const end_time = break_.end_time ? new Date(break_.end_time) : new Date();
      total_break_time_prayer += (end_time - start_time) / 1000;
    });

    let total_break_time_lunch = 0;
    lunch_breaks.forEach((break_) => {
      const start_time = new Date(break_.start_time);
      const end_time = break_.end_time ? new Date(break_.end_time) : new Date();
      total_break_time_lunch += (end_time - start_time) / 1000;
    });

    this.state.total_break_time_prayer = this.convertSecondsToTime(
      total_break_time_prayer
    );
    this.state.total_break_time_lunch = this.convertSecondsToTime(
      total_break_time_lunch
    );
  }

  render_total_productive_time() {
    this.time_count_interval = setInterval(async () => {
      try {
        let employee_info = this.state.employee_info;
        employee_info = await this.orm.searchRead("hr.employee", [
          ["id", "=", employee_info.id],
        ]);
        const hours_today = employee_info[0].hours_today; // int
        const in_secs = hours_today * 3600;
        const hours_today_str = this.convertSecondsToTime(in_secs);
        this.state.total_productive_time_today = hours_today_str;
        await this.compute_break_times();
      } catch (e) {
        console.error("ERROR=====>", e);
        clearInterval(this.time_count_interval);
      }
    }, 1000);
  }

  async handleOnClickPunch(type) {
    if (!type) {
      type = "prayer";
    }

    // scenario where employee is already in break and want to end it
    const employee_id = this.state.employee_info.id;
    const break_data = await this.orm.searchRead("break.schedule", [
      ["employee_id", "=", employee_id],
    ]);

    const is_already_punched_in_of_a_specific_type = break_data.find(
      (break_) => break_.type === type && break_.end_time === false
    );

    if (is_already_punched_in_of_a_specific_type) {
      const break_id = is_already_punched_in_of_a_specific_type.id;
      await this.orm.write("break.schedule", [break_id], {
        end_time: this.formatDate(new Date()),
      });

      await this.send_notification(
        "Success",
        `${type} Break ended successfully`
      );
      return;
    }

    // scenario where employee is not in break and want to start it
    else {
      const break_data = {
        employee_id: employee_id,
        start_time: this.formatDate(new Date()),
        type: type,
        end_time: false,
      };
      await this.orm.create("break.schedule", [break_data]);

      await this.send_notification(
        "Success",
        `${type} Break started successfully`
      );
    }
  }

  formatDate(date) {
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
      date.getSeconds()
    )}`;
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

    await this.action.doAction(parms);
  }

  async onClickDashboard() {
    await this.action.doAction(
      {
        type: "ir.actions.client",
        tag: "oms.main_view",
      },
      {
        clearBreadcrumbs: false,
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
        clearBreadcrumbs: false,
      }
    );
  }
}

registry.category("actions").add("oms.attendance_view", Attendance);
