from database.session import SessionLocal
from schemas.auth import LoginRequest
from services.auth_service import AuthService

db = SessionLocal()

try:
    tokens = AuthService.login(
        db,
        LoginRequest(
            email="john@example.com",
            password="Password@123",
        ),
    )

    print("\nAccess Token:\n")
    print(tokens.access_token)

    print("\nRefresh Token:\n")
    print(tokens.refresh_token)

except Exception as e:
    print(e)

finally:
    db.close()