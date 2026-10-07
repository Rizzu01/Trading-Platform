from fastapi import APIRouter, HTTPException

from schemas.scanner import ScannerRequest
from services.scanner_service import scan

router = APIRouter(prefix="/ai", tags=["AI Trading"])


@router.post("/scan")
def market_scan(request: ScannerRequest):
    try:
        return {"results": scan(request.symbols, request.market_type, request.timeframe)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/regime")
def market_regime(symbol: str, market_type: str = "usdm", timeframe: str = "15m"):
    try:
        from services.regime_service import analyze
        return analyze(symbol, market_type, timeframe)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
