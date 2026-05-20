# Production Setup Guide

For non-trivial deployments, work through the checklist below before
exposing SambaControl outside a trusted network.

---

## 1. Rotate the secret key

The installer generates one with `openssl rand -hex 48`, but verify:

```bash
sudo grep SECRET_KEY /opt/sambacontrol/.env
```

It must not be `INSECURE-CHANGE-ME` or any value you've committed elsewhere.
Rotating invalidates all issued JWTs — users will have to log in again.

```bash
sudo sed -i "s|SAMBACONTROL_SECRET_KEY=.*|SAMBACONTROL_SECRET_KEY=$(openssl rand -hex 48)|" /opt/sambacontrol/.env
sudo systemctl restart sambacontrol-backend
```

---

## 2. Put TLS in front

Plain HTTP on port 9912 is fine on a LAN. For internet-facing or even
cross-VLAN access, terminate TLS in a reverse proxy. See
[DEPLOYMENT.md → Behind a reverse proxy with TLS](DEPLOYMENT.md#behind-a-reverse-proxy-with-tls).

---

## 3. Lock down the admin port

Even with TLS, restrict who can reach 9912:

```bash
# Allow only 10.0.0.0/24 to reach the GUI
sudo ufw delete allow 9912/tcp 2>/dev/null || true
sudo ufw allow from 10.0.0.0/24 to any port 9912 proto tcp comment 'SambaControl'
```

---

## 4. Pick the right shares root

By default everything lives under `/srv/samba/shares`. If you want shares
backed by a separate disk:

```bash
sudo mkdir -p /mnt/data/shares
sudo chown root:users /mnt/data/shares
sudo chmod 2775 /mnt/data/shares
sudo sed -i 's|SAMBACONTROL_SHARES_ROOT=.*|SAMBACONTROL_SHARES_ROOT=/mnt/data/shares|' /opt/sambacontrol/.env
sudo systemctl restart sambacontrol-backend
```

Update `/etc/sudoers.d/sambacontrol` if you change this path — replace
`/srv/samba/shares` everywhere it appears, then `visudo -c`.

---

## 5. Verify filesystem supports ACLs

ACLs need to be enabled on the filesystem hosting your shares. Ext4 and
XFS support them out of the box on Ubuntu 24.04:

```bash
# Check mount options
mount | grep " on $(df -P /srv/samba/shares | tail -1 | awk '{print $6}') "
# Should NOT show 'noacl'

# Test setfacl
sudo setfacl -m u:nobody:rx /srv/samba/shares
sudo getfacl /srv/samba/shares
```

If your `/etc/fstab` mounts with `noacl`, remove that option and remount.

---

## 6. Schedule data backups

The updater snapshots code automatically, but not the database. Add a cron
job:

```bash
sudo crontab -e
```

```cron
# SambaControl: snapshot DB + .env nightly
0 3 * * * /opt/sambacontrol/scripts/backup.sh >/dev/null 2>&1
```

The script keeps the last 10 snapshots. Mirror them off-host with `rsync`,
`rclone`, or your backup tool of choice.

---

## 7. Centralised logging

Application logs go to:

- `journalctl -u sambacontrol-backend` (stdout from uvicorn)
- `/var/log/sambacontrol/sambacontrol.log` (rotated, 5 × 5 MB)

To ship to a syslog server, add a `journald` forwarding config or point your
log shipper (Vector, Promtail, Fluent Bit) at the file.

---

## 8. Resource limits

The systemd unit is conservative by default. For a busy server, add an
override:

```bash
sudo systemctl edit sambacontrol-backend
```

```ini
[Service]
LimitNOFILE=65535
MemoryMax=1G
```

```bash
sudo systemctl restart sambacontrol-backend
```

---

## 9. Disable Samba guest access

The GUI lets you tick "Guest OK" per share. For most environments this
should stay off. If you never want guest access at all, add to
`/etc/samba/smb.conf` (in `[global]`):

```ini
map to guest = Never
guest account = nobody
```

---

## 10. Monitoring

A simple uptime probe:

```bash
curl -fsS http://127.0.0.1:9912/api/health || echo "SambaControl is DOWN"
```

Wire that into your monitoring system (Healthchecks.io, Uptime Kuma,
Prometheus blackbox exporter, etc).

---

## 11. Upgrade strategy

- Pin to a release tag in production: `sudo ./update.sh --version 1.2.3`
- Watch the GitHub Releases page for changelogs
- Test major version bumps on a staging box first
- The updater always backs up before applying — `/opt/sambacontrol/backups/`

---

## 12. Disaster recovery

Should the server burn down:

1. Provision a fresh Ubuntu 24.04 host
2. Re-run the one-line installer
3. Restore the latest `data-*.tar.gz` from off-host backup:
   ```bash
   sudo /opt/sambacontrol/scripts/restore.sh /path/to/data-YYYYMMDD-HHMMSS.tar.gz
   ```
4. Re-create the share *directories* on disk (paths are stored in DB, but
   the actual file content is your responsibility to back up separately)

The DB itself is small (a few hundred KB even with thousands of shares) so
nightly off-host backups are cheap insurance.
