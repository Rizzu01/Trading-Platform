from __future__ import annotations

from pydantic import BaseModel, Field


class MarketContextResponse(BaseModel):
    context: dict


class AIAnalyzeRequest(BaseModel):
    symbol: str = Field(min_length=3)
    market_type: str = Field(default="spot", pattern="^(spot|usdm)$")
    timeframe: str = Field(default="15m")
    question: str = Field(min_length=3, max_length=2000)


class AIAnalyzeResponse(BaseModel):
    answer: str
    timestamp: int
    context: dict


class RiskRequest(BaseModel):
    balance: float = Field(gt=0)
    risk_percent: float = Field(gt=0, le=100)
    entry: float = Field(gt=0)
    stop_loss: float = Field(gt=0)
    leverage: float = Field(default=1, gt=0)
    contract_multiplier: float = Field(default=1, gt=0)
