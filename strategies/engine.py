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


def _sma(values, period):
    out = [None] * len(values)
    if len(values) < period:
        return out
    running = sum(values[:period])
    out[period - 1] = running / period
    for i in range(period, len(values)):
        running += values[i] - values[i - period]
        out[i] = running / period
    return out


def _macd(closes, fast=12, slow=26, signal_period=9):
    fast_v = ema(closes, fast)
    slow_v = ema(closes, slow)
    line = [None if fast_v[i] is None or slow_v[i] is None else fast_v[i] - slow_v[i] for i in range(len(closes))]
    clean = [x if x is not None else 0.0 for x in line]
    signal = ema(clean, signal_period)
    hist = [None if line[i] is None or signal[i] is None else line[i] - signal[i] for i in range(len(closes))]
    return line, signal, hist


def ema_rsi_signal(candles, index):
    closes = [x["close"] for x in candles]
    e20, e50, r, a = ema(closes, 20), ema(closes, 50), rsi(closes, 14), atr(candles, 14)
    if not all(finite(x) for x in (e20[index], e50[index], r[index], a[index])):
        return Signal(0, 0, "Waiting for EMA/RSI history.")
    if e20[index] > e50[index] and r[index] > 55:
        return Signal(1, min(92, int(55 + (r[index] - 55))), f"EMA trend bullish and RSI {r[index]:.1f} confirms momentum.", float(a[index]) * 2)
    if e20[index] < e50[index] and r[index] < 45:
        return Signal(-1, min(92, int(55 + (45 - r[index]))), f"EMA trend bearish and RSI {r[index]:.1f} confirms momentum.", float(a[index]) * 2)
    return Signal(0, 25, "EMA trend and RSI are not aligned.")


def rsi_reversal_signal(candles, index):
    closes = [x["close"] for x in candles]
    r = rsi(closes, 14)
    a = atr(candles, 14)
    if not all(finite(x) for x in (r[index], a[index])) or index < 1:
        return Signal(0, 0, "Waiting for RSI reversal history.")
    prev, cur = r[index - 1], r[index]
    if prev < 30 and cur > prev:
        return Signal(1, 68, f"RSI reversal from oversold: {cur:.1f}.", float(a[index]) * 1.8)
    if prev > 70 and cur < prev:
        return Signal(-1, 68, f"RSI reversal from overbought: {cur:.1f}.", float(a[index]) * 1.8)
    return Signal(0, 25, f"No confirmed RSI reversal: {cur:.1f}.")


def macd_momentum_signal(candles, index):
    closes = [x["close"] for x in candles]
    line, sig, hist = _macd(closes)
    e50 = ema(closes, 50)
    a = atr(candles, 14)
    if not all(finite(x) for x in (line[index], sig[index], hist[index], e50[index], a[index])) or index < 1:
        return Signal(0, 0, "Waiting for MACD history.")
    cross_up = line[index] > sig[index] and line[index - 1] <= sig[index - 1]
    cross_down = line[index] < sig[index] and line[index - 1] >= sig[index - 1]
    if cross_up and closes[index] > e50[index] and hist[index] > 0:
        return Signal(1, 72, "MACD bullish cross with positive histogram above EMA50.", float(a[index]) * 2)
    if cross_down and closes[index] < e50[index] and hist[index] < 0:
        return Signal(-1, 72, "MACD bearish cross with negative histogram below EMA50.", float(a[index]) * 2)
    return Signal(0, 25, "No confirmed MACD momentum trigger.")


def vwap_signal(candles, index):
    if index < 20:
        return Signal(0, 0, "Waiting for VWAP history.")
    start = max(0, index - 19)
    window = candles[start:index + 1]
    pv = sum(((x["high"] + x["low"] + x["close"]) / 3) * x["volume"] for x in window)
    vol = sum(x["volume"] for x in window)
    vwap = pv / vol if vol > 0 else None
    avg_volume = sum(x["volume"] for x in window) / len(window)
    price = candles[index]["close"]
    a = atr(candles, 14)[index]
    if vwap is None or not finite(a):
        return Signal(0, 0, "Insufficient volume for VWAP.")
    if price > vwap and candles[index]["volume"] > avg_volume:
        return Signal(1, 67, f"Price above VWAP {vwap:.2f} with above-average volume.", float(a) * 2)
    if price < vwap and candles[index]["volume"] > avg_volume:
        return Signal(-1, 67, f"Price below VWAP {vwap:.2f} with above-average volume.", float(a) * 2)
    return Signal(0, 25, "Price/volume are not confirming VWAP momentum.")


def breakout_signal(candles, index):
    if index < 20:
        return Signal(0, 0, "Waiting for breakout history.")
    highs = [x["high"] for x in candles]
    lows = [x["low"] for x in candles]
    upper, lower = max(highs[index - 20:index]), min(lows[index - 20:index])
    price = candles[index]["close"]
    a = atr(candles, 14)[index]
    if not finite(a):
        return Signal(0, 0, "ATR unavailable.")
    if price > upper:
        return Signal(1, 70, "Price broke the previous 20-bar high.", float(a) * 2.2)
    if price < lower:
        return Signal(-1, 70, "Price broke the previous 20-bar low.", float(a) * 2.2)
    return Signal(0, 25, "No range breakout confirmed.")


