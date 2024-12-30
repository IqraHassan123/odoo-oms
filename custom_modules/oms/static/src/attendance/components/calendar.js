/** @odoo-module */

const { Component, useState, onMounted, useEffect } = owl;
import { useService } from "@web/core/utils/hooks";

const CONSTANTS = {
  SUNDAY_URL:
    "https://www.oms.enigmatix.co/static/media/sunday.b8cef86694a911d561e88e243f81abb5.svg",
  SATURDAY_URL:
    "https://www.oms.enigmatix.co/static/media/saturday.55e8eb0176a4ae4f47feba1d4467b698.svg",
  CROSS_URL:
    "https://www.oms.enigmatix.co/static/media/cross.d66627387f20d569bf425356fad014b6.svg",
  TICK_URL:
    "https://www.oms.enigmatix.co/static/media/tick.09c9652c75f1fd921ec8753c4efc25ce.svg",
};

export class Calendar extends Component {
  static template = "custom.oms.attendance.calendar";

  setup() {
    this.orm = useService("orm");
    this.state = useState({
      year: "",
      data: [],
      name_of_the_month: "",
      days: [],
    });

    onMounted(async () => {
      // await this.fetchData();
    });

    useEffect(
      () => {
        const fetchData = async () => {
          await this.fetchData();
        };
        fetchData();
        return () => {};
      },
      () => [this.props.search_term]
    );
  }

  async fetchData() {
    const search_term = this.props.search_term;
    const employee_id = this.props.employee_id;
    const year = search_term.split("-")[0];
    const month = search_term.split("-")[1];

    const attendance = await this.orm.searchRead("hr.attendance", [
      ["employee_id", "=", employee_id],
      ["check_in", ">=", `${year}-${month}-01 00:00:00`],
      // check_out is current day
      [
        "check_out",
        "<=",
        `${year}-${month}-${this.max_days_in_a_month(month)} 23:59:59`,
      ],
    ]);

    this.make_the_attendance_work_useful(attendance);
  }

  make_the_attendance_work_useful(attendance) {
    const data = [];
    const year = this.props.search_term.split("-")[0];
    const month = this.props.search_term.split("-")[1];
    const days_in_month = new Date(year, month, 0).getDate();
    for (let day = 1; day <= days_in_month; day++) {
      const date = `${year}-${month}-${day.toString().padStart(2, "0")}`;
      const name_of_the_day = new Date(date)
        .toLocaleString("en-us", {
          weekday: "long",
        })
        .slice(0, 3);
      // if day is sunday or saturday
      if (name_of_the_day === "Sun" || name_of_the_day === "Sat") {
        data.push({
          date,
          present: false,
          day,
          name_of_the_day,
          image_url:
            CONSTANTS[name_of_the_day == "Sat" ? "SATURDAY_URL" : "SUNDAY_URL"],
        });
        continue;
      }
      const present = attendance.some((att) => {
        return att.check_in.split(" ")[0] == date;
      });

      data.push({
        date,
        present,
        day,
        name_of_the_day,
        image_url: CONSTANTS[present ? "TICK_URL" : "CROSS_URL"],
      });
    }

    const days = [];
    for (let i = 1; i <= days_in_month; i++) {
      const date = `${year}-${month}-${i}`;
      const name_of_the_day = new Date(date);
      days.push({
        name: name_of_the_day
          .toLocaleString("en-us", { weekday: "long" })
          .slice(0, 3),
        number: i,
      });
    }

    this.state.data = data;
    this.state.name_of_the_month = this.get_name_of_the_month(parseInt(month));
    this.state.year = year;
    this.state.days = days;
  }

  get_name_of_the_month(month) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month - 1];
  }

  max_days_in_a_month(month_num) {
    return new Date(this.state.year, month_num, 0).getDate();
  }
}
