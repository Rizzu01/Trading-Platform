from database.base import Base
from database.session import engine

# Import all models here
from models.user import User


def create_database():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    create_database()
    print("✅ Database initialized successfully.")