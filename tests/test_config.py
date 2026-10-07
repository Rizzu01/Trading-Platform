import os


def test_ci_does_not_require_a_real_env_file():
    assert not os.path.exists(".env")


def test_database_url_uses_configured_components(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.setenv("JWT_SECRET_KEY", "y" * 32)
    monkeypatch.setenv("ENCRYPTION_KEY", "z" * 32)
    monkeypatch.setenv("DATABASE_HOST", "db")
    monkeypatch.setenv("DATABASE_NAME", "trading")
    monkeypatch.setenv("DATABASE_USER", "tester")
    monkeypatch.setenv("DATABASE_PASSWORD", "secret")

    from core.config import Settings

    settings = Settings()
    assert settings.DATABASE_URL == "postgresql+psycopg://tester:secret@db:5432/trading"
