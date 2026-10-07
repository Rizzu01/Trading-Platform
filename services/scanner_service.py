from __future__ import annotations

from exchanges.factory import create_exchange
from services.Market_context import MarketContextService
from services.trade_setup_service import build_trade_setup

def _score(setup: dict) -> int:
    if setup.get("direction") == "NO TRADE":
        return min(55, max(0, int(setup.get("confidence", 0))))
    agreement = setup.get("strategyAgreement", 0)
    evaluated = max(1, setup.get("strategiesEvaluated", 1))
    evidence = int(setup.get("historicalEvidenceScore", 0))
    live = int(setup.get("liveConfidence", setup.get("confidence", 0)))
    return max(0, min(100, round(live * 0.45 + agreement / evaluated * 25 + evidence * 0.30)))

def _discover_symbols(market_type: str, limit: int = 30) -> list[str]:
    client = create_exchange(exchange="binance", api_key="", api_secret="", market_type=market_type)
    markets = client.exchange.load_markets()
    candidates = []
    for symbol, market in markets.items():
        if market.get("quote") != "USDT" or not market.get("active", True):
            continue
        if market_type == "usdm" and not market.get("contract"):
            continue
        if market_type == "spot" and market.get("contract"):
            continue
        if market.get("linear") is False and market_type == "usdm":
            continue
        candidates.append(symbol)
    tickers = client.exchange.fetch_tickers(candidates[:200])
    ranked = sorted(candidates[:200], key=lambda s: float((tickers.get(s) or {}).get("quoteVolume") or 0), reverse=True)
    return ranked[:limit]

def scan(symbols: list[str] | None, market_type: str, timeframe: str, universe_limit: int = 20) -> list[dict]:
    symbols = symbols or _discover_symbols(market_type, universe_limit)
    results = []
    for symbol in symbols:
        try:
            context = MarketContextService.build(symbol, market_type, timeframe, 300)
            setup = build_trade_setup(symbol, market_type, timeframe)
            ind = context["indicators"]
            results.append({
                "symbol": context["symbol"],
                "marketType": market_type,
                "timeframe": timeframe,
                "setupScore": _score(setup),
                "trend": context["regime"]["trend"],
                "regime": context["regime"]["name"],
                "momentum": "strong" if (ind.get("rsi14") or 50) > 55 else "weak" if (ind.get("rsi14") or 50) < 45 else "neutral",
                "volume": "increasing" if (ind.get("sma20Volume") or 0) < (context.get("volume") or 0) else "normal",
                "volatility": context["regime"]["volatility"],
                "openInterest": context.get("openInterest"),
                "fundingRate": context.get("fundingRate"),
                "setup": setup["direction"],
                "signal": setup["direction"],
                "confidence": setup["confidence"],
                "liveConfidence": setup.get("liveConfidence", setup["confidence"]),
                "historicalEvidenceScore": setup.get("historicalEvidenceScore", 0),
                "strategyAgreement": setup["strategyAgreement"],
                "strategiesEvaluated": setup["strategiesEvaluated"],
                "votes": setup.get("votes", []),
                "timestamp": context["timestamp"],
            })
        except Exception as exc:
            results.append({"symbol": symbol, "error": "Insufficient real-time data to evaluate this setup.", "detail": str(exc)})
    return sorted(results, key=lambda item: item.get("setupScore", -1), reverse=True)
