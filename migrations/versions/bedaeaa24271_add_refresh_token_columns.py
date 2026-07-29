"""add refresh token columns

Revision ID: bedaeaa24271
Revises: e89d229ff9df
Create Date: 2026-07-28 12:49:32.783277

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bedaeaa24271'
down_revision: Union[str, Sequence[str], None] = 'e89d229ff9df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("refresh_token", sa.String(), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column(
            "refresh_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "refresh_token_expires_at")
    op.drop_column("users", "refresh_token")
