# Build context: repository ROOT (set by docker-compose.yml).
# This lets us COPY both backend/* and the top-level VERSION file in one go.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# System deps: samba clients/tools so the backend can invoke smbpasswd/setfacl/getfacl
# inside the container if running in Docker mode.
RUN apt-get update && apt-get install -y --no-install-recommends \
        samba-common-bin \
        acl \
        sudo \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY VERSION ./VERSION

# Run as unprivileged user inside the container (host commands still gated by sudoers).
RUN useradd -m -u 1500 -s /usr/sbin/nologin sambacontrol && \
    mkdir -p /var/log/sambacontrol /opt/sambacontrol/data && \
    chown -R sambacontrol:sambacontrol /var/log/sambacontrol /opt/sambacontrol
USER sambacontrol

EXPOSE 9913

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:9913/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9913", "--proxy-headers"]
