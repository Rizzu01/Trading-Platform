from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "YOUR_NEW_REVISION_ID"
down_revision = "bedaeaa24271"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "refresh_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("users", "refresh_token_expires_at")