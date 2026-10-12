const mongoose = require("mongoose");

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
      validate: {
        validator: Number.isFinite,
        message: "Price must be a valid number.",
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

module.exports = mongoose.model("Product", productSchema);