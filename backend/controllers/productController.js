const mongoose = require("mongoose");
const Product = require("../models/Product");

const validId = (id) => mongoose.isValidObjectId(id);
const fields = ["name", "sku", "category", "price", "costPrice", "reorderLevel", "supplier", "description"];

const getProducts = async (req, res) => {
  try { const products = await Product.find().sort({ createdAt: -1 }); return res.json({ success: true, count: products.length, products }); }
  catch (error) { console.error("Get products error:", error.message); return res.status(500).json({ success: false, message: "Unable to retrieve products" }); }
};

const createProduct = async (req, res) => {
  try {
    const data = Object.fromEntries(fields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    const product = await Product.create(data);
    return res.status(201).json({ success: true, message: "Product created successfully", product });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "SKU is already registered" });
    if (error.name === "ValidationError") return res.status(400).json({ success: false, message: "Please provide valid product details" });
    console.error("Create product error:", error.message); return res.status(500).json({ success: false, message: "Unable to create product" });
  }
};

const updateProduct = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product ID" });
    const data = Object.fromEntries(fields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, message: "Product updated successfully", product });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "SKU is already registered" });
    if (error.name === "ValidationError") return res.status(400).json({ success: false, message: "Please provide valid product details" });
    console.error("Update product error:", error.message); return res.status(500).json({ success: false, message: "Unable to update product" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product ID" });
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) { console.error("Delete product error:", error.message); return res.status(500).json({ success: false, message: "Unable to delete product" }); }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };