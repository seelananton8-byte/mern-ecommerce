const mongoose = require("mongoose");
const Stripe = require("stripe");
const Order = require("../models/Order");
const Product = require("../models/product");
const { emitOrderUpdate } = require("../socket");

const SECRET_KEY_PATTERN = /^sk_(test|live)_[A-Za-z0-9]{16,}$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]{16,}$/;

function isDemoMode(env = process.env) {
  return env.NODE_ENV !== "production" && env.PAYMENT_MODE === "demo";
}

function isValidStripeSecretKey(value) {
  return typeof value === "string" && SECRET_KEY_PATTERN.test(value);
}

function isValidStripeWebhookSecret(value) {
  return typeof value === "string" && WEBHOOK_SECRET_PATTERN.test(value);
}

function getStripe(env = process.env) {
  if (!isValidStripeSecretKey(env.STRIPE_SECRET_KEY)) {
    const error = new Error("Stripe is not configured with a valid secret key.");
    error.status = 503;
    throw error;
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}

function getStripeCurrency(env = process.env) {
  const currency = (env.STRIPE_CURRENCY || "inr").toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    const error = new Error("Stripe currency configuration is invalid.");
    error.status = 503;
    throw error;
  }
  return currency;
}

function expectedAmountCents(order) {
  if (!Array.isArray(order.items) || order.items.length === 0) return null;

  let totalCents = 0;
  for (const item of order.items) {
    if (
      !Number.isFinite(item.price) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return null;
    }
    totalCents += Math.round(item.price * 100) * item.quantity;
  }

  const storedTotalCents = Math.round(order.totalAmount * 100);
  return Number.isSafeInteger(totalCents) && totalCents === storedTotalCents
    ? totalCents
    : null;
}

function isStripeSessionForOrder(order, session, currency, requirePaid = false) {
  const amountCents = expectedAmountCents(order);
  const orderId = String(order._id);
  const userId = String(order.user?._id || order.user);

  if (
    amountCents === null ||
    !session ||
    session.id !== order.stripeSessionId ||
    session.mode !== "payment" ||
    session.currency !== currency ||
    session.amount_total !== amountCents ||
    session.metadata?.orderId !== orderId ||
    session.metadata?.userId !== userId ||
    session.client_reference_id !== orderId
  ) {
    return false;
  }

  return !requirePaid || (
    session.status === "complete" &&
    session.payment_status === "paid"
  );
}

async function markOrderPaid({
  OrderModel = Order,
  emitUpdate = emitOrderUpdate,
  order,
  session,
  currency = getStripeCurrency(),
  io,
}) {
  if (!isStripeSessionForOrder(order, session, currency, true)) return null;

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  const updated = await OrderModel.findOneAndUpdate(
    {
      _id: order._id,
      stripeSessionId: session.id,
      paymentProvider: "stripe",
      paymentStatus: "pending",
      status: "pending",
    },
    {
      $set: {
        paymentStatus: "paid",
        paidAt: new Date(),
        ...(paymentIntentId ? { paymentIntentId } : {}),
        status: "confirmed",
      },
      $push: { statusHistory: { status: "confirmed" } },
    },
    { new: true }
  );

  if (updated) emitUpdate(io, updated, "paid");
  return updated;
}

async function expireUnpaidOrder(session, io) {
  const orderId = session?.metadata?.orderId;
  if (!orderId || !/^[a-f\d]{24}$/i.test(orderId) || !session.id) return null;

  const mongoSession = await mongoose.startSession();
  let cancelled = null;
  try {
    await mongoSession.withTransaction(async () => {
      const order = await Order.findOneAndUpdate(
        {
          _id: orderId,
          stripeSessionId: session.id,
          paymentProvider: "stripe",
          paymentStatus: "pending",
          status: "pending",
        },
        {
          $set: { status: "cancelled", paymentStatus: "failed" },
          $push: { statusHistory: { status: "cancelled" } },
        },
        { new: true, session: mongoSession }
      );
      if (!order) return;

      await Product.bulkWrite(
        order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: item.quantity } },
          },
        })),
        { session: mongoSession }
      );
      cancelled = order;
    });
  } finally {
    await mongoSession.endSession();
  }

  if (cancelled) emitOrderUpdate(io, cancelled, "payment_failed");
  return cancelled;
}

module.exports = {
  expireUnpaidOrder,
  expectedAmountCents,
  getStripe,
  getStripeCurrency,
  isDemoMode,
  isStripeSessionForOrder,
  isValidStripeSecretKey,
  isValidStripeWebhookSecret,
  markOrderPaid,
};
