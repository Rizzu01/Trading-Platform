from pydantic import BaseModel, Field


class ScannerRequest(BaseModel):
    symbols: list[str] | None = Field(default=None, max_length=30)
    market_type: str = Field(default="usdm", pattern="^(spot|usdm)$")
    timeframe: str = "15m"
