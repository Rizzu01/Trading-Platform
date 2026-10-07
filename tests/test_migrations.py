import importlib.util
from pathlib import Path

from database.base import Base
from models.exchange import Exchange
from models.order import Order
from models.position import Position
from models.user import User


def _load_baseline_migration():
    path = Path(__file__).parents[1] / "migrations" / "versions" / "20261007_0001_initial_schema.py"
    spec = importlib.util.spec_from_file_location("baseline_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_baseline_migration_is_root_revision():
    migration = _load_baseline_migration()
    assert migration.revision == "20261007_0001"
    assert migration.down_revision is None


def test_baseline_covers_registered_models():
    expected = {"users", "exchanges", "orders", "positions"}
    assert expected <= set(Base.metadata.tables)


def test_baseline_models_match_table_names():
    assert User.__tablename__ == "users"
    assert Exchange.__tablename__ == "exchanges"
    assert Order.__tablename__ == "orders"
    assert Position.__tablename__ == "positions"
