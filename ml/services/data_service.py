from __future__ import annotations

from collections import Counter
from typing import Any, Sequence

import numpy as np
import pandas as pd


def _records(items: Sequence[Any]) -> list[dict[str, Any]]:
    return [item.model_dump() if hasattr(item, "model_dump") else item for item in items]


def summarize_sales(sales: Sequence[Any]) -> dict[str, int | float]:
    frame = pd.DataFrame(_records(sales))
    if frame.empty:
        return {"sales_records": 0, "total_units_sold": 0, "total_revenue": 0.0, "average_sale_value": 0.0, "average_units_sold_per_sale": 0.0}
    units = pd.to_numeric(frame["unitsSold"], errors="raise")
    revenue = pd.to_numeric(frame["totalAmount"], errors="raise")
    return {"sales_records": int(len(frame)), "total_units_sold": int(units.sum()), "total_revenue": float(np.round(revenue.sum(), 2)), "average_sale_value": float(np.round(revenue.mean(), 2)), "average_units_sold_per_sale": float(np.round(units.mean(), 2))}


def summarize_inventory(inventory: Sequence[Any]) -> dict[str, int]:
    frame = pd.DataFrame(_records(inventory))
    if frame.empty:
        return {"inventory_records": 0, "total_inventory_quantity": 0, "low_stock_items": 0, "in_stock_items": 0}
    quantity = pd.to_numeric(frame["quantity"], errors="raise")
    reorder_level = pd.to_numeric(frame["reorderLevel"], errors="raise")
    low_stock = quantity <= reorder_level
    return {"inventory_records": int(len(frame)), "total_inventory_quantity": int(quantity.sum()), "low_stock_items": int(low_stock.sum()), "in_stock_items": int((~low_stock).sum())}


def summarize_products(products: Sequence[Any]) -> dict[str, int | dict[str, int]]:
    frame = pd.DataFrame(_records(products))
    if frame.empty:
        return {"products": 0, "category_counts": {}}
    categories = Counter(frame["category"].dropna().astype(str))
    return {"products": int(len(frame)), "category_counts": dict(sorted(categories.items()))}


def summarize_data(sales: Sequence[Any], inventory: Sequence[Any], products: Sequence[Any]) -> dict[str, int | float | dict[str, int]]:
    return {**summarize_sales(sales), **summarize_inventory(inventory), **summarize_products(products)}
