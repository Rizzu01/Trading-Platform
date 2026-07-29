import ccxt


class BinanceExchange:
    def __init__(
        self,
        api_key: str,
        api_secret: str,
        market_type: str = "spot",
    ):
        """
        market_type:
            spot  -> Binance Spot
            usdm  -> Binance USD-M Futures
            coinm -> Binance Coin-M Futures
        """

        options = {}

        if market_type.lower() == "usdm":
            options["defaultType"] = "future"
        elif market_type.lower() == "coinm":
            options["defaultType"] = "delivery"
        else:
            options["defaultType"] = "spot"

        print("=" * 60)
        print("MARKET TYPE :", market_type)
        print("OPTIONS     :", options)
        print("=" * 60)

        self.client = ccxt.binance(
            {
                "apiKey": api_key,
                "secret": api_secret,
                "enableRateLimit": True,
                "timeout": 30000,
                "options": options,
            }
        )

        print("API URL :", self.client.urls["api"])

    # -------------------------------------------------------
    # Validate API Credentials
    # -------------------------------------------------------

    def validate_credentials(self):
        return self.client.fetch_balance()

    # -------------------------------------------------------
    # Account Balance
    # -------------------------------------------------------

    def get_balance(self):
        balance = self.client.fetch_balance()

        assets = []

        totals = balance.get("total", {})
        free = balance.get("free", {})
        used = balance.get("used", {})

        for asset, total in totals.items():
            if total and float(total) > 0:
                assets.append(
                    {
                        "asset": asset,
                        "free": float(free.get(asset, 0)),
                        "used": float(used.get(asset, 0)),
                        "total": float(total),
                    }
                )

        return assets

    # -------------------------------------------------------
    # Current Price
    # -------------------------------------------------------

    def get_ticker(self, symbol: str):
        """
        Example:
            BTC/USDT
            ETH/USDT
        """

        ticker = self.client.fetch_ticker(symbol)

        return {
            "symbol": symbol,
            "price": ticker["last"],
            "bid": ticker["bid"],
            "ask": ticker["ask"],
            "high": ticker["high"],
            "low": ticker["low"],
            "volume": ticker["baseVolume"],
        }

    # -------------------------------------------------------
    # OHLCV
    # -------------------------------------------------------

    def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
    ):
        return self.client.fetch_ohlcv(
            symbol,
            timeframe=timeframe,
            limit=limit,
        )

    # -------------------------------------------------------
    # Open Positions (Future)
    # -------------------------------------------------------

    def get_positions(self):
        raise NotImplementedError

    # -------------------------------------------------------
    # Open Orders
    # -------------------------------------------------------

    def get_open_orders(self, symbol=None):
        return self.client.fetch_open_orders(symbol)

    # -------------------------------------------------------
    # Order History
    # -------------------------------------------------------

    def get_order_history(self, symbol=None):
        return self.client.fetch_orders(symbol)

    # -------------------------------------------------------
    # Market Buy
    # -------------------------------------------------------

    def market_buy(self, symbol: str, amount: float):
        return self.client.create_market_buy_order(
            symbol,
            amount,
        )

    # -------------------------------------------------------
    # Market Sell
    # -------------------------------------------------------

    def market_sell(self, symbol: str, amount: float):
        return self.client.create_market_sell_order(
            symbol,
            amount,
        )

    # -------------------------------------------------------
    # Limit Buy
    # -------------------------------------------------------

    def limit_buy(
        self,
        symbol: str,
        amount: float,
        price: float,
    ):
        return self.client.create_limit_buy_order(
            symbol,
            amount,
            price,
        )

    # -------------------------------------------------------
    # Limit Sell
    # -------------------------------------------------------

    def limit_sell(
        self,
        symbol: str,
        amount: float,
        price: float,
    ):
        return self.client.create_limit_sell_order(
            symbol,
            amount,
            price,
        )

    # -------------------------------------------------------
    # Cancel Order
    # -------------------------------------------------------

    def cancel_order(
        self,
        order_id: str,
        symbol: str,
    ):
        return self.client.cancel_order(
            order_id,
            symbol,
        )