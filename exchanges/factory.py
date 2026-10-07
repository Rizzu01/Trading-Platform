from exchanges.binance import BinanceExchange
from exchanges.coinswitch import CoinSwitchExchange


def create_exchange(exchange: str, api_key: str, api_secret: str, passphrase: str | None = None, market_type: str = "spot"):
    name = exchange.strip().lower()
    if name == "binance":
        return BinanceExchange(api_key=api_key, api_secret=api_secret, market_type=market_type)
    if name in {"coinswitch", "coin_switch"}:
        if market_type != "spot":
            raise NotImplementedError("CoinSwitch futures adapter is not configured.")
        return CoinSwitchExchange(api_key=api_key, api_secret=api_secret)
    raise ValueError(f"Unsupported exchange: {exchange}")
