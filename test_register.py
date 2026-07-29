from database.session import SessionLocal
from schemas.user import UserCreate
from services.auth_service import AuthService

db = SessionLocal()

try:
    user = AuthService.register(
        db,
        UserCreate(
            full_name="John Doe",
            email="john@example.com",
            password="Password@123",
        ),
    )

    print("User Registered!")
    print(user.id)

except Exception as e:
    print(e)

finally:
    db.close()