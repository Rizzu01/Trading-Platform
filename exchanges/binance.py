import ccxt


class BinanceExchange:
    def __init__(self, api_key: str, api_secret: str, market_type: str = "spot"):
        options = {"defaultType": "spot"}
        if market_type.lower() == "usdm":
            options["defaultType"] = "future"
        elif market_type.lower() == "coinm":
            options["defaultType"] = "delivery"

        self.market_type = market_type.lower()
        self.client = ccxt.binance({
            "apiKey": api_key,
            "secret": api_secret,
            "enableRateLimit": True,
            "timeout": 30000,
            "options": options,
        })

    def validate_credentials(self):
        return self.client.fetch_balance()

    def get_balance(self):
        balance = self.client.fetch_balance()
        assets = []
        for asset, total in balance.get("total", {}).items():
            if total and float(total) > 0:
                assets.append({
                    "asset": asset,
                    "free": float(balance.get("free", {}).get(asset, 0)),
                    "used": float(balance.get("used", {}).get(asset, 0)),
                    "total": float(total),
                })
        return assets

    def get_ticker(self, symbol: str):
        ticker = self.client.fetch_ticker(symbol)
        return {
            "symbol": symbol,
            "price": ticker.get("last"),
            "bid": ticker.get("bid"),
            "ask": ticker.get("ask"),
            "high": ticker.get("high"),
            "low": ticker.get("low"),
            "volume": ticker.get("baseVolume"),
        }

    def get_ohlcv(self, symbol: str, timeframe: str = "1h", limit: int = 100):
        return self.client.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)

    def get_positions(self):
        if self.market_type not in {"usdm", "coinm"}:
            return []
        return self.client.fetch_positions()

    def get_open_orders(self, symbol=None):
        return self.client.fetch_open_orders(symbol)

    def get_order_history(self, symbol=None):
        return self.client.fetch_orders(symbol)

    def market_buy(self, symbol: str, amount: float):
        return self.client.create_market_buy_order(symbol, amount)

    def market_sell(self, symbol: str, amount: float):
        return self.client.create_market_sell_order(symbol, amount)

    def limit_buy(self, symbol: str, amount: float, price: float):
        return self.client.create_limit_buy_order(symbol, amount, price)

    def limit_sell(self, symbol: str, amount: float, price: float):
        return self.client.create_limit_sell_order(symbol, amount, price)

    def set_leverage(self, symbol: str, leverage: int):
        if self.market_type not in {"usdm", "coinm"}:
            raise NotImplementedError("Leverage is only available for futures markets.")
        return self.client.set_leverage(leverage, symbol)

    def cancel_order(self, order_id: str, symbol: str):
        return self.client.cancel_order(order_id, symbol)
