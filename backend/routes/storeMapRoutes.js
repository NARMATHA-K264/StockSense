const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { getStoreMap } = require("../controllers/storeMapController");

const router = express.Router();
router.use(authMiddleware);
router.get("/", authorizeRoles("admin", "manager"), getStoreMap);

module.exports = router;