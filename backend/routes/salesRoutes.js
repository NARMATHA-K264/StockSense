const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const controller = require("../controllers/salesController");

const router = express.Router();
router.use(authMiddleware);
const salesAccess = authorizeRoles("admin", "manager", "cashier");
router.post("/", salesAccess, controller.createSale);
router.get("/", salesAccess, controller.getSales);
router.get("/product/:productId", salesAccess, controller.getSalesByProduct);
router.get("/store/:storeId", salesAccess, controller.getSalesByStore);
router.get("/:id", salesAccess, controller.getSaleById);
router.delete("/:id", authorizeRoles("admin", "manager"), controller.deleteSale);

module.exports = router;