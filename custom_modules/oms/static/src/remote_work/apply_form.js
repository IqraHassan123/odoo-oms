/** @odoo-module */

const { Component, useState } = owl;
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

export class ApplyForm extends Component {
    static template = "custom.oms.remote_work.apply_form";

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");

        this.state = useState({
            start_date: "",
            end_date: "",
            reason: "",
        });

        this.toggleDrawer = this.props.toggleApplyForm;
    }

  async onClickApplyForRemote() {
    console.log("Submit button clicked"); // Debug log
    const { start_date, end_date, reason } = this.state;

    if (!start_date || !end_date || !reason) {
        await this.sendNotification("Error", "Please fill in all fields.");
        return;
    }

    if (new Date(start_date) > new Date(end_date)) {
        await this.sendNotification("Error", "Start date cannot be after end date.");
        return;
    }

    try {
        await this.orm.create("oms.remote_work", [
            { start_date, end_date, reason, state: "pending" },
        ]);

        console.log("Form submitted successfully"); // Debug log
        await this.sendNotification("Success", "Remote work request submitted.");
        this.toggleApplyForm();

        if (this.props.onDataAdded) {
            this.props.onDataAdded();
        }
    } catch (error) {
        console.error("Error submitting request:", error); // Debug log
        await this.sendNotification("Error", "Failed to submit request.");
    }
}

    async sendNotification(title, message) {
        await this.actionService.doAction({
            type: "ir.actions.client",
            tag: "display_notification",
            params: { title, message, sticky: false },
        });
    }
}

registry.category("actions").add("oms.remote_work_apply_form", ApplyForm);
