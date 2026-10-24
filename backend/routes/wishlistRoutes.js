const express = require("express");
const rateLimit = require("express-rate-limit");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/product");
const authMiddleware = require("../middleware/authMiddleware");

// Mounted at /api/wishlist 
const router = express.Router();

const { MAX_ITEMS } = Wishlist;

const isValidId = (id) => typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);

// Limits wishlist requests per logged-in user
const wishlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || "anonymous",
  message: {
    success: false,
    message: "Too many wishlist requests. Try again later.",
  },
});

router.use(authMiddleware, wishlistLimiter);

async function currentIds(userId) {
  const wishlist = await Wishlist.findOne({ user: userId })
    .select("products")
    .lean();

  return (wishlist?.products || []).map(String);
}

// GET /api/wishlist

router.get("/", async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.userId })
      .populate("products")
      .lean();

    // Products that were deleted from the store are skipped
    const products = (wishlist?.products || []).filter(Boolean);

    return res.status(200).json({
      success: true,
      products,
      count: products.length,
    });
  } catch (error) {
    console.error("Get wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load your wishlist.",
    });
  }
});

// POST /api/wishlist/merge
// Adds the products a visitor saved before logging in.

router.post("/merge", async (req, res) => {
  try {
    const { productIds } = req.body || {};

    if (!Array.isArray(productIds) || productIds.length > MAX_ITEMS) {
      return res.status(400).json({
        success: false,
        message: `productIds must be a list of at most ${MAX_ITEMS} product IDs.`,
      });
    }

    const ids = [
      ...new Set(
        productIds.filter(isValidId).map((id) => id.toLowerCase())
      ),
    ];

    const have = new Set(await currentIds(req.user.userId));

    if (ids.length > 0) {
      const existing = await Product.find({ _id: { $in: ids } })
        .select("_id")
        .lean();

      const toAdd = existing
        .map((p) => String(p._id))
        .filter((id) => !have.has(id))
        .slice(0, Math.max(0, MAX_ITEMS - have.size));

      if (toAdd.length > 0) {
        await Wishlist.updateOne(
          { user: req.user.userId },
          { $addToSet: { products: { $each: toAdd } } },
          { upsert: true }
        );

        toAdd.forEach((id) => have.add(id));
      }
    }

    return res.status(200).json({
      success: true,
      message: "Wishlist updated.",
      count: have.size,
    });
  } catch (error) {
    console.error("Merge wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update your wishlist.",
    });
  }
});

// POST /api/wishlist/:productId   

router.post("/:productId", async (req, res) => {
  try {
    if (!isValidId(req.params.productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const productId = req.params.productId.toLowerCase();

    if (!(await Product.exists({ _id: productId }))) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const have = await currentIds(req.user.userId);
    const alreadySaved = have.includes(productId);

    if (!alreadySaved && have.length >= MAX_ITEMS) {
      return res.status(400).json({
        success: false,
        message: `Your wishlist is full (maximum ${MAX_ITEMS} products).`,
      });
    }

    await Wishlist.updateOne(
      { user: req.user.userId },
      { $addToSet: { products: productId } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Added to wishlist.",
      count: alreadySaved ? have.length : have.length + 1,
    });
  } catch (error) {
    console.error("Add to wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update your wishlist.",
    });
  }
});

// DELETE /api/wishlist/:productId   

router.delete("/:productId", async (req, res) => {
  try {
    if (!isValidId(req.params.productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user.userId },
      { $pull: { products: req.params.productId.toLowerCase() } },
      { returnDocument: "after" }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Removed from wishlist.",
      count: wishlist?.products?.length || 0,
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update your wishlist.",
    });
  }
});

module.exports = router;