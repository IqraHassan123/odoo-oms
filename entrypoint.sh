#!/bin/bash

# Set default values if not provided
: ${DB_HOST:=db}
: ${DB_PORT:=5432}
: ${DB_USER:=odoo}
: ${DB_PASSWORD:=odoo}
: ${DB_NAME:=odoo}
: ${ODOO_PORT:=8069}

# Create the configuration file
cat <<EOF > /etc/odoo/odoo.conf
[options]
addons_path = ${ODOO_HOME}/addons
data_dir = ${ODOO_HOME}/data
db_host = ${DB_HOST}
db_port = ${DB_PORT}
db_user = ${DB_USER}
db_password = ${DB_PASSWORD}
db_name = ${DB_NAME}
xmlrpc_port = ${ODOO_PORT}
EOF

# Run the command
exec "$@"