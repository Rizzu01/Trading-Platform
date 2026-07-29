from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from schemas.user import UserCreate, UserResponse
from services.auth_service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    return AuthService.register(
        db=db,
        user_data=user,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    return AuthService.login(
        db=db,
        login_data=login_data,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
)
def refresh(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    return AuthService.refresh(
        db=db,
        request=request,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
)
def logout(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    return AuthService.logout(
        db=db,
        request=request,
    )

    