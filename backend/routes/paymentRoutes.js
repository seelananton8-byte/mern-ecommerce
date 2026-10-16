const express = require("express");
const Stripe = require("stripe");
const Order = require("../models/Order");
const authMiddleware = require("../middleware/authMiddleware");
const { emitOrderUpdate } = require("../socket");

const router = express.Router();

// DEMO mode: no Stripe account needed. A fake card page marks the order as paid.
// Active when PAYMENT_MODE=demo OR when STRIPE_SECRET_KEY is not set.
const isDemoMode = () =>
  process.env.PAYMENT_MODE === "demo" || !process.env.STRIPE_SECRET_KEY;

router.get("/config", (req, res) => {
  res.json({ success: true, mode: isDemoMode() ? "demo" : "stripe" });
});

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

    if (isDemoMode()) {
      return res.status(200).json({ success: true, demo: true, orderId: String(order._id) });
    }

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

// DEMO payment: simulates a card payment (only when demo mode is on).
// Card 4000 0000 0000 0002 is declined, any other valid-looking card succeeds.
router.post("/demo-pay", authMiddleware, async (req, res) => {
  try {
    if (!isDemoMode()) {
      return res.status(403).json({ success: false, message: "Demo payments are disabled." });
    }
    const { orderId, cardNumber } = req.body || {};
    if (typeof orderId !== "string" || !/^[a-f\d]{24}$/i.test(orderId)) {
      return res.status(400).json({ success: false, message: "A valid orderId is required." });
    }
    const digits = String(cardNumber || "").replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) {
      return res.status(400).json({ success: false, message: "Enter a valid card number." });
    }
    if (digits === "4000000000000002") {
      return res.status(402).json({ success: false, message: "Your card was declined (demo)." });
    }
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        user: req.user.userId,
        paymentProvider: "stripe",
        paymentStatus: { $ne: "paid" },
        status: "pending",
      },
      {
        $set: {
          paymentStatus: "paid",
          paidAt: new Date(),
          status: "confirmed",
          paymentIntentId: `demo_pi_${orderId}`,
        },
        $push: { statusHistory: { status: "confirmed" } },
      },
      { new: true }
    ).select(safeOrderQuery());
    if (!order) {
      return res.status(409).json({ success: false, message: "This order cannot be paid." });
    }
    emitOrderUpdate(req.app.get("io"), order, "paid");
    return res.json({ success: true, message: "Demo payment successful.", order });
  } catch (error) {
    console.error("Demo payment error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to process demo payment." });
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
