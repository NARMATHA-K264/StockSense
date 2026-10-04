const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { getReplenishment } = require("../controllers/replenishmentController");

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin", "manager"));
router.get("/", getReplenishment);

module.exports = router;