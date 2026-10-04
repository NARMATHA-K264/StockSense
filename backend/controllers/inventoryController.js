const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const HistoricalInventory = require("../models/HistoricalInventory");
const Product = require("../models/Product");
const Store = require("../models/Store");

const inventoryPopulate = [
  { path: "product", select: "name sku category price" },
  { path: "store", select: "name location" },
];

const addStatus = (inventory) => {
  const result = inventory.toObject ? inventory.toObject() : inventory;
  result.status =
    result.quantity <= 0
      ? "Out of Stock"
      : result.quantity <= result.reorderLevel
        ? "Low Stock"
        : "In Stock";
  return result;
};

const addStatuses = (inventories) => inventories.map(addStatus);

const isValidId = (id) => mongoose.isValidObjectId(id);

const getInventory = async (req, res) => {
  try {
    const storeId = req.query.storeId;
    if (storeId && storeId !== "all" && !isValidId(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store ID" });
    }
    if (storeId && storeId !== "all" && !await Store.exists({ _id: storeId })) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    const operationalFilter =
      storeId && storeId !== "all" ? { store: storeId } : {};
    const [operationalInventory, historicalInventory] = await Promise.all([
      Inventory.find(operationalFilter)
        .populate(inventoryPopulate)
        .sort({ lastUpdated: -1 })
        .lean(),
      HistoricalInventory.aggregate([
        {
          $match: {
            endDate: null,
            ...(storeId && storeId !== "all"
              ? { store: new mongoose.Types.ObjectId(storeId) }
              : {}),
          },
        },
        { $sort: { startDate: -1, _id: -1 } },
        {
          $group: {
            _id: { product: "$product", store: "$store" },
            snapshot: { $first: "$$ROOT" },
          },
        },
        { $replaceRoot: { newRoot: "$snapshot" } },
        {
          $lookup: {
            from: Inventory.collection.name,
            let: { productId: "$product", storeId: "$store" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$product", "$$productId"] },
                      { $eq: ["$store", "$$storeId"] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "operationalOverride",
          },
        },
        { $match: { "operationalOverride.0": { $exists: false } } },
        {
          $lookup: {
            from: Product.collection.name,
            localField: "product",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: Store.collection.name,
            localField: "store",
            foreignField: "_id",
            as: "store",
          },
        },
        { $unwind: "$store" },
        {
          $project: {
            _id: 1,
            product: { _id: "$product._id", name: "$product.name", sku: "$product.sku", category: "$product.category", price: "$product.price" },
            store: { _id: "$store._id", name: "$store.name", location: "$store.location" },
            quantity: "$quantityOnHand",
            reorderLevel: { $ifNull: ["$product.reorderLevel", 10] },
            lastUpdated: "$startDate",
            source: { $literal: "historical" },
          },
        },
      ]).allowDiskUse(true),
    ]);
    const inventory = [
      ...operationalInventory.map((item) => ({ ...item, source: "operational" })),
      ...historicalInventory,
    ];
    return res.status(200).json({ success: true, count: inventory.length, inventory: addStatuses(inventory) });
  } catch (error) {
    console.error("Get inventory error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve inventory" });
  }
};

const setCurrentInventory = async (req, res) => {
  try {
    const { productId, storeId } = req.params;
    const { quantity, reorderLevel } = req.body;
    if (!isValidId(productId) || !isValidId(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid product or store ID" });
    }
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ success: false, message: "Quantity cannot be negative" });
    }
    if (typeof reorderLevel !== "number" || !Number.isFinite(reorderLevel) || reorderLevel < 0) {
      return res.status(400).json({ success: false, message: "Reorder level cannot be negative" });
    }

    const [productExists, storeExists] = await Promise.all([
      Product.exists({ _id: productId }),
      Store.exists({ _id: storeId }),
    ]);
    if (!productExists) return res.status(404).json({ success: false, message: "Product not found" });
    if (!storeExists) return res.status(404).json({ success: false, message: "Store not found" });

    const currentSnapshot = await HistoricalInventory.findOne({
      product: productId,
      store: storeId,
      endDate: null,
    })
      .sort({ startDate: -1, _id: -1 })
      .select("_id")
      .lean();
    if (!currentSnapshot) {
      return res.status(404).json({ success: false, message: "Current inventory not found for this product and store" });
    }

    const inventory = await Inventory.findOneAndUpdate(
      { product: productId, store: storeId },
      { $set: { quantity, reorderLevel, lastUpdated: new Date() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).populate(inventoryPopulate);
    return res.status(200).json({ success: true, message: "Inventory updated successfully", inventory: addStatus(inventory) });
  } catch (error) {
    console.error("Set current inventory error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update inventory" });
  }
};

const zeroCurrentInventory = async (req, res) => {
  req.body = { quantity: 0, reorderLevel: Number(req.body.reorderLevel) };
  return setCurrentInventory(req, res);
};

const getInventoryById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid inventory ID" });
    const inventory = await Inventory.findById(req.params.id).populate(inventoryPopulate);
    if (!inventory) return res.status(404).json({ success: false, message: "Inventory not found" });
    return res.status(200).json({ success: true, inventory: addStatus(inventory) });
  } catch (error) {
    console.error("Get inventory by ID error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve inventory" });
  }
};

