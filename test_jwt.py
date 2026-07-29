from auth.jwt import (
    create_access_token,
    verify_token,
)

token = create_access_token(
    {
        "sub": "admin@example.com"
    }
)

print("\nToken:\n")
print(token)

print("\nDecoded:\n")
print(verify_token(token))