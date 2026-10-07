"""baseline trading platform schema

Revision ID: 20261007_0001
Revises:
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261007_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum("ADMIN", "USER", name="userrole")
    order_side = sa.Enum("BUY", "SELL", name="orderside")
    order_type = sa.Enum("MARKET", "LIMIT", name="ordertype")
    order_status = sa.Enum("OPEN", "CLOSED", "CANCELED", "REJECTED", "EXPIRED", name="orderstatus")

    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    order_side.create(bind, checkfirst=True)
    order_type.create(bind, checkfirst=True)
    order_status.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("is_two_factor_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("refresh_token", sa.String(length=512), nullable=True),
        sa.Column("refresh_token_expires_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "exchanges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exchange_name", sa.String(length=50), nullable=False),
        sa.Column("market_type", sa.String(length=20), nullable=False),
        sa.Column("api_key", sa.String(), nullable=False),
        sa.Column("api_secret", sa.String(), nullable=False),
        sa.Column("passphrase", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exchanges_user_id", "exchanges", ["user_id"], unique=False)

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exchange_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_order_id", sa.String(length=128), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("side", order_side, nullable=False),
        sa.Column("type", order_type, nullable=False),
        sa.Column("status", order_status, nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("filled", sa.Float(), nullable=False),
        sa.Column("remaining", sa.Float(), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("average", sa.Float(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["exchange_id"], ["exchanges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"], unique=False)
    op.create_index("ix_orders_exchange_id", "orders", ["exchange_id"], unique=False)
    op.create_index("ix_orders_external_order_id", "orders", ["external_order_id"], unique=False)
    op.create_index("ix_orders_symbol", "orders", ["symbol"], unique=False)
    position_side = sa.Enum("LONG", "SHORT", name="positionside")
    position_status = sa.Enum("OPEN", "CLOSED", name="positionstatus")
    position_side.create(bind, checkfirst=True)
    position_status.create(bind, checkfirst=True)

    op.create_table(
        "positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exchange_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("side", position_side, nullable=False),
        sa.Column("status", position_status, nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("entry_price", sa.Float(), nullable=False),
        sa.Column("mark_price", sa.Float(), nullable=True),
        sa.Column("leverage", sa.Float(), nullable=False),
        sa.Column("margin", sa.Float(), nullable=True),
        sa.Column("unrealized_pnl", sa.Float(), nullable=False),
        sa.Column("realized_pnl", sa.Float(), nullable=False),
        sa.Column("liquidation_price", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["exchange_id"], ["exchanges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_positions_user_id", "positions", ["user_id"], unique=False)
    op.create_index("ix_positions_exchange_id", "positions", ["exchange_id"], unique=False)
    op.create_index("ix_positions_symbol", "positions", ["symbol"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_orders_symbol", table_name="orders")
    op.drop_index("ix_orders_external_order_id", table_name="orders")
    op.drop_index("ix_orders_exchange_id", table_name="orders")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")
    op.drop_index("ix_positions_symbol", table_name="positions")
    op.drop_index("ix_positions_exchange_id", table_name="positions")
    op.drop_index("ix_positions_user_id", table_name="positions")
    op.drop_table("positions")
    op.drop_index("ix_exchanges_user_id", table_name="exchanges")
    op.drop_table("exchanges")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    for enum_name in ("positionstatus", "positionside", "orderstatus", "ordertype", "orderside", "userrole"):
        sa.Enum(name=enum_name).drop(bind, checkfirst=True)
