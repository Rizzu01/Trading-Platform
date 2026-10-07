from dataclasses import dataclass, field
from threading import Lock
from uuid import UUID, uuid4


@dataclass
class PaperPosition:
    symbol: str
    side: str
    quantity: float
    entry_price: float
    leverage: int = 1
    margin: float = 0.0


@dataclass
class PaperAccount:
    balance: float = 100000.0
    positions: dict[str, PaperPosition] = field(default_factory=dict)
    orders: list[dict] = field(default_factory=list)


class PaperTradingService:
    """Process-local paper simulator. It never sends orders to an exchange."""
    _accounts: dict[UUID, PaperAccount] = {}
    _lock = Lock()

    @classmethod
    def _account(cls, user_id: UUID) -> PaperAccount:
        with cls._lock:
            return cls._accounts.setdefault(user_id, PaperAccount())

    @classmethod
    def reset(cls, user_id: UUID, balance: float = 100000.0) -> dict:
        if balance <= 0:
            raise ValueError("balance must be greater than zero")
        with cls._lock:
            cls._accounts[user_id] = PaperAccount(balance=balance)
        return cls.snapshot(user_id)

    @classmethod
    def market_order(cls, user_id: UUID, symbol: str, side: str, quantity: float, price: float, market_type: str = "usdm", leverage: int = 1) -> dict:
        if quantity <= 0 or price <= 0:
            raise ValueError("quantity and price must be greater than zero")
        side, market_type, symbol = side.upper(), market_type.lower(), symbol.upper()
        if side not in {"BUY", "SELL"}:
            raise ValueError("side must be BUY or SELL")
        if market_type not in {"spot", "usdm"}:
            raise ValueError("market_type must be spot or usdm")
        if leverage < 1 or leverage > 125:
            raise ValueError("leverage must be between 1 and 125")

        account = cls._account(user_id)
        key = f"{market_type}:{symbol}"
        notional = quantity * price
        position_side = "LONG" if side == "BUY" else "SHORT"
        existing = account.positions.get(key)

        if market_type == "spot":
            if side == "BUY":
                if notional > account.balance:
                    raise ValueError("insufficient paper balance")
                if existing and existing.side == "LONG":
                    total = existing.quantity + quantity
                    existing.entry_price = ((existing.entry_price * existing.quantity) + notional) / total
                    existing.quantity = total
                    existing.margin += notional
                else:
                    account.positions[key] = PaperPosition(symbol, "LONG", quantity, price, 1, notional)
                account.balance -= notional
            else:
                if not existing or existing.side != "LONG" or quantity > existing.quantity:
                    raise ValueError("insufficient paper spot position")
                existing.quantity -= quantity
                account.balance += notional
                existing.margin = max(0.0, existing.margin - existing.entry_price * quantity)
                if existing.quantity == 0:
                    del account.positions[key]
        else:
            margin = notional / leverage
            if not existing:
                if margin > account.balance:
                    raise ValueError("insufficient paper balance")
                account.balance -= margin
                account.positions[key] = PaperPosition(symbol, position_side, quantity, price, leverage, margin)
            elif existing.side == position_side:
                total = existing.quantity + quantity
                existing.entry_price = ((existing.entry_price * existing.quantity) + (price * quantity)) / total
                existing.quantity = total
                existing.margin += margin
                if margin > account.balance:
                    raise ValueError("insufficient paper balance")
                account.balance -= margin
            else:
                close_qty = min(quantity, existing.quantity)
                pnl = ((price - existing.entry_price) if existing.side == "LONG" else (existing.entry_price - price)) * close_qty
                released = existing.margin * (close_qty / existing.quantity)
                account.balance += released + pnl
                existing.quantity -= close_qty
                existing.margin -= released
                if existing.quantity == 0:
                    del account.positions[key]
                remainder = quantity - close_qty
                if remainder:
                    new_margin = remainder * price / leverage
                    if new_margin > account.balance:
                        raise ValueError("insufficient paper balance for reversed position")
                    account.balance -= new_margin
                    account.positions[key] = PaperPosition(symbol, position_side, remainder, price, leverage, new_margin)

        order = {"id": str(uuid4()), "symbol": symbol, "side": side, "type": "MARKET", "status": "FILLED", "quantity": quantity, "price": price, "notional": notional, "marketType": market_type}
        account.orders.insert(0, order)
        return {"order": order, **cls.snapshot(user_id)}

    @classmethod
    def snapshot(cls, user_id: UUID) -> dict:
        account = cls._account(user_id)
        return {"balance": account.balance, "positions": [vars(p) for p in account.positions.values()], "orders": account.orders[:50], "mode": "paper"}
