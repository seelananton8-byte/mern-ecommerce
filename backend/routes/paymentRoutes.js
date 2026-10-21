const crypto = require("crypto");
const express = require("express");
const Order = require("../models/Order");
const authMiddleware = require("../middleware/authMiddleware");
const { emitOrderUpdate } = require("../socket");
const {
  expireUnpaidOrder,
  getStripe,
  getStripeCurrency,
  isDemoMode,
  isStripeSessionForOrder,
  markOrderPaid,
} = require("../services/paymentService");

const router = express.Router();
const SAFE_ORDER_SELECT = "-stripeSessionId -paymentIntentId -idempotencyKey";

router.get("/config", (req, res) => {
  if (isDemoMode()) {
    return res.json({ success: true, mode: "demo" });
  }
  try {
    getStripe();
    getStripeCurrency();
    return res.json({ success: true, mode: "stripe" });
  } catch (error) {
    return res.status(error.status || 503).json({
      success: false,
      message: error.message,
    });
  }
});

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
    const currency = getStripeCurrency();

    // Reuse a session after checking it against the persisted order.
    if (order.stripeSessionId) {
      let previousSession;
      try {
        previousSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      } catch (retrieveError) {
        console.error("Could not verify existing Stripe session:", retrieveError.message);
        return res.status(503).json({
          success: false,
          message: "Unable to verify the existing payment session.",
        });
      }

      if (!isStripeSessionForOrder(order, previousSession, currency)) {
        return res.status(409).json({
          success: false,
          message: "The existing payment session does not match this order.",
        });
      }

      if (previousSession.status === "expired") {
        await expireUnpaidOrder(previousSession, req.app.get("io"));
        return res.status(409).json({
          success: false,
          message: "This payment session expired. Please place a new order.",
        });
      }

      if (previousSession.status === "open" && previousSession.url) {
        return res.status(200).json({
          success: true,
          checkoutUrl: previousSession.url,
          sessionId: previousSession.id,
        });
      }

      if (
        previousSession.status === "complete" &&
        previousSession.payment_status === "paid"
      ) {
        await markOrderPaid({ order, session: previousSession, currency, io: req.app.get("io") });
        return res.status(409).json({
          success: false,
          message: "This order has already been paid.",
        });
      }

      return res.status(409).json({
        success: false,
        message: "This payment session is no longer open. Please place a new order.",
      });
    }

    const lineItems = order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency,
        unit_amount: Math.round(item.price * 100),
        product_data: { name: item.title },
      },
    }));

    // Hash of the request params: same params => same key
    // changed params => new key
    const paramsHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ lineItems, currency }))
      .digest("hex")
      .slice(0, 12);

    // Payment methods are managed from the Stripe Dashboard.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        metadata: { orderId: String(order._id), userId: String(order.user) },
        client_reference_id: String(order._id),
        success_url: `${clientUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/checkout?payment=cancelled&order_id=${order._id}`,
      },
      { idempotencyKey: `checkout_${String(order._id)}_${paramsHash}` }
    );

    order.stripeSessionId = session.id;
    await order.save();
    return res.status(201).json({ success: true, checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Create Stripe checkout error:", error.message);
    const status =
      error.status ||
      (error.type === "StripeAuthenticationError" ? 503 : 500);
    return res.status(status).json({
      success: false,
      message: status === 503
        ? "Stripe is not configured or available."
        : "Unable to start Stripe checkout.",
    });
  }
});

// DEMO payment: simulates a card payment
router.post("/demo-pay", authMiddleware, async (req, res) => {
  try {
    if (!isDemoMode()) {
      return res.status(403).json({ success: false, message: "Demo payments are disabled." });
    }
    const { orderId, cardNumber } = req.body || {};
    if (typeof orderId !== "string" || !/^[a-f\d]{24}$/i.test(orderId)) {
      return res.status(400).json({ success: false, message: "A valid orderId is required." });
    }
    if (typeof cardNumber !== "string") {
      return res.status(400).json({ success: false, message: "Enter a valid card number." });
    }
    const digits = cardNumber.replace(/\D/g, "");
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
        paymentStatus: "pending",
        status: "pending",
        stripeSessionId: { $exists: false },
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
      { returnDocument: "after" }
    ).select(SAFE_ORDER_SELECT);
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

// The live Stripe session is verified server-side after the Checkout redirect.
router.get("/session-status", authMiddleware, async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return res.status(400).json({ success: false, message: "A valid session_id is required." });
    }
    const order = await Order.findOne({
      user: req.user.userId,
      stripeSessionId: sessionId,
      paymentProvider: "stripe",
    });
    if (!order) return res.status(404).json({ success: false, message: "Payment order not found." });
    const stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
    const currency = getStripeCurrency();

    if (!isStripeSessionForOrder(order, stripeSession, currency)) {
      return res.status(409).json({
        success: false,
        message: "Stripe could not verify this session for the order.",
      });
    }

    let currentOrder = order;
    if (stripeSession.status === "complete" && stripeSession.payment_status === "paid") {
      currentOrder = await markOrderPaid({
        order,
        session: stripeSession,
        currency,
        io: req.app.get("io"),
      }) || await Order.findById(order._id).select(SAFE_ORDER_SELECT);
      if (!currentOrder || currentOrder.paymentStatus !== "paid") {
        return res.status(409).json({
          success: false,
          message: "Payment was received but the order could not be confirmed.",
        });
      }
    } else if (stripeSession.status === "expired") {
      await expireUnpaidOrder(stripeSession, req.app.get("io"));
      currentOrder = await Order.findById(order._id).select(SAFE_ORDER_SELECT);
    }

    if (!currentOrder) {
      return res.status(404).json({ success: false, message: "Payment order not found." });
    }

    if (
      stripeSession.payment_status !== "paid" &&
      currentOrder.paymentStatus === "paid"
    ) {
      return res.status(409).json({
        success: false,
        message: "Stripe has not verified payment for this order.",
      });
    }

    // Private fields were needed for verification
    const safeOrder = currentOrder.toObject();
    delete safeOrder.stripeSessionId;
    delete safeOrder.paymentIntentId;
    delete safeOrder.idempotencyKey;

    return res.json({
      success: true,
      verified: true,
      paymentStatus: currentOrder.paymentStatus,
      orderStatus: currentOrder.status,
      checkoutPaymentStatus: stripeSession.payment_status,
      order: safeOrder,
    });
  } catch (error) {
    console.error("Stripe session status error:", error.message);
    const status =
      error.status ||
      (error.type === "StripeAuthenticationError" ? 503 : 500);
    return res.status(status).json({
      success: false,
      message: status === 503
        ? "Stripe is not configured or available."
        : "Unable to verify payment status.",
    });
  }
});

module.exports = router;