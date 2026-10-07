from __future__ import annotations

import time
import requests

from strategies.indicators import adx, atr, bollinger, ema, rsi, sma


BINANCE_SPOT = "https://api.binance.com"
BINANCE_FUTURES = "https://fapi.binance.com"


class MarketContextService:
    @staticmethod
    def _symbol(symbol: str) -> str:
        value = symbol.strip().upper().replace("/", "")
        if not value.endswith("USDT"):
            raise ValueError("Only USDT-quoted symbols are supported by the public context service.")
        return value

    @staticmethod
    def _get(base: str, path: str, params: dict) -> dict | list:
        response = requests.get(base + path, params=params, timeout=10)
        response.raise_for_status()
        return response.json()

    @classmethod
    def build(cls, symbol: str, market_type: str = "spot", timeframe: str = "15m", limit: int = 300) -> dict:
        market = market_type.lower()
        if market not in {"spot", "usdm"}:
            raise ValueError("market_type must be spot or usdm")
        symbol = cls._symbol(symbol)
        base = BINANCE_FUTURES if market == "usdm" else BINANCE_SPOT

        raw = cls._get(base, "/fapi/v1/klines" if market == "usdm" else "/api/v3/klines", {
            "symbol": symbol, "interval": timeframe, "limit": min(max(limit, 120), 1000)
        })
        candles = [{
            "timestamp": int(x[0]), "open": float(x[1]), "high": float(x[2]),
            "low": float(x[3]), "close": float(x[4]), "volume": float(x[5])
        } for x in raw]
        if len(candles) < 50:
            raise ValueError("Insufficient real-time data to evaluate this setup.")

        closes = [x["close"] for x in candles]
        volumes = [x["volume"] for x in candles]
        e20, e50 = ema(closes, 20), ema(closes, 50)
        rsi14, atr14, adx14 = rsi(closes, 14), atr(candles, 14), adx(candles, 14)
        middle, upper, lower = bollinger(closes, 20, 2)
        vol_sma = sma(volumes, 20)

        last = len(candles) - 1
        price = closes[last]
        ticker = cls._get(base, "/fapi/v1/ticker/24hr" if market == "usdm" else "/api/v3/ticker/24hr", {"symbol": symbol})
        depth = cls._get(base, "/fapi/v1/depth" if market == "usdm" else "/api/v3/depth", {"symbol": symbol, "limit": 20})

        result = {
            "symbol": symbol[:-4] + "/USDT",
            "marketType": market,
            "timeframe": timeframe,
            "timestamp": int(time.time() * 1000),
            "price": price,
            "volume": float(ticker.get("volume", 0)),
            "changePercent": float(ticker.get("priceChangePercent", 0)),
            "indicators": {
                "ema20": e20[last], "ema50": e50[last], "rsi14": rsi14[last],
                "atr14": atr14[last], "adx14": adx14[last],
                "sma20Volume": vol_sma[last],
                "bollinger": {"middle": middle[last], "upper": upper[last], "lower": lower[last]},
            },
            "orderBook": {
                "bid": float(depth["bids"][0][0]) if depth.get("bids") else None,
                "ask": float(depth["asks"][0][0]) if depth.get("asks") else None,
                "bidVolume": sum(float(x[1]) for x in depth.get("bids", [])),
                "askVolume": sum(float(x[1]) for x in depth.get("asks", [])),
            },
            "candles": candles,
        }

        if market == "usdm":
            premium = cls._get(base, "/fapi/v1/premiumIndex", {"symbol": symbol})
            oi = cls._get(base, "/fapi/v1/openInterest", {"symbol": symbol})
            result["fundingRate"] = float(premium.get("lastFundingRate", 0))
            result["markPrice"] = float(premium.get("markPrice", price))
            result["indexPrice"] = float(premium.get("indexPrice", price))
            result["openInterest"] = float(oi.get("openInterest", 0))

            try:
                ratio = cls._get(base, "/futures/data/globalLongShortAccountRatio", {
                    "symbol": symbol, "period": timeframe, "limit": 1
                })
                result["longShortRatio"] = float(ratio[-1]["longShortRatio"]) if ratio else None
            except Exception:
                result["longShortRatio"] = None
        else:
            result.update({"fundingRate": None, "markPrice": None, "indexPrice": None, "openInterest": None, "longShortRatio": None})

        result["regime"] = cls._regime(result["indicators"], candles)
        return result

    @staticmethod
    def _regime(ind: dict, candles: list[dict]) -> dict:
        e20, e50, r, a, x = ind["ema20"], ind["ema50"], ind["rsi14"], ind["atr14"], ind["adx14"]
        price = candles[-1]["close"]
        if None in (e20, e50, r, a, x) or price <= 0:
            return {"name": "Insufficient Data", "trend": "unknown", "volatility": "unknown"}
        atr_pct = a / price * 100
        if x >= 25 and e20 > e50:
            name = "Strong Bull Trend"
        elif x >= 20 and e20 > e50:
            name = "Weak Bull Trend"
        elif x >= 25 and e20 < e50:
            name = "Strong Bear Trend"
        elif x >= 20 and e20 < e50:
            name = "Weak Bear Trend"
        else:
            name = "Sideways"
        volatility = "High Volatility" if atr_pct >= 2.0 else "Low Volatility" if atr_pct <= 0.7 else "Normal Volatility"
        return {"name": name, "trend": "bullish" if e20 > e50 else "bearish" if e20 < e50 else "neutral", "volatility": volatility, "atrPercent": round(atr_pct, 4)}
