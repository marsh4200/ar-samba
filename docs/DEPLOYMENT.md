# Deployment Guide

This guide covers deploying SambaControl on Ubuntu Server 20.04, 22.04, and 24.04.

---

## Option A — One-line install (recommended)

On a fresh Ubuntu server (20.04, 22.04, or 24.04):

```bash
bash <(curl -sSL https://raw.githubusercontent.com/marsh4200/ar-samba/main/install.sh)
```

The installer is idempotent. Running it again on an existing install will:

- Update the code to the latest `main`
- Re-apply system services, sudoers, nginx
- Preserve `.env`, `data/`, and `backups/`

After it finishes, browse to `http://<server-ip>:9912` and complete the
first-run setup wizard to create the admin account.

---

## Option B — Manual install

```bash
# 1. Clone
sudo git clone https://github.com/marsh4200/ar-samba.git /opt/sambacontrol
cd /opt/sambacontrol

# 2. Run the installer locally
sudo bash install.sh
```

Everything the installer does is documented in `install.sh` — read it through
before running on a production box.

---

## Option C — Docker Compose (evaluation only)

```bash
git clone https://github.com/marsh4200/ar-samba.git
cd ar-samba
cp .env.example .env
# edit .env, set SAMBACONTROL_SECRET_KEY at minimum
docker compose up -d
```

Open `http://localhost:9912`.

> The Docker stack runs Samba *inside the container* and does not manage your
> host's Samba. For production, use the native install.

---

## What gets installed

| Path | Purpose |
|------|---------|
| `/opt/sambacontrol/` | Code, venv, frontend `dist/`, data, backups |
| `/opt/sambacontrol/.env` | Generated env file (mode 0600, owned by `sambacontrol`) |
| `/opt/sambacontrol/data/sambacontrol.db` | SQLite DB |
| `/opt/sambacontrol/backups/` | Auto-snapshots created by the updater |
| `/etc/samba/sambacontrol.conf` | The managed include file (overwritten on every change) |
| `/etc/samba/smb.conf` | Gets `include = /etc/samba/sambacontrol.conf` appended once |
| `/etc/systemd/system/sambacontrol-backend.service` | Backend unit |
| `/etc/nginx/sites-available/sambacontrol` | Nginx site (listens on 9912) |
| `/etc/sudoers.d/sambacontrol` | Restricted sudo allowlist |
| `/var/log/sambacontrol/sambacontrol.log` | Application log (rotated) |
| `/srv/samba/shares/` | Default jail directory under which all shares live |

The Samba packages (`samba`, `samba-common-bin`, `acl`) are installed by `apt`.

---

## Networking & firewall

SambaControl's web UI listens on **TCP 9912**. Samba uses:

- TCP/UDP 137, 138 (NetBIOS)
- TCP 139 (SMB over NetBIOS)
- TCP 445 (SMB direct)

If you use `ufw`:

```bash
sudo ufw allow 9912/tcp comment 'SambaControl'
sudo ufw allow samba
```

---

## Behind a reverse proxy with TLS

The bundled nginx site is plain HTTP for simplicity. To put it behind HTTPS,
either replace `/etc/nginx/sites-available/sambacontrol` with a TLS server
block of your own (terminate TLS, proxy to `127.0.0.1:9912`), or stop nginx
and run Caddy/Traefik in front of the backend on `127.0.0.1:9913`.

A minimal Caddy example:

```caddyfile
samba.example.com {
    reverse_proxy 127.0.0.1:9912
}
```

---

## Verifying the install

```bash
# Backend health
curl http://127.0.0.1:9913/api/health

# Through nginx
curl http://127.0.0.1:9912/api/health

# Backend service status
systemctl status sambacontrol-backend

# Tail logs
sudo journalctl -u sambacontrol-backend -f
```

---

## Updating

From the GUI: **Settings → Updates → Check → Update Now**.

From CLI:

```bash
sudo /opt/sambacontrol/update.sh
# or pin a specific tag:
sudo /opt/sambacontrol/update.sh --version 1.2.3
```

Backups are kept in `/opt/sambacontrol/backups/`. The last 5 are retained
automatically. If anything fails during update, the previous snapshot is
restored and the service is restarted.

---

## Uninstalling

```bash
sudo /opt/sambacontrol/uninstall.sh
```

Add `--purge` to also wipe `/opt/sambacontrol` (DB and backups).
Add `--remove-users` to delete every SambaControl-managed Samba user.
