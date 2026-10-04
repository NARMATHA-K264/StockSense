# StockSense ML Service

## Purpose

This folder contains the independent Python AI/ML foundation for StockSense. Stage 8 validates prepared sales, inventory, and product data and performs basic data processing for later stages.

## Current Stage

**Stage 8 - Python AI Foundation**

Stage 9 adds demand forecasting with a lightweight weighted moving-average baseline. Stage 10 adds deterministic inventory risk and replenishment recommendations. Maps and deployment are not implemented.

## Setup on Windows

```powershell
cd C:\StockSense\ml
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```powershell
cd C:\StockSense\ml
venv\Scripts\activate
uvicorn app:app --reload --port 8000
```

The service runs at `http://127.0.0.1:8000`.

## Endpoints

### `GET /health`

Returns the service status.

### `POST /data/validate`

Accepts `sales`, `inventory`, and `products` arrays using the existing StockSense model fields. It returns calculated record counts, sales totals, average values, inventory totals, low-stock/in-stock counts, and category counts.

## Tests

```powershell
cd C:\StockSense\ml
venv\Scripts\activate
pytest
```

The tests cover health, valid data, empty data, invalid data, and the `quantity <= reorderLevel` low-stock rule. No production or mock business data is stored by the service.

### `POST /forecast`

Accepts a selected product/store pair, a forecast horizon from 1 to 30 days, and the matching historical sales records:

```json
{
	"productId": "product-id",
	"storeId": "store-id",
	"forecastDays": 7,
	"sales": [
		{ "unitsSold": 3, "saleDate": "2026-09-24T10:00:00Z" }
	]
}
```

The service aggregates duplicate sales by day, fills missing days with zero demand, and applies a weighted moving average over the most recent seven daily observations. It returns the historical daily series, exactly the requested number of future predictions, and the method name `weighted_moving_average`. Predictions are finite and never negative.

An empty sales array returns a controlled `400` response because the service does not fabricate historical demand. Small histories are supported by using all available observations within the moving-average window.

The Node backend calls this service through `ML_SERVICE_URL`, defaulting locally to `http://127.0.0.1:8000` when the variable is not set.

### `POST /risk/replenishment`

Accepts inventory items with current quantity, reorder level, and matching historical sales. The service reuses the forecast baseline for each item and returns risk status, forecast demand, safety stock, target stock, days of cover, and a non-negative recommendation.

The default planning horizon is 7 days and accepts values from 1 to 30. Safety stock uses a transparent two-day buffer:

```text
averageDailyForecastDemand = forecastDemand / planningHorizonDays
safetyStock = ceil(averageDailyForecastDemand * 2)
targetStock = ceil(forecastDemand + safetyStock)
recommendedReplenishment = max(0, targetStock - currentQuantity)
```

Statuses are deterministic: `OUT_OF_STOCK` for zero quantity, `CRITICAL` when stock is below forecast demand, `LOW` when stock is at or below reorder level, `ADEQUATE` otherwise, and `INSUFFICIENT_DATA` when no sales history exists. Recommendations are informational only; no order is placed.
