/** @odoo-module */

import { loadJS } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
const {
  Component,
  useState,
  onWillStart,
  useRef,
  onMounted,
  useEffect,
  onWillUnmount,
} = owl;

const labels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export class Bottom extends Component {
  static template = "custom.oms.bottom";

  setup() {
    this.orm = useService("orm");
    this.charRef = useRef("chart");

    this.state = useState({
      weekly_attendance: [],
      announcements: [],

      values: [],
    });

    onWillStart(async () => {
      await loadJS("https://cdn.jsdelivr.net/npm/chart.js");
      this.start();
    });

    useEffect(
      () => {
        this.render_chart();
      },
      () => [this.state.values]
    );

    onMounted(() => {
      this.render_chart();
    });
  }

  async start() {
    await this.get_attendance_info();
    await this.render_chart();
    await this.get_announcements();
  }

  async get_attendance_info() {
    const employee_id = this.props.employee_info.id;
    const today = new Date();
    const current_day = today.getDay();
    const current_week = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - (current_day - 1)
    );
    const attendance_info = await this.orm.searchRead("hr.attendance", [
      ["employee_id", "=", employee_id],
      ["check_in", ">", current_week],
    ]);

    const total_hours_worked_in_days = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    };

    const getDayOfWeek = (date) => {
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      return days[date.getDay()];
    };

    attendance_info.forEach((attendance) => {
      const checkInDate = new Date(attendance.check_in);
      const dayOfWeek = getDayOfWeek(checkInDate);
      total_hours_worked_in_days[dayOfWeek] += attendance.worked_hours;
    });

    const data = labels.map((label) =>
      total_hours_worked_in_days[label].toFixed(0)
    );
    this.state.values = data;
  }

  async render_chart() {
    if (this.chart) {
      this.chart.destroy();
    }

    const data = {
      labels: labels,
      datasets: [
        {
          label: "Weekly Report",
          data: this.state.values,
        },
      ],
    };

    this.chart = new Chart(this.charRef.el, {
      type: "line",
      data: data,
      options: {
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  async get_announcements() {
    const today = new Date();
    const current_day = today.getDay()
    const current_week = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - (current_day - 1)
    );
    const announcements = await this.orm.searchRead("oms.announcement", [
      ["is_active", "=", true],
      ["date", ">", current_week],
    ]);
    this.state.announcements = announcements;
  }
}
