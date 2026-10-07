import time
import requests

from utils.coinswitch_auth import CoinSwitchSigner


class CoinSwitchExchange:

    BASE_URL = "https://coinswitch.co"

    def __init__(
        self,
        api_key: str,
        api_secret: str,
    ):
        self.signer = CoinSwitchSigner(
            api_key=api_key,
            secret_key=api_secret,
        )

    def _request(
        self,
        method: str,
        endpoint: str,
        params: dict | None = None,
        body: dict | None = None,
    ):
        if params is None:
            params = {}

        if body is None:
            body = {}

        headers, signed_path = self.signer.sign_request(
            method=method,
            path=endpoint,
            params=params,
        )

        url = self.BASE_URL + signed_path

        req = requests.Request(
            method=method,
            url=url,
            headers=headers,
            json=body,
        )

        prepared = req.prepare()

        session = requests.Session()
        response = session.send(prepared, timeout=30)

        response.raise_for_status()
        try:
            return response.json()
        except ValueError as exc:
            raise Exception("CoinSwitch returned an invalid response.") from exc

    def validate_credentials(self):
        try:
            return self._request(
                method="GET",
                endpoint="/trade/api/v2/user/portfolio",
            )
        except Exception as e:
            raise Exception("CoinSwitch authentication failed. Verify the API key and API secret.") from e

    def get_balance(self):
        response = self._request(
            method="GET",
            endpoint="/trade/api/v2/user/portfolio",
        )

        balances = {}

        for asset in response["data"]:
            balances[asset["currency"]] = {
                "free": float(asset.get("main_balance", 0)),
                "locked": float(asset.get("blocked_balance_order", 0)),
                "total": (
                    float(asset.get("main_balance", 0))
                    + float(asset.get("blocked_balance_order", 0))
                ),
            }

        return balances

    def get_ticker(
        self,
        symbol: str,
    ):
        response = self._request(
            method="GET",
            endpoint="/trade/api/v2/24hr/ticker",
            params={
                "exchange": "coinswitchx",
                "symbol": symbol.upper(),
            },
        )

        return response["data"]["coinswitchx"]

    def get_ohlcv(
        self,
        symbol: str,
        interval: str = "1",
        limit: int = 100,
    ):
        interval_ms = int(interval) * 60 * 1000

        end_time = int(time.time() * 1000)
        start_time = end_time - (limit * interval_ms)

        response = self._request(
            method="GET",
            endpoint="/trade/api/v2/candles",
            params={
                "exchange": "coinswitchx",
                "symbol": symbol.upper(),
                "interval": interval,
                "start_time": start_time,
                "end_time": end_time,
                "limit": limit,
            },
        )

        return response["data"]

    def market_buy(
        self,
        symbol: str,
        quantity: float,
    ):
        body = {
            "exchange": "coinswitchx",
            "symbol": symbol.upper(),
            "side": "buy",
            "type": "market",
            "quantity": float(quantity),
        }

        return self._request(
            method="POST",
            endpoint="/trade/api/v2/order",
            body=body,
        )

    def limit_buy(
        self,
        symbol: str,
        quantity: float,
        price: float,
    ):
        body = {
            "exchange": "coinswitchx",
            "symbol": symbol.upper(),
            "side": "buy",
            "type": "limit",
            "price": float(price),
            "quantity": float(quantity),
        }

        return self._request(
            method="POST",
            endpoint="/trade/api/v2/order",
            body=body,
        )