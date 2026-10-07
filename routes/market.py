from fastapi import APIRouter, HTTPException
from exchanges.factory import create_exchange
from schemas.market import OHLCVResponse

router = APIRouter(prefix="/market", tags=["Market"])


def _normalize_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if "/" not in value and value.endswith("USDT"):
        value = value[:-4] + "/USDT"
    return value


@router.get("/ohlcv/{symbol}", response_model=OHLCVResponse)
def get_public_ohlcv(symbol: str, timeframe: str = "1h", limit: int = 100):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")
    try:
        client = create_exchange(
            exchange="binance",
            api_key="",
            api_secret="",
            market_type="spot",
        )
        normalized = _normalize_symbol(symbol)
        candles = client.get_ohlcv(normalized, timeframe=timeframe, limit=limit)
        return {
            "symbol": normalized,
            "timeframe": timeframe,
            "candles": [
                {
                    "timestamp": candle[0],
                    "open": candle[1],
                    "high": candle[2],
                    "low": candle[3],
                    "close": candle[4],
                    "volume": candle[5],
                }
                for candle in candles
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Market data unavailable: {exc}") from exc
