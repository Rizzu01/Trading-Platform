from uuid import uuid4

import pytest

from services.paper_trading_service import PaperTradingService


def test_paper_spot_round_trip():
    user = uuid4()
    PaperTradingService.reset(user, 10000)
    PaperTradingService.market_order(user, "BTCUSDT", "BUY", 0.01, 100000, "spot", 1)
    snap = PaperTradingService.market_order(user, "BTCUSDT", "SELL", 0.01, 101000, "spot", 1)
    assert snap["balance"] == pytest.approx(10010, rel=0, abs=1e-9)  # 1000 spent, 1010 returned
    assert snap["positions"] == []


def test_paper_futures_flip_realizes_pnl():
    user = uuid4()
    PaperTradingService.reset(user, 10000)
    PaperTradingService.market_order(user, "BTCUSDT", "BUY", 0.01, 100000, "usdm", 5)
    snap = PaperTradingService.market_order(user, "BTCUSDT", "SELL", 0.01, 101000, "usdm", 5)
    assert snap["positions"] == []
    assert snap["balance"] == pytest.approx(10002, rel=0, abs=1e-9)
