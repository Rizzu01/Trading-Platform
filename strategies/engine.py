from __future__ import annotations

from dataclasses import dataclass

from .indicators import adx, atr, bollinger, ema, finite, highest, lowest, rsi
from .registry import get_strategy


@dataclass
class Signal:
    value: int
    confidence: int
    reason: str
    stop_distance: float | None = None


def _candles(candles):
    return [
        {
            "timestamp": int(item.get("timestamp", 0)),
            "open": float(item["open"]),
            "high": float(item["high"]),
            "low": float(item["low"]),
            "close": float(item["close"]),
            "volume": float(item.get("volume", 0)),
        }
        for item in candles
    ]


def adaptive_trend_signal(candles: list[dict], index: int) -> Signal:
    closes = [item["close"] for item in candles]
    ema20 = ema(closes, 20)
    ema50 = ema(closes, 50)
    rsi14 = rsi(closes, 14)
    atr14 = atr(candles, 14)
    adx14 = adx(candles, 14)

    e20, e50, r, a, x = ema20[index], ema50[index], rsi14[index], atr14[index], adx14[index]
    close = closes[index]
    if not all(finite(value) for value in (e20, e50, r, a, x)):
        return Signal(0, 0, "Waiting for enough candles.")

    if e20 > e50 and close > e20 and x >= 20 and r >= 52:
        confidence = min(95, int(55 + min(30, x - 20) + min(10, max(0, r - 52))))
        return Signal(1, confidence, f"Uptrend confirmed: EMA20>EMA50, ADX {x:.1f}, RSI {r:.1f}.", float(a) * 2.5)

    if e20 < e50 and close < e20 and x >= 20 and r <= 48:
        confidence = min(95, int(55 + min(30, x - 20) + min(10, max(0, 48 - r))))
        return Signal(-1, confidence, f"Downtrend confirmed: EMA20<EMA50, ADX {x:.1f}, RSI {r:.1f}.", float(a) * 2.5)

    return Signal(0, 25, f"No high-quality trend alignment: ADX {x:.1f}, RSI {r:.1f}.")


def donchian_signal(candles: list[dict], index: int) -> Signal:
    if index < 100:
        return Signal(0, 0, "Waiting for 100-bar Donchian history.")

    closes = [item["close"] for item in candles]
    highs = [item["high"] for item in candles]
    lows = [item["low"] for item in candles]
    atr14 = atr(candles, 14)
    close = closes[index]
    upper_hits = 0
    lower_hits = 0
    for lookback in (20, 55, 100):
        upper = highest(highs, lookback, index)
        lower = lowest(lows, lookback, index)
        if upper is not None and close > upper:
            upper_hits += 1
        if lower is not None and close < lower:
            lower_hits += 1

    stop_distance = float(atr14[index]) * 2.5 if finite(atr14[index]) else None

    if upper_hits >= 2:
        confidence = min(95, 60 + upper_hits * 10)
        return Signal(1, confidence, f"Multi-horizon upside breakout: {upper_hits}/3 channels confirmed.", stop_distance)
    if lower_hits >= 2:
        confidence = min(95, 60 + lower_hits * 10)
        return Signal(-1, confidence, f"Multi-horizon downside breakout: {lower_hits}/3 channels confirmed.", stop_distance)

    return Signal(0, 30, "Breakout confirmation is not broad enough across horizons.")


def regime_rsi_signal(candles: list[dict], index: int) -> Signal:
    closes = [item["close"] for item in candles]
    rsi14 = rsi(closes, 14)
    adx14 = adx(candles, 14)
    middle, upper, lower = bollinger(closes, 20, 2.0)
    r, x = rsi14[index], adx14[index]
    close = closes[index]

    if not all(finite(value) for value in (r, x, middle[index], upper[index], lower[index])):
        return Signal(0, 0, "Waiting for enough range data.")

    if x < 20 and r < 30 and close <= lower[index]:
        return Signal(1, 70, f"Range oversold: RSI {r:.1f}, ADX {x:.1f}.")
    if x < 20 and r > 70 and close >= upper[index]:
        return Signal(-1, 70, f"Range overbought: RSI {r:.1f}, ADX {x:.1f}.")

    return Signal(0, 25, f"No range extreme: RSI {r:.1f}, ADX {x:.1f}.")


STRATEGY_FUNCTIONS = {
    "adaptive_trend": adaptive_trend_signal,
    "donchian_ensemble": donchian_signal,
    "regime_rsi": regime_rsi_signal,
}


