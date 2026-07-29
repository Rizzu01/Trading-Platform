from sqlalchemy.orm import Session

from auth.password import hash_password
from models.user import User
from schemas.user import UserCreate


class UserService:
    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        return (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

    @staticmethod
    def get_by_id(db: Session, user_id):
        return (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

    @staticmethod
    def create_user(
        db: Session,
        user_data: UserCreate,
    ) -> User:

        user = User(
            full_name=user_data.full_name,
            email=user_data.email,
            password_hash=hash_password(user_data.password),
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user