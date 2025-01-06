/** @odoo-module */

const { Component, useState, onWillStart } = owl;
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { SideBar } from "../js/sections/sidebar/sidebar";
import { MyRemoteWork } from "./components/my_remote_work";
import { ManageRemoteWork } from "./components/manage_remote_work";
import { ApplyForm } from "./apply_form";

const leave_status = {
    draft: "To Submit",
    confirm: "To Approve",
    refuse: "Refused",
    validate1: "Second Approval",
    validate: "Approved",
};

export class RemoteWork extends Component {
    static template = "custom.oms.remote_work";
    static components = { SideBar, MyRemoteWork, ManageRemoteWork, ApplyForm };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");

        this.state = useState({
            employee_info: {},
            remote_applications: [],
            is_a_manager: false,
            total_applications: 0,
            employee_ids: [],
            remote_work_time_off_id: 0,
            showApplyForm: false,
        });

        this.toggleApplyForm = this.toggleApplyForm.bind(this);

        onWillStart(async () => {
            await this.initializeData();
        });
    }

    async initializeData() {
        try {
            await this.getEmployeeInfo();
            await this.refreshTableData();
            await this.getEmployeesToManage();
            await this.findRemoteWorkTimeOffId();
            this.state.is_a_manager = await this.isManager();
        } catch (error) {
            console.error("Error during initialization:", error);
        }
    }

    async refreshTableData() {
        try {
            const applications = await this.orm.searchRead("hr.leave", [
                ["employee_id", "=", this.state.employee_info.id],
            ]);
            const filteredApplications = this.filterApplications(applications);

            this.state.remote_applications = filteredApplications.map(app => ({
                id: app.id,
                leave_type: app.holiday_status_id[1],
                date: `${app.date_from.slice(0, 10)} - ${app.date_to.slice(0, 10)}`,
                duration: app.number_of_days,
                status: leave_status[app.state],
                leave_manager: this.state.employee_info.leave_manager_id[1],
                description: app.name,
            }));

            this.state.total_applications = filteredApplications.length;
        } catch (error) {
            console.error("Error refreshing table data:", error);
            await this.sendNotification("Error", "Failed to fetch leave data.");
        }
    }

    async findRemoteWorkTimeOffId() {
        const remoteWorkType = await this.orm.searchRead("hr.leave.type", [
            ["name", "=", "Remote Work"],
        ]);
        this.state.remote_work_time_off_id = remoteWorkType[0]?.id || null;
    }

    async getEmployeeInfo() {
        const userId = user.userId;
        const partnerInfo = await this.orm.searchRead("res.partner", [["id", "=", userId]]);
        const employeeId = partnerInfo[0]?.employee_ids[0];
        const employeeInfo = await this.orm.searchRead("hr.employee", [["id", "=", employeeId]]);
        this.state.employee_info = employeeInfo[0];
    }

    async isManager() {
        const manager = await this.orm.searchRead("hr.employee", [["leave_manager_id", "=", user.userId]]);
        return manager.length > 0;
    }

    filterApplications(applications) {
        return applications.filter(app => app.holiday_status_id[1] === "Remote Work");
    }

    toggleApplyForm() {
        this.state.showApplyForm = !this.state.showApplyForm;
    }

    async sendNotification(title, message) {
        await this.action.doAction({
            type: "ir.actions.client",
            tag: "display_notification",
            params: { title, message, sticky: false },
        });
    }

    async getEmployeesToManage() {
        const employees = await this.orm.searchRead("hr.employee", [["leave_manager_id", "=", user.userId]]);
        this.state.employee_ids = employees.map(emp => emp.id);
    }
}

registry.category("actions").add("oms.remote_work_view", RemoteWork);
