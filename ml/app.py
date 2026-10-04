from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from services.data_service import summarize_data
from services.forecasting_service import forecast_daily_demand, historical_daily_demand, historical_records
from services.risk_service import SAFETY_DAYS, analyze_replenishment
from utils.validation import ForecastRequest, RiskRequest, StockSenseData

app = FastAPI(title="StockSense ML Service", version="0.1.0")


class ValidationResponse(BaseModel):
    valid: bool
    summary: dict


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "stocksense-ml"}


@app.post("/data/validate", response_model=ValidationResponse)
def validate_data(payload: StockSenseData) -> ValidationResponse:
    return ValidationResponse(valid=True, summary=summarize_data(payload.sales, payload.inventory, payload.products))


@app.post("/forecast")
def forecast(payload: ForecastRequest) -> dict:
    if not payload.sales:
        raise HTTPException(status_code=400, detail="Not enough historical sales data to generate a forecast")
    try:
        predictions = forecast_daily_demand(payload.sales, payload.forecastDays)
        return {"productId": payload.productId, "storeId": payload.storeId, "forecastDays": payload.forecastDays, "historicalRecords": historical_records(payload.sales), "model": "weighted_moving_average", "historical": historical_daily_demand(payload.sales), "forecast": predictions}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/risk/replenishment")
def risk_replenishment(payload: RiskRequest) -> dict:
    try:
        items = analyze_replenishment(payload.items, payload.planningHorizonDays)
        counts = {status: sum(item["status"] == status for item in items) for status in ("OUT_OF_STOCK", "CRITICAL", "LOW", "ADEQUATE", "INSUFFICIENT_DATA")}
        return {"planningHorizonDays": payload.planningHorizonDays, "safetyDays": SAFETY_DAYS, "summary": {"totalItems": len(items), **{key.lower(): value for key, value in counts.items()}}, "items": items}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
