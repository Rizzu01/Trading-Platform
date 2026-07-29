from typing import Any

from fastapi.responses import JSONResponse


class ApiResponse:
    @staticmethod
    def success(
        data: Any = None,
        message: str = "Success",
        status_code: int = 200,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status_code,
            content={
                "success": True,
                "message": message,
                "data": data,
            },
        )

    @staticmethod
    def error(
        message: str = "Something went wrong",
        status_code: int = 400,
        errors: Any = None,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "message": message,
                "errors": errors,
            },
        )