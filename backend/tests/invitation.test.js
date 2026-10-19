const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const User = require("../models/User");
const authRoutes = require("../routes/authRoutes");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { buildInvitationUrl, hashInvitationToken } = require("../utils/invitationService");

const methodNames = ["create", "findOne", "findOneAndUpdate"];
let originalMethods;
let originalFetch;
let originalConsoleError;
let originalEnv;
let users;
let errors;

const makeUser = (fields) => ({
  _id: "pending-user-id",
  ...fields,
  toObject() {
    return { ...this };
  },
  async save() {
    return this;
  },
});

const makeResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const invitationRequest = (email = "staff@example.test") => ({
  body: { email },
});

test("production invitation URLs use the configured public frontend base", () => {
  process.env.NODE_ENV = "production";
  process.env.FRONTEND_URL = "https://stocksense-isui.onrender.com/";

  assert.equal(
    buildInvitationUrl("secure token"),
    "https://stocksense-isui.onrender.com/set-password?token=secure%20token"
  );
});

beforeEach(() => {
  originalMethods = Object.fromEntries(methodNames.map((name) => [name, Object.getOwnPropertyDescriptor(User, name)]));
  originalFetch = global.fetch;
  originalConsoleError = console.error;
  originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    FRONTEND_URL: process.env.FRONTEND_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  users = [];
  errors = [];
  process.env.RESEND_API_KEY = "test-only-key";
  process.env.EMAIL_FROM = "StockSense <sender@example.test>";
  process.env.FRONTEND_URL = "https://stocksense.example.test";
  process.env.NODE_ENV = "production";
  console.error = (...args) => errors.push(args);
});

afterEach(() => {
  for (const name of methodNames) {
    if (originalMethods[name]) {
      Object.defineProperty(User, name, originalMethods[name]);
    } else {
      delete User[name];
    }
  }
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  console.error = originalConsoleError;
});