def volume_breakout_signal(candles, index):
    if index < 21:
        return Signal(0, 0, "Waiting for volume breakout history.")
    highs = [x["high"] for x in candles]
    lows = [x["low"] for x in candles]
    avg = sum(x["volume"] for x in candles[index - 20:index]) / 20
    price = candles[index]["close"]
    a = atr(candles, 14)[index]
    if not finite(a) or avg <= 0:
        return Signal(0, 0, "Volume/ATR unavailable.")
    if candles[index]["volume"] > avg * 1.5 and price > max(highs[index - 20:index]):
        return Signal(1, 78, f"Upside breakout with volume {candles[index]['volume'] / avg:.1f}x average.", float(a) * 2.2)
    if candles[index]["volume"] > avg * 1.5 and price < min(lows[index - 20:index]):
        return Signal(-1, 78, f"Downside breakout with volume {candles[index]['volume'] / avg:.1f}x average.", float(a) * 2.2)
    return Signal(0, 25, "No high-volume breakout.")


def mean_reversion_signal(candles, index):
    closes = [x["close"] for x in candles]
    r = rsi(closes, 14)
    x = adx(candles, 14)
    middle, upper, lower = bollinger(closes, 20, 2)
    a = atr(candles, 14)
    if not all(finite(v) for v in (r[index], x[index], upper[index], lower[index], a[index])):
        return Signal(0, 0, "Waiting for mean-reversion history.")
    if x[index] < 20 and closes[index] <= lower[index] and r[index] < 35:
        return Signal(1, 70, f"Low-trend oversold reversion: RSI {r[index]:.1f}.", float(a[index]) * 1.5)
    if x[index] < 20 and closes[index] >= upper[index] and r[index] > 65:
        return Signal(-1, 70, f"Low-trend overbought reversion: RSI {r[index]:.1f}.", float(a[index]) * 1.5)
    return Signal(0, 25, "Mean-reversion conditions are not aligned.")


def momentum_signal(candles, index):
    closes = [x["close"] for x in candles]
    e20, e50, r, a = ema(closes, 20), ema(closes, 50), rsi(closes, 14), atr(candles, 14)
    if not all(finite(v) for v in (e20[index], e50[index], r[index], a[index])) or index < 20:
        return Signal(0, 0, "Waiting for momentum history.")
    avg_volume = sum(x["volume"] for x in candles[index - 20:index]) / 20
    if e20[index] > e50[index] and r[index] > 55 and candles[index]["volume"] > avg_volume:
        return Signal(1, 74, f"Trend, RSI {r[index]:.1f}, and volume confirm bullish momentum.", float(a[index]) * 2)
    if e20[index] < e50[index] and r[index] < 45 and candles[index]["volume"] > avg_volume:
        return Signal(-1, 74, f"Trend, RSI {r[index]:.1f}, and volume confirm bearish momentum.", float(a[index]) * 2)
    return Signal(0, 25, "Momentum factors are not aligned.")


STRATEGY_FUNCTIONS = {
    "adaptive_trend": adaptive_trend_signal,
    "donchian_ensemble": donchian_signal,
    "regime_rsi": regime_rsi_signal,
    "ema_rsi": ema_rsi_signal,
    "rsi_reversal": rsi_reversal_signal,
    "macd_momentum": macd_momentum_signal,
    "vwap": vwap_signal,
    "breakout": breakout_signal,
    "volume_breakout": volume_breakout_signal,
    "mean_reversion": mean_reversion_signal,
    "momentum": momentum_signal,
}


def strategy_signal(strategy_id: str, candles: list[dict], index: int | None = None) -> Signal:
    clean = _candles(candles)
    if len(clean) < 2:
        return Signal(0, 0, "Not enough market data.")

    target = len(clean) - 1 if index is None else index
    strategy = get_strategy(strategy_id)
    function = STRATEGY_FUNCTIONS[strategy["id"]]
    return function(clean, target)


def _fee(notional: float, fee_rate: float) -> float:
    return abs(notional) * fee_rate



