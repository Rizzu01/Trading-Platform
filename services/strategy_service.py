from __future__ import annotations

from exchanges.factory import create_exchange
from strategies.engine import backtest, strategy_signal
from strategies.registry import get_strategy, list_strategies


class StrategyService:
    @staticmethod
    def list():
        return list_strategies()

    @staticmethod
    def _client(market_type: str):
        return create_exchange(
            exchange="binance",
            api_key="",
            api_secret="",
            market_type=market_type,
        )

    @staticmethod
    def _normalize_symbol(symbol: str) -> str:
        value = symbol.strip().upper()
        if "/" not in value and value.endswith("USDT"):
            value = value[:-4] + "/USDT"
        if "/" not in value:
            raise ValueError("Symbol must use BASE/QUOTE format or end with USDT.")
        return value

    @classmethod
    def _candles(cls, symbol: str, market_type: str, timeframe: str, limit: int):
        client = cls._client(market_type)
        normalized = cls._normalize_symbol(symbol)
        raw = client.get_ohlcv(normalized, timeframe=timeframe, limit=limit)
        return [
            {
                "timestamp": int(item[0]),
                "open": float(item[1]),
                "high": float(item[2]),
                "low": float(item[3]),
                "close": float(item[4]),
                "volume": float(item[5]),
            }
            for item in raw
        ], normalized

    @classmethod
    def signal(cls, strategy_id: str, symbol: str, market_type: str, timeframe: str | None = None):
        strategy = get_strategy(strategy_id)
        selected_timeframe = timeframe or strategy["timeframe"]
        candles, normalized = cls._candles(normalized_symbol := symbol, market_type, selected_timeframe, 500)
        signal = strategy_signal(strategy_id, candles)
        return {
            "strategy_id": strategy_id,
            "strategy_name": strategy["name"],
            "symbol": normalized,
            "market_type": market_type,
            "timeframe": selected_timeframe,
            "signal": signal.value,
            "confidence": signal.confidence,
            "reason": signal.reason,
            "stop_distance": signal.stop_distance,
        }

    @classmethod
    def backtest(cls, strategy_id: str, data):
        strategy = get_strategy(strategy_id)
        timeframe = data.timeframe or strategy["timeframe"]
        candles, normalized = cls._candles(data.symbol, data.market_type, timeframe, data.limit)
        result = backtest(
            strategy_id,
            candles,
            initial_capital=data.initial_capital,
            fee_bps=data.fee_bps,
            slippage_bps=data.slippage_bps,
            market_type=data.market_type,
        )
        result["symbol"] = normalized
        result["timeframe"] = timeframe
        return result
