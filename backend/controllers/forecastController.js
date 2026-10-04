const mongoose = require("mongoose");
const Product = require("../models/Product");
const Store = require("../models/Store");
const Sale = require("../models/Sale");
const HistoricalSale = require("../models/HistoricalSale");

const mlServiceUrl = () => (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const getProductsWithSalesForStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    if (!mongoose.isValidObjectId(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store ID" });
    }
    if (!await Store.exists({ _id: storeId })) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    const storeObjectId = new mongoose.Types.ObjectId(storeId);
    const [historicalProductIds, operationalProductIds] = await Promise.all([
      HistoricalSale.distinct("product", { store: storeObjectId }),
      Sale.distinct("product", { store: storeObjectId }),
    ]);
    const productIds = [...new Set(
      [...historicalProductIds, ...operationalProductIds].map(String)
    )];
    const products = await Product.find({ _id: { $in: productIds } })
      .select("name sku")
      .sort({ name: 1, sku: 1 })
      .lean();

    return res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    console.error("Get forecast products error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve products with sales history" });
  }
};

const createForecast = async (req, res) => {
  try {
    const { productId, storeId, forecastDays } = req.body;
    if (!productId || !storeId || forecastDays === undefined) {
      return res.status(400).json({ success: false, message: "Product, store, and forecast days are required" });
    }
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid product or store ID" });
    }
    if (!Number.isInteger(forecastDays) || forecastDays < 1 || forecastDays > 30) {
      return res.status(400).json({ success: false, message: "Forecast days must be an integer from 1 to 30" });
    }

    const [product, store] = await Promise.all([Product.findById(productId).select("name sku"), Store.findById(storeId).select("name location")]);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });

    const now = new Date();
    const historicalMatch = {
      product: new mongoose.Types.ObjectId(productId),
      store: new mongoose.Types.ObjectId(storeId),
      transactionDate: { $lte: now },
    };
    const operationalMatch = {
      product: new mongoose.Types.ObjectId(productId),
      store: new mongoose.Types.ObjectId(storeId),
      saleDate: { $lte: now },
    };
    const [historicalSales, operationalSales] = await Promise.all([
      HistoricalSale.aggregate([
        { $match: historicalMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$transactionDate",
                timezone: "UTC",
              },
            },
            unitsSold: { $sum: "$quantitySold" },
          },
        },
        { $project: { _id: 0, saleDate: "$_id", unitsSold: 1 } },
      ]),
      Sale.aggregate([
        { $match: operationalMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$saleDate",
                timezone: "UTC",
              },
            },
            unitsSold: { $sum: "$unitsSold" },
          },
        },
        { $project: { _id: 0, saleDate: "$_id", unitsSold: 1 } },
      ]),
    ]);
    const dailySales = new Map();
    for (const sale of [...historicalSales, ...operationalSales]) {
      dailySales.set(
        sale.saleDate,
        (dailySales.get(sale.saleDate) || 0) + sale.unitsSold
      );
    }
    const sales = [...dailySales]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([saleDate, unitsSold]) => ({ saleDate, unitsSold }));
    const dataSource = [
      historicalSales.length && "HistoricalSale",
      operationalSales.length && "Sale",
    ].filter(Boolean).join("+");

    if (!sales.length) {
      return res.status(400).json({
        success: false,
        message: "Not enough historical sales data to generate a forecast",
      });
    }

    const mlResponse = await fetch(`${mlServiceUrl()}/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        storeId,
        forecastDays,
        sales: sales.map((sale) => ({
          unitsSold: sale.unitsSold,
          saleDate:
            typeof sale.saleDate === "string"
              ? `${sale.saleDate}T00:00:00.000Z`
              : sale.saleDate,
        })),
      }),
    });
    let mlPayload = {};
    try { mlPayload = await mlResponse.json(); } catch { mlPayload = {}; }
    if (!mlResponse.ok) {
      return res.status(mlResponse.status >= 500 ? 502 : mlResponse.status).json({ success: false, message: mlPayload.detail || "Forecast service could not generate a forecast" });
    }

    return res.status(200).json({ success: true, product, store, dataSource, ...mlPayload });
  } catch (error) {
    if (error.name === "FetchError" || error.cause?.code === "ECONNREFUSED") {
      return res.status(502).json({ success: false, message: "Forecast service is currently unavailable" });
    }
    console.error("Forecast error:", error.message);
    return res.status(502).json({ success: false, message: "Forecast service is currently unavailable" });
  }
};

module.exports = { createForecast, getProductsWithSalesForStore };