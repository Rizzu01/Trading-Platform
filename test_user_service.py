from database.session import SessionLocal
from schemas.user import UserCreate
from services.user_service import UserService

db = SessionLocal()

try:
    user = UserService.create_user(
        db,
        UserCreate(
            full_name="Rizwan Khan",
            email="rizwan@example.com",
            password="Password@123",
        ),
    )

    print("\nUser Created Successfully!\n")
    print(f"ID: {user.id}")
    print(f"Name: {user.full_name}")
    print(f"Email: {user.email}")

finally:
    db.close()