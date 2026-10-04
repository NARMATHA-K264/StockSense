const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Authentication token required" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("Authentication error: JWT_SECRET is not configured");
      return res.status(401).json({ success: false, message: "Invalid authentication token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid or expired authentication token" });
    }

    console.error("Authentication error:", error.message);
    return res.status(401).json({ success: false, message: "Unable to authenticate request" });
  }
};

module.exports = authMiddleware;