def performance_metrics(initial_capital: float, equity_curve: list[float], trades: list[dict]) -> dict:
    returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i - 1]
        cur = equity_curve[i]
        if prev > 0:
            returns.append(cur / prev - 1)

    if returns:
        avg = sum(returns) / len(returns)
        variance = sum((x - avg) ** 2 for x in returns) / len(returns)
        std = variance ** 0.5
        sharpe = (avg / std) * (len(returns) ** 0.5) if std > 0 else 0.0
        downside = [min(0.0, x) for x in returns]
        downside_dev = (sum(x * x for x in downside) / len(downside)) ** 0.5
        sortino = (avg / downside_dev) * (len(returns) ** 0.5) if downside_dev > 0 else 0.0
    else:
        sharpe = sortino = 0.0

    pnls = [float(t["pnl"]) for t in trades]
    wins = [x for x in pnls if x > 0]
    losses = [x for x in pnls if x < 0]
    long_pnl = sum(x for x, t in zip(pnls, trades) if t["side"] == "long")
    short_pnl = sum(x for x, t in zip(pnls, trades) if t["side"] == "short")

    best_run = worst_run = current_win = current_loss = 0
    for pnl in pnls:
        if pnl > 0:
            current_win += 1; current_loss = 0
        elif pnl < 0:
            current_loss += 1; current_win = 0
        else:
            current_win = current_loss = 0
        best_run = max(best_run, current_win)
        worst_run = max(worst_run, current_loss)

    return {
        "sharpe_ratio": round(sharpe, 4),
        "sortino_ratio": round(sortino, 4),
        "average_trade": round(sum(pnls) / len(pnls), 8) if pnls else 0.0,
        "average_win": round(sum(wins) / len(wins), 8) if wins else 0.0,
        "average_loss": round(sum(losses) / len(losses), 8) if losses else 0.0,
        "long_pnl": round(long_pnl, 8),
        "short_pnl": round(short_pnl, 8),
        "consecutive_wins": best_run,
        "consecutive_losses": worst_run,
        "equity_curve": [round(x, 8) for x in equity_curve],
    }

def backtest(
    strategy_id: str,
    candles: list[dict],
    initial_capital: float,
    fee_bps: float,
    slippage_bps: float,
    market_type: str,
    risk_percent: float = 1.0,
    leverage: float = 1.0,
) -> dict:
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
    entry_notional = 0.0
    entry_fee = 0.0
    trades = []
    equity_curve = []
    if not 0 < risk_percent <= 10:
        raise ValueError("risk_percent must be between 0 and 10.")
    if leverage <= 0 or leverage > 125:
        raise ValueError("leverage must be between 0 and 125.")
    position_pct = min(1.0, risk_percent * leverage / 100)

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
                exit_notional = entry_notional
                gross_pnl = exit_notional * ((exit_price / entry_price - 1) * position)
                exit_fee = _fee(exit_notional, fee_rate)
                net_pnl = gross_pnl - exit_fee
                equity += net_pnl
                trades.append({
                    "side": "long" if position > 0 else "short",
                    "entry": entry_price,
                    "exit": exit_price,
                    "return_pct": (gross_pnl / exit_notional * 100) if exit_notional else 0.0,
                    "pnl": net_pnl - entry_fee,
                    "entry_timestamp": entry_time,
                    "exit_timestamp": candle["timestamp"],
                })
                entry_price = None
                entry_time = None
                entry_notional = 0.0
                entry_fee = 0.0

            if desired != 0:
                entry_price = open_price * (1 + slippage_rate if desired > 0 else 1 - slippage_rate)
                stop_distance = strategy_signal(strategy_id, clean, index - 1).stop_distance
                risk_capital = equity * (risk_percent / 100)
                risk_based_notional = (risk_capital / max(float(stop_distance or (entry_price * 0.01)), entry_price * 1e-6)) * entry_price
                max_notional = equity * max(leverage, 1.0)
                entry_notional = min(risk_based_notional, max_notional)
                if market_type == "spot":
                    entry_notional = min(entry_notional, equity)
                entry_fee = _fee(entry_notional, fee_rate)
                equity -= entry_fee
                entry_time = candle["timestamp"]

            position = desired

        marked_equity = equity
        if position != 0 and entry_price is not None:
            unrealized = entry_notional * ((close_price / entry_price - 1) * position)
            marked_equity += unrealized
        equity_curve.append(marked_equity)

    if position != 0 and entry_price is not None:
        exit_price = clean[-1]["close"] * (1 - slippage_rate if position > 0 else 1 + slippage_rate)
        gross_pnl = entry_notional * ((exit_price / entry_price - 1) * position)
        exit_fee = _fee(entry_notional, fee_rate)
        net_pnl = gross_pnl - exit_fee
        equity += net_pnl
        trades.append({
            "side": "long" if position > 0 else "short",
            "entry": entry_price,
            "exit": exit_price,
            "return_pct": (gross_pnl / entry_notional * 100) if entry_notional else 0.0,
            "pnl": net_pnl - entry_fee,
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

    metrics = performance_metrics(initial_capital, equity_curve, trades)
    return {
        "strategy": strategy,
        "market_type": market_type,
        "initial_capital": initial_capital,
        "final_equity": round(equity, 2),
        "return_pct": round(total_return, 2),
        "roi_pct": round(total_return, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "trade_count": len(trades),
        "win_rate_pct": round((len(wins) / len(trades) * 100), 2) if trades else 0.0,
        "loss_rate_pct": round((len(losses) / len(trades) * 100), 2) if trades else 0.0,
        "profit_factor": round(profit_factor, 2) if profit_factor is not None else None,
        "fees_bps": fee_bps,
        "slippage_bps": slippage_bps,
        "trades": trades[-25:],
        **metrics,
        "validation": {
            "status": "screening",
            "note": "Screening backtest includes execution fees, slippage, next-bar entries, and mark-to-market drawdown; it is not a guarantee of future profitability.",
        },
    }
