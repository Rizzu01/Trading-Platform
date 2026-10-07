from exchanges.binance import BinanceExchange
from exchanges.coinswitch import CoinSwitchExchange


def create_exchange(
    exchange_name: str,
    api_key: str,
    api_secret: str,
    passphrase: str | None = None,
    market_type: str = "spot",
):
    name = exchange_name.strip().lower()

    if name == "binance":
        return BinanceExchange(
            api_key=api_key,
            api_secret=api_secret,
            market_type=market_type,
        )

    if name in {"coinswitch", "coin_switch"}:
        return CoinSwitchExchange(
            api_key=api_key,
            api_secret=api_secret,
        )

    raise ValueError(f"Unsupported exchange: {exchange_name}")
