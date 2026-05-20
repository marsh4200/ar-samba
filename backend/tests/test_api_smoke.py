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
