from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    full_name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: UUID
    role: str
    is_active: bool
    is_verified: bool
    is_two_factor_enabled: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)