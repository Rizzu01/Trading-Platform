import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class PositionSide(str, Enum):
    LONG = "long"
    SHORT = "short"


class PositionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exchange_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exchanges.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    side: Mapped[PositionSide] = mapped_column(SqlEnum(PositionSide), nullable=False)
    status: Mapped[PositionStatus] = mapped_column(SqlEnum(PositionStatus), nullable=False, default=PositionStatus.OPEN)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    mark_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    leverage: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    margin: Mapped[float | None] = mapped_column(Float, nullable=True)
    unrealized_pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    realized_pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    liquidation_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
