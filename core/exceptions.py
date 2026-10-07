class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
    ):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class BadRequestException(AppException):
    def __init__(self, message: str):
        super().__init__(message, 400)


class UnauthorizedException(AppException):
    def __init__(self, message: str):
        super().__init__(message, 401)


class ForbiddenException(AppException):
    def __init__(self, message: str):
        super().__init__(message, 403)


class NotFoundException(AppException):
    def __init__(self, message: str):
        super().__init__(message, 404)


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(message, 409)

class NotSupportedException(AppException):
    def __init__(self, message: str):
        super().__init__(message, 501)
