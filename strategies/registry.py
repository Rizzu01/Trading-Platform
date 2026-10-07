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
    "ema_rsi": {"id": "ema_rsi", "name": "EMA Trend + RSI", "tier": "research-backed", "timeframe": "1h", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "EMA20/50 trend alignment with RSI momentum confirmation.", "rules": ["Long when EMA20 > EMA50 and RSI > 55.", "Short when EMA20 < EMA50 and RSI < 45.", "ATR defines stop guidance."]},\n    "rsi_reversal": {"id": "rsi_reversal", "name": "RSI Reversal", "tier": "experimental", "timeframe": "15m", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "Oversold/overbought RSI reversal with volatility-aware exits.", "rules": ["Long below RSI 30 with reversal confirmation.", "Short above RSI 70 with reversal confirmation."]},\n    "macd_momentum": {"id": "macd_momentum", "name": "MACD Momentum", "tier": "research-backed", "timeframe": "1h", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "MACD histogram momentum aligned with trend.", "rules": ["Trade MACD line/signal cross with histogram confirmation.", "Use EMA50 as directional filter."]},\n    "vwap": {"id": "vwap", "name": "VWAP Momentum", "tier": "research-backed", "timeframe": "15m", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "Intraday VWAP trend and volume confirmation.", "rules": ["Long above VWAP with rising volume.", "Short below VWAP with rising volume."]},\n    "breakout": {"id": "breakout", "name": "Structure Breakout", "tier": "research-backed", "timeframe": "1h", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "Previous-range high/low breakout with ATR filter.", "rules": ["Long on confirmed range-high break.", "Short on confirmed range-low break."]},\n    "volume_breakout": {"id": "volume_breakout", "name": "Volume Breakout", "tier": "research-backed", "timeframe": "15m", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "Price breakout validated by abnormal volume.", "rules": ["Volume must exceed its 20-bar average.", "Breakout direction determines trade side."]},\n    "mean_reversion": {"id": "mean_reversion", "name": "Mean Reversion", "tier": "experimental", "timeframe": "15m", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "Bollinger-band reversion in low-trend regimes.", "rules": ["ADX below 20.", "Buy lower-band rejection and sell upper-band rejection."]},\n    "momentum": {"id": "momentum", "name": "Momentum", "tier": "research-backed", "timeframe": "1h", "supported_market_types": ["spot", "usdm"], "direction": "long+short", "description": "Trend, momentum and volume alignment.", "rules": ["EMA trend alignment.", "RSI momentum confirmation.", "Volume above average."]},\n    "regime_rsi": {
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
