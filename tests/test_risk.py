from services.risk_service import calculate_risk
import pytest


def test_calculate_risk_respects_risk_budget():
    result = calculate_risk(100000, 1, 100, 98, leverage=5)
    assert result["maximumLoss"] == 1000
    assert result["riskReward"] == 2.0
    assert result["marginRequired"] > 0
    assert result["liquidationRisk"] in {"lower", "moderate", "high"}


def test_calculate_risk_rejects_invalid_stop():
    with pytest.raises(ValueError):
        calculate_risk(100000, 1, 100, 100)
