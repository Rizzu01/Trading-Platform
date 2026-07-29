from fastapi import APIRouter

from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.exchange import router as exchange_router
api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(exchange_router)