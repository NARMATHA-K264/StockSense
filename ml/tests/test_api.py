from fastapi.testclient import TestClient

from app import app

client = TestClient(app)

VALID_PAYLOAD = {
    "sales": [{"product": "product-id", "store": "store-id", "unitsSold": 3, "unitPrice": 100, "totalAmount": 300, "saleDate": "2026-09-24T10:00:00Z", "soldBy": "user-id"}],
    "inventory": [{"product": "product-id", "store": "store-id", "quantity": 5, "reorderLevel": 5, "lastUpdated": "2026-09-24T10:00:00Z"}],
    "products": [{"name": "Laptop", "sku": "LAP-001", "category": "Computers", "price": 100, "costPrice": 70, "reorderLevel": 5, "supplier": "Supplier", "description": "Test product"}],
}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "stocksense-ml"}


def test_valid_data_summary():
    response = client.post("/data/validate", json=VALID_PAYLOAD)
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert response.json()["valid"] is True
    assert summary["sales_records"] == 1
    assert summary["total_units_sold"] == 3
    assert summary["total_revenue"] == 300.0
    assert summary["average_sale_value"] == 300.0
    assert summary["low_stock_items"] == 1
    assert summary["category_counts"] == {"Computers": 1}


def test_empty_data():
    response = client.post("/data/validate", json={"sales": [], "inventory": [], "products": []})
    assert response.status_code == 200
    assert response.json()["summary"] == {"sales_records": 0, "total_units_sold": 0, "total_revenue": 0.0, "average_sale_value": 0.0, "average_units_sold_per_sale": 0.0, "inventory_records": 0, "total_inventory_quantity": 0, "low_stock_items": 0, "in_stock_items": 0, "products": 0, "category_counts": {}}


def test_invalid_data_is_rejected():
    response = client.post("/data/validate", json={"sales": [{"product": "p", "store": "s", "unitsSold": "not-a-number"}]})
    assert response.status_code == 422


def test_low_stock_rule():
    response = client.post("/data/validate", json={"inventory": [{"product": "p", "store": "s", "quantity": 9, "reorderLevel": 10}]})
    assert response.status_code == 200
    assert response.json()["summary"]["low_stock_items"] == 1
    assert response.json()["summary"]["in_stock_items"] == 0


def test_valid_forecast():
    response = client.post("/forecast", json={"productId": "p", "storeId": "s", "forecastDays": 7, "sales": [{"unitsSold": 2, "saleDate": "2026-09-01T10:00:00Z"}, {"unitsSold": 4, "saleDate": "2026-09-03T10:00:00Z"}]})
    assert response.status_code == 200
    body = response.json()
    assert body["productId"] == "p"
    assert body["storeId"] == "s"
    assert body["model"] == "weighted_moving_average"
    assert len(body["forecast"]) == 7
    assert body["historical"] == [{"date": "2026-09-01", "demand": 2}, {"date": "2026-09-02", "demand": 0}, {"date": "2026-09-03", "demand": 4}]
    assert all(item["predictedDemand"] >= 0 for item in body["forecast"])


def test_forecast_empty_sales_is_controlled():
    response = client.post("/forecast", json={"productId": "p", "storeId": "s", "forecastDays": 7, "sales": []})
    assert response.status_code == 400


def test_forecast_days_are_limited():
    for days in (0, 31, -1):
        response = client.post("/forecast", json={"productId": "p", "storeId": "s", "forecastDays": days, "sales": []})
        assert response.status_code == 422


def test_forecast_signed_units_preserve_return_impact():
    response = client.post(
        "/forecast",
        json={
            "productId": "p",
            "storeId": "s",
            "forecastDays": 1,
            "sales": [
                {"unitsSold": -2, "saleDate": "2026-09-01"},
                {"unitsSold": 5, "saleDate": "2026-09-02"},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["historical"] == [
        {"date": "2026-09-01", "demand": -2},
        {"date": "2026-09-02", "demand": 5},
    ]
    assert body["forecast"][0]["predictedDemand"] > 0


def test_forecast_return_only_demand_is_clamped_to_zero():
    response = client.post(
        "/forecast",
        json={
            "productId": "p",
            "storeId": "s",
            "forecastDays": 1,
            "sales": [{"unitsSold": -2, "saleDate": "2026-09-01"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["forecast"][0]["predictedDemand"] == 0


def test_forecast_missing_date_is_rejected():
    response = client.post("/forecast", json={"productId": "p", "storeId": "s", "forecastDays": 7, "sales": [{"unitsSold": 1}]})
    assert response.status_code == 422
