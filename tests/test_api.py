from uuid import UUID

from fastapi.testclient import TestClient

from main import app
from dependencies.auth import get_current_user


class StubUser:
    id = UUID("12345678-1234-5678-1234-567812345678")


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "healthy"


def test_exchange_requires_authentication():
    client = TestClient(app)
    response = client.get("/api/v1/exchange")
    assert response.status_code == 401


def test_exchange_validation_is_enforced():
    app.dependency_overrides[get_current_user] = lambda: StubUser()
    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/exchange",
            json={
                "exchange_name": "",
                "market_type": "invalid",
                "api_key": "key",
                "api_secret": "secret",
            },
        )
        assert response.status_code == 422
        assert response.json()["success"] is False
        assert response.json()["message"] == "Validation failed."
    finally:
        app.dependency_overrides.pop(get_current_user, None)
