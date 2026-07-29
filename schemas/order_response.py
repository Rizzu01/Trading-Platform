from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class OrderResponse(BaseModel):
    success: bool

    order_id: str

    symbol: str

    side: str

    type: str

    status: str

    amount: float

    filled: float

    remaining: float

    price: Optional[float] = None

    average: Optional[float] = None

    cost: Optional[float] = None

    timestamp: Optional[int] = None

    datetime: Optional[datetime] = None


class CancelOrderResponse(BaseModel):
    success: bool

    message: str

    order_id: str


class OpenOrderResponse(BaseModel):
    success: bool

    orders: list[OrderResponse]