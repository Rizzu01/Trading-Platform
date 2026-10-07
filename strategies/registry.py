from __future__ import annotations

STRATEGIES = {
    "adaptive_trend": {
        "id": "adaptive_trend",
        "name": "Adaptive Trend",
        "tier": "research-backed",
        "timeframe": "8h",
        "supported_market_types": ["spot", "usdm"],
        "direction": "long+short",
        "description": "EMA trend + ADX strength + RSI confirmation with ATR-aware risk guidance.",
        "rules": [
            "EMA(20) above EMA(50) for long bias; below for short bias.",
            "ADX(14) above 20 filters weak directional regimes.",
            "RSI(14) confirms momentum instead of chasing exhausted moves.",
            "ATR(14) is used for risk-aware stop guidance and sizing.",
        ],
    },
    "donchian_ensemble": {
        "id": "donchian_ensemble",
        "name": "Donchian Trend Ensemble",
        "tier": "research-backed",
        "timeframe": "6h",
        "supported_market_types": ["spot", "usdm"],
        "direction": "long+short",
        "description": "Multi-horizon Donchian breakout ensemble designed to trade persistent crypto trends.",
        "rules": [
            "Uses 20/55/100 bar breakout channels.",
            "Requires agreement from at least two horizons.",
            "ATR(14) provides volatility-aware stop and position guidance.",
        ],
    },
    "regime_rsi": {
        "id": "regime_rsi",
        "name": "Range RSI",
        "tier": "experimental",
        "timeframe": "15m",
        "supported_market_types": ["spot", "usdm"],
        "direction": "long+short",
        "description": "RSI + Bollinger mean reversion only when ADX indicates a non-trending regime.",
        "rules": [
            "ADX(14) below 20 is required.",
            "RSI(14) below 30 with a lower Bollinger touch suggests long mean reversion.",
            "RSI(14) above 70 with an upper Bollinger touch suggests short mean reversion.",
            "This strategy is paper-first because short-horizon edges can disappear after fees and slippage.",
        ],
    },
}


def list_strategies() -> list[dict]:
    return list(STRATEGIES.values())


def get_strategy(strategy_id: str) -> dict:
    try:
        return STRATEGIES[strategy_id]
    except KeyError as exc:
        raise ValueError(f"Unknown strategy: {strategy_id}") from exc
