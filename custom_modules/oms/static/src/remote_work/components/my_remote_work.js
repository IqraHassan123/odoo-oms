/** @odoo-module */

const { Component, useState } = owl;

export class MyRemoteWork extends Component {
  static template = "custom.oms.remote_work.my_remote_work";

  setup() {
    this.state = useState({
      remote_applications: this.props?.remote_applications,
      total_applications: 0,
    });
  }
}
