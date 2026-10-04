const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");

const mlServiceUrl = () => (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const getReplenishment = async (req, res) => {
  try {
    const planningHorizonDays = req.query.planningHorizonDays === undefined ? 7 : Number(req.query.planningHorizonDays);
    if (!Number.isInteger(planningHorizonDays) || planningHorizonDays < 1 || planningHorizonDays > 30) {
      return res.status(400).json({ success: false, message: "Planning horizon must be an integer from 1 to 30" });
    }

    const filter = {};
    for (const field of ["productId", "storeId"]) {
      if (req.query[field]) {
        if (!mongoose.isValidObjectId(req.query[field])) return res.status(400).json({ success: false, message: `Invalid ${field}` });
        filter[field === "productId" ? "product" : "store"] = req.query[field];
      }
    }

    const inventory = await Inventory.find(filter).populate("product", "name sku category").populate("store", "name location").lean();
    if (!inventory.length) return res.status(200).json({ success: true, planningHorizonDays, summary: { totalItems: 0, out_of_stock: 0, critical: 0, low: 0, adequate: 0, insufficient_data: 0 }, items: [] });

    const pairs = inventory.map((entry) => ({ product: entry.product._id, store: entry.store._id }));
    const sales = await Sale.find({ $or: pairs }).select("product store unitsSold saleDate -_id").sort({ saleDate: 1 }).lean();
    const salesByPair = new Map();
    for (const sale of sales) {
      const key = `${sale.product}:${sale.store}`;
      if (!salesByPair.has(key)) salesByPair.set(key, []);
      salesByPair.get(key).push({ unitsSold: sale.unitsSold, saleDate: sale.saleDate });
    }

    const payload = {
      planningHorizonDays,
      items: inventory.map((entry) => ({
        productId: String(entry.product._id),
        storeId: String(entry.store._id),
        currentQuantity: entry.quantity,
        reorderLevel: entry.reorderLevel,
        sales: salesByPair.get(`${entry.product._id}:${entry.store._id}`) || [],
      })),
    };
    const mlResponse = await fetch(`${mlServiceUrl()}/risk/replenishment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    let mlPayload = {};
    try { mlPayload = await mlResponse.json(); } catch { mlPayload = {}; }
    if (!mlResponse.ok) return res.status(mlResponse.status >= 500 ? 502 : mlResponse.status).json({ success: false, message: mlPayload.detail || "Risk service could not analyze inventory" });

    const details = new Map(inventory.map((entry) => [`${entry.product._id}:${entry.store._id}`, { productName: entry.product.name, sku: entry.product.sku, category: entry.product.category, storeName: entry.store.name, location: entry.store.location }]));
    const items = (mlPayload.items || []).map((item) => ({ ...details.get(`${item.productId}:${item.storeId}`), ...item }));
    return res.status(200).json({ success: true, planningHorizonDays, safetyDays: mlPayload.safetyDays, summary: mlPayload.summary, items });
  } catch (error) {
    if (error.name === "FetchError" || error.cause?.code === "ECONNREFUSED") return res.status(502).json({ success: false, message: "Risk service is currently unavailable" });
    console.error("Replenishment error:", error.message);
    return res.status(502).json({ success: false, message: "Risk service is currently unavailable" });
  }
};

module.exports = { getReplenishment };