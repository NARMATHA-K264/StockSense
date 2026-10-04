from datetime import date, timedelta

from services.forecasting_service import forecast_daily_demand, prepare_daily_demand


def sales_from(start: date, values: list[int]) -> list[dict]:
    return [{"unitsSold": units, "saleDate": (start + timedelta(days=index)).isoformat()} for index, units in enumerate(values)]


def test_daily_preparation_fills_missing_dates_and_aggregates():
    sales = [{"unitsSold": 2, "saleDate": "2026-09-01T10:00:00Z"}, {"unitsSold": 3, "saleDate": "2026-09-01T15:00:00Z"}, {"unitsSold": 4, "saleDate": "2026-09-03T10:00:00Z"}]
    daily = prepare_daily_demand(sales)
    assert list(daily) == [5.0, 0.0, 4.0]


def test_forecast_has_requested_future_dates_and_non_negative_values():
    forecast = forecast_daily_demand(sales_from(date(2026, 9, 1), [2, 0, 4]), 7)
    assert len(forecast) == 7
    assert forecast[0]["date"] == "2026-09-04"
    assert all(item["predictedDemand"] >= 0 for item in forecast)


def test_zero_demand_is_supported():
    forecast = forecast_daily_demand(sales_from(date(2026, 9, 1), [0, 0, 0]), 2)
    assert [item["predictedDemand"] for item in forecast] == [0.0, 0.0]