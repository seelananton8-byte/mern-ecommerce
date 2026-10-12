const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const ALLOWED_UPDATE_FIELDS = [
  "title",
  "description",
  "price",
  "category",
  "image",
  "stock",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidPrice(value) {
  return (
    value !== null &&
    value !== "" &&
    (typeof value === "number" || typeof value === "string") &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
  );
}

function isValidStock(value) {
  return (
    value !== null &&
    value !== "" &&
    (typeof value === "number" || typeof value === "string") &&
    Number.isInteger(Number(value)) &&
    Number(value) >= 0
  );
}

function isValidImage(value) {
  if (value === undefined || value === "") return true;
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateProductInput(body, isUpdate = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "A valid JSON object is required.";
  }

  const keys = Object.keys(body);

  if (keys.some((key) => !ALLOWED_UPDATE_FIELDS.includes(key))) {
    return "One or more unsupported product fields were provided.";
  }

  if (!isUpdate) {
    if (
      !isNonEmptyString(body.title) ||
      !isNonEmptyString(body.description) ||
      !isNonEmptyString(body.category) ||
      !isValidPrice(body.price)
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

  if ("price" in body && !isValidPrice(body.price)) {
    return "Price must be a valid non-negative number.";
  }

  if ("stock" in body && !isValidStock(body.stock)) {
    return "Stock must be a non-negative whole number.";
  }

  if (
    "image" in body &&
    !isValidImage(body.image)
  ) {
    return "Image must be a valid HTTP or HTTPS URL.";
  }

  return null;
}

function normalizeProductInput(body) {
  const result = {};

  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (body[field] === undefined) continue;

    if (["title", "description", "category"].includes(field)) {
      result[field] = body[field].trim();
    } else if (field === "price" || field === "stock") {
      result[field] = Number(body[field]);
    } else {
      result[field] = body[field];
    }
  }

  return result;
}

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

// GET: List products (public)
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
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