def strategy_signal(strategy_id: str, candles: list[dict], index: int | None = None) -> Signal:
    clean = _candles(candles)
    if len(clean) < 2:
        return Signal(0, 0, "Not enough market data.")

    target = len(clean) - 1 if index is None else index
    strategy = get_strategy(strategy_id)
    function = STRATEGY_FUNCTIONS[strategy["id"]]
    return function(clean, target)


def _trade_fee(notional: float, fee_rate: float, slippage_rate: float) -> float:
    return abs(notional) * fee_rate + abs(notional) * slippage_rate


def backtest(strategy_id: str, candles: list[dict], initial_capital: float, fee_bps: float, slippage_bps: float, market_type: str) -> dict:
    clean = _candles(candles)
    strategy = get_strategy(strategy_id)
    if len(clean) < 120:
        raise ValueError("At least 120 candles are required for the backtest.")

    if market_type not in strategy["supported_market_types"]:
        raise ValueError(f"{strategy['name']} does not support {market_type}.")

    fee_rate = fee_bps / 10_000
    slippage_rate = slippage_bps / 10_000
    equity = float(initial_capital)
    position = 0
    entry_price = None
    entry_time = None
    trades = []
    equity_curve = []
    position_pct = 0.25

    for index in range(1, len(clean)):
        signal = strategy_signal(strategy_id, clean, index - 1).value
        candle = clean[index]
        open_price = candle["open"]
        close_price = candle["close"]

        desired = signal
        if market_type == "spot" and desired < 0:
            desired = 0

        if position != desired:
            if position != 0 and entry_price is not None:
                exit_price = open_price * (1 - slippage_rate if position > 0 else 1 + slippage_rate)
                notional = equity * position_pct
                move_return = (exit_price / entry_price - 1) * position
                pnl = notional * move_return
                fees = _trade_fee(notional, fee_rate, slippage_rate)
                equity += pnl - fees
                trades.append({
                    "side": "long" if position > 0 else "short",
                    "entry": entry_price,
                    "exit": exit_price,
                    "return_pct": move_return * 100,
                    "pnl": pnl - fees,
                    "entry_timestamp": entry_time,
                    "exit_timestamp": candle["timestamp"],
                })
                entry_price = None
                entry_time = None

            if desired != 0:
                entry_price = open_price * (1 + slippage_rate if desired > 0 else 1 - slippage_rate)
                entry_time = candle["timestamp"]

            position = desired

        equity_curve.append(equity)

    if position != 0 and entry_price is not None:
        final = clean[-1]["close"] * (1 - slippage_rate if position > 0 else 1 + slippage_rate)
        notional = equity * position_pct
        move_return = (final / entry_price - 1) * position
        pnl = notional * move_return
        fees = _trade_fee(notional, fee_rate, slippage_rate)
        equity += pnl - fees
        trades.append({
            "side": "long" if position > 0 else "short",
            "entry": entry_price,
            "exit": final,
            "return_pct": move_return * 100,
            "pnl": pnl - fees,
            "entry_timestamp": entry_time,
            "exit_timestamp": clean[-1]["timestamp"],
        })
        equity_curve.append(equity)

    peak = initial_capital
    max_drawdown = 0.0
    for value in equity_curve + [equity]:
        peak = max(peak, value)
        if peak > 0:
            max_drawdown = min(max_drawdown, (value / peak - 1) * 100)

    wins = [trade for trade in trades if trade["pnl"] > 0]
    losses = [trade for trade in trades if trade["pnl"] < 0]
    gross_profit = sum(trade["pnl"] for trade in wins)
    gross_loss = abs(sum(trade["pnl"] for trade in losses))
    profit_factor = (gross_profit / gross_loss) if gross_loss else None
    total_return = (equity / initial_capital - 1) * 100

    return {
        "strategy": strategy,
        "market_type": market_type,
        "initial_capital": initial_capital,
        "final_equity": round(equity, 2),
        "return_pct": round(total_return, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "trade_count": len(trades),
        "win_rate_pct": round((len(wins) / len(trades) * 100), 2) if trades else 0.0,
        "profit_factor": round(profit_factor, 2) if profit_factor is not None else None,
        "fees_bps": fee_bps,
        "slippage_bps": slippage_bps,
        "trades": trades[-25:],
        "validation": {
            "status": "screening",
            "note": "This is an engine-level screening backtest, not a guarantee of future profitability.",
        },
    }
