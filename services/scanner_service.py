from __future__ import annotations

from services.market_context import MarketContextService
from strategies.engine import strategy_signal


def _score(context: dict) -> tuple[int, dict]:
    ind = context["indicators"]
    score = 50
    reasons = []
    e20, e50, r, x = ind.get("ema20"), ind.get("ema50"), ind.get("rsi14"), ind.get("adx14")
    volume = context.get("volume") or 0
    avg_volume = ind.get("sma20Volume") or 0

    if e20 is not None and e50 is not None:
        if e20 > e50:
            score += 12; reasons.append("trend bullish")
        elif e20 < e50:
            score -= 12; reasons.append("trend bearish")
    if r is not None:
        if r >= 55:
            score += 8; reasons.append("momentum strong")
        elif r <= 45:
            score -= 8; reasons.append("momentum weak")
    if x is not None and x >= 25:
        score += 8; reasons.append("trend strength high")
    if avg_volume and volume > avg_volume:
        score += 8; reasons.append("volume increasing")

    if context["marketType"] == "usdm":
        funding = context.get("fundingRate")
        oi = context.get("openInterest")
        if funding is not None and abs(funding) > 0.0005:
            score -= 3
        if oi is not None:
            reasons.append("open interest available")

    score = max(0, min(100, int(score)))
    setup = "Momentum" if abs(score - 50) >= 18 else "Range/Neutral"
    if x is not None and x >= 25 and abs(score - 50) >= 12:
        setup = "Trend"
    return score, {"reasons": reasons, "setup": setup}


def scan(symbols: list[str], market_type: str, timeframe: str) -> list[dict]:
    results = []
    for symbol in symbols:
        try:
            context = MarketContextService.build(symbol, market_type, timeframe, 220)
            score, meta = _score(context)
            ind = context["indicators"]
            signal = strategy_signal("momentum", context["candles"])[0] if False else strategy_signal("momentum", context["candles"])
            results.append({
                "symbol": context["symbol"],
                "marketType": market_type,
                "timeframe": timeframe,
                "setupScore": score,
                "trend": context["regime"]["trend"],
                "momentum": "strong" if (ind.get("rsi14") or 50) > 55 else "weak" if (ind.get("rsi14") or 50) < 45 else "neutral",
                "volume": "increasing" if (ind.get("sma20Volume") or 0) < (context.get("volume") or 0) else "normal",
                "volatility": context["regime"]["volatility"],
                "openInterest": context.get("openInterest"),
                "fundingRate": context.get("fundingRate"),
                "setup": meta["setup"],
                "signal": "LONG" if signal.value == 1 else "SHORT" if signal.value == -1 else "FLAT",
                "confidence": signal.confidence,
                "timestamp": context["timestamp"],
            })
        except Exception as exc:
            results.append({"symbol": symbol, "error": "Insufficient real-time data to evaluate this setup.", "detail": str(exc)})
    return sorted(results, key=lambda item: item.get("setupScore", -1), reverse=True)
