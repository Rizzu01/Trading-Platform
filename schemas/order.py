from pydantic import BaseModel, Field


class MarketOrderRequest(BaseModel):
    symbol: str = Field(
        ...,
        examples=["BTCUSDT"],
        description="Trading pair",
    )

    amount: float = Field(
        ...,
        gt=0,
        description="Quantity to buy/sell",
    )


class LimitOrderRequest(BaseModel):
    symbol: str = Field(
        ...,
        examples=["BTCUSDT"],
        description="Trading pair",
    )

    amount: float = Field(
        ...,
        gt=0,
        description="Quantity",
    )

    price: float = Field(
        ...,
        gt=0,
        description="Limit price",
    )