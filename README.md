# Trading Platform

Professional multi-exchange trading terminal foundation with a FastAPI backend and React/Vite frontend.

## Stack

- Python 3.12
- FastAPI
- SQLAlchemy + PostgreSQL
- Alembic
- CCXT exchange adapters
- Redis configuration
- JWT authentication
- React 19 + Vite

## Project structure

```
.
├── api/                 # API routers
├── core/                # Application settings
├── database/            # SQLAlchemy session/base
├── exchanges/           # Exchange adapters and factory
├── models/              # Database models
├── routes/              # HTTP/WebSocket routes
├── schemas/             # Pydantic schemas
├── services/            # Auth, exchange and order services
├── migrations/          # Alembic migrations
├── tests/               # Backend tests
└── frontend/            # React/Vite trading terminal
```

## Backend setup

1. Create a Python 3.12 virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and configure PostgreSQL, Redis and application secrets.
4. Run migrations:

```bash
alembic upgrade head
```

5. Start the API:

```bash
uvicorn main:app --reload --port 8000
```

Health check:

```
GET /health
```

## Frontend setup

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env` if the API is not running at the default URL.

Start Vite:

```bash
npm run dev
```

The frontend defaults to `http://localhost:5173` and the API defaults to `http://localhost:8000`.

## Tests

Backend:

```bash
pytest -q
```

Python compilation:

```bash
python -m compileall -q .
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Current capabilities

- JWT registration/login
- Encrypted exchange credential storage
- Binance and CoinSwitch adapter foundation
- Spot / USDT-M / Coin-M account configuration
- Public market ticker and OHLCV data
- WebSocket market stream foundation
- Position, open-order and order-history views
- Futures leverage/margin UI
- Safe order preview and validation UI

## Important

Live order execution is intentionally not represented as a completed production feature in this README. Exchange execution requires additional production hardening, permissions, risk controls, and end-to-end verification before real funds should be used.


## Deployment
Backend is configured for Railway with PostgreSQL, Redis, Alembic migrations, and a health check at `/health`.
