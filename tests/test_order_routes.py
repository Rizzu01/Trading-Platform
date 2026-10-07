from uuid import UUID

from fastapi.testclient import TestClient

from main import app
from dependencies.auth import get_current_user


class StubUser:
    id = UUID("12345678-1234-5678-1234-567812345678")


def test_market_order_requires_authentication():
    client = TestClient(app)
    response = client.post(
        "/api/v1/orders/12345678-1234-5678-1234-567812345678/market-buy",
        json={"symbol": "BTCUSDT", "amount": 0.01},
    )
    assert response.status_code == 403


def test_market_order_validation_is_enforced():
    app.dependency_overrides[get_current_user] = lambda: StubUser()
    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/orders/12345678-1234-5678-1234-567812345678/market-buy",
            json={"symbol": "BTCUSDT", "amount": 0},
        )
        assert response.status_code == 422
        assert response.json()["success"] is False
        assert response.json()["message"] == "Validation failed."
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_limit_order_validation_rejects_negative_price():
    app.dependency_overrides[get_current_user] = lambda: StubUser()
    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/orders/12345678-1234-5678-1234-567812345678/limit-buy",
            json={"symbol": "BTCUSDT", "amount": 0.01, "price": -1},
        )
        assert response.status_code == 422
        assert response.json()["success"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
