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
