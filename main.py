from fastapi import FastAPI
from core.handlers import register_exception_handlers
from api.api_v1 import router as api_v1_router
from core.responses import ApiResponse
from core.exceptions import NotFoundException
from core.logger import logger
from routes.order import router as order_router



app = FastAPI(
    title="Trading Platform API",
    version="1.0.0",
    description="Professional Multi-Exchange Algorithmic Trading Platform",
)

register_exception_handlers(app)

app.include_router(api_v1_router)
app.include_router(order_router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "message": "Trading Platform API Running 🚀"
    }


@app.get("/test-response")
def test_response():
    return ApiResponse.success(
        message="Backend is working.",
        data={
            "version": "1.0.0",
            "status": "healthy",
        },
    )
@app.get("/test-error")
def test_error():
    raise NotFoundException("User not found.")



@app.get("/test-log")
def test_log():

    logger.info("Test info log")

    logger.warning("Test warning")

    logger.error("Test error")

    return {
        "message": "Logs generated."
    }
