const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const {
  generateInvitationToken,
  hashInvitationToken,
  buildInvitationUrl,
  getInvitationExpiry,
  sendInvitationEmail,
  sendRemovalEmail,
} = require("../utils/invitationService");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRoles = ["manager", "cashier", "inventory_staff"];

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const userResponse = (user) => {
  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;
  delete safeUser.invitationTokenHash;
  return safeUser;
};

const createPendingEmployee = async ({ name, email, role }) => {
  const normalizedEmail = normalizeEmail(email);
  const token = generateInvitationToken();
  const invitationTokenHash = hashInvitationToken(token);
  const expiresAt = getInvitationExpiry();

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: null,
    role,
    status: "pending",
    invitationTokenHash,
    invitationExpiresAt: expiresAt,
    invitationUsedAt: null,
  });

  const invitationUrl = buildInvitationUrl(token);
  const emailResult = await sendInvitationEmail({
    name: user.name,
    email: user.email,
    role: user.role,
    invitationUrl,
  });

  return {
    user,
    invitationUrl: process.env.NODE_ENV === "development" && emailResult.invitationUrl ? emailResult.invitationUrl : undefined,
    emailAccepted: emailResult.accepted,
  };
};

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const requestedRole = typeof role === "string" ? role.trim() : "";
    const invitationMode = password === undefined || password === null || password === "";

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }

    if (requestedRole && !allowedRoles.includes(requestedRole)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    if (invitationMode) {
      if (!requestedRole) {
        return res.status(400).json({ success: false, message: "Role is required" });
      }

      const created = await createPendingEmployee({ name, email: normalizedEmail, role: requestedRole });

      return res.status(201).json({
        success: true,
        message: created.emailAccepted
          ? "Invitation sent successfully."
          : "User created, but invitation email could not be sent.",
        user: userResponse(created.user),
        ...(created.invitationUrl ? { invitationUrl: created.invitationUrl } : {}),
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      status: "active",
      ...(requestedRole ? { role: requestedRole } : {}),
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token: generateToken(user),
      user: userResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    console.error("Registration error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to register user" });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["manager", "cashier", "inventory_staff"] }, status: { $ne: "removed" } })
      .select("name email role status")
      .sort({ name: 1, email: 1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve users" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Please activate your account using the invitation link.",
      });
    }

    if (user.status === "removed") {
      return res.status(403).json({
        success: false,
        message: "This account has been removed and cannot be used.",
      });
    }

    const passwordMatches = user.password ? await bcrypt.compare(password, user.password) : false;

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to log in" });
  }
};

const setPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    const trimmedToken = typeof token === "string" ? token.trim() : "";

    if (!trimmedToken) {
      return res.status(400).json({ success: false, message: "Invitation token is required" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const tokenHash = hashInvitationToken(trimmedToken);
    const user = await User.findOne({ invitationTokenHash: tokenHash, status: "pending" });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invitation is no longer valid." });
    }

    if (user.invitationExpiresAt && new Date(user.invitationExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "Invitation has expired. Please request a new invitation." });
    }

    if (user.invitationUsedAt) {
      return res.status(400).json({ success: false, message: "Invitation is no longer valid." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.status = "active";
    user.invitationTokenHash = null;
    user.invitationExpiresAt = null;
    user.invitationUsedAt = new Date();

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Your account has been activated successfully.",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Set password error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to activate account" });
  }
};

const resendInvitation = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(400).json({ success: false, message: "Invitation can only be resent for employee accounts." });
    }

    if (user.status !== "pending") {
      return res.status(400).json({ success: false, message: "Invitation can only be resent for pending users." });
    }

    const token = generateInvitationToken();
    const invitationTokenHash = hashInvitationToken(token);
    const expiresAt = getInvitationExpiry();

    user.invitationTokenHash = invitationTokenHash;
    user.invitationExpiresAt = expiresAt;
    user.invitationUsedAt = null;
    await user.save();

    const invitationUrl = buildInvitationUrl(token);
    const emailResult = await sendInvitationEmail({
      name: user.name,
      email: user.email,
      role: user.role,
      invitationUrl,
    });

    if (!emailResult.accepted) {
      return res.status(200).json({
        success: true,
        message: "Invitation email could not be sent.",
        ...(emailResult.invitationUrl && process.env.NODE_ENV === "development" ? { invitationUrl: emailResult.invitationUrl } : {}),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invitation sent successfully.",
      ...(emailResult.invitationUrl && process.env.NODE_ENV === "development" ? { invitationUrl: emailResult.invitationUrl } : {}),
    });
  } catch (error) {
    console.error("Resend invitation error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to resend invitation" });
  }
};

const removeUser = async (req, res) => {
  try {
    const { email, id } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const targetUser = id ? await User.findById(id) : await User.findOne({ email: normalizedEmail });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (targetUser.status === "removed") {
      return res.status(400).json({ success: false, message: "This user has already been removed." });
    }

    targetUser.status = "removed";
    targetUser.invitationTokenHash = null;
    targetUser.invitationExpiresAt = null;
    targetUser.invitationUsedAt = new Date();
    await targetUser.save();

    const emailResult = await sendRemovalEmail({
      name: targetUser.name,
      email: targetUser.email,
    });

    return res.status(200).json({
      success: true,
      message: emailResult.accepted
        ? "User access was removed successfully."
        : "User access was removed, but the removal notification email could not be sent.",
      user: userResponse(targetUser),
    });
  } catch (error) {
    console.error("Remove user error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to remove user" });
  }
};

const getCurrentUser = (req, res) => {
  return res.status(200).json({
    success: true,
    user: userResponse(req.user),
  });
};

const logout = (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully. Remove the token on the client.",
  });
};

module.exports = {
  register,
  getUsers,
  login,
  setPassword,
  resendInvitation,
  getCurrentUser,
  logout,
  removeUser,
};
