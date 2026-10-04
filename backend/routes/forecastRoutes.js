const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { createForecast, getProductsWithSalesForStore } = require("../controllers/forecastController");

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin", "manager"));
router.get("/products/:storeId", getProductsWithSalesForStore);
router.post("/", createForecast);

module.exports = router;