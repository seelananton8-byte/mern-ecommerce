import "dotenv/config";
import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/product");
const Review = require("../models/Review");

const BASE = "http://localhost:5000";
const MISSING_ID = "507f1f77bcf86cd799439011";

// Different prefixes from the other test files, so cleanups never collide
const USER_PREFIX = "__rvtest_";
const PRODUCT_PREFIX = "__RVTEST__";

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
    description: "Temporary product for the review tests.",
    price: 100,
    category: "test",
    stock: 5,
  });

  return String(product._id);
}

async function cleanup() {
  const products = await Product.find({
    title: new RegExp(`^${PRODUCT_PREFIX}`),
  }).select("_id");
  const productIds = products.map((p) => p._id);

  await Review.deleteMany({
    $or: [{ user: { $in: createdUserIds } }, { product: { $in: productIds } }],
  });
  await mongoose.connection
    .collection("orders")
    .deleteMany({ user: { $in: createdUserIds } });
  await Product.deleteMany({ title: new RegExp(`^${PRODUCT_PREFIX}`) });
  await User.deleteMany({ email: new RegExp(`^${USER_PREFIX}`) });
}

describe("Ratings and reviews API", () => {
  let admin;
  let userA;
  let userB;
  let userC;
  let validator;
  let productId;
  let reviewA;
  let reviewB;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await cleanup();

    admin = await createUser("admin", "admin");
    userA = await createUser("user", "usera");
    userB = await createUser("user", "userb");
    userC = await createUser("user", "userc");
    validator = await createUser("user", "validator");
    productId = await createProduct("Review product");
  }, 30000);

  afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
  }, 30000);

  const reviewsPath = (id = productId) => `/api/products/${id}/reviews`;

  it("lists no reviews for a new product (public)", async () => {
    const res = await api("GET", reviewsPath());

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.reviews).toEqual([]);
    expect(res.data.summary.count).toBe(0);
    expect(res.data.summary.average).toBe(0);
  });

  it("needs a login to write a review", async () => {
    const res = await api("POST", reviewsPath(), {
      body: { rating: 5, comment: "No token here" },
    });

    expect(res.status).toBe(401);
  });

  it("rejects an invalid rating or comment", async () => {
    const badBodies = [
      { rating: 0, comment: "Looks fine" },
      { rating: 6, comment: "Looks fine" },
      { rating: 3.5, comment: "Looks fine" },
      { rating: "abc", comment: "Looks fine" },
      { rating: true, comment: "Looks fine" },
      { comment: "Rating is missing" },
      { rating: 4, comment: "ab" },
      { rating: 4, comment: 12345 },
      { rating: 4 },
      { rating: 4, comment: "x".repeat(1001) },
    ];

    for (const body of badBodies) {
      const res = await api("POST", reviewsPath(), {
        token: validator.token,
        body,
      });
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(res.data.success).toBe(false);
    }
  });

  it("creates a review and shows it in the list with the summary", async () => {
    const res = await api("POST", reviewsPath(), {
      token: userA.token,
      body: { rating: 5, comment: "Great product, works well." },
    });

    expect(res.status).toBe(201);
    expect(res.data.review.rating).toBe(5);
    expect(res.data.review.name).toBe("Test usera");
    expect(res.data.summary.count).toBe(1);
    reviewA = res.data.review.id;

    const list = await api("GET", reviewsPath());
    expect(list.data.reviews).toHaveLength(1);
    expect(list.data.reviews[0].comment).toBe("Great product, works well.");
    expect(list.data.summary.average).toBe(5);
    // the reviewer's email is never exposed
    expect(JSON.stringify(list.data)).not.toContain("@example.com");
  });

  it("posting again updates the same review instead of adding a second one", async () => {
    const res = await api("POST", reviewsPath(), {
      token: userA.token,
      body: { rating: 3, comment: "Changed my mind, it is average." },
    });

    expect(res.status).toBe(200);
    expect(res.data.review.id).toBe(reviewA);
    expect(res.data.summary.count).toBe(1);
    expect(res.data.summary.average).toBe(3);
  });

  it("calculates the average and the distribution across users", async () => {
    const res = await api("POST", reviewsPath(), {
      token: userB.token,
      body: { rating: 4, comment: "Good value for the price." },
    });

    expect(res.status).toBe(201);
    reviewB = res.data.review.id;

    const list = await api("GET", reviewsPath());
    expect(list.data.summary.count).toBe(2);
    expect(list.data.summary.average).toBe(3.5);
    expect(list.data.summary.distribution["3"]).toBe(1);
    expect(list.data.summary.distribution["4"]).toBe(1);
    expect(list.data.pages).toBe(1);
  });

  it("returns the logged in user's own review, or null", async () => {
    const mine = await api("GET", `${reviewsPath()}/mine`, {
      token: userA.token,
    });
    expect(mine.status).toBe(200);
    expect(mine.data.review.id).toBe(reviewA);
    expect(mine.data.review.rating).toBe(3);

    const none = await api("GET", `${reviewsPath()}/mine`, {
      token: userC.token,
    });
    expect(none.status).toBe(200);
    expect(none.data.review).toBeNull();

    const anonymous = await api("GET", `${reviewsPath()}/mine`);
    expect(anonymous.status).toBe(401);
  });

  it("marks reviews from customers who ordered the product as verified", async () => {
    await mongoose.connection.collection("orders").insertOne({
      user: new mongoose.Types.ObjectId(userA.id),
      items: [
        {
          product: new mongoose.Types.ObjectId(productId),
          title: "Review product",
          price: 100,
          quantity: 1,
        },
      ],
      status: "delivered",
      paymentStatus: "paid",
      createdAt: new Date(),
    });

    const list = await api("GET", reviewsPath());
    const byId = Object.fromEntries(list.data.reviews.map((r) => [r.id, r]));

    expect(byId[reviewA].verifiedPurchase).toBe(true);
    expect(byId[reviewB].verifiedPurchase).toBe(false);
  });

  it("does not let a user delete someone else's review", async () => {
    const res = await api("DELETE", `${reviewsPath()}/${reviewA}`, {
      token: userB.token,
    });
    expect(res.status).toBe(403);

    const list = await api("GET", reviewsPath());
    expect(list.data.summary.count).toBe(2);
  });

  it("lets the author delete their own review", async () => {
    const res = await api("DELETE", `${reviewsPath()}/${reviewB}`, {
      token: userB.token,
    });

    expect(res.status).toBe(200);
    expect(res.data.summary.count).toBe(1);
  });

  it("lets an admin delete any review", async () => {
    const res = await api("DELETE", `${reviewsPath()}/${reviewA}`, {
      token: admin.token,
    });

    expect(res.status).toBe(200);
    expect(res.data.summary.count).toBe(0);
  });

  it("rejects invalid or missing product and review ids", async () => {
    const badProduct = await api("GET", reviewsPath("not-an-id"));
    expect(badProduct.status).toBe(400);

    const missingProduct = await api("GET", reviewsPath(MISSING_ID));
    expect(missingProduct.status).toBe(404);

    const badReview = await api("DELETE", `${reviewsPath()}/not-an-id`, {
      token: admin.token,
    });
    expect(badReview.status).toBe(400);

    const missingReview = await api("DELETE", `${reviewsPath()}/${MISSING_ID}`, {
      token: admin.token,
    });
    expect(missingReview.status).toBe(404);
  });

  it("deletes the reviews when the product is deleted", async () => {
    const tempId = await createProduct("Temporary product");

    const created = await api("POST", reviewsPath(tempId), {
      token: userC.token,
      body: { rating: 2, comment: "This product will be removed." },
    });
    expect(created.status).toBe(201);
    expect(await Review.countDocuments({ product: tempId })).toBe(1);

    const removed = await api("DELETE", `/api/products/${tempId}`, {
      token: admin.token,
    });
    expect(removed.status).toBe(200);
    expect(await Review.countDocuments({ product: tempId })).toBe(0);
  });
});