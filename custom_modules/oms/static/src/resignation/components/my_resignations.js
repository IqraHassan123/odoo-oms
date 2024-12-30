/** @odoo-module */

const { Component, useState, onWillStart } = owl;

import { useService } from "@web/core/utils/hooks";

export class MyResignations extends Component {
  static template = "custom.oms.resignations.my_resignations";
  static components = { MyResignations };

  setup() {
    this.orm = useService("orm");
    this.state = useState({
      resignations: [],
    });

    onWillStart(async () => {
      const resignation = await this._fetchResignation();
      this.state.resignations = resignation;
    });
  }

  async willStart() {
    return this._fetchResignation();
  }

  async _fetchResignation() {
    const employee_id = this.props.employee_id;
    const resignations = await this.orm.searchRead("oms.resignation", [
      ["employee_id", "=", employee_id],
    ]);

    resignations.forEach((resignation) => {
      resignation.resignation_date = new Date(
        resignation.resignation_date
      ).toLocaleDateString();
      resignation.notice_period = `${resignation.notice_period} days`;
      resignation.employee = resignation.employee_id[1];
    });

    return resignations;
  }
}
