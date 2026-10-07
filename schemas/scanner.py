from pydantic import BaseModel, Field


class ScannerRequest(BaseModel):
    symbols: list[str] = Field(default=["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"], min_length=1, max_length=30)
    market_type: str = Field(default="usdm", pattern="^(spot|usdm)$")
    timeframe: str = "15m"
