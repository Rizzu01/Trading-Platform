from __future__ import annotations

from services.market_context import MarketContextService


PREFERRED = {
    "Strong Bull Trend": ["adaptive_trend", "momentum", "breakout", "volume_breakout"],
    "Weak Bull Trend": ["adaptive_trend", "ema_rsi", "vwap"],
    "Strong Bear Trend": ["adaptive_trend", "momentum", "breakout", "volume_breakout"],
    "Weak Bear Trend": ["adaptive_trend", "ema_rsi", "vwap"],
    "Sideways": ["regime_rsi", "mean_reversion", "vwap"],
}


def analyze(symbol: str, market_type: str, timeframe: str) -> dict:
    context = MarketContextService.build(symbol, market_type, timeframe, 300)
    regime = context["regime"]
    return {
        "symbol": context["symbol"],
        "marketType": context["marketType"],
        "timeframe": context["timeframe"],
        "regime": regime,
        "preferredStrategies": PREFERRED.get(regime["name"], []),
        "avoid": ["mean_reversion"] if "Trend" in regime["name"] else [],
        "timestamp": context["timestamp"],
    }
