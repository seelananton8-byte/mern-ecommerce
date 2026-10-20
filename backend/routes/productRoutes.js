const express = require("express");
const Product = require("../models/product");
const authMiddleware = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const MAX_PRICE = 10000000;
const MAX_STOCK = 1000000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const ALLOWED_FIELDS = [
  "title",
  "description",
  "price",
  "category",
  "image",
  "stock",
];

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
};

// ---------- helpers ----------

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidId(id) {
  return typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
}

// Returns a Number, or null when invalid. Accepts numbers or numeric strings.
function parsePrice(value) {
  let num;

  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
    num = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isFinite(num) || num < 0 || num > MAX_PRICE) return null;
  if (Math.round(num * 100) / 100 !== num) return null; // max 2 decimals

  return num;
}

function parseStock(value) {
  let num;

  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    num = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isInteger(num) || num < 0 || num > MAX_STOCK) return null;

  return num;
}

function isValidImage(value) {
  if (value === undefined || value === "") return true;
  if (typeof value !== "string" || value.length > 2048) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function validateProductInput(body, isUpdate = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "A valid JSON object is required.";
  }

  const keys = Object.keys(body);

  if (keys.some((key) => !ALLOWED_FIELDS.includes(key))) {
    return "One or more unsupported product fields were provided.";
  }

  if (!isUpdate) {
    if (
      !isNonEmptyString(body.title) ||
      !isNonEmptyString(body.description) ||
      !isNonEmptyString(body.category) ||
      parsePrice(body.price) === null
    ) {
      return "Valid title, description, category, and price are required.";
    }
  } else if (keys.length === 0) {
    return "Provide at least one field to update.";
  }

  if (
    "title" in body &&
    (!isNonEmptyString(body.title) || body.title.trim().length > 200)
  ) {
    return "Title must contain 1–200 characters.";
  }

  if (
    "description" in body &&
    (!isNonEmptyString(body.description) ||
      body.description.trim().length > 5000)
  ) {
    return "Description must contain 1–5000 characters.";
  }

  if (
    "category" in body &&
    (!isNonEmptyString(body.category) || body.category.trim().length > 100)
  ) {
    return "Category must contain 1–100 characters.";
  }

  if ("price" in body && parsePrice(body.price) === null) {
    return "Price must be a non-negative number with at most 2 decimals.";
  }

  if ("stock" in body && parseStock(body.stock) === null) {
    return "Stock must be a non-negative whole number.";
  }

  if ("image" in body && !isValidImage(body.image)) {
    return "Image must be a valid HTTP or HTTPS URL.";
  }

  return null;
}

function normalizeProductInput(body) {
  const result = {};

  for (const field of ALLOWED_FIELDS) {
    if (body[field] === undefined) continue;

    if (["title", "description", "category"].includes(field)) {
      result[field] = body[field].trim();
    } else if (field === "price") {
      result[field] = parsePrice(body[field]);
    } else if (field === "stock") {
      result[field] = parseStock(body[field]);
    } else {
      result[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
    }
  }

  return result;
}

function parseIntParam(value, fallback, min, max) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const num = Number(value);
  return Math.min(Math.max(num, min), max);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- routes ----------

// GET: List products (public) with pagination, filter, search, sort
// Query: ?page=1&limit=20&category=Shoes&search=nike&sort=price_asc
router.get("/", async (req, res) => {
  try {
    const page = parseIntParam(req.query.page, 1, 1, 1000000);
    const limit = parseIntParam(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);

    const filter = {};

    if (
      typeof req.query.category === "string" &&
      req.query.category.trim() &&
      req.query.category.length <= 100
    ) {
      filter.category = req.query.category.trim();
    }

    if (
      typeof req.query.search === "string" &&
      req.query.search.trim() &&
      req.query.search.length <= 50
    ) {
      filter.title = {
        $regex: escapeRegex(req.query.search.trim()),
        $options: "i",
      };
    }

    const sort =
      typeof req.query.sort === "string" && SORT_OPTIONS[req.query.sort]
        ? SORT_OPTIONS[req.query.sort]
        : SORT_OPTIONS.newest;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    console.error("Fetch products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch products.",
    });
  }
});

// GET: Product details (public)
router.get("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Fetch product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch product.",
    });
  }
});

// POST: Create product (admin only)
router.post("/", authMiddleware, allowRoles("admin"), async (req, res) => {
  const validationError = validateProductInput(req.body);

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  try {
    const product = await Product.create(normalizeProductInput(req.body));

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Product data failed validation.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create product.",
    });
  }
});

// PUT: Update product (admin only)
router.put("/:id", authMiddleware, allowRoles("admin"), async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID.",
    });
  }

  const validationError = validateProductInput(req.body, true);

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  try {
    const updates = normalizeProductInput(req.body);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error.message);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Product data is invalid.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update product.",
    });
  }
});

// DELETE: Delete product (admin only)
router.delete("/:id", authMiddleware, allowRoles("admin"), async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID.",
    });
  }

  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
      product,
    });
  } catch (error) {
    console.error("Delete product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete product.",
    });
  }
});

module.exports = router;