from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from exchanges.factory import create_exchange
from models.exchange import Exchange
from schemas.exchange import ExchangeCreate, ExchangeUpdate
from utils.encryption import decrypt, encrypt


class ExchangeService:
    @staticmethod
    def create(db: Session, user_id: UUID, data: ExchangeCreate) -> Exchange:
        exchange = Exchange(
            user_id=user_id,
            exchange_name=data.exchange_name,
            market_type=data.market_type,
            api_key=encrypt(data.api_key),
            api_secret=encrypt(data.api_secret),
            passphrase=encrypt(data.passphrase) if data.passphrase else None,
        )
        db.add(exchange)
        db.commit()
        db.refresh(exchange)
        return exchange

    @staticmethod
    def get_all(db: Session, user_id: UUID):
        return db.query(Exchange).filter(Exchange.user_id == user_id).all()

    @staticmethod
    def get(db: Session, user_id: UUID, exchange_id: UUID) -> Exchange:
        exchange = db.query(Exchange).filter(Exchange.id == exchange_id, Exchange.user_id == user_id).first()
        if exchange is None:
            raise NotFoundException("Exchange not found.")
        return exchange

    @staticmethod
    def update(db: Session, user_id: UUID, exchange_id: UUID, data: ExchangeUpdate) -> Exchange:
        exchange = ExchangeService.get(db, user_id, exchange_id)
        values = data.model_dump(exclude_unset=True)
        for key in ("exchange_name", "market_type", "is_active"):
            if key in values:
                setattr(exchange, key, values[key])
        if "api_key" in values:
            exchange.api_key = encrypt(values["api_key"])
        if "api_secret" in values:
            exchange.api_secret = encrypt(values["api_secret"])
        if "passphrase" in values:
            exchange.passphrase = encrypt(values["passphrase"]) if values["passphrase"] else None
        db.commit()
        db.refresh(exchange)
        return exchange

    @staticmethod
    def delete(db: Session, user_id: UUID, exchange_id: UUID):
        exchange = ExchangeService.get(db, user_id, exchange_id)
        db.delete(exchange)
        db.commit()

    @staticmethod
    def get_credentials(db: Session, user_id: UUID, exchange_id: UUID):
        exchange = ExchangeService.get(db, user_id, exchange_id)
        return {
            "exchange": exchange.exchange_name,
            "market_type": exchange.market_type,
            "api_key": decrypt(exchange.api_key),
            "api_secret": decrypt(exchange.api_secret),
            "passphrase": decrypt(exchange.passphrase) if exchange.passphrase else None,
        }

    @staticmethod
    def _client(db: Session, user_id: UUID, exchange_id: UUID):
        credentials = ExchangeService.get_credentials(db, user_id, exchange_id)
        return create_exchange(**credentials)

    @staticmethod
    def get_balance(db: Session, user_id: UUID, exchange_id: UUID):
        client = ExchangeService._client(db, user_id, exchange_id)
        return {"success": True, "balances": client.get_balance()}

    @staticmethod
    def get_ticker(db: Session, user_id: UUID, exchange_id: UUID, symbol: str):
        client = ExchangeService._client(db, user_id, exchange_id)
        if "/" not in symbol and symbol.upper().endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"
        ticker = client.get_ticker(symbol.upper())\n        return {"symbol": ticker.get("symbol", symbol.upper()), "last": ticker.get("last", ticker.get("price")), "bid": ticker.get("bid"), "ask": ticker.get("ask"), "high": ticker.get("high"), "low": ticker.get("low"), "volume": ticker.get("volume"), "timestamp": ticker.get("timestamp")}

    @staticmethod
    def get_ohlcv(db: Session, user_id: UUID, exchange_id: UUID, symbol: str, timeframe: str = "1h", limit: int = 100):
        client = ExchangeService._client(db, user_id, exchange_id)
        if "/" not in symbol and symbol.upper().endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"
        candles = client.get_ohlcv(symbol.upper(), timeframe=timeframe, limit=limit)
        return {"symbol": symbol.upper(), "timeframe": timeframe, "candles": [
            {"timestamp": c[0], "open": c[1], "high": c[2], "low": c[3], "close": c[4], "volume": c[5]}
            for c in candles
        ]}


    @staticmethod
    def get_positions(db: Session, user_id: UUID, exchange_id: UUID):
        client = ExchangeService._client(db, user_id, exchange_id)
        if not hasattr(client, "get_positions"):
            raise NotImplementedError("Positions are not supported by this exchange adapter.")
        return {"success": True, "positions": client.get_positions()}

    @staticmethod
    def set_leverage(db: Session, user_id: UUID, exchange_id: UUID, symbol: str, leverage: int):
        if leverage < 1 or leverage > 125:
            raise ValueError("Leverage must be between 1 and 125.")
        client = ExchangeService._client(db, user_id, exchange_id)
        if not hasattr(client, "set_leverage"):
            raise NotImplementedError("Leverage is not supported by this exchange adapter.")
        if "/" not in symbol and symbol.upper().endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"
        return {"success": True, "result": client.set_leverage(symbol.upper(), leverage)}
