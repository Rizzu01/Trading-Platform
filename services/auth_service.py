from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from auth.jwt import create_access_token, create_refresh_token, verify_refresh_token
from auth.password import verify_password
from core.config import settings
from core.exceptions import ConflictException, UnauthorizedException
from models.user import User
from schemas.auth import LoginRequest, RefreshTokenRequest, TokenResponse
from schemas.user import UserCreate
from services.user_service import UserService


class AuthService:

    @staticmethod
    def register(db: Session, user_data: UserCreate) -> User:
        if UserService.get_by_email(db, user_data.email):
            raise ConflictException("Email already registered.")
        return UserService.create_user(db, user_data)

    @staticmethod
    def login(db: Session, login_data: LoginRequest) -> TokenResponse:
        user = UserService.get_by_email(db, login_data.email)
        if not user or not verify_password(login_data.password, user.password_hash):
            raise UnauthorizedException("Invalid email or password.")

        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
        })
        refresh_token = create_refresh_token({"sub": str(user.id)})

        now = datetime.now(timezone.utc)
        user.refresh_token = refresh_token
        user.refresh_token_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    @staticmethod
    def refresh(db: Session, request: RefreshTokenRequest) -> TokenResponse:
        payload = verify_refresh_token(request.refresh_token)
        try:
            user = db.get(User, UUID(payload["sub"]))
        except (KeyError, ValueError):
            raise UnauthorizedException("Invalid refresh token.")

        if not user or user.refresh_token != request.refresh_token:
            raise UnauthorizedException("Refresh token is invalid.")

        expires_at = user.refresh_token_expires_at
        if expires_at and expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise UnauthorizedException("Refresh token has expired.")

        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
        })
        new_refresh_token = create_refresh_token({"sub": str(user.id)})

        user.refresh_token = new_refresh_token
        user.refresh_token_expires_at = (
            datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
        )

    @staticmethod
    def logout(db: Session, request: RefreshTokenRequest) -> dict:
        payload = verify_refresh_token(request.refresh_token)
        try:
            user = db.get(User, UUID(payload["sub"]))
        except (KeyError, ValueError):
            raise UnauthorizedException("Invalid refresh token.")

        if not user:
            raise UnauthorizedException("User not found.")

        user.refresh_token = None
        user.refresh_token_expires_at = None
        db.commit()

        return {"success": True, "message": "Logged out successfully."}
