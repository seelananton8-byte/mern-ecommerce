const mongoose = require("mongoose");

const MAX_ITEMS = 100;

const wishlistSchema = new mongoose.Schema(
  {
    // One wishlist per user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    products: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
      validate: {
        validator: (list) => list.length <= MAX_ITEMS,
        message: `A wishlist can hold at most ${MAX_ITEMS} products.`,
      },
    },
  },
  { timestamps: true }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
Wishlist.MAX_ITEMS = MAX_ITEMS;

module.exports = Wishlist;