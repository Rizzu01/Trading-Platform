from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from schemas.ai import AIAnalyzeRequest, AIAnalyzeResponse, RiskRequest
from services.ai_provider import AIProvider, AIProviderError
from services.market_context import MarketContextService
from services.risk_service import calculate_risk
from services.trade_setup_service import build_trade_setup

router = APIRouter(prefix="/ai", tags=["AI Trading"])


@router.get("/market-context")
def market_context(symbol: str, market_type: str = "spot", timeframe: str = "15m", limit: int = 300):
    try:
        return {"context": MarketContextService.build(symbol, market_type, timeframe, limit)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Insufficient real-time data to evaluate this setup: {exc}") from exc


@router.post("/analyze", response_model=AIAnalyzeResponse)
async def analyze(request: AIAnalyzeRequest):
    try:
        context = MarketContextService.build(request.symbol, request.market_type, request.timeframe, 300)
        answer = await AIProvider.analyze_context(context, request.question)
        return {"answer": answer, "timestamp": int(time.time() * 1000), "context": context}
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Insufficient real-time data to evaluate this setup: {exc}") from exc


@router.get("/trade-setup")
def trade_setup(symbol: str, market_type: str = "spot", timeframe: str = "15m"):
    try:
        return build_trade_setup(symbol, market_type, timeframe)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Insufficient real-time data to evaluate this setup: {exc}") from exc


@router.post("/risk")
def risk(request: RiskRequest):
    try:
        return calculate_risk(**request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
