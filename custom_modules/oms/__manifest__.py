{
    'name': 'OMS',
    'version': '1.0',
    'depends': ['base', 'web', 'hr', 'hr_attendance', 'hr_holidays','hr_homeworking'],
    'author': 'Muhammad Absar',
    'category': 'OMS',
    "data": [
        "views/announcement.xml",
        
        "views/actions.xml",
        "views/menus.xml",
        "views/sequence.xml",
        "views/break_schedule.xml",
        # "views/remote_work.xml",
        "security/ir.model.access.csv",
    ],
    "assets": {
        "web.assets_backend": [
            "oms/static/src/css/*",
            "oms/static/src/js/*",
            "oms/static/src/js/sections/**/*",
            "oms/static/src/leave/**/*",
            "oms/static/src/settings/**/*",
            "oms/static/src/employees/**/*",
            "oms/static/src/attendance/**/*",
            "oms/static/src/remote_work/**/*",
            "oms/static/src/resignation/**/*",
        ]
    },
    'description': """
        OMS
    """,
    'installable': True,
    'license': 'GPL-2',
}
