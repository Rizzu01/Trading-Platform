from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ExchangeCreate(BaseModel):
    exchange_name: str
    api_key: str
    api_secret: str
    passphrase: Optional[str] = None


class ExchangeUpdate(BaseModel):
    exchange_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    passphrase: Optional[str] = None
    is_active: Optional[bool] = None




class ExchangeResponse(BaseModel):
    id: UUID
    exchange_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)