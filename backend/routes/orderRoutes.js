const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Order = require("../models/Order");
const Product = require("../models/product");
const authMiddleware = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { emitOrderUpdate } = require("../socket");

const router = express.Router();

const MAX_ITEMS = 50;
const MAX_QUANTITY = 100;
const MAX_LIMIT = 100;

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

// Allowed status transitions but (cancel is handled separately, it restores stock)
const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const USER_CANCELLABLE = ["pending"];
const ADMIN_CANCELLABLE = ["pending", "confirmed", "processing"];

// Never send these to API clients
const SAFE_SELECT = "-stripeSessionId -paymentIntentId -idempotencyKey";

// helpers

class HttpError extends Error {
  constructor(httpStatus, message) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

function isValidId(id) {
  return typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
}

function parseIntParam(value, fallback, min, max) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  return Math.min(Math.max(Number(value), min), max);
}

function validateShippingAddress(address) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return false;
  }

  const fields = ["fullName", "addressLine", "city", "postalCode"];

  return (
    fields.every(
      (field) =>
        typeof address[field] === "string" &&
        address[field].trim().length > 0
    ) &&
    address.fullName.trim().length <= 100 &&
    address.addressLine.trim().length <= 250 &&
    address.city.trim().length <= 100 &&
    address.postalCode.trim().length <= 20
  );
}

// Limits order creation per user (stops stock hoarding / spam)
const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.userId) || "anonymous",
  message: {
    success: false,
    message: "Too many orders created. Please try again later.",
  },
});

// cancel an order and put the stock back.
// Returns the cancelled order
async function cancelOrderAndRestoreStock({ orderId, userId, allowedStatuses }) {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      result = null;

      const filter = {
        _id: orderId,
        status: { $in: allowedStatuses },
        paymentStatus: { $ne: "paid" }, // paid orders need a Stripe refund first
        $or: [
          { paymentProvider: { $ne: "stripe" } },
          { stripeSessionId: { $exists: false } },
          { stripeSessionId: null },
        ],
      };
      if (userId) filter.user = userId;

      const order = await Order.findOneAndUpdate(
        filter,
        {
          $set: { status: "cancelled" },
          $push: { statusHistory: { status: "cancelled" } },
        },
        { new: true, session }
      );

      if (!order) return;

      await Product.bulkWrite(
        order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: item.quantity } },
          },
        })),
        { session }
      );

      result = order;
    });

    return result;
  } finally {
    await session.endSession();
  }
}


// POST: Create an order
router.post("/", authMiddleware, createOrderLimiter, async (req, res) => {
  const body = req.body || {};
  const { items, shippingAddress, paymentProvider } = body;

  const idempotencyKey = req.get("Idempotency-Key") || body.idempotencyKey;

  if (
    idempotencyKey !== undefined &&
    (typeof idempotencyKey !== "string" ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey))
  ) {
    return res.status(400).json({
      success: false,
      message: "Idempotency key must be 8–100 letters, numbers, - or _.",
    });
  }

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > MAX_ITEMS ||
    !validateShippingAddress(shippingAddress)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid order items and shipping address are required.",
    });
  }

  if (
    paymentProvider !== undefined &&
    !["stripe", "cash_on_delivery"].includes(paymentProvider)
  ) {
    return res.status(400).json({
      success: false,
      message: "Unsupported payment provider.",
    });
  }

  const quantitiesByProduct = new Map();

  for (const item of items) {
    if (
      !item ||
      !isValidId(item.productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > MAX_QUANTITY
    ) {
      return res.status(400).json({
        success: false,
        message: "Each item must have a valid product ID and quantity.",
      });
    }

    const total = (quantitiesByProduct.get(item.productId) || 0) + item.quantity;

    if (total > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds the allowed limit.",
      });
    }

    quantitiesByProduct.set(item.productId, total);
  }

  try {
    // Same key + same user => return the order already created
    if (idempotencyKey) {
      const existing = await Order.findOne({
        user: req.user.userId,
        idempotencyKey,
      }).select(SAFE_SELECT);

      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Order already created.",
          order: existing,
        });
      }
    }

    const session = await mongoose.startSession();
    let createdOrderId;

    try {
      await session.withTransaction(async () => {
        const orderItems = [];
        let totalCents = 0;

        // Stable order avoids deadlocks / write conflicts
        const entries = [...quantitiesByProduct.entries()].sort((a, b) =>
          a[0].localeCompare(b[0])
        );

        for (const [productId, quantity] of entries) {
          // conditional update: stock can never go below zero
          const product = await Product.findOneAndUpdate(
            { _id: productId, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { new: false, session }
          );

          if (!product) {
            const exists = await Product.exists({ _id: productId }).session(
              session
            );

            throw exists
              ? new HttpError(409, "Insufficient stock for one or more products.")
              : new HttpError(400, "One or more products could not be found.");
          }

          orderItems.push({
            product: product._id,
            title: product.title,
            price: product.price,
            quantity,
          });

          totalCents += Math.round(product.price * 100) * quantity;
        }

        const orderData = {
          user: req.user.userId,
          items: orderItems,
          totalAmount: totalCents / 100,
          shippingAddress: {
            fullName: shippingAddress.fullName.trim(),
            addressLine: shippingAddress.addressLine.trim(),
            city: shippingAddress.city.trim(),
            postalCode: shippingAddress.postalCode.trim(),
            phone:
              typeof shippingAddress.phone === "string"
                ? shippingAddress.phone.trim().slice(0, 20)
                : undefined,
          },
          paymentProvider: paymentProvider || "cash_on_delivery",
          paymentStatus: "pending",
          status: "pending",
          statusHistory: [{ status: "pending" }],
        };

        if (idempotencyKey) orderData.idempotencyKey = idempotencyKey;

        const [order] = await Order.create([orderData], { session });
        createdOrderId = order._id;
      });
    } finally {
      await session.endSession();
    }

    const order = await Order.findById(createdOrderId).select(SAFE_SELECT);
    emitOrderUpdate(req.app.get("io"), order, "created");

    return res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.httpStatus).json({
        success: false,
        message: error.message,
      });
    }

    // Two requests with the same idempotency key
    if (error.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({
        user: req.user.userId,
        idempotencyKey,
      }).select(SAFE_SELECT);

      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Order already created.",
          order: existing,
        });
      }
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Order details are invalid.",
      });
    }

    console.error("Create order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create order.",
    });
  }
});

