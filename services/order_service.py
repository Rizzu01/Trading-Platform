from uuid import UUID

from sqlalchemy.orm import Session

from exchanges.factory import create_exchange
from models.order import Order, OrderSide, OrderStatus, OrderType
from schemas.order import LimitOrderRequest, MarketOrderRequest
from services.exchange_service import ExchangeService


def _normalize_symbol(symbol: str) -> str:
    symbol = symbol.strip().upper()
    if "/" not in symbol and symbol.endswith("USDT"):
        return symbol[:-4] + "/USDT"
    return symbol


def _as_float(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _normalize_status(status: str | None) -> OrderStatus:
    value = (status or "open").lower()
    mapping = {
        "open": OrderStatus.OPEN,
        "closed": OrderStatus.CLOSED,
        "canceled": OrderStatus.CANCELED,
        "cancelled": OrderStatus.CANCELED,
        "rejected": OrderStatus.REJECTED,
        "expired": OrderStatus.EXPIRED,
    }
    return mapping.get(value, OrderStatus.OPEN)


def _persist_order(
    db: Session,
    user_id: UUID,
    exchange_id: UUID,
    order_data: dict,
    fallback_symbol: str,
    fallback_side: OrderSide,
    fallback_type: OrderType,
) -> Order:
    external_id = str(order_data.get("id") or order_data.get("order_id") or "")
    if not external_id:
        raise ValueError("Exchange did not return an order id.")

    existing = (
        db.query(Order)
        .filter(
            Order.user_id == user_id,
            Order.exchange_id == exchange_id,
            Order.external_order_id == external_id,
        )
        .first()
    )

    values = {
        "symbol": str(order_data.get("symbol") or fallback_symbol).upper(),
        "side": OrderSide(str(order_data.get("side") or fallback_side.value).lower()),
        "type": OrderType(str(order_data.get("type") or fallback_type.value).lower()),
        "status": _normalize_status(order_data.get("status")),
        "amount": _as_float(order_data.get("amount")),
        "filled": _as_float(order_data.get("filled")),
        "remaining": _as_float(order_data.get("remaining")),
        "price": order_data.get("price"),
        "average": order_data.get("average"),
        "cost": order_data.get("cost"),
    }

    if values["amount"] <= 0:
        values["amount"] = _as_float(order_data.get("quantity"))

    if values["remaining"] == 0 and values["amount"] > 0 and values["filled"] < values["amount"]:
        values["remaining"] = values["amount"] - values["filled"]

    if existing:
        for key, value in values.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing

    record = Order(
        user_id=user_id,
        exchange_id=exchange_id,
        external_order_id=external_id,
        **values,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _serialize_order(order: Order) -> dict:
    return {
        "id": str(order.id),
        "external_order_id": order.external_order_id,
        "symbol": order.symbol,
        "side": order.side.value,
        "type": order.type.value,
        "status": order.status.value,
        "amount": order.amount,
        "filled": order.filled,
        "remaining": order.remaining,
        "price": order.price,
        "average": order.average,
        "cost": order.cost,
    }


class OrderService:
    @staticmethod
    def _client(db: Session, user_id: UUID, exchange_id: UUID):
        credentials = ExchangeService.get_credentials(db, user_id, exchange_id)
        return create_exchange(
            exchange=credentials["exchange"],
            api_key=credentials["api_key"],
            api_secret=credentials["api_secret"],
            passphrase=credentials["passphrase"],
            market_type=credentials["market_type"],
        )

    @staticmethod
    def _place(db, user_id, exchange_id, symbol, side, order_type, amount, price=None):
        exchange = OrderService._client(db, user_id, exchange_id)
        symbol = _normalize_symbol(symbol)

        if order_type == OrderType.MARKET and side == OrderSide.BUY:
            raw = exchange.market_buy(symbol, amount)
        elif order_type == OrderType.MARKET and side == OrderSide.SELL:
            raw = exchange.market_sell(symbol, amount)
        elif order_type == OrderType.LIMIT and side == OrderSide.BUY:
            raw = exchange.limit_buy(symbol, amount, price)
        elif order_type == OrderType.LIMIT and side == OrderSide.SELL:
            raw = exchange.limit_sell(symbol, amount, price)
        else:
            raise NotImplementedError("Unsupported order configuration.")

        record = _persist_order(
            db, user_id, exchange_id, raw, symbol, side, order_type
        )
        return {"success": True, "order": _serialize_order(record)}

    @staticmethod
    def market_buy(db: Session, user_id: UUID, exchange_id: UUID, data: MarketOrderRequest):
        return OrderService._place(
            db, user_id, exchange_id, data.symbol, OrderSide.BUY, OrderType.MARKET, data.amount
        )

    @staticmethod
    def market_sell(db: Session, user_id: UUID, exchange_id: UUID, data: MarketOrderRequest):
        return OrderService._place(
            db, user_id, exchange_id, data.symbol, OrderSide.SELL, OrderType.MARKET, data.amount
        )

    @staticmethod
    def limit_buy(db: Session, user_id: UUID, exchange_id: UUID, data: LimitOrderRequest):
        return OrderService._place(
            db, user_id, exchange_id, data.symbol, OrderSide.BUY, OrderType.LIMIT, data.amount, data.price
        )

    @staticmethod
    def limit_sell(db: Session, user_id: UUID, exchange_id: UUID, data: LimitOrderRequest):
        return OrderService._place(
            db, user_id, exchange_id, data.symbol, OrderSide.SELL, OrderType.LIMIT, data.amount, data.price
        )

    @staticmethod
    def get_open_orders(db: Session, user_id: UUID, exchange_id: UUID, symbol: str | None = None):
        query = db.query(Order).filter(
            Order.user_id == user_id,
            Order.exchange_id == exchange_id,
            Order.status == OrderStatus.OPEN,
        )
        if symbol:
            query = query.filter(Order.symbol == _normalize_symbol(symbol).upper())
        return {"success": True, "orders": [_serialize_order(item) for item in query.order_by(Order.created_at.desc()).all()]}

    @staticmethod
    def order_history(db: Session, user_id: UUID, exchange_id: UUID, symbol: str | None = None):
        query = db.query(Order).filter(
            Order.user_id == user_id,
            Order.exchange_id == exchange_id,
        )
        if symbol:
            query = query.filter(Order.symbol == _normalize_symbol(symbol).upper())
        return {"success": True, "orders": [_serialize_order(item) for item in query.order_by(Order.created_at.desc()).all()]}

    @staticmethod
    def cancel_order(db: Session, user_id: UUID, exchange_id: UUID, order_id: str, symbol: str):
        exchange = OrderService._client(db, user_id, exchange_id)
        result = exchange.cancel_order(order_id=order_id, symbol=_normalize_symbol(symbol))

        record = (
            db.query(Order)
            .filter(
                Order.user_id == user_id,
                Order.exchange_id == exchange_id,
                Order.external_order_id == order_id,
            )
            .first()
        )
        if record:
            record.status = _normalize_status(result.get("status") if isinstance(result, dict) else "canceled")
            if record.status == OrderStatus.OPEN:
                record.status = OrderStatus.CANCELED
            db.commit()
            db.refresh(record)

        return {
            "success": True,
            "order": _serialize_order(record) if record else result,
        }