const getInventoryByProduct = async (req, res) => {
  try {
    if (!isValidId(req.params.productId)) return res.status(400).json({ success: false, message: "Invalid product ID" });
    if (!await Product.exists({ _id: req.params.productId })) return res.status(404).json({ success: false, message: "Product not found" });
    const inventory = await Inventory.find({ product: req.params.productId }).populate(inventoryPopulate).sort({ lastUpdated: -1 });
    return res.status(200).json({ success: true, count: inventory.length, inventory: addStatuses(inventory) });
  } catch (error) {
    console.error("Get inventory by product error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve inventory" });
  }
};

const getInventoryByStore = async (req, res) => {
  try {
    if (!isValidId(req.params.storeId)) return res.status(400).json({ success: false, message: "Invalid store ID" });
    if (!await Store.exists({ _id: req.params.storeId })) return res.status(404).json({ success: false, message: "Store not found" });
    const inventory = await Inventory.find({ store: req.params.storeId }).populate(inventoryPopulate).sort({ lastUpdated: -1 });
    return res.status(200).json({ success: true, count: inventory.length, inventory: addStatuses(inventory) });
  } catch (error) {
    console.error("Get inventory by store error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve inventory" });
  }
};

const createInventory = async (req, res) => {
  try {
    const { product, store, quantity, reorderLevel } = req.body;
    if (!product || !store || quantity === undefined) return res.status(400).json({ success: false, message: "Product, store, and quantity are required" });
    if (!isValidId(product) || !isValidId(store)) return res.status(400).json({ success: false, message: "Invalid product or store ID" });
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ success: false, message: "Quantity cannot be negative" });
    if (reorderLevel !== undefined && (typeof reorderLevel !== "number" || !Number.isFinite(reorderLevel) || reorderLevel < 0)) return res.status(400).json({ success: false, message: "Reorder level cannot be negative" });
    const [productExists, storeExists] = await Promise.all([Product.exists({ _id: product }), Store.exists({ _id: store })]);
    if (!productExists) return res.status(404).json({ success: false, message: "Product not found" });
    if (!storeExists) return res.status(404).json({ success: false, message: "Store not found" });
    if (await Inventory.exists({ product, store })) return res.status(409).json({ success: false, message: "Inventory already exists for this product and store" });
    const created = await Inventory.create({ product, store, quantity, ...(reorderLevel !== undefined ? { reorderLevel } : {}) });
    const inventory = await Inventory.findById(created._id).populate(inventoryPopulate);
    return res.status(201).json({ success: true, message: "Inventory created successfully", inventory: addStatus(inventory) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Inventory already exists for this product and store" });
    console.error("Create inventory error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create inventory" });
  }
};

const updateInventory = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid inventory ID" });
    const updates = {};
    for (const field of ["quantity", "reorderLevel"]) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "number" || !Number.isFinite(req.body[field]) || req.body[field] < 0) return res.status(400).json({ success: false, message: `${field} cannot be negative` });
        updates[field] = req.body[field];
      }
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "Quantity or reorder level is required" });
    updates.lastUpdated = new Date();
    const inventory = await Inventory.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate(inventoryPopulate);
    if (!inventory) return res.status(404).json({ success: false, message: "Inventory not found" });
    return res.status(200).json({ success: true, message: "Inventory updated successfully", inventory: addStatus(inventory) });
  } catch (error) {
    console.error("Update inventory error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update inventory" });
  }
};

const deleteInventory = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid inventory ID" });
    const inventory = await Inventory.findByIdAndDelete(req.params.id);
    if (!inventory) return res.status(404).json({ success: false, message: "Inventory not found" });
    return res.status(200).json({ success: true, message: "Inventory deleted successfully" });
  } catch (error) {
    console.error("Delete inventory error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to delete inventory" });
  }
};

const getLowStockInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find({ $expr: { $lte: ["$quantity", "$reorderLevel"] } }).populate(inventoryPopulate).sort({ quantity: 1 });
    return res.status(200).json({ success: true, count: inventory.length, inventory: addStatuses(inventory) });
  } catch (error) {
    console.error("Get low stock error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve low-stock inventory" });
  }
};

module.exports = { getInventory, getInventoryById, getInventoryByProduct, getInventoryByStore, createInventory, updateInventory, deleteInventory, getLowStockInventory, setCurrentInventory, zeroCurrentInventory };