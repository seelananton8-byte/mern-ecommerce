import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  getStripe,
  isDemoMode,
  isStripeSessionForOrder,
  isValidStripeSecretKey,
  isValidStripeWebhookSecret,
  markOrderPaid,
} = require("../services/paymentService");

const order = {
  _id: "507f1f77bcf86cd799439011",
  user: "507f191e810c19729de860ea",
  stripeSessionId: "cs_test_session",
  paymentProvider: "stripe",
  paymentStatus: "pending",
  status: "pending",
  totalAmount: 999,
  items: [{ price: 499.5, quantity: 2 }],
};

const session = {
  id: order.stripeSessionId,
  mode: "payment",
  status: "complete",
  payment_status: "paid",
  currency: "inr",
  amount_total: 99900,
  client_reference_id: order._id,
  metadata: {
    orderId: order._id,
    userId: order.user,
  },
  payment_intent: "pi_verified",
};

describe("Stripe payment configuration", () => {
  it("does not enable demo mode unless explicitly selected outside production", () => {
    expect(isDemoMode({ NODE_ENV: "development", PAYMENT_MODE: "demo" })).toBe(true);
    expect(isDemoMode({ NODE_ENV: "production", PAYMENT_MODE: "demo" })).toBe(false);
    expect(isDemoMode({ NODE_ENV: "development" })).toBe(false);
  });

  it("rejects absent and malformed Stripe credentials without creating a client", () => {
    expect(isValidStripeSecretKey(undefined)).toBe(false);
    expect(isValidStripeSecretKey("not-a-stripe-secret")).toBe(false);
    expect(() => getStripe({})).toThrow(/valid secret key/i);
    expect(isValidStripeWebhookSecret(undefined)).toBe(false);
    expect(isValidStripeWebhookSecret("invalid")).toBe(false);
  });
});

describe("Stripe Checkout session verification", () => {
  it("rejects unpaid sessions", () => {
    expect(
      isStripeSessionForOrder(
        order,
        { ...session, payment_status: "unpaid" },
        "inr",
        true
      )
    ).toBe(false);
  });

  it("accepts a paid session only when its order, user, currency, and amount match", () => {
    expect(isStripeSessionForOrder(order, session, "inr", true)).toBe(true);
    expect(
      isStripeSessionForOrder(
        order,
        { ...session, amount_total: 100 },
        "inr",
        true
      )
    ).toBe(false);
    expect(
      isStripeSessionForOrder(
        order,
        { ...session, metadata: { ...session.metadata, userId: "another-user" } },
        "inr",
        true
      )
    ).toBe(false);
  });

  it("applies one paid transition and emits one update for duplicate paid events", async () => {
    let paid = false;
    let updateCount = 0;
    let emittedCount = 0;
    const OrderModel = {
      async findOneAndUpdate(filter, update) {
        updateCount += 1;
        expect(filter.paymentStatus).toBe("pending");
        expect(filter.status).toBe("pending");
        expect(update.$set.paymentStatus).toBe("paid");
        if (paid) return null;
        paid = true;
        return { ...order, paymentStatus: "paid", status: "confirmed" };
      },
    };

    await markOrderPaid({
      OrderModel,
      emitUpdate: () => { emittedCount += 1; },
      order,
      session,
      currency: "inr",
    });
    const duplicate = await markOrderPaid({
      OrderModel,
      emitUpdate: () => { emittedCount += 1; },
      order,
      session,
      currency: "inr",
    });

    expect(duplicate).toBeNull();
    expect(updateCount).toBe(2);
    expect(emittedCount).toBe(1);
  });

  it("does not change an order when payment verification fails", async () => {
    let updateCount = 0;
    const result = await markOrderPaid({
      OrderModel: {
        async findOneAndUpdate() {
          updateCount += 1;
          return order;
        },
      },
      emitUpdate: () => {},
      order,
      session: { ...session, amount_total: 1 },
      currency: "inr",
    });

    expect(result).toBeNull();
    expect(updateCount).toBe(0);
  });
});
