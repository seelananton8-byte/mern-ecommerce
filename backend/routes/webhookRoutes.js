const express = require("express");
const Order = require("../models/Order");
const {
  expireUnpaidOrder,
  getStripe,
  getStripeCurrency,
  isValidStripeSecretKey,
  isValidStripeWebhookSecret,
  markOrderPaid,
} = require("../services/paymentService");

const router = express.Router();

async function markPaid(session, io) {
  const orderId = session.metadata && session.metadata.orderId;
  if (!orderId || !/^[a-f\d]{24}$/i.test(orderId)) return;
  const verifiedSession = await getStripe().checkout.sessions.retrieve(session.id);
  const order = await Order.findOne({
    _id: orderId,
    stripeSessionId: verifiedSession.id,
    paymentProvider: "stripe",
  });
  if (!order) return;
  if (verifiedSession.id !== session.id) return;

  const updated = await markOrderPaid({
    order,
    session: verifiedSession,
    currency: getStripeCurrency(),
    io,
  });
  if (!updated && order.paymentStatus !== "paid") {
    console.warn("Stripe paid session did not match its pending order.");
  }
}

router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (
    !isValidStripeSecretKey(process.env.STRIPE_SECRET_KEY) ||
    !isValidStripeWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET)
  ) {
    return res.status(503).json({ success: false, message: "Stripe webhook is not configured." });
  }
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return res.status(503).json({ success: false, message: "Stripe webhook is not configured." });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error.message);
    return res.status(400).json({ success: false, message: "Invalid Stripe webhook signature." });
  }

  try {
    const io = req.app.get("io");
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status === "paid") await markPaid(session, io);
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await expireUnpaidOrder(event.data.object, io);
        break;
      default:
        break;
    }
    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error.message);
    return res.status(500).json({ success: false, message: "Webhook processing failed." });
  }
});

module.exports = router;