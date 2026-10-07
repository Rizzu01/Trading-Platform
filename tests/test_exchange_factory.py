import pytest

from exchanges.factory import create_exchange


def test_factory_rejects_unknown_exchange():
    with pytest.raises(ValueError, match="Unsupported exchange"):
        create_exchange(
            exchange="unknown",
            api_key="test",
            api_secret="test",
        )


def test_factory_rejects_non_spot_coinswitch():
    with pytest.raises(NotImplementedError, match="CoinSwitch futures"):
        create_exchange(
            exchange="coinswitch",
            api_key="test",
            api_secret="test",
            market_type="usdm",
        )


def test_binance_usdm_uses_unified_future_symbol():
    from exchanges.binance import BinanceExchange

    exchange = BinanceExchange(api_key="test", api_secret="test", market_type="usdm")
    assert exchange._normalize_symbol("BTC/USDT") == "BTC/USDT:USDT"
    assert exchange._normalize_symbol("BTC/USDT:USDT") == "BTC/USDT:USDT"


def test_binance_spot_keeps_spot_symbol():
    from exchanges.binance import BinanceExchange

    exchange = BinanceExchange(api_key="test", api_secret="test", market_type="spot")
    assert exchange._normalize_symbol("BTC/USDT") == "BTC/USDT"
