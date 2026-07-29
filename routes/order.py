from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.order import (
    MarketOrderRequest,
    LimitOrderRequest,
)
from services.order_service import OrderService

router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


# -------------------------------
# Market Buy
# -------------------------------

@router.post("/{exchange_id}/market-buy")
def market_buy(
    exchange_id: UUID,
    data: MarketOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.market_buy(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        data=data,
    )


# -------------------------------
# Market Sell
# -------------------------------

@router.post("/{exchange_id}/market-sell")
def market_sell(
    exchange_id: UUID,
    data: MarketOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.market_sell(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        data=data,
    )


# -------------------------------
# Limit Buy
# -------------------------------

@router.post("/{exchange_id}/limit-buy")
def limit_buy(
    exchange_id: UUID,
    data: LimitOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.limit_buy(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        data=data,
    )


# -------------------------------
# Limit Sell
# -------------------------------

@router.post("/{exchange_id}/limit-sell")
def limit_sell(
    exchange_id: UUID,
    data: LimitOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.limit_sell(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        data=data,
    )


# -------------------------------
# Open Orders
# -------------------------------

@router.get("/{exchange_id}/open")
def open_orders(
    exchange_id: UUID,
    symbol: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.get_open_orders(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        symbol=symbol,
    )


# -------------------------------
# Order History
# -------------------------------

@router.get("/{exchange_id}/history")
def order_history(
    exchange_id: UUID,
    symbol: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.order_history(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        symbol=symbol,
    )


# -------------------------------
# Cancel Order
# -------------------------------

@router.delete("/{exchange_id}/{order_id}")
def cancel_order(
    exchange_id: UUID,
    order_id: str,
    symbol: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService.cancel_order(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        order_id=order_id,
        symbol=symbol,
    )