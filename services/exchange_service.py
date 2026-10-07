from uuid import UUID

from sqlalchemy.orm import Session

import ccxt

from core.exceptions import (
    BadGatewayException,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    NotSupportedException,
)
from exchanges.factory import create_exchange
from models.exchange import Exchange
from schemas.exchange import ExchangeCreate, ExchangeUpdate
from utils.encryption import decrypt, encrypt


class ExchangeService:
    @staticmethod
    def _verify_credentials(
        exchange_name: str,
        market_type: str,
        api_key: str,
        api_secret: str,
        passphrase: str | None = None,
    ):
        try:
            client = create_exchange(
                exchange=exchange_name,
                api_key=api_key,
                api_secret=api_secret,
                passphrase=passphrase,
                market_type=market_type,
            )
            client.validate_credentials()
        except ccxt.AuthenticationError as exc:
            raise BadRequestException(
                "Exchange authentication failed. Verify the API key, secret, permissions, and market type."
            ) from exc
        except ccxt.PermissionDenied as exc:
            raise ForbiddenException(
                "The API key does not have the required account permissions."
            ) from exc
        except ccxt.NetworkError as exc:
            raise BadGatewayException(
                "Exchange API is unreachable right now. Please retry."
            ) from exc
        except NotImplementedError as exc:
            raise NotSupportedException(str(exc)) from exc
        except ValueError as exc:
            raise BadRequestException(str(exc)) from exc
        except ccxt.BaseError as exc:
            raise BadRequestException(
                "Exchange verification failed. Check the credentials and selected market type."
            ) from exc
        except Exception as exc:
            raise BadRequestException(
                "Exchange verification failed. Check the credentials and selected market type."
            ) from exc

    @staticmethod
    def _call_exchange(callback):
        try:
            return callback()
        except ccxt.AuthenticationError as exc:
            raise BadRequestException(
                "Exchange authentication failed. Reconnect the exchange and verify API permissions."
            ) from exc
        except ccxt.PermissionDenied as exc:
            raise ForbiddenException(
                "The connected API key does not have permission for this action."
            ) from exc
        except ccxt.NetworkError as exc:
            raise BadGatewayException(
                "Exchange API is unreachable right now. Please retry."
            ) from exc
        except ccxt.InsufficientFunds as exc:
            raise BadRequestException(
                "Insufficient exchange balance for this action."
            ) from exc
        except ccxt.InvalidOrder as exc:
            raise BadRequestException(
                "The exchange rejected this request. Check the symbol, amount, price, and order rules."
            ) from exc
        except ccxt.BaseError as exc:
            raise BadRequestException(
                "The exchange rejected this request."
            ) from exc

    @staticmethod
    def create(db: Session, user_id: UUID, data: ExchangeCreate) -> Exchange:
        ExchangeService._verify_credentials(
            exchange_name=data.exchange_name,
            market_type=data.market_type,
            api_key=data.api_key,
            api_secret=data.api_secret,
            passphrase=data.passphrase,
        )

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
        return (
            db.query(Exchange)
            .filter(Exchange.user_id == user_id)
            .order_by(Exchange.created_at.desc())
            .all()
        )

    @staticmethod
    def get(db: Session, user_id: UUID, exchange_id: UUID) -> Exchange:
        exchange = (
            db.query(Exchange)
            .filter(Exchange.id == exchange_id, Exchange.user_id == user_id)
            .first()
        )
        if exchange is None:
            raise NotFoundException("Exchange not found.")
        return exchange

    @staticmethod
    def update(db: Session, user_id: UUID, exchange_id: UUID, data: ExchangeUpdate) -> Exchange:
        exchange = ExchangeService.get(db, user_id, exchange_id)
        values = data.model_dump(exclude_unset=True)

        if any(
            key in values
            for key in ("exchange_name", "market_type", "api_key", "api_secret", "passphrase")
        ):
            current_api_key = decrypt(exchange.api_key)
            current_api_secret = decrypt(exchange.api_secret)
            current_passphrase = decrypt(exchange.passphrase) if exchange.passphrase else None

            ExchangeService._verify_credentials(
                exchange_name=values.get("exchange_name") or exchange.exchange_name,
                market_type=values.get("market_type") or exchange.market_type,
                api_key=values.get("api_key") or current_api_key,
                api_secret=values.get("api_secret") or current_api_secret,
                passphrase=values.get("passphrase") if "passphrase" in values else current_passphrase,
            )

        for key in ("exchange_name", "market_type", "is_active"):
            if key in values:
                setattr(exchange, key, values[key])

        if "api_key" in values and values["api_key"]:
            exchange.api_key = encrypt(values["api_key"])
        if "api_secret" in values and values["api_secret"]:
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
        return {"success": True, "balances": ExchangeService._call_exchange(client.get_balance)}

    @staticmethod
    def get_ticker(db: Session, user_id: UUID, exchange_id: UUID, symbol: str):
        client = ExchangeService._client(db, user_id, exchange_id)
        ticker = ExchangeService._call_exchange(lambda: client.get_ticker(symbol))
        return {
            "symbol": ticker.get("symbol", symbol.upper()),
            "last": ticker.get("last", ticker.get("price")),
            "bid": ticker.get("bid"),
            "ask": ticker.get("ask"),
            "high": ticker.get("high"),
            "low": ticker.get("low"),
            "volume": ticker.get("volume"),
            "timestamp": ticker.get("timestamp"),
        }

    @staticmethod
    def get_ohlcv(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
    ):
        if limit < 1 or limit > 500:
            raise BadRequestException("limit must be between 1 and 500")

        client = ExchangeService._client(db, user_id, exchange_id)
        candles = ExchangeService._call_exchange(
            lambda: client.get_ohlcv(symbol, timeframe=timeframe, limit=limit)
        )
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "candles": [
                {
                    "timestamp": c[0],
                    "open": c[1],
                    "high": c[2],
                    "low": c[3],
                    "close": c[4],
                    "volume": c[5],
                }
                for c in candles
            ],
        }

    @staticmethod
    def get_positions(db: Session, user_id: UUID, exchange_id: UUID):
        exchange = ExchangeService.get(db, user_id, exchange_id)
        client = ExchangeService._client(db, user_id, exchange_id)
        if exchange.market_type == "spot":
            return {
                "success": True,
                "positions": [],
                "supported": False,
                "message": "Positions are only available for futures accounts.",
            }
        if not hasattr(client, "get_positions"):
            raise NotSupportedException("Positions are not supported by this exchange adapter.")
        return {
            "success": True,
            "positions": ExchangeService._call_exchange(client.get_positions),
            "supported": True,
        }

    @staticmethod
    def set_leverage(db: Session, user_id: UUID, exchange_id: UUID, symbol: str, leverage: int):
        if leverage < 1 or leverage > 125:
            raise BadRequestException("Leverage must be between 1 and 125.")

        exchange = ExchangeService.get(db, user_id, exchange_id)
        if exchange.market_type == "spot":
            raise NotSupportedException("Leverage is only available for futures accounts.")

        client = ExchangeService._client(db, user_id, exchange_id)
        if not hasattr(client, "set_leverage"):
            raise NotSupportedException("Leverage is not supported by this exchange adapter.")

        return {
            "success": True,
            "result": ExchangeService._call_exchange(lambda: client.set_leverage(symbol, leverage)),
        }