test("invitation creation keeps a pending user and returns a link when Resend rejects", async () => {
  process.env.FRONTEND_URL = "https://stocksense-isui.onrender.com";
  User.findOne = async ({ email }) => users.find((user) => user.email === email) || null;
  User.create = async (fields) => {
    const user = makeUser(fields);
    users.push(user);
    return user;
  };
  global.fetch = async () => ({ ok: false, status: 403 });

  const response = makeResponse();
  await authController.register({
    body: { name: "Staff Member", email: " Staff@Example.test ", role: "manager" },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.user.status, "pending");
  assert.equal(response.payload.message, "User created, but invitation email could not be sent.");
  assert.equal(users.length, 1);
  assert.match(users[0].invitationTokenHash, /^[a-f0-9]{64}$/);
  assert.equal("invitationTokenHash" in response.payload.user, false);

  const token = new URL(response.payload.invitationUrl).searchParams.get("token");
  assert.ok(token);
  assert.equal(
    response.payload.invitationUrl,
    `https://stocksense-isui.onrender.com/set-password?token=${encodeURIComponent(token)}`
  );
  assert.equal(hashInvitationToken(token), users[0].invitationTokenHash);
  assert.equal(
    new Date(users[0].invitationExpiresAt).getTime() - Date.now() >= 24 * 60 * 60 * 1000 - 1000,
    true
  );
  assert.equal(errors.some((entry) => entry.join(" ").includes(token)), false);

  const duplicate = makeResponse();
  await authController.register({
    body: { name: "Staff Member", email: "staff@example.test", role: "manager" },
  }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(users.length, 1);
});

test("admin-only route and role guard protect invitation-link retrieval", () => {
  const invitationRoute = authRoutes.stack.find((layer) => layer.route?.path === "/invitation-link");
  assert.ok(invitationRoute);
  assert.equal(invitationRoute.route.methods.post, true);
  assert.equal(invitationRoute.route.stack.length, 3);
  assert.equal(invitationRoute.route.stack[0].handle, authMiddleware);

  const unauthenticated = makeResponse();
  authMiddleware({ headers: {} }, unauthenticated, () => assert.fail("Authentication is required"));
  assert.equal(unauthenticated.statusCode, 401);

  const guard = invitationRoute.route.stack[1].handle;
  const denied = makeResponse();
  let deniedNext = false;
  guard({ user: { role: "manager" } }, denied, () => { deniedNext = true; });
  assert.equal(denied.statusCode, 403);
  assert.equal(deniedNext, false);

  let allowedNext = false;
  guard({ user: { role: "admin" } }, makeResponse(), () => { allowedNext = true; });
  assert.equal(allowedNext, true);
});

test("a rejected resend retains the existing pending user and returns its active link", async () => {
  const user = makeUser({
    name: "Staff Member",
    email: "staff@example.test",
    role: "manager",
    status: "pending",
    invitationTokenHash: "previous-token-hash",
    invitationExpiresAt: new Date(Date.now() + 60_000),
    invitationUsedAt: null,
  });
  users.push(user);
  User.findOne = async ({ email }) => users.find((entry) => entry.email === email) || null;
  global.fetch = async () => ({ ok: false, status: 403 });

  const response = makeResponse();
  await authController.resendInvitation(invitationRequest(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.message, "Invitation email could not be sent.");
  assert.equal(users.length, 1);
  assert.equal(user.status, "pending");
  const token = new URL(response.payload.invitationUrl).searchParams.get("token");
  assert.equal(user.invitationTokenHash, hashInvitationToken(token));
  assert.notEqual(user.invitationTokenHash, "previous-token-hash");
});

test("authorized link retrieval rotates the pending token without creating another user", async () => {
  const user = makeUser({
    name: "Staff Member",
    email: "staff@example.test",
    role: "manager",
    status: "pending",
    invitationTokenHash: "old-token-hash",
  });
  users.push(user);
  User.findOne = async () => users.find((entry) => entry.email === "staff@example.test") || null;
  User.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter._id, user._id);
    Object.assign(user, update.$set);
    return user;
  };

  const response = makeResponse();
  await authController.getInvitationLink(invitationRequest(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(users.length, 1);
  const token = new URL(response.payload.invitationUrl).searchParams.get("token");
  assert.equal(user.invitationTokenHash, hashInvitationToken(token));
  assert.notEqual(user.invitationTokenHash, "old-token-hash");
  assert.equal(user.status, "pending");
});

test("expired invitations cannot set a password", async () => {
  const token = "expired-invitation-token";
  User.findOne = async () => makeUser({
    status: "pending",
    invitationTokenHash: hashInvitationToken(token),
    invitationExpiresAt: new Date(Date.now() - 1000),
    invitationUsedAt: null,
  });
  User.findOneAndUpdate = async () => {
    assert.fail("Expired invitation must not be activated");
  };

  const response = makeResponse();
  await authController.setPassword({
    body: { token, password: "new-password", confirmPassword: "new-password" },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /expired/i);
});

test("a valid invitation can activate an account only once, including concurrent requests", async () => {
  const token = "single-use-invitation-token";
  const user = makeUser({
    name: "Staff Member",
    email: "staff@example.test",
    role: "manager",
    status: "pending",
    invitationTokenHash: hashInvitationToken(token),
    invitationExpiresAt: new Date(Date.now() + 60_000),
    invitationUsedAt: null,
    password: null,
  });
  users.push(user);
  User.findOne = async ({ invitationTokenHash }) =>
    user.invitationTokenHash === invitationTokenHash && user.status === "pending" ? user : null;
  User.findOneAndUpdate = async (filter, update) => {
    if (
      user.invitationTokenHash !== filter.invitationTokenHash ||
      user.status !== filter.status ||
      user.invitationExpiresAt <= filter.invitationExpiresAt.$gt ||
      user.invitationUsedAt !== filter.invitationUsedAt
    ) {
      return null;
    }
    Object.assign(user, update.$set);
    return user;
  };

  const requests = [makeResponse(), makeResponse()];
  await Promise.all(requests.map((response) => authController.setPassword({
    body: { token, password: "new-password", confirmPassword: "new-password" },
  }, response)));

  assert.deepEqual(requests.map((response) => response.statusCode).sort(), [200, 400]);
  assert.equal(user.status, "active");
  assert.equal(user.invitationTokenHash, null);
  assert.equal(user.invitationExpiresAt, null);
  assert.ok(user.invitationUsedAt instanceof Date);
  assert.ok(user.password);
});
