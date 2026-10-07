from models.exchange import Exchange
from models.order import Order
from models.position import Position
from models.user import User


def _column_names(model):
    return {column.name for column in model.__table__.columns}


def test_user_schema_contains_auth_fields():
    columns = _column_names(User)
    assert {"id", "email", "password_hash", "role", "is_active"} <= columns


def test_exchange_schema_contains_market_credentials():
    columns = _column_names(Exchange)
    assert {"id", "user_id", "exchange_name", "market_type", "api_key", "api_secret"} <= columns


def test_order_schema_contains_execution_state():
    columns = _column_names(Order)
    assert {"id", "user_id", "exchange_id", "external_order_id", "symbol", "side", "type", "status"} <= columns


def test_position_schema_contains_risk_state():
    columns = _column_names(Position)
    assert {
        "id",
        "user_id",
        "exchange_id",
        "symbol",
        "side",
        "quantity",
        "entry_price",
        "leverage",
        "unrealized_pnl",
        "liquidation_price",
    } <= columns


def test_exchange_user_relationship_is_configured():
    assert "exchanges" in User.__mapper__.relationships
    assert "user" in Exchange.__mapper__.relationships
