from strategies.engine import backtest, strategy_signal


def candles(count=180):
    rows=[]
    price=100.0
    for i in range(count):
        price += 0.15 + (0.05 if i % 7 == 0 else 0)
        rows.append({
            "timestamp": i * 900000,
            "open": price - 0.1,
            "high": price + 0.3,
            "low": price - 0.25,
            "close": price,
            "volume": 1000 + (i % 10) * 25,
        })
    return rows


def test_strategy_signal_returns_structured_signal():
    signal = strategy_signal("ema_rsi", candles())
    assert signal.value in {-1, 0, 1}
    assert 0 <= signal.confidence <= 100
    assert isinstance(signal.reason, str)


def test_backtest_returns_required_metrics():
    result = backtest("ema_rsi", candles(), 10000, 5, 2, "spot", 1.0, 1.0)
    for key in ("return_pct", "max_drawdown_pct", "trade_count", "win_rate_pct", "profit_factor", "sharpe_ratio", "sortino_ratio"):
        assert key in result
    assert result["final_equity"] > 0
