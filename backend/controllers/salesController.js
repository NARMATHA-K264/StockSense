
const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const Store = require("../models/Store");
const Sale = require("../models/Sale");
const HistoricalInventory = require("../models/HistoricalInventory");

const salePopulate = [
  { path: "product", select: "name sku category price" },
  { path: "store", select: "name location" },
  { path: "soldBy", select: "name email role" },
];

const isValidId = (id) => mongoose.isValidObjectId(id);

const salesFilter = (req, filter = {}) =>
  req.user.role === "cashier" ? { ...filter, soldBy: req.user._id } : filter;

const salesQuery = (req) =>
  Sale.find(salesFilter(req))
    .populate(salePopulate)
    .sort({ saleDate: -1 });

const inventoryWithStatus = (inventory) => {
  const result = inventory.toObject ? inventory.toObject() : inventory;

  result.status =
    result.quantity <= result.reorderLevel
      ? "Low Stock"
      : "In Stock";

  return result;
};

const createSale = async (req, res) => {
  try {
    const { product, store, unitsSold } = req.body;

    if (!product || !store || unitsSold === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product, store, and unitsSold are required",
      });
    }

    if (!isValidId(product) || !isValidId(store)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or store ID",
      });
    }

    if (!Number.isInteger(unitsSold) || unitsSold < 1) {
      return res.status(400).json({
        success: false,
        message: "Units sold must be an integer of at least 1",
      });
    }

    let inventory = await Inventory.findOne({
      product,
      store,
    });

    const [productRecord, storeRecord] = await Promise.all([
      Product.findById(product),
      Store.findById(store).select("_id code").lean(),
    ]);

    if (!productRecord) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!storeRecord) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    if (!inventory) {
      const isDatasetPair =
        productRecord.sku.startsWith("PROD-") &&
        /^STR-\d+$/.test(storeRecord.code || "");

      if (!isDatasetPair) {
        return res.status(404).json({
          success: false,
          message: "Inventory not found for this product and store",
        });
      }

      const currentSnapshot = await HistoricalInventory.findOne({
        product: productRecord._id,
        store: storeRecord._id,
        endDate: null,
      })
        .sort({ startDate: -1, _id: -1 })
        .select("quantityOnHand")
        .lean();

      if (!currentSnapshot) {
        return res.status(404).json({
          success: false,
          message: "Current historical inventory not found for this product and store",
        });
      }

      if (unitsSold > currentSnapshot.quantityOnHand) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock",
        });
      }

      inventory = await Inventory.create({
        product: productRecord._id,
        store: storeRecord._id,
        quantity: currentSnapshot.quantityOnHand,
        reorderLevel: productRecord.reorderLevel,
      });
    }

    if (unitsSold > inventory.quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock",
      });
    }

    const sale = await Sale.create({
      product: productRecord._id,
      store: storeRecord._id,
      unitsSold,
      unitPrice: productRecord.price,
      totalAmount: productRecord.price * unitsSold,
      soldBy: req.user._id,
    });

    inventory.quantity -= unitsSold;
    inventory.lastUpdated = new Date();

    await inventory.save();

    const populatedSale = await Sale.findById(sale._id).populate(salePopulate);

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      sale: populatedSale,
      inventory: inventoryWithStatus(inventory),
    });
  } catch (error) {
    console.error("Create sale error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create sale",
    });
  }
};

const getSales = async (req, res) => {
  try {
    const sales = await salesQuery(req);

    return res.status(200).json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    console.error("Get sales error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve sales",
    });
  }
};

const getSaleById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    const sale = await Sale.findById(req.params.id).populate(salePopulate);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    if (req.user.role === "cashier" && String(sale.soldBy?._id || sale.soldBy) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    return res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    console.error("Get sale error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve sale",
    });
  }
};

const getSalesBy = (field, model, param, label) => async (req, res) => {
  try {
    if (!isValidId(req.params[param])) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${label} ID`,
      });
    }

    if (!await model.exists({ _id: req.params[param] })) {
      return res.status(404).json({
        success: false,
        message: `${label[0].toUpperCase()}${label.slice(1)} not found`,
      });
    }

    const sales = await Sale.find(salesFilter(req, {
      [field]: req.params[param],
    }))
      .populate(salePopulate)
      .sort({ saleDate: -1 });

    return res.status(200).json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    console.error(
      `Get sales by ${label} error:`,
      error.message
    );

    return res.status(500).json({
      success: false,
      message: `Unable to retrieve sales by ${label}`,
    });
  }
};

const getSalesByProduct = getSalesBy(
  "product",
  Product,
  "productId",
  "product"
);

const getSalesByStore = getSalesBy(
  "store",
  Store,
  "storeId",
  "store"
);

const deleteSale = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const inventory = await Inventory.findOne({
      product: sale.product,
      store: sale.store,
    });

    if (!inventory) {
      return res.status(409).json({
        success: false,
        message: "Inventory not found; sale was not deleted",
      });
    }

    inventory.quantity += sale.unitsSold;
    inventory.lastUpdated = new Date();

    await inventory.save();

    await Sale.deleteOne({
      _id: sale._id,
    });

    return res.status(200).json({
      success: true,
      message: "Sale deleted and inventory restored successfully",
    });
  } catch (error) {
    console.error("Delete sale error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete sale",
    });
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
  getSalesByProduct,
  getSalesByStore,
  deleteSale,
};