// GET: Admin - list all orders
// NOTE: must stay above "/:id"
router.get("/admin/all", authMiddleware, allowRoles("admin"), async (req, res) => {
  try {
    const page = parseIntParam(req.query.page, 1, 1, 1000000);
    const limit = parseIntParam(req.query.limit, 20, 1, MAX_LIMIT);

    const filter = {};
    if (
      typeof req.query.status === "string" &&
      ORDER_STATUSES.includes(req.query.status)
    ) {
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select(SAFE_SELECT)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email")
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    console.error("Admin list orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch orders.",
    });
  }
});

// GET: The authenticated user's own orders
router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = parseIntParam(req.query.page, 1, 1, 1000000);
    const limit = parseIntParam(req.query.limit, 50, 1, MAX_LIMIT);

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user.userId })
        .select(SAFE_SELECT)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("items.product", "title image"),
      Order.countDocuments({ user: req.user.userId }),
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    console.error("Get orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch orders.",
    });
  }
});

// GET: One order, only if it belongs to the authenticated user
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.userId,
    })
      .select(SAFE_SELECT)
      .populate("items.product", "title image");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch order.",
    });
  }
});

// PATCH: User cancels own order
router.patch("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await cancelOrderAndRestoreStock({
      orderId: req.params.id,
      userId: req.user.userId,
      allowedStatuses: USER_CANCELLABLE,
    });

    if (!order) {
      const exists = await Order.exists({
        _id: req.params.id,
        user: req.user.userId,
      });

      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists
          ? "This order can no longer be cancelled."
          : "Order not found.",
      });
    }

    const safeOrder = await Order.findById(order._id).select(SAFE_SELECT);
    emitOrderUpdate(req.app.get("io"), safeOrder, "cancelled");
    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      order: safeOrder,
    });
  } catch (error) {
    console.error("Cancel order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel order.",
    });
  }
});

// PATCH: Admin updates order status
router.patch("/:id/status", authMiddleware, allowRoles("admin"), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const { status } = req.body || {};

    if (typeof status !== "string" || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "A valid status is required.",
      });
    }

    const current = await Order.findById(req.params.id).select(
      "status paymentStatus paymentProvider"
    );

    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Cancel: restores stock
    if (status === "cancelled") {
      const cancelled = await cancelOrderAndRestoreStock({
        orderId: req.params.id,
        allowedStatuses: ADMIN_CANCELLABLE,
      });

      if (!cancelled) {
        return res.status(409).json({
          success: false,
          message:
            "This order cannot be cancelled (already shipped/closed, or paid and needs a refund).",
        });
      }

      const safeOrder = await Order.findById(cancelled._id).select(SAFE_SELECT);
      emitOrderUpdate(req.app.get("io"), safeOrder, "cancelled");
      return res.status(200).json({
        success: true,
        message: "Order cancelled and stock restored.",
        order: safeOrder,
      });
    }

    const fromStatuses = Object.keys(TRANSITIONS).filter((s) =>
      TRANSITIONS[s].includes(status)
    );

    if (!fromStatuses.includes(current.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change order from "${current.status}" to "${status}".`,
      });
    }

    // Online (Stripe) orders must be paid before they move forward
    if (
      current.paymentProvider === "stripe" &&
      current.paymentStatus !== "paid"
    ) {
      return res.status(409).json({
        success: false,
        message: "Payment has not been completed for this order.",
      });
    }

    const update = { status };

    // Cash on delivery is paid when delivered
    if (
      status === "delivered" &&
      current.paymentProvider === "cash_on_delivery" &&
      current.paymentStatus === "pending"
    ) {
      update.paymentStatus = "paid";
      update.paidAt = new Date();
    }

    const updated = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        status: current.status, // guards against a parallel change
        paymentStatus: current.paymentStatus,
      },
      { $set: update, $push: { statusHistory: { status } } },
      { new: true }
    ).select(SAFE_SELECT);

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "Order was changed by someone else. Please retry.",
      });
    }

    emitOrderUpdate(req.app.get("io"), updated, "status_changed");
    return res.status(200).json({
      success: true,
      message: "Order status updated.",
      order: updated,
    });
  } catch (error) {
    console.error("Update order status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update order status.",
    });
  }
});

module.exports = router;