from odoo import http, fields
from odoo.http import Response, request
import json
from datetime import timedelta, datetime
import pytz


route = http.route
class Controller(http.Controller):
    
    @route('/api/oms/dashboard/total_days', auth='user') # DONE
    def total_days(self):
        user = http.request.env.user
        if not user.employee_ids:
            return "No employee found"
        employee_id = user.employee_ids[0]
        today_date = fields.Datetime.today()
        total_days = today_date - employee_id.create_date
        total_days = total_days.days
        return f"{total_days}"

    @route('/api/oms/dashboard/today_timesheet', auth='user')
    def today_timesheet(self):
        user = http.request.env.user
        if not user.employee_ids:
            return "No employee found"
        employee_id = user.employee_ids[0]

        # productive time today
        hours_today = employee_id.hours_today
        print("Hours Today:  ", hours_today)
        hours_today_in_seconds = int(hours_today * 3600)
        hours_today = convert_hours_into_hh_mm_ss(hours_today_in_seconds)

        # total break time today
        _break_data = http.request.env['break.schedule'].sudo().search([
            ('employee_id', '=', employee_id.id),
            ('start_time', '>=', fields.Datetime.today()),
            ('start_time', '<=', fields.Datetime.today() + timedelta(days=1))
        ])
        break_data = []
        for break_ in _break_data:
            _current_break_data = {
                "id": break_.id,
                "start_time": break_.start_time,
                "end_time": break_.end_time or fields.Datetime.now(),
                "type": break_.type,
                "break_hours": break_.break_hours or ((break_.end_time or fields.Datetime.now()) - break_.start_time).total_seconds() / 3600
            }
            break_data.append(_current_break_data)

        prayer_breaks = [break_ for break_ in break_data if break_["type"] == 'prayer']
        lunch_breaks = [break_ for break_ in break_data if break_["type"] == 'lunch']

        total_prayer_break_time = sum([break_["break_hours"] for break_ in prayer_breaks])
        total_lunch_break_time = sum([break_["break_hours"] for break_ in lunch_breaks])

        total_lunch_break_time_in_seconds = int(total_lunch_break_time * 3600)
        total_prayer_break_time_in_seconds = int(total_prayer_break_time * 3600)
        total_break_time_in_seconds = total_lunch_break_time_in_seconds + total_prayer_break_time_in_seconds

        total_lunch_break_time = convert_hours_into_hh_mm_ss(total_lunch_break_time_in_seconds)
        total_prayer_break_time = convert_hours_into_hh_mm_ss(total_prayer_break_time_in_seconds)
        total_break_time = convert_hours_into_hh_mm_ss(total_break_time_in_seconds)

        return http.Response(
            json.dumps({
                "hours_today": hours_today,
                "breaks": {
                    "total_lunch_break_time": total_lunch_break_time,
                    "total_prayer_break_time": total_prayer_break_time,
                    "total_break_time": total_break_time,
                }
            }),
            headers=[('Content-Type', 'application/json')],
            status=200,
        )

    @route('/api/oms/dashboard/attendance_overview', auth='user')
    def attendance_overview(self):
        # total presents and absents in current month
        user = http.request.env.user
        if not user.employee_ids:
            return "No employee found"
        employee_id = user.employee_ids[0]
        today_date = fields.Datetime.today()
        start_date = today_date.replace(day=1)
        end_date = today_date + timedelta(days=1)
        attendance_records = http.request.env['hr.attendance'].sudo().search([
            ('employee_id', '=', employee_id.id),
            ('check_in', '>=', start_date),
            ('check_in', '<=', end_date)
        ])
        present_dates = set()
        for record in attendance_records:
            present_dates.add(record.check_in.date())
        total_presents = len(present_dates)
        total_days = today_date.day
        total_absents = total_days - total_presents
        
        # total leaves in current month
        leaves = http.request.env['hr.leave'].sudo().search([
            ('employee_id', '=', employee_id.id),
            ('request_date_from', '>=', start_date),
            ('request_date_from', '<=', end_date)
        ])
        total_leaves = len(leaves)
        
        # total overtime hours in current month as int
        overtime_hours = 0
        for record in attendance_records:
            worked_hours = record.worked_hours
            if worked_hours > 8:
                overtime_hours += worked_hours - 8
        overtime_hours = int(overtime_hours)
        
        # on-time and on-late count as ints in current month
        # on-time if first check_in is before 9:00 AM
        on_time_count, on_late_count = compute_on_time_and_late(attendance_records)
        
        return http.Response(
            json.dumps({
                "total_presents": total_presents,
                "total_absents": total_absents,
                "total_leaves": total_leaves,
                "overtime_hours": overtime_hours,
                "on_time_count": on_time_count,
                "on_late_count": on_late_count,
            }),
            headers=[('Content-Type', 'application/json')],
            status=200,
        )

    @route('/api/oms/dashboard/activities', auth='user')
    def get_activities_today(self):
        user = http.request.env.user
        if not user.employee_ids:
            return "No employee found"
        employee_id = user.employee_ids[0]
        
        today_date = fields.Datetime.today()
        start_date = today_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = today_date.replace(hour=23, minute=59, second=59, microsecond=0)
        attendance_info_today = http.request.env['hr.attendance'].sudo().search([
            ('employee_id', '=', employee_id.id),
            ('check_in', '>=', start_date),
            ('check_in', '<=', end_date)
        ])
        
        break_schedule = http.request.env['break.schedule'].sudo().search([
            ('employee_id', '=', employee_id.id),
            ('start_time', '>=', start_date),
            ('start_time', '<=', end_date)
        ])
        
        activities = get_activities(attendance_info_today, break_schedule)

        return http.Response(
            json.dumps({
                "activities": activities,
            }),
            headers=[('Content-Type', 'application/json')],
            status=200,
        )

    @route("/api/oms/dashboard/work_time_statistics", auth="user")
    def get_weekly_worked_hours_graph(self):
        user = http.request.env.user
        if not user.employee_ids:
            return "No employee Found"

        employee_id = user.employee_ids[0]
        
        today = fields.Datetime.now()
        start_of_the_week = today - timedelta(days=today.weekday())
        
        attendance_info = http.request.env['hr.attendance'].sudo().search([
            ('employee_id', '=', employee_id.id),
            ('check_in', '>=', start_of_the_week),
        ])
        
        total_hours_worked_in_days = {
            "Monday": 0,
            "Tuesday": 0,
            "Wednesday": 0,
            "Thursday": 0,
            "Friday": 0,
            "Saturday": 0,
            "Sunday": 0,
        }
        
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        for attendance in attendance_info:
            check_in_date = fields.Datetime.from_string(attendance.check_in)
            day_of_week = days[check_in_date.weekday()]
            total_hours_worked_in_days[day_of_week] += attendance.worked_hours
        
        data = [total_hours_worked_in_days[day] for day in days]
        
        return http.Response(
            json.dumps({
                "data": data,
            }),
            headers=[('Content-Type', 'application/json')],
            status=200,
        )
        
    @route("/api/oms/dashboard/get_announcements", auth="user")
    def get_announcements(self):
        # get announcements which are active and in the last 7 days
        announcements = http.request.env["oms.announcement"].sudo().search([
            ('is_active', '=', True),
            ('create_date', '>=', fields.Datetime.today() - timedelta(days=7)),
        ])
        
        announcements_data = []
        for announcement in announcements:
            announcements_data.append({
                "title": announcement.name,
                "description": announcement.description,
                "date": str(announcement.create_date.astimezone(pytz.timezone('Asia/Karachi')).date()),
            })
            
        return http.Response(
            json.dumps({
                "announcements": announcements_data,
            }),
            headers=[('Content-Type', 'application/json')],
            status=200,
        )


