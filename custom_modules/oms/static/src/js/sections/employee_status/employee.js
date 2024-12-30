/** @odoo-module */

const { Component, onWillStart, useState, onWillUnmount } = owl;
import { useService } from "@web/core/utils/hooks";

const FULL_TIME_WORKING_HOURS = 8;

export class EmployeeStatus extends Component {
  static template = "custom.oms.employee";

  setup() {
    this.orm = useService("orm");
    this.action = useService("action");
    this.state = useState({
      employee_info: this.props.employee_info,
      today_productive_time: "00:00:00",
      total_presents_in_month: 0,
      total_absents_in_month: 0,
      total_overtime_hours_in_month: 0,
      total_overtime_hours: 0,
      prayer_break_time: "00:00:00",
      lunch_break_time: "00:00:00",
      prayer_break_active: false,
      lunch_break_active: false,
      activities: [],
      consuming_leave_count: 0,
      total_ontime_in_month: 0,
      total_latetime_in_month: 0,

      total_break_time_prayer: "00:00:00",
      total_break_time_lunch: "00:00:00",

      is_prayer_break_active: false,
      is_lunch_break_active: false,
    });

    onWillStart(async () => {
      this.state.employee_info = this.props.employee_info;
      await this.get_info();
    });

    onWillUnmount(() => {
      if (this.time_count_interval) clearInterval(this.time_count_interval);
    });
  }

  async get_info() {
    this.get_activities();
    const employee_id = this.state.employee_info.id;
    this.compute_productive_time();
    this.compute_total_presents_in_month();
    this.compute_total_absents_in_month();
    this.compute_overtime_hours();
    this.compute_total_overtime_hours_in_month();
    this.compute_consuming_leave_count();
    this.compute_total_ontime_in_month();
    this.compute_break_times();
    this.are_breaks_active();

    this.render_total_productive_time();
  }

  compute_productive_time() {
    const hours_today = this.props.employee_info.hours_today; // int
    const in_secs = hours_today * 3600;
    const hours_today_str = this.convert_seconds_to_time(in_secs);
    this.state.total_productive_time = hours_today_str;
  }

