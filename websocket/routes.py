import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from exchanges.factory import create_exchange

router = APIRouter(prefix="/ws", tags=["WebSocket"])


@router.websocket("/market/{exchange}/{symbol}")
async def market_stream(websocket: WebSocket, exchange: str, symbol: str):
    await websocket.accept()

    try:
        client = create_exchange(
            exchange=exchange,
            api_key="",
            api_secret="",
            market_type="spot",
        )
        normalized = symbol.upper()
        if "/" not in normalized and normalized.endswith("USDT"):
            normalized = normalized[:-4] + "/USDT"

        while True:
            ticker = await asyncio.to_thread(client.get_ticker, normalized)
            payload = {
                "type": "ticker",
                "symbol": ticker.get("symbol", normalized),
                "last": ticker.get("price", ticker.get("last")),
                "bid": ticker.get("bid"),
                "ask": ticker.get("ask"),
                "high": ticker.get("high"),
                "low": ticker.get("low"),
                "volume": ticker.get("volume"),
            }
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await websocket.send_json({"error": str(exc)})
        await websocket.close(code=1011)
