from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID
from database.session import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.exchange import (
    ExchangeCreate,
    ExchangeUpdate,
    ExchangeResponse,
)
from services.exchange_service import ExchangeService

router = APIRouter(
    prefix="/exchange",
    tags=["Exchange"],
)


@router.post(
    "",
    response_model=ExchangeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exchange(
    data: ExchangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.create(
        db=db,
        user_id=current_user.id,
        data=data,
    )


@router.get(
    "",
    response_model=list[ExchangeResponse],
)
def get_exchanges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.get_all(
        db=db,
        user_id=current_user.id,
    )


@router.get(
    "/{exchange_id}",
    response_model=ExchangeResponse,
)
def get_exchange(
    exchange_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.get(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
    )


@router.put(
    "/{exchange_id}",
    response_model=ExchangeResponse,
)
def update_exchange(
    exchange_id: UUID,
    data: ExchangeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.update(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        data=data,
    )


@router.delete(
    "/{exchange_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_exchange(
    exchange_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ExchangeService.delete(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
    )

@router.get(
    "/{exchange_id}/balance",
)
def get_balance(
    exchange_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.get_balance(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
    )

@router.get("/{exchange_id}/positions")
def get_positions(
    exchange_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.get_positions(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
    )


@router.post("/{exchange_id}/leverage")
def set_leverage(
    exchange_id: UUID,
    symbol: str,
    leverage: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.set_leverage(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        symbol=symbol,
        leverage=leverage,
    )


@router.get("/{exchange_id}/ticker/{symbol}")
def get_ticker(
    exchange_id: UUID,
    symbol: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.get_ticker(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        symbol=symbol,
    )

@router.get("/{exchange_id}/ohlcv/{symbol}")
def get_ohlcv(
    exchange_id: UUID,
    symbol: str,
    timeframe: str = "1h",
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExchangeService.get_ohlcv(
        db=db,
        user_id=current_user.id,
        exchange_id=exchange_id,
        symbol=symbol,
        timeframe=timeframe,
        limit=limit,
    )