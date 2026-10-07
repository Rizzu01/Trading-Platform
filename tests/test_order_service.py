from uuid import UUID

import pytest

from services.order_service import OrderService


def test_normalize_symbol_accepts_common_formats():
    assert OrderService._normalize_symbol("BTCUSDT") == "BTC/USDT"
    assert OrderService._normalize_symbol("BTC/USDT") == "BTC/USDT"


def test_normalize_symbol_rejects_invalid_symbol():
    with pytest.raises(ValueError):
        OrderService._normalize_symbol("BTC")


def test_normalize_symbol_rejects_empty_symbol():
    with pytest.raises(ValueError):
        OrderService._normalize_symbol("")


def test_uuid_shape_is_supported():
    value = UUID("12345678-1234-5678-1234-567812345678")
    assert str(value) == "12345678-1234-5678-1234-567812345678"
