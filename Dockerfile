# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
ENV ODOO_VERSION=18.0
ENV ODOO_USER=odoo
ENV ODOO_HOME=/opt/odoo
ENV ODOO_CONF=/etc/odoo/odoo.conf

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libxml2-dev \
    libxslt1-dev \
    libevent-dev \
    libsasl2-dev \
    libldap2-dev \
    libpq-dev \
    libjpeg-dev \
    libjpeg62-turbo-dev \
    liblcms2-dev \
    libblas-dev \
    libatlas-base-dev \
    libssl-dev \
    libffi-dev \
    libfreetype6-dev \
    libwebp-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libx11-dev \
    libxext-dev \
    libxrender-dev \
    libfontconfig1-dev \
    libpango1.0-dev \
    libxft-dev \
    libtool \
    libyaml-dev \
    libyaml-0-2 \
    python3-dev \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    python3-venv \
    git \
    wget \
    postgresql-client \
    && apt-get clean


# wkhtmltopdf

RUN apt-get install fontconfig libfreetype6 libjpeg62-turbo libpng16-16 libx11-6 libxcb1 libxext6 libxrender1 xfonts-75dpi xfonts-base -y && wget http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.0g-2ubuntu4_amd64.deb -O libssl1.1.deb && dpkg -i libssl1.1.deb && rm libssl1.1.deb && wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox_0.12.6.1-2.bullseye_amd64.deb -O wkhtmltopdf.deb \
&& dpkg -i ./wkhtmltopdf.deb \
&& apt-get -f install -y \
&& rm wkhtmltopdf.deb \
&& rm -rf /var/lib/apt/lists/*

# Create a user for Odoo
RUN useradd -m -d ${ODOO_HOME} -U -r -s /bin/bash ${ODOO_USER}

# Set the working directory
WORKDIR ${ODOO_HOME}

COPY requirements.txt .
# Install Python dependencies
RUN pip3 install -r requirements.txt

# Copy the Odoo project files
COPY . ${ODOO_HOME}/

# Create the configuration file
RUN mkdir -p /etc/odoo && \
    touch ${ODOO_CONF} && \
    chown ${ODOO_USER}:${ODOO_USER} ${ODOO_CONF}

# Set the entrypoint script
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose the port
EXPOSE 8069

# Switch to the Odoo user
USER ${ODOO_USER}

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Command to run Odoo
CMD ["python3", "odoo-bin", "--config", "/etc/odoo/odoo.conf", "-i", "base", "--addons-path=addons,custom_modules"]