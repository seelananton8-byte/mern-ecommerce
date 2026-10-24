const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Review = require("../models/Review");
const Product = require("../models/product");
const Order = require("../models/Order");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// Mounted at /api/products/:productId/reviews
const router = express.Router({ mergeParams: true });

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const isValidId = (id) => typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);

// Limits review writes per logged-in user
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || "anonymous",
  message: {
    success: false,
    message: "Too many review requests. Try again later.",
  },
});

function parseRating(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^[1-5]$/.test(value.trim())) {
    return Number(value.trim());
  }
  return NaN;
}

async function getSummary(productId) {
  const rows = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;

  for (const row of rows) {
    distribution[row._id] = row.count;
    count += row.count;
    sum += row._id * row.count;
  }

  return {
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    distribution,
  };
}

const toDto = (review, name, verifiedPurchase) => ({
  id: String(review._id),
  name: name || "Customer",
  rating: review.rating,
  comment: review.comment,
  verifiedPurchase: Boolean(verifiedPurchase),
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

// Every route needs a valid, existing product
router.use(async (req, res, next) => {
  const { productId } = req.params;

  if (!isValidId(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID.",
    });
  }

  try {
    const exists = await Product.exists({ _id: productId });

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return next();
  } catch (error) {
    console.error("Review product lookup error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process the request.",
    });
  }
});

// GET /api/products/:productId/reviews 

router.get("/", async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE)
    );
    const filter = { product: productId };

    const [total, reviews, summary, buyerIds] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name")
        .lean(),
      getSummary(productId),
      // Customers who ordered this product
      Order.distinct("user", {
        "items.product": productId,
        status: { $ne: "cancelled" },
      }),
    ]);

    const buyers = new Set(buyerIds.map(String));

    return res.status(200).json({
      success: true,
      reviews: reviews.map((review) =>
        toDto(review, review.user?.name, buyers.has(String(review.user?._id)))
      ),
      summary,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
    });
  } catch (error) {
    console.error("List reviews error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load reviews.",
    });
  }
});

// GET /api/products/:productId/reviews

router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;

    const review = await Review.findOne({
      product: productId,
      user: req.user.userId,
    })
      .populate("user", "name")
      .lean();

    if (!review) {
      return res.status(200).json({ success: true, review: null });
    }

    const verified = await Order.exists({
      user: req.user.userId,
      "items.product": productId,
      status: { $ne: "cancelled" },
    });

    return res.status(200).json({
      success: true,
      review: toDto(review, review.user?.name, verified),
    });
  } catch (error) {
    console.error("My review error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load your review.",
    });
  }
});

// POST /api/products/:productId/reviews 
// Creates the review, or updates the user's existing one.

router.post("/", authMiddleware, writeLimiter, async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body || {};

    const ratingNumber = parseRating(rating);

    if (!Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number from 1 to 5.",
      });
    }

    if (typeof comment !== "string") {
      return res.status(400).json({
        success: false,
        message: "Review text is required.",
      });
    }

    const text = comment.trim();

    if (text.length < 3 || text.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Review must be between 3 and 1000 characters.",
      });
    }

    let review = await Review.findOne({
      product: productId,
      user: req.user.userId,
    });
    const isNew = !review;

    if (review) {
      review.rating = ratingNumber;
      review.comment = text;
      await review.save();
    } else {
      review = await Review.create({
        product: productId,
        user: req.user.userId,
        rating: ratingNumber,
        comment: text,
      });
    }

    const [user, verified, summary] = await Promise.all([
      User.findById(req.user.userId).select("name").lean(),
      Order.exists({
        user: req.user.userId,
        "items.product": productId,
        status: { $ne: "cancelled" },
      }),
      getSummary(productId),
    ]);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? "Review added." : "Review updated.",
      review: toDto(review, user?.name, verified),
      summary,
    });
  } catch (error) {
    // Two requests at the same time can hit the unique index
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product.",
      });
    }

    console.error("Save review error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save your review.",
    });
  }
});

// DELETE /api/products/:productId/reviews/:reviewId
// The author or an admin can delete a review.

router.delete("/:reviewId", authMiddleware, writeLimiter, async (req, res) => {
  try {
    const { productId, reviewId } = req.params;

    if (!isValidId(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID.",
      });
    }

    const review = await Review.findOne({ _id: reviewId, product: productId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    const isOwner = String(review.user) === req.user.userId;

    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own review.",
      });
    }

    await review.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Review deleted.",
      summary: await getSummary(productId),
    });
  } catch (error) {
    console.error("Delete review error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete the review.",
    });
  }
});

module.exports = router;