/** @odoo-module */

const { Component, onWillStart, useState } = owl;

export class Hero extends Component {
  static template = "custom.oms.hero";
  static components = {};


  setup() {
    this.state = useState({
      days_in_company: this.compute_days_in_company(),
      image_url: `data:image/png;base64,${this.props?.image_url}`,
    });
  }

  compute_days_in_company() {
    const today = new Date();
    const start_date = new Date(this.props?.start_date);
    const diff = today - start_date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days;
  }
}
