from fastapi import APIRouter, Depends, HTTPException
from dependencies.auth import get_current_user
from models.user import User
from schemas.paper import PaperOrderRequest, PaperResetRequest
from services.paper_trading_service import PaperTradingService

router = APIRouter(prefix="/paper", tags=["Paper Trading"])

@router.get("/account")
def paper_account(current_user: User = Depends(get_current_user)):
    return PaperTradingService.snapshot(current_user.id)

@router.post("/reset")
def paper_reset(data: PaperResetRequest, current_user: User = Depends(get_current_user)):
    return PaperTradingService.reset(current_user.id, data.balance)

@router.post("/orders/market")
def paper_market_order(data: PaperOrderRequest, current_user: User = Depends(get_current_user)):
    try:
        return PaperTradingService.market_order(current_user.id, data.symbol, data.side, data.quantity, data.price, data.market_type, data.leverage)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
