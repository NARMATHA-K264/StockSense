from __future__ import annotations

from datetime import date, timedelta
from math import isfinite
from typing import Any, Sequence

import numpy as np
import pandas as pd


def prepare_daily_demand(sales: Sequence[Any]) -> pd.Series:
    records = [sale.model_dump() if hasattr(sale, "model_dump") else sale for sale in sales]
    if not records:
        return pd.Series(dtype=float, name="unitsSold")

    frame = pd.DataFrame(records)
    dates = pd.to_datetime(frame["saleDate"], errors="coerce", utc=True)
    if dates.isna().any():
        raise ValueError("All sale dates must be valid")
    frame["date"] = dates.dt.date
    frame["unitsSold"] = pd.to_numeric(frame["unitsSold"], errors="raise")
    daily = frame.groupby("date", as_index=True)["unitsSold"].sum().sort_index()
    date_index = pd.date_range(start=min(daily.index), end=max(daily.index), freq="D").date
    return daily.reindex(date_index, fill_value=0).astype(float).rename("unitsSold")


def forecast_daily_demand(sales: Sequence[Any], forecast_days: int) -> list[dict[str, int | float]]:
    daily = prepare_daily_demand(sales)
    if daily.empty:
        raise ValueError("Not enough historical sales data to generate a forecast")

    window = min(7, len(daily))
    recent = daily.iloc[-window:].to_numpy(dtype=float)
    weights = np.arange(1, window + 1, dtype=float)
    weighted_average = float(np.average(recent, weights=weights))
    prediction = max(0.0, weighted_average)
    last_date = date.fromisoformat(str(daily.index[-1]))
    forecast = []
    for offset in range(1, forecast_days + 1):
        value = round(prediction, 2)
        if not isfinite(value) or value < 0:
            value = 0.0
        forecast.append({"date": (last_date + timedelta(days=offset)).isoformat(), "predictedDemand": value})
    return forecast


def historical_daily_demand(sales: Sequence[Any]) -> list[dict[str, int | float]]:
    daily = prepare_daily_demand(sales)
    return [{"date": date.fromisoformat(str(day)).isoformat(), "demand": int(value)} for day, value in daily.items()]


def historical_records(sales: Sequence[Any]) -> int:
    return len(prepare_daily_demand(sales))