from database.base import Base
from database.session import engine

# Import all models so SQLAlchemy registers their metadata.
from models.user import User
from models.exchange import Exchange
from models.order import Order


def create_database():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    create_database()
    print("Database initialized successfully.")
