from __future__ import annotations

from pydantic import BaseModel, Field


class StrategyBacktestRequest(BaseModel):
    symbol: str = Field(min_length=3)
    market_type: str = Field(default="spot", pattern="^(spot|usdm)$")
    timeframe: str | None = None
    limit: int = Field(default=500, ge=120, le=1500)
    initial_capital: float = Field(default=10_000, gt=0)
    fee_bps: float = Field(default=5.0, ge=0, le=100)
    slippage_bps: float = Field(default=2.0, ge=0, le=100)


class StrategySignalResponse(BaseModel):
    strategy_id: str
    strategy_name: str
    symbol: str
    market_type: str
    timeframe: str
    signal: int
    confidence: int
    reason: str
    stop_distance: float | None = None


class StrategyBacktestResponse(BaseModel):
    strategy: dict
    market_type: str
    initial_capital: float
    final_equity: float
    return_pct: float
    max_drawdown_pct: float
    trade_count: int
    win_rate_pct: float
    profit_factor: float | None
    fees_bps: float
    slippage_bps: float
    trades: list[dict] = Field(default_factory=list)
    validation: dict
