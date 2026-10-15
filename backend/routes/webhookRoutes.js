const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { emitOrderUpdate } = require("../socket");

const router = express.Router();

async function markPaid(session, io) {
  const orderId = session.metadata && session.metadata.orderId;
  if (!orderId || !/^[a-f\d]{24}$/i.test(orderId)) return;
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent && session.payment_intent.id;

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentProvider: "stripe", stripeSessionId: session.id, paymentStatus: { $ne: "paid" }, status: { $ne: "cancelled" } },
    { $set: { paymentStatus: "paid", paidAt: new Date(), ...(paymentIntentId ? { paymentIntentId } : {}), status: "confirmed" } },
    { new: true }
  );
  if (updated) emitOrderUpdate(io, updated, "paid");
}

async function expireUnpaidOrder(session, io) {
  const orderId = session.metadata && session.metadata.orderId;
  if (!orderId || !/^[a-f\d]{24}$/i.test(orderId)) return;
  const mongoSession = await mongoose.startSession();
  let cancelled = null;
  try {
    await mongoSession.withTransaction(async () => {
      const order = await Order.findOneAndUpdate(
        { _id: orderId, stripeSessionId: session.id, paymentStatus: { $ne: "paid" }, status: { $in: ["pending"] } },
        { $set: { status: "cancelled", paymentStatus: "failed" } },
        { new: true, session: mongoSession }
      );
      if (!order) return;
      await Product.bulkWrite(order.items.map((item) => ({
        updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
      })), { session: mongoSession });
      cancelled = order;
    });
  } finally {
    await mongoSession.endSession();
  }
  if (cancelled) emitOrderUpdate(io, cancelled, "payment_failed");
}

router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ success: false, message: "Stripe webhook is not configured." });
  }
  let event;
  try {
    const Stripe = require("stripe");
    event = new Stripe(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
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
