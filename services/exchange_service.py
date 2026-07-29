from sqlalchemy.orm import Session
from uuid import UUID
from schemas.order import MarketOrderRequest
from exchanges.binance import BinanceExchange
from models.exchange import Exchange
from schemas.exchange import (
    ExchangeCreate,
    ExchangeUpdate,
)
from utils.encryption import (
    encrypt,
    decrypt,
)
from core.exceptions import NotFoundException


class ExchangeService:

    @staticmethod
    def create(
        db: Session,
        user_id: UUID,
        data: ExchangeCreate,
    ) -> Exchange:

        exchange = Exchange(
            user_id=user_id,
            exchange_name=data.exchange_name,
            api_key=encrypt(data.api_key),
            api_secret=encrypt(data.api_secret),
            passphrase=encrypt(data.passphrase) if data.passphrase else None,
        )

        db.add(exchange)
        db.commit()
        db.refresh(exchange)

        return exchange

    @staticmethod
    def get_all(
        db: Session,
        user_id: UUID,
    ):
        return (
            db.query(Exchange)
            .filter(Exchange.user_id == user_id)
            .all()
        )

    @staticmethod
    def get(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
    ) -> Exchange:

        exchange = (
            db.query(Exchange)
            .filter(
                Exchange.id == exchange_id,
                Exchange.user_id == user_id,
            )
            .first()
        )

        if exchange is None:
            raise NotFoundException("Exchange not found.")

        return exchange

    @staticmethod
    def update(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        data: ExchangeUpdate,
    ) -> Exchange:

        exchange = ExchangeService.get(
            db,
            user_id,
            exchange_id,
        )

        update_data = data.model_dump(exclude_unset=True)

        if "exchange_name" in update_data:
            exchange.exchange_name = update_data["exchange_name"]

        if "api_key" in update_data:
            exchange.api_key = encrypt(update_data["api_key"])

        if "api_secret" in update_data:
            exchange.api_secret = encrypt(update_data["api_secret"])

        if "passphrase" in update_data:
            exchange.passphrase = (
                encrypt(update_data["passphrase"])
                if update_data["passphrase"]
                else None
            )

        if "is_active" in update_data:
            exchange.is_active = update_data["is_active"]

        db.commit()
        db.refresh(exchange)

        return exchange

    @staticmethod
    def delete(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
    ):

        exchange = ExchangeService.get(
            db,
            user_id,
            exchange_id,
        )

        db.delete(exchange)
        db.commit()

    @staticmethod
    def get_credentials(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
    ):

        exchange = ExchangeService.get(
            db,
            user_id,
            exchange_id,
        )

        api_key = decrypt(exchange.api_key)
        api_secret = decrypt(exchange.api_secret)

        return {
            "exchange": exchange.exchange_name,
            "api_key": api_key,
            "api_secret": api_secret,
            "passphrase": (
                decrypt(exchange.passphrase)
                if exchange.passphrase
                else None
            ),
        }

    @staticmethod
    def get_balance(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
    ):

        credentials = ExchangeService.get_credentials(
            db=db,
            user_id=user_id,
            exchange_id=exchange_id,
        )

        print("\n" + "=" * 70)
        print("DEBUG: ExchangeService.get_balance()")
        print("FILE      :", __file__)
        print("EXCHANGE  :", credentials["exchange"])
        print("API KEY   :", repr(credentials["api_key"]))
        print("API SECRET:", repr(credentials["api_secret"]))
        print("=" * 70 + "\n")

        try:
            exchange = BinanceExchange(
                api_key=credentials["api_key"],
                api_secret=credentials["api_secret"],
            )

            balances = exchange.get_balance()

            return {
                "success": True,
                "balances": balances,
            }

        except Exception as e:
            print("\n" + "=" * 70)
            print("BINANCE ERROR")
            print(type(e).__name__)
            print(str(e))
            print("=" * 70 + "\n")
            raise

    @staticmethod
    def get_ticker(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        symbol: str,
    ):

        credentials = ExchangeService.get_credentials(
            db=db,
            user_id=user_id,
            exchange_id=exchange_id,
        )

        exchange = BinanceExchange(
            api_key=credentials["api_key"],
            api_secret=credentials["api_secret"],
        )

        # Convert BTCUSDT -> BTC/USDT
        if "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        ticker = exchange.get_ticker(symbol)

        return {
            "success": True,
            "ticker": ticker,
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

        credentials = ExchangeService.get_credentials(
            db=db,
            user_id=user_id,
            exchange_id=exchange_id,
        )

        exchange = BinanceExchange(
            api_key=credentials["api_key"],
            api_secret=credentials["api_secret"],
        )

        # Convert BTCUSDT -> BTC/USDT
        if "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        candles = exchange.get_ohlcv(
            symbol=symbol,
            timeframe=timeframe,
            limit=limit,
        )

        return {
            "success": True,
            "symbol": symbol,
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

    