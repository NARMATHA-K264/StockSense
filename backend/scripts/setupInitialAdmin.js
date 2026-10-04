require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function setupInitialAdmin() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be configured in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true,
    tls: true,
  });

  const adminCount = await User.countDocuments({ role: "admin" });
  if (adminCount > 1) {
    throw new Error(`Found ${adminCount} Admin accounts. No records were changed; resolve duplicates manually.`);
  }

  if (adminCount === 0) {
    const name = process.env.INITIAL_ADMIN_NAME?.trim();
    const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!name || !emailPattern.test(email || "") || typeof password !== "string" || password.length < 6) {
      throw new Error("Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD (minimum 6 characters) in backend/.env");
    }
  }

  await User.collection.createIndex(
    { role: 1 },
    {
      unique: true,
      partialFilterExpression: { role: "admin" },
      name: "one_admin_per_shop",
    }
  );

  if (adminCount === 1) {
    console.log("An Admin already exists. The one-Admin constraint is in place; no user was created.");
    return;
  }

  try {
    await User.create({
      name: process.env.INITIAL_ADMIN_NAME.trim(),
      email: process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase(),
      password: await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12),
      role: "admin",
    });
    console.log("Initial Admin created successfully.");
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("Admin or email already exists. No existing account was changed.");
    }

    throw error;
  }
}

setupInitialAdmin()
  .catch((error) => {
    console.error(`Initial Admin setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });