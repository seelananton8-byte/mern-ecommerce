// Full backend API test (vitest). Run:  npm test
// Needs: server running on localhost:5000, .env with MONGODB_URI + JWT_SECRET.
// It creates temporary users / products / orders in the DB (names start with
// "__test_" / "__TEST__") and deletes them all afterwards.
import "dotenv/config";
import http from "node:http";
import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

const BASE = "http://localhost:5000";
const MISSING_ID = "507f1f77bcf86cd799439011";

const address = {
  fullName: "Test User",
  addressLine: "1 Main Street",
  city: "Chennai",
  postalCode: "600001",
};

const createdUserIds = [];

// ---------------- helpers ----------------

async function api(method, path, { token, body, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data, headers: res.headers };
}

// Node's fetch may refuse a custom Origin header, so use http directly
function rawStatus(path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port: 5000, path, method: "GET", headers },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function createUser(role, label) {
  const user = await User.create({
    name: `Test ${label}`,
    email: `__test_${label}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`,
    password: "TestPass#12345",
    role,
  });

  createdUserIds.push(user._id);

  const token = jwt.sign(
    { userId: String(user._id), role },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  return { id: String(user._id), token };
}

async function stockOf(productId) {
  const res = await api("GET", `/api/products/${productId}`);
  return res.data.product.stock;
}

async function cleanup() {
  await Order.deleteMany({ user: { $in: createdUserIds } });
  await Product.deleteMany({ title: /^__TEST__/ });
  await User.deleteMany({ email: /^__test_/ });
}

// ---------------- tests ----------------

describe("Full backend API", () => {
  let admin;
  let userA;
  let userB;
  let productId;
  let orderPlain; // qty 2
  let orderIdem; // qty 1 (idempotency + status flow)
  const idemKey = `test-key-${Date.now()}-abcdef`;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await cleanup(); // leftovers from a crashed earlier run

    admin = await createUser("admin", "admin");
    userA = await createUser("user", "usera");
    userB = await createUser("user", "userb");
  }, 30000);

  afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
  }, 30000);

  // ---------- server / security ----------
  describe("Server and security", () => {
    it("health check works", async () => {
      const res = await api("GET", "/api/health");
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it("unknown route returns JSON 404", async () => {
      const res = await api("GET", "/api/does-not-exist");
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
    });

    it("hides x-powered-by and sets helmet headers", async () => {
      const res = await api("GET", "/api/health");
      expect(res.headers.get("x-powered-by")).toBeNull();
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it("blocks a disallowed CORS origin", async () => {
      const status = await rawStatus("/api/products", {
        Origin: "http://evil.com",
      });
      expect(status).toBe(403);
    });

    it("rejects invalid JSON with 400", async () => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad json",
      });
      expect(res.status).toBe(400);
    });

    it("rejects an oversized body with 413", async () => {
      const res = await fetch(`${BASE}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "a".repeat(20000) }),
      });
      expect(res.status).toBe(413);
    });
  });

  // ---------- roles ----------
  describe("Roles", () => {
    it("admin token reaches an admin route", async () => {
      const res = await api("GET", "/api/orders/admin/all", {
        token: admin.token,
      });
      expect(res.status).toBe(200);
    });

    it("role is read from the DB (demoted admin loses access)", async () => {
      const temp = await createUser("admin", "tempadmin");

      const before = await api("GET", "/api/orders/admin/all", {
        token: temp.token,
      });
      expect(before.status).toBe(200);

      await User.updateOne({ _id: temp.id }, { role: "user" });

      const after = await api("GET", "/api/orders/admin/all", {
        token: temp.token,
      });
      expect(after.status).toBe(403);
    });
  });

  // ---------- products ----------
  describe("Products", () => {
    it("lists products with pagination fields", async () => {
      const res = await api("GET", "/api/products?limit=2");
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.products)).toBe(true);
      expect(res.data.products.length).toBeLessThanOrEqual(2);
      expect(typeof res.data.total).toBe("number");
      expect(res.data.page).toBe(1);
      expect(typeof res.data.pages).toBe("number");
    });

    it("caps an abusive limit", async () => {
      const res = await api("GET", "/api/products?limit=100000");
      expect(res.status).toBe(200);
      expect(res.data.products.length).toBeLessThanOrEqual(100);
    });

    it("treats regex characters in search as plain text", async () => {
      const res = await api("GET", "/api/products?search=a.*b(");
      expect(res.status).toBe(200);
    });

    it("invalid product ID returns 400, unknown returns 404", async () => {
      expect((await api("GET", "/api/products/abc")).status).toBe(400);
      expect((await api("GET", `/api/products/${MISSING_ID}`)).status).toBe(404);
    });

    it("create product without token is 401, as normal user is 403", async () => {
      const body = {
        title: "__TEST__ nope",
        description: "d",
        category: "c",
        price: 10,
      };
      expect((await api("POST", "/api/products", { body })).status).toBe(401);
      expect(
        (await api("POST", "/api/products", { token: userA.token, body })).status
      ).toBe(403);
    });

    const badProductCases = [
      ["negative price", { price: -5 }],
      ["3 decimal price", { price: 19.999 }],
      ["whitespace price", { price: " " }],
      ["huge price", { price: 1e12 }],
      ["unsupported field", { isAdmin: true }],
      ["javascript: image", { image: "javascript:alert(1)" }],
      ["negative stock", { stock: -1 }],
      ["decimal stock", { stock: 1.5 }],
    ];

    it.each(badProductCases)("admin create rejects %s", async (_name, extra) => {
      const res = await api("POST", "/api/products", {
        token: admin.token,
        body: {
          title: "__TEST__ bad",
          description: "d",
          category: "c",
          price: 10,
          ...extra,
        },
      });
      expect(res.status).toBe(400);
    });

    it("admin creates a product", async () => {
      const res = await api("POST", "/api/products", {
        token: admin.token,
        body: {
          title: "__TEST__ Phone",
          description: "Test product",
          category: "__TEST__",
          price: 499.5,
          stock: 10,
        },
      });
      expect(res.status).toBe(201);
      expect(res.data.product.price).toBe(499.5);
      productId = res.data.product._id;
    });

    it("gets the product by ID and finds it by search", async () => {
      const one = await api("GET", `/api/products/${productId}`);
      expect(one.status).toBe(200);

      const search = await api("GET", "/api/products?search=__TEST__%20Phone");
      expect(search.status).toBe(200);
      expect(search.data.products.some((p) => p._id === productId)).toBe(true);
    });

    it("admin updates a product; bad updates are rejected", async () => {
      const ok = await api("PUT", `/api/products/${productId}`, {
        token: admin.token,
        body: { description: "Updated description" },
      });
      expect(ok.status).toBe(200);

      const unsupported = await api("PUT", `/api/products/${productId}`, {
        token: admin.token,
        body: { role: "admin" },
      });
      expect(unsupported.status).toBe(400);

      const empty = await api("PUT", `/api/products/${productId}`, {
        token: admin.token,
        body: {},
      });
      expect(empty.status).toBe(400);

      const asUser = await api("PUT", `/api/products/${productId}`, {
        token: userA.token,
        body: { price: 1 },
      });
      expect(asUser.status).toBe(403);
    });
  });

  // ---------- orders ----------
  describe("Orders", () => {
    it("requires a token", async () => {
      const res = await api("GET", "/api/orders");
      expect(res.status).toBe(401);
    });

    const badOrderCases = [
      ["negative quantity", (id) => ({ items: [{ productId: id, quantity: -1 }], shippingAddress: address })],
      ["zero quantity", (id) => ({ items: [{ productId: id, quantity: 0 }], shippingAddress: address })],
      ["decimal quantity", (id) => ({ items: [{ productId: id, quantity: 1.5 }], shippingAddress: address })],
      ["quantity above 100", (id) => ({ items: [{ productId: id, quantity: 101 }], shippingAddress: address })],
      ["string quantity", (id) => ({ items: [{ productId: id, quantity: "2" }], shippingAddress: address })],
      ["invalid product id", () => ({ items: [{ productId: "abc", quantity: 1 }], shippingAddress: address })],
      ["no items", () => ({ items: [], shippingAddress: address })],
      ["no address", (id) => ({ items: [{ productId: id, quantity: 1 }] })],
      ["bad payment provider", (id) => ({ items: [{ productId: id, quantity: 1 }], shippingAddress: address, paymentProvider: "bitcoin" })],
    ];

    it.each(badOrderCases)("rejects %s", async (_name, build) => {
      const res = await api("POST", "/api/orders", {
        token: userA.token,
        body: build(productId),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a product that does not exist", async () => {
      const res = await api("POST", "/api/orders", {
        token: userA.token,
        body: {
          items: [{ productId: MISSING_ID, quantity: 1 }],
          shippingAddress: address,
        },
      });
      expect(res.status).toBe(400);
    });

    it("calculates price on the server (ignores client price)", async () => {
      const res = await api("POST", "/api/orders", {
        token: userA.token,
        body: {
          items: [{ productId, quantity: 2, price: 1 }],
          shippingAddress: address,
        },
      });

      expect(res.status).toBe(201);
      expect(res.data.order.totalAmount).toBe(999);
      expect(res.data.order.items[0].price).toBe(499.5);
      expect(res.data.order.status).toBe("pending");
      expect(res.data.order).not.toHaveProperty("stripeSessionId");
      orderPlain = res.data.order._id;

      expect(await stockOf(productId)).toBe(8);
    });

    it("idempotency key prevents duplicate orders and double stock deduction", async () => {
      const body = {
        items: [{ productId, quantity: 1 }],
        shippingAddress: address,
      };

      const first = await api("POST", "/api/orders", {
        token: userA.token,
        body,
        headers: { "Idempotency-Key": idemKey },
      });
      expect(first.status).toBe(201);
      expect(first.data.order).not.toHaveProperty("idempotencyKey");
      orderIdem = first.data.order._id;
      expect(await stockOf(productId)).toBe(7);

      const replay = await api("POST", "/api/orders", {
        token: userA.token,
        body,
        headers: { "Idempotency-Key": idemKey },
      });
      expect(replay.status).toBe(200);
      expect(replay.data.order._id).toBe(orderIdem);
      expect(await stockOf(productId)).toBe(7);
    });

    it("returns 409 when stock is insufficient", async () => {
      const res = await api("POST", "/api/orders", {
        token: userA.token,
        body: {
          items: [{ productId, quantity: 100 }],
          shippingAddress: address,
        },
      });
      expect(res.status).toBe(409);
      expect(await stockOf(productId)).toBe(7);
    });

    it("user sees only their own orders", async () => {
      const mine = await api("GET", "/api/orders", { token: userA.token });
      expect(mine.status).toBe(200);
      expect(mine.data.orders.length).toBeGreaterThanOrEqual(2);
      expect(mine.data.orders.every((o) => String(o.user) === userA.id)).toBe(true);

      const others = await api("GET", "/api/orders", { token: userB.token });
      expect(others.status).toBe(200);
      expect(others.data.orders.length).toBe(0);
    });

    it("blocks reading or cancelling another user's order (IDOR)", async () => {
      expect(
        (await api("GET", `/api/orders/${orderPlain}`, { token: userB.token })).status
      ).toBe(404);
      expect(
        (await api("PATCH", `/api/orders/${orderPlain}/cancel`, { token: userB.token })).status
      ).toBe(404);
      expect(
        (await api("GET", `/api/orders/${orderPlain}`, { token: userA.token })).status
      ).toBe(200);
    });

    it("normal users cannot use admin order routes", async () => {
      expect(
        (await api("GET", "/api/orders/admin/all", { token: userA.token })).status
      ).toBe(403);
      expect(
        (
          await api("PATCH", `/api/orders/${orderPlain}/status`, {
            token: userA.token,
            body: { status: "delivered" },
          })
        ).status
      ).toBe(403);
    });

    it("user cancels an order and stock is restored (second cancel is 409)", async () => {
      const res = await api("PATCH", `/api/orders/${orderPlain}/cancel`, {
        token: userA.token,
      });
      expect(res.status).toBe(200);
      expect(res.data.order.status).toBe("cancelled");
      expect(await stockOf(productId)).toBe(9);

      const again = await api("PATCH", `/api/orders/${orderPlain}/cancel`, {
        token: userA.token,
      });
      expect(again.status).toBe(409);
      expect(await stockOf(productId)).toBe(9);
    });

    it("admin lists orders with pagination", async () => {
      const res = await api("GET", "/api/orders/admin/all?limit=5", {
        token: admin.token,
      });
      expect(res.status).toBe(200);
      expect(typeof res.data.total).toBe("number");
      expect(res.data.orders.length).toBeLessThanOrEqual(5);
    });

    it("enforces order status transitions and marks COD paid on delivery", async () => {
      const setStatus = (status) =>
        api("PATCH", `/api/orders/${orderIdem}/status`, {
          token: admin.token,
          body: { status },
        });

      expect((await setStatus("hacked")).status).toBe(400);
      expect((await setStatus("delivered")).status).toBe(409); // pending -> delivered not allowed
      expect((await setStatus("confirmed")).status).toBe(200);
      expect((await setStatus("processing")).status).toBe(200);
      expect((await setStatus("shipped")).status).toBe(200);

      const delivered = await setStatus("delivered");
      expect(delivered.status).toBe(200);
      expect(delivered.data.order.paymentStatus).toBe("paid");

      expect((await setStatus("cancelled")).status).toBe(409); // closed order
    });

    it("an unpaid Stripe order cannot move forward, but can be cancelled", async () => {
      const before = await stockOf(productId);

      const created = await api("POST", "/api/orders", {
        token: userA.token,
        body: {
          items: [{ productId, quantity: 1 }],
          shippingAddress: address,
          paymentProvider: "stripe",
        },
      });
      expect(created.status).toBe(201);
      const id = created.data.order._id;
      expect(await stockOf(productId)).toBe(before - 1);

      const confirm = await api("PATCH", `/api/orders/${id}/status`, {
        token: admin.token,
        body: { status: "confirmed" },
      });
      expect(confirm.status).toBe(409);

      const cancel = await api("PATCH", `/api/orders/${id}/status`, {
        token: admin.token,
        body: { status: "cancelled" },
      });
      expect(cancel.status).toBe(200);
      expect(await stockOf(productId)).toBe(before);
    });

    it("stock race: 8 parallel orders for 5 items => exactly 5 succeed", async () => {
      const raceProduct = await Product.create({
        title: "__TEST__ Race Item",
        description: "race",
        category: "__TEST__",
        price: 100,
        stock: 5,
      });

      const buyers = [];
      for (let i = 0; i < 8; i++) {
        buyers.push(await createUser("user", `race${i}`));
      }

      const results = await Promise.all(
        buyers.map((buyer) =>
          api("POST", "/api/orders", {
            token: buyer.token,
            body: {
              items: [{ productId: String(raceProduct._id), quantity: 1 }],
              shippingAddress: address,
            },
          })
        )
      );

      const statuses = results.map((r) => r.status);
      expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
      expect(statuses.filter((s) => s === 201).length).toBe(5);

      const finalProduct = await Product.findById(raceProduct._id).lean();
      expect(finalProduct.stock).toBe(0);
    }, 60000);
  });

  // ---------- delete (last) ----------
  describe("Product delete", () => {
    it("normal user cannot delete, admin can, second delete is 404", async () => {
      expect(
        (await api("DELETE", `/api/products/${productId}`, { token: userA.token })).status
      ).toBe(403);
      expect(
        (await api("DELETE", `/api/products/${productId}`, { token: admin.token })).status
      ).toBe(200);
      expect(
        (await api("DELETE", `/api/products/${productId}`, { token: admin.token })).status
      ).toBe(404);
    });
  });
});