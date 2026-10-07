from pydantic import BaseModel, Field


class PaperOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=3, max_length=32)
    side: str = Field(..., pattern="^(BUY|SELL)$")
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0)
    market_type: str = Field(default="usdm", pattern="^(spot|usdm)$")
    leverage: int = Field(default=1, ge=1, le=125)


class PaperResetRequest(BaseModel):
    balance: float = Field(default=100000, gt=0)
