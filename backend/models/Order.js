const mongoose = require("mongoose");

const MAX_ITEMS_PER_ORDER = 50;
const MAX_QUANTITY_PER_ITEM = 100;

// Round to 2 decimals on assignment (avoids 59.970000000000006)
const round2 = (value) =>
  typeof value === "number" ? Math.round(value * 100) / 100 : value;

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      set: round2,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_QUANTITY_PER_ITEM,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number.",
      },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator(items) {
          return (
            Array.isArray(items) &&
            items.length > 0 &&
            items.length <= MAX_ITEMS_PER_ORDER
          );
        },
        message: `An order must contain 1–${MAX_ITEMS_PER_ORDER} items.`,
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      set: round2,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentProvider: {
      type: String,
      enum: ["stripe", "cash_on_delivery"],
      default: "cash_on_delivery",
    },

    // Stripe linkage (set by the server / webhook only, never from req.body)
    stripeSessionId: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    paymentIntentId: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    paidAt: {
      type: Date,
    },

    // Client-generated key (e.g. UUID) to stop duplicate orders on double click / retry
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },
      addressLine: {
        type: String,
        required: true,
        trim: true,
        maxlength: 250,
      },
      city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },
      postalCode: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20,
      },
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

// One order per (user, idempotencyKey)
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

// A Stripe session / payment intent can belong to only one order
orderSchema.index(
  { stripeSessionId: 1 },
  { unique: true, partialFilterExpression: { stripeSessionId: { $type: "string" } } }
);
orderSchema.index(
  { paymentIntentId: 1 },
  { unique: true, partialFilterExpression: { paymentIntentId: { $type: "string" } } }
);

module.exports = mongoose.model("Order", orderSchema);