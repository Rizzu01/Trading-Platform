from pydantic import BaseModel, Field


class MarketOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=3, max_length=32, examples=["BTCUSDT"])
    amount: float = Field(..., gt=0)


class LimitOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=3, max_length=32, examples=["BTCUSDT"])
    amount: float = Field(..., gt=0)
    price: float = Field(..., gt=0)


class OrderResponse(BaseModel):
    id: str
    external_order_id: str
    symbol: str
    side: str
    type: str
    status: str
    amount: float
    filled: float
    remaining: float
    price: float | None = None
    average: float | None = None
    cost: float | None = None