def convert_hours_into_hh_mm_ss(seconds):
    hours = seconds // 3600
    seconds %= 3600
    minutes = seconds // 60
    seconds %= 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

def get_activities(attendance_info_today, break_schedule):
    activities = []

    for attendance in attendance_info_today:
        check_in = attendance['check_in']
        check_out = attendance['check_out']

        # Convert to timezone
        check_in = check_in.astimezone(pytz.timezone('Asia/Karachi'))
        check_out = check_out.astimezone(pytz.timezone('Asia/Karachi')) if check_out else None

        check_in_time = check_in.strftime('%I:%M:%S %p')
        check_out_time = check_out.strftime('%I:%M:%S %p') if check_out else "N/A"

        if check_out_time != "N/A":
            activities.append({
                "activity": "Checked Out",
                "time": check_out_time,
            })

        activities.append({
            "activity": "Checked In",
            "time": check_in_time,
        })

    for break_time in break_schedule:
        break_start = break_time['start_time'].astimezone(pytz.timezone('Asia/Karachi')).strftime('%I:%M:%S %p')
        break_end = break_time['end_time'].astimezone(pytz.timezone('Asia/Karachi')).strftime('%I:%M:%S %p') if break_time["end_time"] else "N/A"
        activities.append({
            "activity": "Break Start",
            "time": break_start,
        })
        
        if break_end != "N/A":
            activities.append({
                "activity": "Break End",
                "time": break_end,
            })

    activities.sort(key=lambda x: datetime.strptime(x['time'], '%I:%M:%S %p'))
    
    return activities

def compute_on_time_and_late(attendance_records):
    unique_employee_attendance_info = {}

    for record in attendance_records:
        check_in = record['check_in']
        check_out = record['check_out']
        
        # Convert to timezone
        check_in = check_in.astimezone(pytz.timezone('Asia/Karachi'))
        if check_out:
            check_out = check_out.astimezone(pytz.timezone('Asia/Karachi'))
        
        check_in_date = check_in.date()
        check_in_time = check_in.time()
        check_out_time = check_out.time() if check_out else None

        if check_in_date not in unique_employee_attendance_info:
            unique_employee_attendance_info[check_in_date] = {
                'date': check_in_date,
                'first_check_in_time': check_in_time,
                'last_check_out_time': check_out_time,
            }
        else:
            target = unique_employee_attendance_info[check_in_date]
            if check_in_time < target['first_check_in_time']:
                target['first_check_in_time'] = check_in_time
            if check_out_time and (not target['last_check_out_time'] or check_out_time > target['last_check_out_time']):
                target['last_check_out_time'] = check_out_time

    unique_attendance_array = list(unique_employee_attendance_info.values())

    total_ontime_in_month = 0
    for attendance in unique_attendance_array:
        first_check_in_time = attendance['first_check_in_time']
        first_check_in_time_seconds = first_check_in_time.hour * 3600 + first_check_in_time.minute * 60 + first_check_in_time.second

        if first_check_in_time_seconds <= 32400:  # 9:00 AM in seconds
            total_ontime_in_month += 1

    total_latetime_in_month = len(unique_attendance_array) - total_ontime_in_month

    return total_ontime_in_month, total_latetime_in_month

