from __future__ import annotations

from collections import Counter

from services.market_context import MarketContextService
from services.regime_service import PREFERRED
from strategies.engine import backtest, strategy_signal
from strategies.registry import get_strategy


def _direction(value: int) -> str:
    return "LONG" if value > 0 else "SHORT" if value < 0 else "FLAT"


def build_trade_setup(symbol: str, market_type: str, timeframe: str) -> dict:
    context = MarketContextService.build(symbol, market_type, timeframe, 300)
    regime_name = context["regime"]["name"]
    candidates = [
        strategy_id
        for strategy_id in PREFERRED.get(regime_name, [])
        if market_type in get_strategy(strategy_id)["supported_market_types"]
    ]

    votes = []
    for strategy_id in candidates:
        signal = strategy_signal(strategy_id, context["candles"])\n        validation = backtest(strategy_id, context["candles"], 10000, 5, 2, market_type, 1.0, 1.0)
        votes.append({
            "strategyId": strategy_id,
            "strategy": get_strategy(strategy_id)["name"],
            "signal": _direction(signal.value),
            "confidence": signal.confidence,
            "reason": signal.reason,
            "stopDistance": signal.stop_distance,\n            "validation": {\n                "returnPct": validation["return_pct"],\n                "maxDrawdownPct": validation["max_drawdown_pct"],\n                "winRatePct": validation["win_rate_pct"],\n                "profitFactor": validation["profit_factor"],\n                "tradeCount": validation["trade_count"],\n                "sharpeRatio": validation["sharpe_ratio"],\n            },
        })

    usable = [v for v in votes if v["signal"] in ("LONG", "SHORT")]
    counts = Counter(v["signal"] for v in usable)
    long_count = counts.get("LONG", 0)
    short_count = counts.get("SHORT", 0)
    majority_direction = "LONG" if long_count > short_count else "SHORT" if short_count > long_count else "NO TRADE"
    required = max(2, (len(candidates) + 1) // 2)
    agreement = max(long_count, short_count)

    if agreement < required or (market_type == "spot" and majority_direction == "SHORT"):
        return {
            "symbol": context["symbol"],
            "marketType": context["marketType"],
            "timeframe": context["timeframe"],
            "regime": context["regime"],
            "direction": "NO TRADE",
            "entry": context["price"],
            "stopLoss": None,
            "takeProfit": None,
            "riskReward": None,
            "confidence": round(sum(v["confidence"] for v in usable) / len(usable)) if usable else 0,
            "strategyAgreement": agreement,
            "strategiesEvaluated": len(candidates),
            "requiredAgreement": required,
            "votes": votes,
            "rationale": "Strategy signals do not have sufficient directional agreement for a high-quality setup.",
            "timestamp": context["timestamp"],
        }

    agreeing = [v for v in usable if v["signal"] == majority_direction]
    confidence = round(sum(v["confidence"] for v in agreeing) / len(agreeing))
    stop_distances = [float(v["stopDistance"]) for v in agreeing if v["stopDistance"] and v["stopDistance"] > 0]
    atr = float(context["indicators"]["atr14"])
    stop_distance = max(stop_distances) if stop_distances else atr * 2
    entry = float(context["price"])
    stop_loss = entry - stop_distance if majority_direction == "LONG" else entry + stop_distance
    take_profit = entry + stop_distance * 2 if majority_direction == "LONG" else entry - stop_distance * 2

    return {
        "symbol": context["symbol"],
        "marketType": context["marketType"],
        "timeframe": context["timeframe"],
        "regime": context["regime"],
        "direction": majority_direction,
        "entry": entry,
        "stopLoss": stop_loss,
        "takeProfit": take_profit,
        "riskReward": 2.0,
        "confidence": min(95, confidence),
        "strategyAgreement": agreement,
        "strategiesEvaluated": len(candidates),
        "requiredAgreement": required,
        "votes": votes,
        "rationale": f"{agreement}/{len(candidates)} preferred strategies agree on {majority_direction} in the current {regime_name} regime.",
        "timestamp": context["timestamp"],
    }
