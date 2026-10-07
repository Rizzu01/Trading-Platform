from __future__ import annotations

import math
from statistics import mean, pstdev


def ema(values: list[float], period: int) -> list[float | None]:
    if period <= 0:
        raise ValueError("EMA period must be positive.")
    result: list[float | None] = [None] * len(values)
    if len(values) < period:
        return result
    seed = mean(values[:period])
    result[period - 1] = seed
    alpha = 2 / (period + 1)
    previous = seed
    for index in range(period, len(values)):
        previous = values[index] * alpha + previous * (1 - alpha)
        result[index] = previous
    return result


def true_ranges(candles: list[dict]) -> list[float]:
    ranges = []
    previous_close = None
    for candle in candles:
        high = float(candle["high"])
        low = float(candle["low"])
        if previous_close is None:
            tr = high - low
        else:
            tr = max(
                high - low,
                abs(high - previous_close),
                abs(low - previous_close),
            )
        ranges.append(max(tr, 0.0))
        previous_close = float(candle["close"])
    return ranges


def atr(candles: list[dict], period: int = 14) -> list[float | None]:
    tr = true_ranges(candles)
    result: list[float | None] = [None] * len(tr)
    if len(tr) < period:
        return result
    seed = mean(tr[:period])
    result[period - 1] = seed
    previous = seed
    for index in range(period, len(tr)):
        previous = ((previous * (period - 1)) + tr[index]) / period
        result[index] = previous
    return result


def rsi(closes: list[float], period: int = 14) -> list[float | None]:
    result: list[float | None] = [None] * len(closes)
    if len(closes) <= period:
        return result

    gains = []
    losses = []
    for index in range(1, len(closes)):
        delta = closes[index] - closes[index - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))

    average_gain = mean(gains[:period])
    average_loss = mean(losses[:period])
    result[period] = 100.0 if average_loss == 0 else 100 - (100 / (1 + average_gain / average_loss))

    for index in range(period + 1, len(closes)):
        gain = gains[index - 1]
        loss = losses[index - 1]
        average_gain = ((average_gain * (period - 1)) + gain) / period
        average_loss = ((average_loss * (period - 1)) + loss) / period
        result[index] = 100.0 if average_loss == 0 else 100 - (100 / (1 + average_gain / average_loss))

    return result


def adx(candles: list[dict], period: int = 14) -> list[float | None]:
    if len(candles) < period * 2 + 1:
        return [None] * len(candles)

    trs = true_ranges(candles)
    plus_dm = [0.0]
    minus_dm = [0.0]

    for index in range(1, len(candles)):
        up_move = float(candles[index]["high"]) - float(candles[index - 1]["high"])
        down_move = float(candles[index - 1]["low"]) - float(candles[index]["low"])
        plus_dm.append(up_move if up_move > down_move and up_move > 0 else 0.0)
        minus_dm.append(down_move if down_move > up_move and down_move > 0 else 0.0)

    tr14 = sum(trs[:period])
    plus14 = sum(plus_dm[:period])
    minus14 = sum(minus_dm[:period])

    dx_values: list[float] = []
    dx_indices: list[int] = []

    def append_dx(index: int, tr_sum: float, plus_sum: float, minus_sum: float) -> None:
        if tr_sum <= 0:
            dx = 0.0
        else:
            plus_di = 100 * (plus_sum / tr_sum)
            minus_di = 100 * (minus_sum / tr_sum)
            denominator = plus_di + minus_di
            dx = 0.0 if denominator == 0 else 100 * abs(plus_di - minus_di) / denominator
        dx_values.append(dx)
        dx_indices.append(index)

    append_dx(period - 1, tr14, plus14, minus14)

    for index in range(period, len(candles)):
        tr14 = tr14 - (tr14 / period) + trs[index]
        plus14 = plus14 - (plus14 / period) + plus_dm[index]
        minus14 = minus14 - (minus14 / period) + minus_dm[index]
        append_dx(index, tr14, plus14, minus14)

    result: list[float | None] = [None] * len(candles)
    if len(dx_values) < period:
        return result

    initial = mean(dx_values[:period])
    first_index = dx_indices[period - 1]
    result[first_index] = initial
    previous = initial
    for idx in range(period, len(dx_values)):
        previous = ((previous * (period - 1)) + dx_values[idx]) / period
        result[dx_indices[idx]] = previous

    return result


def bollinger(closes: list[float], period: int = 20, stddevs: float = 2.0) -> tuple[list[float | None], list[float | None], list[float | None]]:
    middle: list[float | None] = [None] * len(closes)
    upper: list[float | None] = [None] * len(closes)
    lower: list[float | None] = [None] * len(closes)
    if len(closes) < period:
        return middle, upper, lower

    for index in range(period - 1, len(closes)):
        window = closes[index - period + 1:index + 1]
        m = mean(window)
        sigma = pstdev(window)
        middle[index] = m
        upper[index] = m + stddevs * sigma
        lower[index] = m - stddevs * sigma
    return middle, upper, lower


def highest(values: list[float], lookback: int, end_index: int) -> float | None:
    start = end_index - lookback
    if start < 0:
        return None
    return max(values[start:end_index])


def lowest(values: list[float], lookback: int, end_index: int) -> float | None:
    start = end_index - lookback
    if start < 0:
        return None
    return min(values[start:end_index])


def safe_pct_change(start: float, end: float) -> float:
    if start == 0:
        return 0.0
    return (end / start - 1) * 100


def finite(value: float | None) -> bool:
    return value is not None and math.isfinite(float(value))
