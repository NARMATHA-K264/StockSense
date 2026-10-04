from datetime import date

import pytest
from pydantic import ValidationError

from services.risk_service import SAFETY_DAYS, analyze_item
from utils.validation import RiskItem


def item(quantity: int, reorder: int, sales: list[dict]) -> RiskItem:
    return RiskItem(productId="p", storeId="s", currentQuantity=quantity, reorderLevel=reorder, sales=sales)


def history() -> list[dict]:
    return [{"unitsSold": 5, "saleDate": date(2026, 9, day).isoformat()} for day in range(1, 8)]


def test_adequate_stock():
    result = analyze_item(item(100, 10, history()), 7)
    assert result["status"] == "ADEQUATE"
    assert result["recommendedReplenishment"] == 0


def test_low_stock_when_below_reorder_but_not_forecast():
    result = analyze_item(item(35, 40, history()), 7)
    assert result["status"] == "LOW"


def test_critical_stock_when_forecast_exceeds_quantity():
    result = analyze_item(item(20, 5, history()), 7)
    assert result["status"] == "CRITICAL"
    assert result["recommendedReplenishment"] > 0


def test_out_of_stock():
    result = analyze_item(item(0, 5, history()), 7)
    assert result["status"] == "OUT_OF_STOCK"


def test_replenishment_formula_and_safety_stock():
    result = analyze_item(item(20, 5, history()), 7)
    assert result["safetyStock"] == 10
    assert result["targetStock"] == 45
    assert result["recommendedReplenishment"] == max(0, result["targetStock"] - result["currentQuantity"])


def test_zero_demand_has_no_division_error():
    sales = [{"unitsSold": 1, "saleDate": "2026-09-01"}, {"unitsSold": 1, "saleDate": "2026-09-02"}]
    result = analyze_item(item(10, 2, sales), 7)
    assert result["daysOfCover"] is not None
    assert result["recommendedReplenishment"] >= 0


def test_no_history_is_insufficient_data():
    result = analyze_item(item(5, 5, []), 7)
    assert result["status"] == "INSUFFICIENT_DATA"
    assert result["recommendedReplenishment"] == 0


def test_zero_stock_takes_priority_over_missing_history():
    result = analyze_item(item(0, 5, []), 7)
    assert result["status"] == "OUT_OF_STOCK"


def test_invalid_risk_values_are_rejected():
    with pytest.raises(ValidationError):
        item(-1, 5, [])
    with pytest.raises(ValidationError):
        RiskItem(productId="p", storeId="s", currentQuantity=1, reorderLevel=1, sales=[{"unitsSold": -1, "saleDate": "2026-09-01"}])