  convert_seconds_to_time(seconds) {
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

  compute_total_presents_in_month() {
    const employee_attendance_info = this.props.attendance_info;
    const uniqueDates = new Set();

    employee_attendance_info?.forEach((attendance) => {
      if (attendance.check_in) {
        const checkInDate = new Date(attendance.check_in)
          .toISOString()
          .split("T")[0];
        uniqueDates.add(checkInDate);
      }
    });

    this.state.total_presents_in_month = uniqueDates.size;
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

  compute_total_absents_in_month() {
    const employee_attendance_info = this.props.attendance_info;
    const uniqueDates = new Set();

    employee_attendance_info?.forEach((attendance) => {
      if (attendance.check_in) {
        const checkInDate = new Date(attendance.check_in)
          .toISOString()
          .split("T")[0];
        uniqueDates.add(checkInDate);
      }
    });

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonthTillToday =
      Math.floor((today - firstDayOfMonth) / (1000 * 60 * 60 * 24)) + 1;

    this.state.total_absents_in_month = daysInMonthTillToday - uniqueDates.size;
  }

  compute_overtime_hours() {
    const employee_attendance_info = this.props.attendance_info;
    let total_overtime_hours = 0;

    employee_attendance_info?.forEach((attendance) => {
      const total_time_in_detail = attendance.worked_time_detailed;
      const total_time_in_detail_arr = total_time_in_detail.split(":");
      const total_time_in_detail_seconds =
        parseInt(total_time_in_detail_arr[0]) * 3600 +
        parseInt(total_time_in_detail_arr[1]) * 60 +
        parseInt(total_time_in_detail_arr[2]);
      if (total_time_in_detail_seconds > 28800) {
        total_overtime_hours += (total_time_in_detail_seconds - 28800) / 3600;
      }
    });

    this.state.total_overtime_hours = total_overtime_hours;
  }

  compute_total_overtime_hours_in_month() { // calculated for everyday
    const employee_attendance_info = this.props.attendance_info;
    let total_overtime_hours = 0;

    employee_attendance_info?.forEach((attendance) => {
      const total_time_in_detail = attendance.worked_time_detailed;
      const total_time_in_detail_arr = total_time_in_detail.split(":");
      const total_time_in_detail_seconds =
        parseInt(total_time_in_detail_arr[0]) * 3600 +
        parseInt(total_time_in_detail_arr[1]) * 60 +
        parseInt(total_time_in_detail_arr[2]);
      if (total_time_in_detail_seconds > FULL_TIME_WORKING_HOURS * 3600) {
        total_overtime_hours += (total_time_in_detail_seconds - 28800) / 3600;
      }
    });

    total_overtime_hours = Number(total_overtime_hours).toFixed(0);
    this.state.total_overtime_hours_in_month = total_overtime_hours;
  }

  async get_activities() {
    const today_attendance_info = this.props.attendance_info_today;
    let activities = [];
    today_attendance_info?.forEach((attendance) => {
      const check_in = `${attendance.check_in}Z`;
      const check_out = attendance.check_out
        ? `${attendance.check_out}Z`
        : null;

      // TODO: check_in and check_out are in UTC format
      const check_in_time = new Date(check_in).toLocaleTimeString("en-US", {
        timeZone: "Asia/Karachi",
      });
      const check_out_time = check_out
        ? new Date(check_out).toLocaleTimeString("en-US", {
            timeZone: "Asia/Karachi",
          })
        : "N/A";

      if (check_out_time != "N/A") {
        activities.push({
          activity: "Checked Out",
          time: check_out_time,
        });
      }

      activities.push({
        activity: "Checked In",
        time: check_in_time,
      });
    });

    this.state.activities = activities;
  }

  render_total_productive_time() {
    this.time_count_interval = setInterval(async () => {
      try {
        let employee_info = this.props.employee_info;
        employee_info = await this.orm.searchRead("hr.employee", [
          ["id", "=", employee_info.id],
        ]);
        const hours_today = employee_info[0].hours_today; // int
        const in_secs = hours_today * 3600;
        const hours_today_str = this.convert_seconds_to_time(in_secs);
        this.state.total_productive_time = hours_today_str;

        await this.compute_break_times();
      } catch (e) {
        console.error("ERROR=====>", e);
        if ("destoryed" in e) {
          clearInterval(this.time_count_interval);
        }
      }
    }, 1000);
  }

  async compute_consuming_leave_count() {
    const employee_id = this.state.employee_info.id;
    const leaves = await this.orm.searchRead("hr.leave", [
      ["employee_id", "=", employee_id],
      ["state", "=", "validate"],
    ]);
    const consuming_leave_count = leaves.length;
    this.state.consuming_leave_count = consuming_leave_count;
  }

  compute_total_ontime_in_month() {
    const employee_attendance_info = this.props.attendance_info;
    const uniqueEmployeeAttendanceInfo = {};

    employee_attendance_info?.forEach((attendance) => {
      attendance.check_in = new Date(`${attendance.check_in}Z`);
      attendance.check_out = attendance.check_out
        ? new Date(`${attendance.check_out}Z`)
        : null;
      const check_in_date = new Date(attendance.check_in)
        .toLocaleString("en-US", { timeZone: "Asia/Karachi" })
        .split(",")[0];
      const check_in_time = new Date(attendance.check_in).toLocaleTimeString(
        "en-US",
        { timeZone: "Asia/Karachi" }
      );
      const check_out_time = attendance.check_out
        ? new Date(attendance.check_out).toLocaleTimeString("en-US", {
            timeZone: "Asia/Karachi",
          })
        : "N/A";

      if (!uniqueEmployeeAttendanceInfo[check_in_date]) {
        uniqueEmployeeAttendanceInfo[check_in_date] = {
          date: check_in_date,
          first_check_in_time: check_in_time,
          last_check_out_time: check_out_time,
        };
      } else {
        const target = uniqueEmployeeAttendanceInfo[check_in_date];
        if (
          new Date(`1970-01-01T${check_in_time}`) <
          new Date(`1970-01-01T${target.first_check_in_time}`)
        ) {
          target.first_check_in_time = check_in_time;
        }
        if (
          check_out_time !== "N/A" &&
          new Date(`1970-01-01T${check_out_time}`) >
            new Date(`1970-01-01T${target.last_check_out_time}`)
        ) {
          target.last_check_out_time = check_out_time;
        }
      }
    });

    const uniqueAttendanceArray = Object.values(uniqueEmployeeAttendanceInfo);

    let total_ontime_in_month = 0;
    uniqueAttendanceArray.forEach((attendance) => {
      if (attendance.first_check_in_time.includes("PM")) {
        return;
      }

      const first_check_in_time = attendance.first_check_in_time;
      const first_check_in_time_arr = first_check_in_time.split(":");
      const first_check_in_time_seconds =
        parseInt(first_check_in_time_arr[0]) * 3600 +
        parseInt(first_check_in_time_arr[1]) * 60 +
        parseInt(first_check_in_time_arr[2]);

      if (first_check_in_time_seconds <= 32400) {
        total_ontime_in_month += 1;
      }
    });

    const today = new Date();
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonthTillToday =
      Math.floor((today - firstDayOfMonth) / (1000 * 60 * 60 * 24)) + 1;

    this.state.total_latetime_in_month =
      uniqueAttendanceArray.length - total_ontime_in_month;

    this.state.total_ontime_in_month = total_ontime_in_month;
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
      const start_time = new Date(`${break_.start_time}Z`).toLocaleString(
        "en-US",
        {
          timeZone: "Asia/Karachi",
        }
      );
      const end_time = break_.end_time
        ? new Date(`${break_.end_time}Z`).toLocaleString("en-US", {
            timeZone: "Asia/Karachi",
          })
        : new Date().toLocaleString("en-US", {
            timeZone: "Asia/Karachi",
          });
      total_break_time_prayer +=
        (new Date(end_time) - new Date(start_time)) / 1000;
    });

    let total_break_time_lunch = 0;
    lunch_breaks.forEach((break_) => {
      const start_time = new Date(`${break_.start_time}Z`).toLocaleString(
        "en-US",
        {
          timeZone: "Asia/Karachi",
        }
      );
      const end_time = break_.end_time
        ? new Date(`${break_.end_time}Z`).toLocaleString("en-US", {
            timeZone: "Asia/Karachi",
          })
        : new Date().toLocaleString("en-US", {
            timeZone: "Asia/Karachi",
          });
      total_break_time_lunch +=
        (new Date(end_time) - new Date(start_time)) / 1000;
    });

    this.state.total_break_time_prayer = this.convert_seconds_to_time(
      total_break_time_prayer
    );
    this.state.total_break_time_lunch = this.convert_seconds_to_time(
      total_break_time_lunch
    );
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

      await this.orm.call("break.schedule", "end_break", [break_id]);

      await this.send_notification(
        "Success",
        `${type} Break ended successfully`
      );
      if (type === "prayer") {
        this.state.is_prayer_break_active = false;
      } else if (type === "lunch") {
        this.state.is_lunch_break_active = false;
      }
      return;
    }

