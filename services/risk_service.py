from __future__ import annotations

import math


def calculate_risk(
    balance: float,
    risk_percent: float,
    entry: float,
    stop_loss: float,
    leverage: float = 1,
    contract_multiplier: float = 1,
) -> dict:
    if balance <= 0 or entry <= 0 or stop_loss <= 0:
        raise ValueError("Balance, entry and stop loss must be positive.")
    if not 0 < risk_percent <= 100:
        raise ValueError("risk_percent must be between 0 and 100.")
    if leverage <= 0 or contract_multiplier <= 0:
        raise ValueError("Leverage and contract multiplier must be positive.")

    distance = abs(entry - stop_loss)
    if distance <= 0:
        raise ValueError("Stop loss must differ from entry.")

    max_loss = balance * risk_percent / 100
    quantity = max_loss / (distance * contract_multiplier)
    notional = quantity * entry * contract_multiplier
    margin = notional / leverage
    reward_distance = distance * 2.0
    risk_reward = reward_distance / distance
    liquidation_buffer = entry / leverage
    liquidation_risk = "high" if margin > balance * 0.5 else "moderate" if margin > balance * 0.25 else "lower"

    return {
        "positionSize": round(quantity, 12),
        "notional": round(notional, 8),
        "marginRequired": round(margin, 8),
        "maximumLoss": round(max_loss, 8),
        "riskReward": round(risk_reward, 2),
        "liquidationBuffer": round(liquidation_buffer, 8),
        "liquidationRisk": liquidation_risk,
        "riskPercent": risk_percent,
    }
