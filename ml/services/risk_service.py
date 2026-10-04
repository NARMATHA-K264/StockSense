from __future__ import annotations

from math import ceil, isfinite
from typing import Any

from services.forecasting_service import forecast_daily_demand

SAFETY_DAYS = 2


def analyze_item(item: Any, planning_days: int) -> dict[str, Any]:
    current_quantity = item.currentQuantity
    reorder_level = item.reorderLevel
    sales = item.sales

    if current_quantity <= 0:
        return {
            "productId": item.productId,
            "storeId": item.storeId,
            "currentQuantity": current_quantity,
            "reorderLevel": reorder_level,
            "forecastDemand": None if not sales else 0,
            "averageDailyForecastDemand": None if not sales else 0,
            "safetyStock": None if not sales else 0,
            "targetStock": None if not sales else 0,
            "recommendedReplenishment": 0,
            "daysOfCover": 0,
            "status": "OUT_OF_STOCK",
        }

    if not sales:
        return {
            "productId": item.productId,
            "storeId": item.storeId,
            "currentQuantity": current_quantity,
            "reorderLevel": reorder_level,
            "forecastDemand": None,
            "averageDailyForecastDemand": None,
            "safetyStock": None,
            "targetStock": None,
            "recommendedReplenishment": 0,
            "daysOfCover": None,
            "status": "INSUFFICIENT_DATA",
        }

    forecast = forecast_daily_demand(sales, planning_days)
    forecast_demand = round(sum(float(day["predictedDemand"]) for day in forecast), 2)
    average_daily_demand = forecast_demand / planning_days
    safety_stock = int(ceil(average_daily_demand * SAFETY_DAYS))
    target_stock = int(ceil(forecast_demand + safety_stock))
    recommended = max(0, target_stock - current_quantity)
    days_of_cover = None if average_daily_demand == 0 else round(current_quantity / average_daily_demand, 2)

    if current_quantity < forecast_demand:
        status = "CRITICAL"
    elif current_quantity <= reorder_level:
        status = "LOW"
    else:
        status = "ADEQUATE"

    return {
        "productId": item.productId,
        "storeId": item.storeId,
        "currentQuantity": current_quantity,
        "reorderLevel": reorder_level,
        "forecastDemand": forecast_demand,
        "averageDailyForecastDemand": round(average_daily_demand, 2),
        "safetyStock": safety_stock,
        "targetStock": target_stock,
        "recommendedReplenishment": recommended,
        "daysOfCover": days_of_cover,
        "status": status,
    }


def analyze_replenishment(items: list[Any], planning_days: int) -> list[dict[str, Any]]:
    return [analyze_item(item, planning_days) for item in items]