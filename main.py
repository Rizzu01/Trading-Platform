import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.api_v1 import router as api_v1_router
from core.config import settings
from core.exceptions import NotFoundException
from core.handlers import register_exception_handlers
from core.logger import logger
from core.responses import ApiResponse
from websocket.routes import router as websocket_router


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Professional Multi-Exchange Algorithmic Trading Platform",
    debug=settings.APP_DEBUG,
)

origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_v1_router)
app.include_router(websocket_router)


@app.get("/")
def root():
    return {
        "message": "Trading Platform API Running 🚀",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
    }


@app.get("/health")
def health():
    return ApiResponse.success(
        message="Backend is healthy.",
        data={"status": "healthy"},
    )


@app.get("/test-response")
def test_response():
    return ApiResponse.success(
        message="Backend is working.",
        data={"version": "1.0.0", "status": "healthy"},
    )


@app.get("/test-error")
def test_error():
    raise NotFoundException("User not found.")


@app.get("/test-log")
def test_log():
    logger.info("Test info log")
    logger.warning("Test warning")
    logger.error("Test error")
    return {"message": "Logs generated."}


if __name__ == "__main__":
    port = int(os.getenv("PORT", str(settings.APP_PORT)))
    uvicorn.run(app, host=settings.APP_HOST, port=port)