    // scenario where employee is not in break and want to start it
    else {
      const break_data = {
        employee_id: employee_id,
        type: type,
        end_time: false,
      };
      await this.orm.create("break.schedule", [break_data]);

      await this.send_notification(
        "Success",
        `${type} Break started successfully`
      );

      if (type === "prayer") {
        this.state.is_prayer_break_active = true;
      }
      if (type === "lunch") {
        this.state.is_lunch_break_active = true;
      }
    }
  }

  async are_breaks_active() {
    // get all the breaks for today that doesnot have a end_time

    const employee_id = this.state.employee_info.id;
    const start_time = new Date();
    start_time.setHours(0, 0, 0, 0);
    const break_data = await this.orm.searchRead("break.schedule", [
      ["employee_id", "=", employee_id],
      ["start_time", ">=", start_time],
      ["end_time", "=", false],
    ]);

    let is_prayer_break_active = false;
    let is_lunch_break_active = false;
    break_data.forEach((break_) => {
      if (break_.type === "prayer") {
        is_prayer_break_active = true;
      } else if (break_.type === "lunch") {
        is_lunch_break_active = true;
      }
    });

    this.state.is_prayer_break_active = is_prayer_break_active;
    this.state.is_lunch_break_active = is_lunch_break_active;
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
}
