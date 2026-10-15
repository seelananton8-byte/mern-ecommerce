const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/product");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function validateShippingAddress(address) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return false;
  }

  const fields = ["fullName", "addressLine", "city", "postalCode"];

  return fields.every(
    (field) =>
      typeof address[field] === "string" &&
      address[field].trim().length > 0
  ) &&
    address.fullName.trim().length <= 100 &&
    address.addressLine.trim().length <= 250 &&
    address.city.trim().length <= 100 &&
    address.postalCode.trim().length <= 20;
}

// Create an order for the authenticated user
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, shippingAddress, paymentProvider } = req.body || {};

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50 ||
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

    const requestedItems = [];
    const quantitiesByProduct = new Map();

    for (const item of items) {
      if (
        !item ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Each item must have a valid product ID and quantity.",
        });
      }

      const productId = item.productId.toString();
      const combinedQuantity =
        (quantitiesByProduct.get(productId) || 0) + item.quantity;

      if (combinedQuantity > 100) {
        return res.status(400).json({
          success: false,
          message: "Requested quantity exceeds the allowed limit.",
        });
      }

      quantitiesByProduct.set(productId, combinedQuantity);
    }

    const productIds = [...quantitiesByProduct.keys()];

    const products = await Product.find({
      _id: { $in: productIds },
    });

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    );

    let totalAmount = 0;

    for (const [productId, quantity] of quantitiesByProduct) {
      const product = productMap.get(productId);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: "One or more products could not be found.",
        });
      }

      if (product.stock < quantity) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.title}.`,
        });
      }

      requestedItems.push({
        product: product._id,
        title: product.title,
        price: product.price,
        quantity,
      });

      totalAmount += product.price * quantity;
    }

    const order = await Order.create({
      user: req.user.userId,
      items: requestedItems,
      totalAmount: Math.round(totalAmount * 100) / 100,
      shippingAddress: {
        fullName: shippingAddress.fullName.trim(),
        addressLine: shippingAddress.addressLine.trim(),
        city: shippingAddress.city.trim(),
        postalCode: shippingAddress.postalCode.trim(),
      },
      paymentProvider: paymentProvider || "cash_on_delivery",
      paymentStatus: "pending",
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order,
    });
  } catch (error) {
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

// Get only the authenticated user's orders
router.get("/", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("items.product", "title image");

    return res.status(200).json({
      success: true,
      count: orders.length,
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

// Get one order only if it belongs to the authenticated user
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.userId,
    }).populate("items.product", "title image");

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

module.exports = router;