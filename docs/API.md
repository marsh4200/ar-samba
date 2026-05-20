# API Reference

The full, always-up-to-date OpenAPI schema is served by the backend itself:

- Swagger UI: `http://<server>:9912/api/docs`
- ReDoc:      `http://<server>:9912/api/redoc`
- JSON:       `http://<server>:9912/api/openapi.json`

This page is a brief tour.

---

## Conventions

- Base path: `/api`
- All non-auth endpoints require `Authorization: Bearer <access_token>`
- Times are ISO-8601 UTC
- All errors return JSON `{"detail": "..."}`

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/auth/setup-status` | Returns `{"initialised": bool}`. No auth. |
| `POST` | `/api/auth/setup` | First-run setup. Creates the first admin. Only callable once. |
| `POST` | `/api/auth/login` | OAuth2 password-form login. |
| `POST` | `/api/auth/login-json` | JSON-body login `{username, password}`. |
| `POST` | `/api/auth/refresh?refresh_token=...` | Exchange a refresh token for a new pair. |
| `GET`  | `/api/auth/me` | Returns the current admin user. |

Both `/login` endpoints return:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer"
}
```

---

## Users (Samba-managed)

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/users` | List Samba users |
| `POST`   | `/api/users` | Create one (provisions Linux + Samba) |
| `PATCH`  | `/api/users/{id}` | Update display name / enabled flag |
| `POST`   | `/api/users/{id}/password` | Reset password |
| `DELETE` | `/api/users/{id}` | Remove user + ACLs |

**Create body:**
```json
{
  "username": "raymond",
  "password": "s3cure-password",
  "display_name": "Raymond M."
}
```

---

## Shares

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/shares` | List shares |
| `POST`   | `/api/shares` | Create share (path is jailed to shares root) |
| `PATCH`  | `/api/shares/{id}` | Update comment/flags |
| `DELETE` | `/api/shares/{id}` | Remove share (directory on disk is **not** deleted) |

**Create body:**
```json
{
  "name": "cncserver",
  "path": "cncserver",
  "comment": "CNC drop folder",
  "browseable": true,
  "read_only": false,
  "guest_ok": false
}
```

---

## Per-share access / ACL

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/shares/{id}/access` | List user grants for this share |
| `PUT`    | `/api/shares/{id}/access` | Create or update a user's grant |
| `DELETE` | `/api/shares/{id}/access/{user_id}` | Revoke a grant + remove ACLs |
| `GET`    | `/api/shares/{id}/acl` | Live `getfacl` output, parsed |

**Upsert body:**
```json
{
  "user_id": 7,
  "can_read": true,
  "can_write": true,
  "can_execute": true,
  "can_delete": false,
  "can_create_files": true,
  "can_create_folders": true,
  "recursive": true,
  "default_acl": true
}
```

The toggles collapse into `rwx` for the underlying `setfacl` call:
- `r` = `can_read`
- `w` = `can_write OR can_create_files OR can_create_folders OR can_delete`
- `x` = `can_execute OR can_create_folders`

`default_acl=true` also applies the same ACL via `setfacl -d` so newly-created
files inherit it.

---

## System

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/system/dashboard` | Aggregated counts, service status, disk usage, recent activity |
| `POST` | `/api/system/samba/reload` | Reload `smbd` |

---

## Logs

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/logs?category=...&limit=100&offset=0` | Paged audit log query |

Categories: `auth`, `user`, `share`, `acl`, `samba`, `update`, `system`.

---

## Updates

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/updates/version` | Compares local `VERSION` to latest GitHub release |
| `POST` | `/api/updates/start?target=v1.2.3` | Kick off the update job (admin role) |
| `GET`  | `/api/updates/status` | Poll current job — `state`, `step`, `progress`, last logs |

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | `{"status":"ok","version":"..."}` — no auth |

Use this for liveness/readiness probes.
