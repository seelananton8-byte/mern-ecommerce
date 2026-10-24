import "dotenv/config";
import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/product");
const Wishlist = require("../models/Wishlist");

const BASE = "http://localhost:5000";
const MISSING_ID = "507f1f77bcf86cd799439011";

// Different prefixes from the other test files, so cleanups never collide
const USER_PREFIX = "__wltest_";
const PRODUCT_PREFIX = "__WLTEST__";

const createdUserIds = [];

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  return { status: res.status, data };
}

async function createUser(role, label) {
  const user = await User.create({
    name: `Test ${label}`,
    email: `${USER_PREFIX}${label}_${Date.now()}_${Math.random()
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

async function createProduct(label) {
  const product = await Product.create({
    title: `${PRODUCT_PREFIX} ${label}`,
    description: "Temporary product for the wishlist tests.",
    price: 100,
    category: "test",
    stock: 5,
  });

  return String(product._id);
}

async function cleanup() {
  await Wishlist.deleteMany({ user: { $in: createdUserIds } });
  await Product.deleteMany({ title: new RegExp(`^${PRODUCT_PREFIX}`) });
  await User.deleteMany({ email: new RegExp(`^${USER_PREFIX}`) });
}

describe("Wishlist API", () => {
  let admin;
  let userA;
  let userB;
  let userC;
  let p1;
  let p2;
  let p3;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await cleanup();

    admin = await createUser("admin", "admin");
    userA = await createUser("user", "usera");
    userB = await createUser("user", "userb");
    userC = await createUser("user", "userc");

    p1 = await createProduct("First");
    p2 = await createProduct("Second");
    p3 = await createProduct("Third");
  }, 30000);

  afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
  }, 30000);

  it("needs a login for every wishlist request", async () => {
    expect((await api("GET", "/api/wishlist")).status).toBe(401);
    expect((await api("POST", `/api/wishlist/${p1}`)).status).toBe(401);
    expect((await api("DELETE", `/api/wishlist/${p1}`)).status).toBe(401);
    expect(
      (await api("POST", "/api/wishlist/merge", { body: { productIds: [p1] } }))
        .status
    ).toBe(401);
  });

  it("starts with an empty wishlist", async () => {
    const res = await api("GET", "/api/wishlist", { token: userA.token });

    expect(res.status).toBe(200);
    expect(res.data.products).toEqual([]);
    expect(res.data.count).toBe(0);
  });

  it("adds a product, and adding it again does not duplicate it", async () => {
    const first = await api("POST", `/api/wishlist/${p1}`, {
      token: userA.token,
    });
    expect(first.status).toBe(200);
    expect(first.data.count).toBe(1);

    const again = await api("POST", `/api/wishlist/${p1}`, {
      token: userA.token,
    });
    expect(again.status).toBe(200);
    expect(again.data.count).toBe(1);

    const list = await api("GET", "/api/wishlist", { token: userA.token });
    expect(list.data.products).toHaveLength(1);
    expect(list.data.products[0].title).toBe(`${PRODUCT_PREFIX} First`);
    expect(String(list.data.products[0]._id)).toBe(p1);
  });

  it("rejects an invalid or missing product id", async () => {
    const bad = await api("POST", "/api/wishlist/not-an-id", {
      token: userA.token,
    });
    expect(bad.status).toBe(400);

    const missing = await api("POST", `/api/wishlist/${MISSING_ID}`, {
      token: userA.token,
    });
    expect(missing.status).toBe(404);

    const badRemove = await api("DELETE", "/api/wishlist/not-an-id", {
      token: userA.token,
    });
    expect(badRemove.status).toBe(400);
  });

  it("keeps the order and removes a product (removing twice is fine)", async () => {
    await api("POST", `/api/wishlist/${p2}`, { token: userA.token });

    const list = await api("GET", "/api/wishlist", { token: userA.token });
    expect(list.data.products.map((p) => String(p._id))).toEqual([p1, p2]);

    const removed = await api("DELETE", `/api/wishlist/${p1}`, {
      token: userA.token,
    });
    expect(removed.status).toBe(200);
    expect(removed.data.count).toBe(1);

    const removedAgain = await api("DELETE", `/api/wishlist/${p1}`, {
      token: userA.token,
    });
    expect(removedAgain.status).toBe(200);
    expect(removedAgain.data.count).toBe(1);
  });

  it("gives every user a separate wishlist", async () => {
    const other = await api("GET", "/api/wishlist", { token: userB.token });

    expect(other.status).toBe(200);
    expect(other.data.products).toEqual([]);
  });

  it("merges the products saved before login and ignores bad ids", async () => {
    const res = await api("POST", "/api/wishlist/merge", {
      token: userC.token,
      body: {
        productIds: [p1, p2, p1, "not-an-id", MISSING_ID, 123, null],
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.count).toBe(2);

    // merging the same list again changes nothing
    const again = await api("POST", "/api/wishlist/merge", {
      token: userC.token,
      body: { productIds: [p1, p2] },
    });
    expect(again.data.count).toBe(2);

    const list = await api("GET", "/api/wishlist", { token: userC.token });
    expect(list.data.products).toHaveLength(2);
  });

  it("rejects a merge request with a bad or oversized list", async () => {
    const notList = await api("POST", "/api/wishlist/merge", {
      token: userC.token,
      body: { productIds: "abc" },
    });
    expect(notList.status).toBe(400);

    const tooMany = await api("POST", "/api/wishlist/merge", {
      token: userC.token,
      body: { productIds: Array.from({ length: 101 }, () => MISSING_ID) },
    });
    expect(tooMany.status).toBe(400);
  });

  it("drops a product from every wishlist when the product is deleted", async () => {
    await api("POST", `/api/wishlist/${p3}`, { token: userA.token });
    await api("POST", `/api/wishlist/${p3}`, { token: userB.token });

    const removed = await api("DELETE", `/api/products/${p3}`, {
      token: admin.token,
    });
    expect(removed.status).toBe(200);

    for (const user of [userA, userB]) {
      const list = await api("GET", "/api/wishlist", { token: user.token });
      expect(list.data.products.map((p) => String(p._id))).not.toContain(p3);
    }

    expect(await Wishlist.countDocuments({ products: p3 })).toBe(0);
  });
});