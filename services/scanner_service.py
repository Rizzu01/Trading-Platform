from __future__ import annotations

from services.market_context import MarketContextService
from services.trade_setup_service import build_trade_setup


def _score(setup: dict) -> int:
    if setup.get("direction") == "NO TRADE":
        return min(55, max(0, int(setup.get("confidence", 0))))
    agreement = setup.get("strategyAgreement", 0)
    evaluated = max(1, setup.get("strategiesEvaluated", 1))
    return max(0, min(100, int(setup.get("confidence", 0) * 0.65 + agreement / evaluated * 35)))


def scan(symbols: list[str], market_type: str, timeframe: str) -> list[dict]:
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
                "momentum": "strong" if (ind.get("rsi14") or 50) > 55 else "weak" if (ind.get("rsi14") or 50) < 45 else "neutral",
                "volume": "increasing" if (ind.get("sma20Volume") or 0) < (context.get("volume") or 0) else "normal",
                "volatility": context["regime"]["volatility"],
                "openInterest": context.get("openInterest"),
                "fundingRate": context.get("fundingRate"),
                "setup": setup["direction"],
                "signal": setup["direction"],
                "confidence": setup["confidence"],
                "strategyAgreement": setup["strategyAgreement"],
                "strategiesEvaluated": setup["strategiesEvaluated"],
                "timestamp": context["timestamp"],
            })
        except Exception as exc:
            results.append({"symbol": symbol, "error": "Insufficient real-time data to evaluate this setup.", "detail": str(exc)})
    return sorted(results, key=lambda item: item.get("setupScore", -1), reverse=True)
