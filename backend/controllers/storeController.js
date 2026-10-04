const mongoose = require("mongoose");
const Store = require("../models/Store");
const User = require("../models/User");

const validId = (id) => mongoose.isValidObjectId(id);
const validCoordinate = (value, min, max) => value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);

const getStores = async (req, res) => {
  try { const stores = await Store.find().populate("manager", "name email role").sort({ createdAt: -1 }); return res.json({ success: true, count: stores.length, stores }); }
  catch (error) { console.error("Get stores error:", error.message); return res.status(500).json({ success: false, message: "Unable to retrieve stores" }); }
};

const createStore = async (req, res) => {
  try {
    const { name, location, manager, latitude, longitude } = req.body;
    if (!name || !location) return res.status(400).json({ success: false, message: "Name and location are required" });
    if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) return res.status(400).json({ success: false, message: "Latitude must be between -90 and 90 and longitude between -180 and 180" });
    if ((latitude === undefined) !== (longitude === undefined)) return res.status(400).json({ success: false, message: "Latitude and longitude must be provided together" });
    if (manager && (!validId(manager) || !await User.exists({ _id: manager }))) return res.status(404).json({ success: false, message: "Manager not found" });
    const store = await Store.create({ name, location, ...(manager ? { manager } : {}), ...(latitude !== undefined ? { latitude, longitude } : {}) });
    return res.status(201).json({ success: true, message: "Store created successfully", store: await Store.findById(store._id).populate("manager", "name email role") });
  } catch (error) { console.error("Create store error:", error.message); return res.status(500).json({ success: false, message: "Unable to create store" }); }
};

const updateStore = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid store ID" });
    const { name, location, manager, latitude, longitude } = req.body;
    if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) return res.status(400).json({ success: false, message: "Latitude must be between -90 and 90 and longitude between -180 and 180" });
    if ((latitude === undefined) !== (longitude === undefined)) return res.status(400).json({ success: false, message: "Latitude and longitude must be provided together" });
    if (manager && (!validId(manager) || !await User.exists({ _id: manager }))) return res.status(404).json({ success: false, message: "Manager not found" });
    const store = await Store.findByIdAndUpdate(req.params.id, { name, location, manager: manager || undefined, latitude, longitude }, { new: true, runValidators: true }).populate("manager", "name email role");
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });
    return res.json({ success: true, message: "Store updated successfully", store });
  } catch (error) { console.error("Update store error:", error.message); return res.status(500).json({ success: false, message: "Unable to update store" }); }
};

const deleteStore = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid store ID" });
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });
    return res.json({ success: true, message: "Store deleted successfully" });
  } catch (error) { console.error("Delete store error:", error.message); return res.status(500).json({ success: false, message: "Unable to delete store" }); }
};

module.exports = { getStores, createStore, updateStore, deleteStore };