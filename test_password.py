from auth.password import hash_password, verify_password

password = "MyPassword123"

hashed = hash_password(password)

print("Hash:", hashed)

print("Valid:", verify_password(password, hashed))