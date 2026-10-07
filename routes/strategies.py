from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from schemas.strategies import StrategyBacktestRequest, StrategyBacktestResponse, StrategySignalResponse
from services.strategy_service import StrategyService

router = APIRouter(prefix="/strategies", tags=["Strategies"])


@router.get("")
def get_strategies():
    return {"success": True, "strategies": StrategyService.list()}


@router.get("/{strategy_id}/signal", response_model=StrategySignalResponse)
def get_signal(
    strategy_id: str,
    symbol: str = Query(...),
    market_type: str = Query("spot", pattern="^(spot|usdm)$"),
    timeframe: str | None = Query(None),
):
    try:
        return StrategyService.signal(strategy_id, symbol, market_type, timeframe)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Strategy market data unavailable: {exc}") from exc


@router.post("/{strategy_id}/backtest", response_model=StrategyBacktestResponse)
def run_backtest(strategy_id: str, data: StrategyBacktestRequest):
    try:
        return StrategyService.backtest(strategy_id, data)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Strategy backtest unavailable: {exc}") from exc
