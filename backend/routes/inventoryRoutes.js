const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const controller = require("../controllers/inventoryController");

const router = express.Router();
router.use(authMiddleware);
router.post("/", authorizeRoles("admin", "manager", "inventory_staff"), controller.createInventory);
router.get("/", controller.getInventory);
router.put("/current/:productId/:storeId", authorizeRoles("admin", "manager", "inventory_staff"), controller.setCurrentInventory);
router.delete("/current/:productId/:storeId", authorizeRoles("admin", "manager"), controller.zeroCurrentInventory);
router.get("/low-stock", controller.getLowStockInventory);
router.get("/product/:productId", controller.getInventoryByProduct);
router.get("/store/:storeId", controller.getInventoryByStore);
router.get("/:id", controller.getInventoryById);
router.put("/:id", authorizeRoles("admin", "manager", "inventory_staff"), controller.updateInventory);
router.delete("/:id", authorizeRoles("admin", "manager"), controller.deleteInventory);

module.exports = router;