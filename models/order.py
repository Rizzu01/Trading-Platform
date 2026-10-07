import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELED = "canceled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exchange_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exchanges.id", ondelete="CASCADE"), nullable=False, index=True)

    external_order_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    side: Mapped[OrderSide] = mapped_column(SqlEnum(OrderSide), nullable=False)
    type: Mapped[OrderType] = mapped_column(SqlEnum(OrderType), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(SqlEnum(OrderStatus), nullable=False, default=OrderStatus.OPEN)

    amount: Mapped[float] = mapped_column(Float, nullable=False)
    filled: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    remaining: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    average: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
