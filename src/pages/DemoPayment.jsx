import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { demoPay, getOrder, shortId } from "../services/orderService";
import { getToken } from "../services/api";
import "../styles/app-extra.css";

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

/* Fake card page used when PAYMENT_MODE=demo (no Stripe account needed). */
export default function DemoPayment() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get("order_id") || "";

  const [order, setOrder] = useState(null);
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true, state: { from: "/orders" } });
      return;
    }
    if (!orderId) {
      navigate("/orders", { replace: true });
      return;
    }

    getOrder(orderId)
      .then((data) => setOrder(data.order))
      .catch((err) => setError(err.message));
  }, [orderId, navigate]);

  const update = (field) => (e) => {
    let value = e.target.value;
    if (field === "number") {
      value = value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
    }
    if (field === "expiry") {
      value = value.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");
    }
    if (field === "cvv") value = value.replace(/\D/g, "").slice(0, 4);
    setCard((c) => ({ ...c, [field]: value }));
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (paying) return;
    setError("");
    setPaying(true);

    try {
      // small delay so it feels like a real payment gateway
      await new Promise((resolve) => setTimeout(resolve, 900));
      const data = await demoPay(orderId, card.number);
      navigate("/order-success", { replace: true, state: { order: data.order } });
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  return (
    <main className="x-page">
      <div className="x-pay x-card">
        <h1>Secure payment</h1>
        <p className="x-sub">Order {shortId(orderId)}</p>

        <div className="x-note">
          <strong>Demo mode:</strong> no real money is charged. Use card{" "}
          <b>4242 4242 4242 4242</b> (any future date, any CVV). Card{" "}
          <b>4000 0000 0000 0002</b> simulates a declined payment.
        </div>

        {order && (
          <div className="x-pay-total">
            <span>Amount to pay</span>
            <strong>{formatPrice(order.totalAmount)}</strong>
          </div>
        )}

        {error && <div className="x-msg" role="alert">{error}</div>}

        <form onSubmit={handlePay}>
          <label className="x-field">
            Name on card
            <input value={card.name} onChange={update("name")} placeholder="Your name" required />
          </label>
          <label className="x-field">
            Card number
            <input
              value={card.number}
              onChange={update("number")}
              inputMode="numeric"
              placeholder="4242 4242 4242 4242"
              required
            />
          </label>
          <div className="x-pay-row">
            <label className="x-field">
              Expiry
              <input value={card.expiry} onChange={update("expiry")} inputMode="numeric" placeholder="MM/YY" required />
            </label>
            <label className="x-field">
              CVV
              <input value={card.cvv} onChange={update("cvv")} inputMode="numeric" placeholder="123" required />
            </label>
          </div>

          <button className="x-btn" style={{ width: "100%", minHeight: 48 }} disabled={paying || !order}>
            {paying ? "Processing..." : `Pay ${order ? formatPrice(order.totalAmount) : ""}`}
          </button>
        </form>
      </div>
    </main>
  );
}
