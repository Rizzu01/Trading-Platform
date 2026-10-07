from uuid import UUID

from sqlalchemy.orm import Session

from exchanges.factory import create_exchange
from schemas.order import LimitOrderRequest, MarketOrderRequest
from services.exchange_service import ExchangeService


def _normalize_symbol(symbol: str) -> str:
    symbol = symbol.strip().upper()
    if "/" not in symbol and symbol.endswith("USDT"):
        return symbol[:-4] + "/USDT"
    return symbol


class OrderService:

    @staticmethod
    def _client(db: Session, user_id: UUID, exchange_id: UUID):
        credentials = ExchangeService.get_credentials(db, user_id, exchange_id)
        return create_exchange(
            exchange_name=credentials["exchange"],
            api_key=credentials["api_key"],
            api_secret=credentials["api_secret"],
            passphrase=credentials["passphrase"],
        )

    @staticmethod
    def market_buy(db: Session, user_id: UUID, exchange_id: UUID, data: MarketOrderRequest):
        exchange = OrderService._client(db, user_id, exchange_id)
        order = exchange.market_buy(_normalize_symbol(data.symbol), data.amount)
        return {"success": True, "order": order}

    @staticmethod
    def market_sell(db: Session, user_id: UUID, exchange_id: UUID, data: MarketOrderRequest):
        exchange = OrderService._client(db, user_id, exchange_id)
        if not hasattr(exchange, "market_sell"):
            raise NotImplementedError("Market sell is not supported by this exchange adapter.")
        order = exchange.market_sell(_normalize_symbol(data.symbol), data.amount)
        return {"success": True, "order": order}

    @staticmethod
    def limit_buy(db: Session, user_id: UUID, exchange_id: UUID, data: LimitOrderRequest):
        exchange = OrderService._client(db, user_id, exchange_id)
        order = exchange.limit_buy(_normalize_symbol(data.symbol), data.amount, data.price)
        return {"success": True, "order": order}

    @staticmethod
    def limit_sell(db: Session, user_id: UUID, exchange_id: UUID, data: LimitOrderRequest):
        exchange = OrderService._client(db, user_id, exchange_id)
        if not hasattr(exchange, "limit_sell"):
            raise NotImplementedError("Limit sell is not supported by this exchange adapter.")
        order = exchange.limit_sell(_normalize_symbol(data.symbol), data.amount, data.price)
        return {"success": True, "order": order}

    @staticmethod
    def get_open_orders(db: Session, user_id: UUID, exchange_id: UUID, symbol: str | None = None):
        exchange = OrderService._client(db, user_id, exchange_id)
        if not hasattr(exchange, "get_open_orders"):
            raise NotImplementedError("Open orders are not supported by this exchange adapter.")
        orders = exchange.get_open_orders(_normalize_symbol(symbol) if symbol else None)
        return {"success": True, "orders": orders}

    @staticmethod
    def order_history(db: Session, user_id: UUID, exchange_id: UUID, symbol: str | None = None):
        exchange = OrderService._client(db, user_id, exchange_id)
        if not hasattr(exchange, "get_order_history"):
            raise NotImplementedError("Order history is not supported by this exchange adapter.")
        orders = exchange.get_order_history(_normalize_symbol(symbol) if symbol else None)
        return {"success": True, "orders": orders}

    @staticmethod
    def cancel_order(db: Session, user_id: UUID, exchange_id: UUID, order_id: str, symbol: str):
        exchange = OrderService._client(db, user_id, exchange_id)
        if not hasattr(exchange, "cancel_order"):
            raise NotImplementedError("Order cancellation is not supported by this exchange adapter.")
        result = exchange.cancel_order(order_id=order_id, symbol=_normalize_symbol(symbol))
        return {"success": True, "order": result}
