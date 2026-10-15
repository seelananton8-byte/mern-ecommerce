const mongoose = require("mongoose");

const MAX_PRICE = 10000000; // 1 crore
const MAX_STOCK = 1000000;

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_PRICE,
      validate: {
        // finite number with at most 2 decimal places (needed for safe
        // conversion to the smallest currency unit for Stripe)
        validator(value) {
          return (
            Number.isFinite(value) &&
            Math.round(value * 100) / 100 === value
          );
        },
        message: "Price must be a valid number with at most 2 decimal places.",
      },
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    image: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2048,
      validate: {
        validator(value) {
          if (!value) return true;

          try {
            const url = new URL(value);
            return (
              ["http:", "https:"].includes(url.protocol) &&
              Boolean(url.hostname)
            );
          } catch {
            return false;
          }
        },
        message: "Image must be a valid HTTP or HTTPS URL.",
      },
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
      max: MAX_STOCK,
      validate: {
        validator(value) {
          return Number.isInteger(value);
        },
        message: "Stock must be a whole number.",
      },
    },
  },
  { timestamps: true }
);

// Indexes for faster listing / filtering / search
productSchema.index({ category: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Product", productSchema);