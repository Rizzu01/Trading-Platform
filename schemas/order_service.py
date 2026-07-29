from uuid import UUID

from sqlalchemy.orm import Session

from exchanges.binance import BinanceExchange
from schemas.order import (
    MarketOrderRequest,
    LimitOrderRequest,
)
from services.exchange_service import ExchangeService


class OrderService:

    @staticmethod
    def market_buy(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        data: MarketOrderRequest,
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

        symbol = data.symbol

        if "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        order = exchange.market_buy(
            symbol=symbol,
            amount=data.amount,
        )

        return {
            "success": True,
            "order": order,
        }

    @staticmethod
    def market_sell(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        data: MarketOrderRequest,
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

        symbol = data.symbol

        if "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        order = exchange.market_sell(
            symbol=symbol,
            amount=data.amount,
        )

        return {
            "success": True,
            "order": order,
        }

    @staticmethod
    def limit_buy(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        data: LimitOrderRequest,
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

        symbol = data.symbol

        if "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        order = exchange.limit_buy(
            symbol=symbol,
            amount=data.amount,
            price=data.price,
        )

        return {
            "success": True,
            "order": order,
        }

    @staticmethod
    def limit_sell(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        data: LimitOrderRequest,
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

        symbol = data.symbol

        if "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        order = exchange.limit_sell(
            symbol=symbol,
            amount=data.amount,
            price=data.price,
        )

        return {
            "success": True,
            "order": order,
        }

    @staticmethod
    def get_open_orders(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        symbol: str | None = None,
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

        if symbol and "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        orders = exchange.get_open_orders(symbol)

        return {
            "success": True,
            "orders": orders,
        }

    @staticmethod
    def cancel_order(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        order_id: str,
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

        if "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        result = exchange.cancel_order(
            order_id=order_id,
            symbol=symbol,
        )

        return {
            "success": True,
            "order": result,
        }

    @staticmethod
    def order_history(
        db: Session,
        user_id: UUID,
        exchange_id: UUID,
        symbol: str | None = None,
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

        if symbol and "/" not in symbol and symbol.endswith("USDT"):
            symbol = symbol[:-4] + "/USDT"

        orders = exchange.get_order_history(symbol)

        return {
            "success": True,
            "orders": orders,
        }