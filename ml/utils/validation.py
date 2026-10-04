from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SaleData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product: str = Field(min_length=1)
    store: str = Field(min_length=1)
    unitsSold: int = Field(ge=1)
    unitPrice: float = Field(ge=0)
    totalAmount: float = Field(ge=0)
    saleDate: datetime | None = None
    soldBy: str | None = None


class InventoryData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product: str = Field(min_length=1)
    store: str = Field(min_length=1)
    quantity: int = Field(ge=0)
    reorderLevel: int = Field(default=10, ge=0)
    lastUpdated: datetime | None = None


class ProductData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    sku: str = Field(min_length=1)
    category: str = Field(min_length=1)
    price: float = Field(ge=0)
    costPrice: float = Field(ge=0)
    reorderLevel: int = Field(default=10, ge=0)
    supplier: str | None = None
    description: str | None = None


class StockSenseData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sales: list[SaleData] = Field(default_factory=list)
    inventory: list[InventoryData] = Field(default_factory=list)
    products: list[ProductData] = Field(default_factory=list)


class ForecastSale(BaseModel):
    model_config = ConfigDict(extra="forbid")

    unitsSold: int
    saleDate: datetime


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: str = Field(min_length=1)
    storeId: str = Field(min_length=1)
    forecastDays: int = Field(ge=1, le=30)
    sales: list[ForecastSale] = Field(default_factory=list)


class RiskSale(BaseModel):
    model_config = ConfigDict(extra="forbid")

    unitsSold: int = Field(ge=1)
    saleDate: datetime


class RiskItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: str = Field(min_length=1)
    storeId: str = Field(min_length=1)
    currentQuantity: int = Field(ge=0)
    reorderLevel: int = Field(ge=0)
    sales: list[RiskSale] = Field(default_factory=list)


class RiskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    planningHorizonDays: int = Field(default=7, ge=1, le=30)
    items: list[RiskItem] = Field(default_factory=list)
