from pydantic import BaseModel, Field


class TickerResponse(BaseModel):
    symbol: str
    last: float | None = None
    bid: float | None = None
    ask: float | None = None
    high: float | None = None
    low: float | None = None
    volume: float | None = None
    timestamp: int | None = None


class Candle(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class OHLCVResponse(BaseModel):
    symbol: str
    timeframe: str
    candles: list[Candle] = Field(default_factory=list)
