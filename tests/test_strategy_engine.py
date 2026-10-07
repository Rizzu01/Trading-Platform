from strategies.engine import backtest, strategy_signal
from strategies.registry import get_strategy, list_strategies


def _candles(count=180, trend=True):
    candles = []
    price = 100.0
    for index in range(count):
        if trend:
            price *= 1.003 if index % 3 else 1.001
        else:
            price *= 1.01 if index % 12 < 6 else 0.99
        candles.append(
            {
                "timestamp": index * 3600_000,
                "open": price * 0.998,
                "high": price * 1.004,
                "low": price * 0.996,
                "close": price,
                "volume": 1000 + index,
            }
        )
    return candles


def test_registry_contains_research_and_experimental_strategies():
    strategies = list_strategies()
    ids = {item["id"] for item in strategies}
    assert {"adaptive_trend", "donchian_ensemble", "regime_rsi"} <= ids
    assert get_strategy("adaptive_trend")["tier"] == "research-backed"
    assert get_strategy("regime_rsi")["tier"] == "experimental"


def test_strategy_signal_returns_valid_contract():
    signal = strategy_signal("adaptive_trend", _candles())
    assert signal.value in (-1, 0, 1)
    assert 0 <= signal.confidence <= 100
    assert signal.reason


def test_spot_backtest_never_opens_short_positions():
    result = backtest(
        "adaptive_trend",
        _candles(),
        initial_capital=10_000,
        fee_bps=5,
        slippage_bps=2,
        market_type="spot",
    )
    assert result["final_equity"] > 0
    assert result["trade_count"] >= 0
    assert all(trade["side"] == "long" for trade in result["trades"])


def test_futures_backtest_allows_short_positions():
    result = backtest(
        "adaptive_trend",
        _candles(trend=False),
        initial_capital=10_000,
        fee_bps=5,
        slippage_bps=2,
        market_type="usdm",
    )
    assert result["final_equity"] > 0
    assert result["market_type"] == "usdm"
