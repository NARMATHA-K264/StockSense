const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const controller = require("../controllers/analyticsController");

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin", "manager"));
router.get("/summary", controller.getSummary);
router.get("/sales", controller.getSalesAnalytics);
router.get("/products", controller.getProductAnalytics);
router.get("/stores", controller.getStoreAnalytics);
router.get("/inventory", controller.getInventoryAnalytics);
router.get("/historical-sales", controller.getHistoricalSalesAnalytics);
router.get("/historical-inventory", controller.getHistoricalInventoryAnalytics);

module.exports = router;