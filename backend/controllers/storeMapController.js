const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");
const Store = require("../models/Store");

const mlServiceUrl = () => (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const getStoreMap = async (req, res) => {
  try {
    const [stores, inventory] = await Promise.all([
      Store.find().select("name location latitude longitude manager").populate("manager", "name email role").lean(),
      Inventory.find().select("product store quantity reorderLevel").populate("product", "name sku category").lean(),
    ]);
    const sales = inventory.length ? await Sale.find({ $or: inventory.map((entry) => ({ product: entry.product._id, store: entry.store })) }).select("product store unitsSold saleDate -_id").lean() : [];
    const salesByPair = new Map();
    for (const sale of sales) {
      const key = `${sale.product}:${sale.store}`;
      if (!salesByPair.has(key)) salesByPair.set(key, []);
      salesByPair.get(key).push({ unitsSold: sale.unitsSold, saleDate: sale.saleDate });
    }
    let riskItems = [];
    if (inventory.length) {
      try {
        const riskResponse = await fetch(`${mlServiceUrl()}/risk/replenishment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planningHorizonDays: 7, items: inventory.map((entry) => ({ productId: String(entry.product._id), storeId: String(entry.store), currentQuantity: entry.quantity, reorderLevel: entry.reorderLevel, sales: salesByPair.get(`${entry.product._id}:${entry.store}`) || [] })) }) });
        if (riskResponse.ok) riskItems = (await riskResponse.json()).items || [];
      } catch (error) {
        console.warn("Store map risk summary unavailable:", error.message);
      }
    }
    const riskByPair = new Map(riskItems.map((item) => [`${item.productId}:${item.storeId}`, item]));
    const storeData = stores.map((store) => {
      const storeInventory = inventory.filter((entry) => String(entry.store) === String(store._id));
      const summaries = storeInventory.map((entry) => riskByPair.get(`${entry.product._id}:${entry.store}`)).filter(Boolean);
      return { ...store, inventorySummary: { totalItems: storeInventory.length, totalQuantity: storeInventory.reduce((total, entry) => total + entry.quantity, 0), lowStockItems: summaries.filter((item) => item.status === "LOW").length, outOfStockItems: summaries.filter((item) => item.status === "OUT_OF_STOCK").length, criticalItems: summaries.filter((item) => item.status === "CRITICAL").length } };
    });
    return res.json({ success: true, stores: storeData });
  } catch (error) {
    console.error("Store map error:", error.message);
    return res.status(502).json({ success: false, message: "Unable to load store map information" });
  }
};

module.exports = { getStoreMap };