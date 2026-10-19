const express = require("express");
const {
  register,
  getUsers,
  login,
  getCurrentUser,
  logout,
  setPassword,
  resendInvitation,
  getInvitationLink,
  removeUser,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/register", authMiddleware, authorizeRoles("admin"), register);
router.post("/resend-invitation", authMiddleware, authorizeRoles("admin"), resendInvitation);
router.post("/invitation-link", authMiddleware, authorizeRoles("admin"), getInvitationLink);
router.post("/remove-user", authMiddleware, authorizeRoles("admin"), removeUser);
router.post("/set-password", setPassword);
router.get("/users", authMiddleware, authorizeRoles("admin"), getUsers);
router.post("/login", login);
router.get("/me", authMiddleware, getCurrentUser);
router.post("/logout", logout);

module.exports = router;
