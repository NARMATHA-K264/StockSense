const mongoose = require("mongoose");
const Product = require("../models/Product");
const Store = require("../models/Store");
const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");
const HistoricalSale = require("../models/HistoricalSale");
const HistoricalInventory = require("../models/HistoricalInventory");

const parseDateRange = (query) => {
  const range = {};
  if (query.from) {
    const from = new Date(`${query.from}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime())) return { error: "Invalid from date" };
    range.$gte = from;
  }
  if (query.to) {
    const to = new Date(`${query.to}T23:59:59.999Z`);
    if (Number.isNaN(to.getTime())) return { error: "Invalid to date" };
    range.$lte = to;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) return { error: "From date must be before to date" };
  return Object.keys(range).length ? { saleDate: range } : {};
};

const salesMatch = (query) => {
  const result = parseDateRange(query);
  return result.error ? result : { match: Object.keys(result).length ? result : {} };
};

const totals = (rows) => {
  const totalSales = rows[0]?.totalSales || 0;
  const totalUnitsSold = rows[0]?.totalUnitsSold || 0;
  const totalRevenue = rows[0]?.totalRevenue || 0;
  return { totalSales, totalUnitsSold, totalRevenue, averageSaleValue: totalSales ? totalRevenue / totalSales : 0 };
};

const getSummary = async (req, res) => {
  try {
    const result = salesMatch(req.query);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const [totalProducts, totalStores, totalInventoryRecords, inventoryTotals, salesTotals] = await Promise.all([
      Product.countDocuments(), Store.countDocuments(), Inventory.countDocuments(),
      Inventory.aggregate([{ $group: { _id: null, totalInventoryUnits: { $sum: "$quantity" }, lowStockItems: { $sum: { $cond: [{ $lte: ["$quantity", "$reorderLevel"] }, 1, 0] } } } }]),
      Sale.aggregate([{ $match: result.match }, { $group: { _id: null, totalSales: { $sum: 1 }, totalUnitsSold: { $sum: "$unitsSold" }, totalRevenue: { $sum: "$totalAmount" } } }]),
    ]);
    return res.json({ success: true, summary: { totalProducts, totalStores, totalInventoryRecords, totalInventoryUnits: inventoryTotals[0]?.totalInventoryUnits || 0, lowStockItems: inventoryTotals[0]?.lowStockItems || 0, ...totals(salesTotals) } });
  } catch (error) { console.error("Analytics summary error:", error.message); return res.status(500).json({ success: false, message: "Unable to retrieve analytics summary" }); }
};

const getSalesAnalytics = async (req, res) => {
  try {
    const result = salesMatch(req.query);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const [summaryRows, byDate] = await Promise.all([
      Sale.aggregate([{ $match: result.match }, { $group: { _id: null, totalSales: { $sum: 1 }, totalUnitsSold: { $sum: "$unitsSold" }, totalRevenue: { $sum: "$totalAmount" } } }]),
      Sale.aggregate([{ $match: result.match }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } }, sales: { $sum: 1 }, unitsSold: { $sum: "$unitsSold" }, revenue: { $sum: "$totalAmount" } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, date: "$_id", sales: 1, unitsSold: 1, revenue: 1 } }]),
    ]);
    return res.json({ success: true, ...totals(summaryRows), salesByDate: byDate });
  } catch (error) { console.error("Sales analytics error:", error.message); return res.status(500).json({ success: false, message: "Unable to retrieve sales analytics" }); }
};

const getProductAnalytics = async (req, res) => {
  try {
    const result = salesMatch(req.query);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const products = await Product.aggregate([
      { $lookup: { from: "sales", let: { productId: "$_id" }, pipeline: [{ $match: { $expr: { $eq: ["$product", "$$productId"] }, ...result.match } }, { $group: { _id: null, unitsSold: { $sum: "$unitsSold" }, revenue: { $sum: "$totalAmount" } } }], as: "sales" } },
      { $lookup: { from: "inventories", localField: "_id", foreignField: "product", as: "inventory" } },
      { $project: { _id: 1, name: 1, sku: 1, category: 1, unitsSold: { $ifNull: [{ $arrayElemAt: ["$sales.unitsSold", 0] }, 0] }, revenue: { $ifNull: [{ $arrayElemAt: ["$sales.revenue", 0] }, 0] }, currentInventory: { $ifNull: [{ $sum: "$inventory.quantity" }, 0] } } },
      { $sort: { revenue: -1, name: 1 } },
    ]);
    return res.json({ success: true, products });
  } catch (error) { console.error("Product analytics error:", error.message); return res.status(500).json({ success: false, message: "Unable to retrieve product analytics" }); }
};

const getStoreAnalytics = async (req, res) => {
  try {
    const result = salesMatch(req.query);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const stores = await Store.aggregate([
      { $lookup: { from: "sales", let: { storeId: "$_id" }, pipeline: [{ $match: { $expr: { $eq: ["$store", "$$storeId"] }, ...result.match } }, { $group: { _id: null, salesCount: { $sum: 1 }, unitsSold: { $sum: "$unitsSold" }, revenue: { $sum: "$totalAmount" } } }], as: "sales" } },
      { $project: { _id: 1, name: 1, location: 1, salesCount: { $ifNull: [{ $arrayElemAt: ["$sales.salesCount", 0] }, 0] }, unitsSold: { $ifNull: [{ $arrayElemAt: ["$sales.unitsSold", 0] }, 0] }, revenue: { $ifNull: [{ $arrayElemAt: ["$sales.revenue", 0] }, 0] } } },
      { $sort: { revenue: -1, name: 1 } },
    ]);
    return res.json({ success: true, stores });
  } catch (error) { console.error("Store analytics error:", error.message); return res.status(500).json({ success: false, message: "Unable to retrieve store analytics" }); }
};

const getInventoryAnalytics = async (req, res) => {
  try {
    const [summaryRows, byStore, byCategory] = await Promise.all([
      Inventory.aggregate([{ $group: { _id: null, totalInventoryUnits: { $sum: "$quantity" }, totalInventoryRecords: { $sum: 1 }, lowStockCount: { $sum: { $cond: [{ $lte: ["$quantity", "$reorderLevel"] }, 1, 0] } }, inStockCount: { $sum: { $cond: [{ $gt: ["$quantity", "$reorderLevel"] }, 1, 0] } } } }]),
      Inventory.aggregate([{ $group: { _id: "$store", units: { $sum: "$quantity" }, records: { $sum: 1 }, lowStockCount: { $sum: { $cond: [{ $lte: ["$quantity", "$reorderLevel"] }, 1, 0] } } } }, { $lookup: { from: "stores", localField: "_id", foreignField: "_id", as: "store" } }, { $project: { _id: 0, store: { $arrayElemAt: ["$store.name", 0] }, units: 1, records: 1, lowStockCount: 1 } }, { $sort: { units: -1 } }]),
      Inventory.aggregate([{ $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } }, { $unwind: "$product" }, { $group: { _id: "$product.category", units: { $sum: "$quantity" }, records: { $sum: 1 }, lowStockCount: { $sum: { $cond: [{ $lte: ["$quantity", "$reorderLevel"] }, 1, 0] } } } }, { $project: { _id: 0, category: "$_id", units: 1, records: 1, lowStockCount: 1 } }, { $sort: { units: -1 } }]),
    ]);
    return res.json({ success: true, ...summaryRows[0] ? summaryRows[0] : { totalInventoryUnits: 0, totalInventoryRecords: 0, lowStockCount: 0, inStockCount: 0 }, inventoryByStore: byStore, inventoryByCategory: byCategory });
  } catch (error) { console.error("Inventory analytics error:", error.message); return res.status(500).json({ success: false, message: "Unable to retrieve inventory analytics" }); }
};
const getHistoricalSalesAnalytics = async (req, res) => {
  try {
    const match = {};

    if (req.query.from || req.query.to) {
      match.transactionDate = {};

      if (req.query.from) {
        const from = new Date(`${req.query.from}T00:00:00.000Z`);

        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid from date",
          });
        }

        match.transactionDate.$gte = from;
      }

      if (req.query.to) {
        const to = new Date(`${req.query.to}T23:59:59.999Z`);

        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid to date",
          });
        }

        match.transactionDate.$lte = to;
      }

      if (
        match.transactionDate.$gte &&
        match.transactionDate.$lte &&
        match.transactionDate.$gte > match.transactionDate.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "From date must be before to date",
        });
      }
    }

    const [summaryRows, salesByDate] = await Promise.all([
      HistoricalSale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalUnitsSold: { $sum: "$quantitySold" },
            totalRevenue: { $sum: "$salesAmount" },
            returnCount: {
              $sum: { $cond: ["$isReturn", 1, 0] },
            },
            returnedUnits: {
              $sum: {
                $cond: [
                  "$isReturn",
                  { $abs: "$quantitySold" },
                  0,
                ],
              },
            },
            returnAmount: {
              $sum: {
                $cond: [
                  "$isReturn",
                  { $abs: "$salesAmount" },
                  0,
                ],
              },
            },
          },
        },
      ]),
      HistoricalSale.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$transactionDate",
              },
            },
            sales: { $sum: 1 },
            unitsSold: { $sum: "$quantitySold" },
            revenue: { $sum: "$salesAmount" },
            returns: {
              $sum: { $cond: ["$isReturn", 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            sales: 1,
            unitsSold: 1,
            revenue: 1,
            returns: 1,
          },
        },
      ]),
    ]);

    const summary = summaryRows[0] || {
      totalSales: 0,
      totalUnitsSold: 0,
      totalRevenue: 0,
      returnCount: 0,
      returnedUnits: 0,
      returnAmount: 0,
    };

    return res.json({
      success: true,
      ...summary,
      averageSaleValue:
        summary.totalSales > 0
          ? summary.totalRevenue / summary.totalSales
          : 0,
      salesByDate,
    });
  } catch (error) {
    console.error("Historical sales analytics error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve historical sales analytics",
    });
  }
};

const getHistoricalInventoryAnalytics = async (req, res) => {
  try {
    const match = {};

    if (req.query.from || req.query.to) {
      match.startDate = {};

      if (req.query.from) {
        const from = new Date(`${req.query.from}T00:00:00.000Z`);
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid from date" });
        }
        match.startDate.$gte = from;
      }

      if (req.query.to) {
        const to = new Date(`${req.query.to}T23:59:59.999Z`);
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid to date" });
        }
        match.startDate.$lte = to;
      }

      if (match.startDate.$gte && match.startDate.$lte && match.startDate.$gte > match.startDate.$lte) {
        return res.status(400).json({ success: false, message: "From date must be before to date" });
      }
    }

    const [summaryRows, byStatus, byStore, byCategory, trend] = await Promise.all([
      HistoricalInventory.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalInventoryRecords: { $sum: 1 },
            totalInventoryUnits: { $sum: "$quantityOnHand" },
            negativeInventoryRecords: {
              $sum: { $cond: [{ $lt: ["$quantityOnHand", 0] }, 1, 0] },
            },
            negativeInventoryUnits: {
              $sum: {
                $cond: [
                  { $lt: ["$quantityOnHand", 0] },
                  { $abs: "$quantityOnHand" },
                  0,
                ],
              },
            },
          },
        },
      ]),
      HistoricalInventory.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: ["$stockStatus", "Unspecified"] },
            units: { $sum: "$quantityOnHand" },
            records: { $sum: 1 },
          },
        },
        { $project: { _id: 0, stockStatus: "$_id", units: 1, records: 1 } },
        { $sort: { records: -1, stockStatus: 1 } },
      ]),
      HistoricalInventory.aggregate([
        { $match: match },
        { $lookup: { from: "stores", localField: "store", foreignField: "_id", as: "store" } },
        { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$store._id",
            store: { $first: { $ifNull: ["$store.name", "Unknown store"] } },
            units: { $sum: "$quantityOnHand" },
            records: { $sum: 1 },
          },
        },
        { $project: { _id: 0, store: 1, units: 1, records: 1 } },
        { $sort: { units: -1, store: 1 } },
      ]),
      HistoricalInventory.aggregate([
        { $match: match },
        { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$product.category", "Uncategorized"] },
            units: { $sum: "$quantityOnHand" },
            records: { $sum: 1 },
          },
        },
        { $project: { _id: 0, category: "$_id", units: 1, records: 1 } },
        { $sort: { units: -1, category: 1 } },
      ]),
      HistoricalInventory.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$startDate",
              },
            },
            units: { $sum: "$quantityOnHand" },
            records: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", units: 1, records: 1 } },
      ]),
    ]);

    return res.json({
      success: true,
      ...(summaryRows[0] || {
        totalInventoryRecords: 0,
        totalInventoryUnits: 0,
        negativeInventoryRecords: 0,
        negativeInventoryUnits: 0,
      }),
      inventoryByStockStatus: byStatus,
      inventoryByStore: byStore,
      inventoryByCategory: byCategory,
      inventoryTrend: trend,
    });
  } catch (error) {
    console.error("Historical inventory analytics error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve historical inventory analytics",
    });
  }
};

module.exports = { getSummary, getSalesAnalytics, getProductAnalytics, getStoreAnalytics, getInventoryAnalytics, getHistoricalSalesAnalytics, getHistoricalInventoryAnalytics };