from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ExchangeCreate(BaseModel):
    exchange_name: str
    market_type: str = Field(default="spot", pattern="^(spot|usdm|coinm)$")
    api_key: str
    api_secret: str
    passphrase: Optional[str] = None


class ExchangeUpdate(BaseModel):
    exchange_name: Optional[str] = None
    market_type: Optional[str] = Field(default=None, pattern="^(spot|usdm|coinm)$")
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    passphrase: Optional[str] = None
    is_active: Optional[bool] = None


class ExchangeResponse(BaseModel):
    id: UUID
    exchange_name: str
    market_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
