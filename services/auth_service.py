from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from auth.jwt import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from auth.password import verify_password
from core.config import settings
from core.exceptions import (
    ConflictException,
    UnauthorizedException,
)
from models.user import User
from schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from schemas.user import UserCreate
from services.user_service import UserService


class AuthService:

    @staticmethod
    def register(
        db: Session,
        user_data: UserCreate,
    ) -> User:

        existing_user = UserService.get_by_email(
            db,
            user_data.email,
        )

        if existing_user:
            raise ConflictException("Email already registered.")

        return UserService.create_user(
            db,
            user_data,
        )

    @staticmethod
    def login(
        db: Session,
        login_data: LoginRequest,
    ) -> TokenResponse:

        user = UserService.get_by_email(
            db,
            login_data.email,
        )

        if not user:
            raise UnauthorizedException(
                "Invalid email or password."
            )

        if not verify_password(
            login_data.password,
            user.password_hash,
        ):
            raise UnauthorizedException(
                "Invalid email or password."
            )

        access_token = create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role.value,
            }
        )

        refresh_token = create_refresh_token(
            {
                "sub": str(user.id),
            }
        )

        user.refresh_token = refresh_token
        user.refresh_token_expires_at = (
           datetime.utcnow()
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )

        db.commit()
        db.refresh(user)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    @staticmethod
    def refresh(
        db: Session,
        request: RefreshTokenRequest,
    ) -> TokenResponse:

        payload = verify_refresh_token(
            request.refresh_token
        )

        user = db.get(
            User,
            UUID(payload["sub"]),
        )

        if not user:
            raise UnauthorizedException(
                "User not found."
            )

        if user.refresh_token != request.refresh_token:
            raise UnauthorizedException(
                "Refresh token is invalid."
            )

        if (
            user.refresh_token_expires_at
            and user.refresh_token_expires_at
            < datetime.utcnow()
        ):
            raise UnauthorizedException(
                "Refresh token has expired."
            )

        access_token = create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role.value,
            }
        )

        new_refresh_token = create_refresh_token(
            {
                "sub": str(user.id),
            }
        )

        user.refresh_token = new_refresh_token
        user.refresh_token_expires_at = (
          datetime.utcnow()
          + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
)

        db.commit()
        db.refresh(user)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
        )

    @staticmethod
    def logout(
        db: Session,
        request: RefreshTokenRequest,
    ) -> dict:

        payload = verify_refresh_token(
            request.refresh_token
        )

        user = db.get(
            User,
            UUID(payload["sub"]),
        )

        if not user:
            raise UnauthorizedException(
                "User not found."
            )

        user.refresh_token = None
        user.refresh_token_expires_at = None

        db.commit()

        return {
            "success": True,
            "message": "Logged out successfully.",
        }