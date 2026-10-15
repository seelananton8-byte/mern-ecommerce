const express = require("express");
const Stripe = require("stripe");
const Order = require("../models/Order");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
    error.status = 503;
    throw error;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function safeOrderQuery() {
  return "-stripeSessionId -paymentIntentId -idempotencyKey";
}

// The order must already exist and its amount/items are always read from MongoDB.
router.post("/checkout-session", authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (typeof orderId !== "string" || !/^[a-f\d]{24}$/i.test(orderId)) {
      return res.status(400).json({ success: false, message: "A valid orderId is required." });
    }
    const order = await Order.findOne({ _id: orderId, user: req.user.userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.paymentProvider !== "stripe") {
      return res.status(409).json({ success: false, message: "This order is not configured for Stripe." });
    }
    if (order.paymentStatus === "paid" || order.status === "cancelled") {
      return res.status(409).json({ success: false, message: "This order cannot be paid." });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const stripe = getStripe();

    // Reuse an open session if the user double-clicks or retries the request.
    if (order.stripeSessionId) {
      try {
        const previousSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (previousSession.status === "open" && previousSession.url) {
          return res.status(200).json({ success: true, checkoutUrl: previousSession.url, sessionId: previousSession.id });
        }
        if (previousSession.payment_status === "paid") {
          return res.status(409).json({ success: false, message: "This order has already been paid." });
        }
      } catch (retrieveError) {
        // A stale session ID must not prevent a new session from being created.
        console.warn("Could not retrieve previous Stripe session:", retrieveError.message);
      }
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: (process.env.STRIPE_CURRENCY || "inr").toLowerCase(),
            unit_amount: Math.round(item.price * 100),
            product_data: { name: item.title },
          },
        })),
        metadata: { orderId: String(order._id), userId: String(order.user) },
        client_reference_id: String(order._id),
        success_url: `${clientUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/checkout?payment=cancelled&order_id=${order._id}`,
      },
      { idempotencyKey: `checkout_${String(order._id)}_${Date.now()}` }
    );

    order.stripeSessionId = session.id;
    await order.save();
    return res.status(201).json({ success: true, checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Create Stripe checkout error:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to start Stripe checkout.",
    });
  }
});

// Frontend may call this after redirect; webhook remains the source of truth.
router.get("/session-status", authMiddleware, async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return res.status(400).json({ success: false, message: "A valid session_id is required." });
    }
    const order = await Order.findOne({ user: req.user.userId, stripeSessionId: sessionId }).select(safeOrderQuery());
    if (!order) return res.status(404).json({ success: false, message: "Payment order not found." });
    const stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
    return res.json({
      success: true,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      checkoutPaymentStatus: stripeSession.payment_status,
    });
  } catch (error) {
    console.error("Stripe session status error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to verify payment status." });
  }
});

module.exports = router;
