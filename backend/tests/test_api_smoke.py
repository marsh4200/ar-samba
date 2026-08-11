"""End-to-end smoke tests against the FastAPI app in DEV_MODE."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_setup_status_initially_uninitialised(client):
    r = client.get("/api/auth/setup-status")
    assert r.status_code == 200
    assert r.json() == {"initialised": False}


def test_first_run_setup_then_login(client):
    # Setup
    r = client.post("/api/auth/setup", json={
        "username": "admin",
        "password": "super-secret-123",
        "email": "admin@example.com",
    })
    assert r.status_code == 201, r.text
    tokens = r.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    # Status now flipped
    r = client.get("/api/auth/setup-status")
    assert r.json() == {"initialised": True}

    # Setup endpoint is now sealed
    r = client.post("/api/auth/setup", json={
        "username": "second",
        "password": "another-pass-123",
    })
    assert r.status_code == 409

    # /me with the token
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert r.status_code == 200
    me = r.json()
    assert me["username"] == "admin"
    assert me["role"] == "admin"

    # JSON login
    r = client.post("/api/auth/login-json", json={"username": "admin", "password": "super-secret-123"})
    assert r.status_code == 200
    assert r.json()["access_token"]

    # Wrong password
    r = client.post("/api/auth/login-json", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_auth_required(client):
    # Set up an admin so the app is past first-run
    client.post("/api/auth/setup", json={"username": "admin", "password": "super-secret-123"})
    r = client.get("/api/users")
    assert r.status_code == 401
    r = client.get("/api/shares")
    assert r.status_code == 401
    r = client.get("/api/system/dashboard")
    assert r.status_code == 401


def _admin_headers(client):
    """Set up the admin, or sign in if a previous test already created one."""
    creds = {"username": "admin", "password": "super-secret-123"}
    r = client.post("/api/auth/setup", json=creds)
    if r.status_code == 409:                      # already initialised
        r = client.post("/api/auth/login-json", json=creds)
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_system_metrics_requires_auth(client):
    client.post("/api/auth/setup", json={"username": "admin", "password": "super-secret-123"})
    assert client.get("/api/system/metrics").status_code == 401


def test_system_metrics_shape(client):
    """The dashboard gauges rely on every one of these fields being present."""
    headers = _admin_headers(client)
    r = client.get("/api/system/metrics", headers=headers)
    assert r.status_code == 200

    body = r.json()
    for key in (
        "hostname", "kernel",
        "cpu_percent", "cpu_cores", "cpu_threads",
        "load_1", "load_5", "load_15",
        "memory_total", "memory_used", "memory_percent",
        "swap_total", "swap_used", "swap_percent",
        "uptime_seconds",
    ):
        assert key in body, f"missing {key}"

    # Percentages must be usable directly as gauge values
    assert 0 <= body["cpu_percent"] <= 100
    assert 0 <= body["memory_percent"] <= 100
    assert body["memory_total"] > 0
    assert body["uptime_seconds"] >= 0


def test_dashboard_contract_unchanged(client):
    """The pre-existing dashboard payload must keep its original shape."""
    headers = _admin_headers(client)
    body = client.get("/api/system/dashboard", headers=headers).json()
    for key in ("user_count", "share_count", "services", "storage",
                "recent_activity", "version"):
        assert key in body
