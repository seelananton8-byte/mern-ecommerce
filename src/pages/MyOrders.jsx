import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cancelOrder, getMyOrders, proceedToPayment, shortId } from "../services/orderService";
import { getToken } from "../services/api";
import { subscribeOrderUpdates } from "../services/socket";
import "../styles/app-extra.css";

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";


function OrderSkeleton() {
  return (
    <div className="x-orders-skeleton" aria-label="Loading orders">
      {[1, 2, 3].map((item) => (
        <div className="x-card x-skeleton-card" key={item}>
          <div className="x-skeleton x-skeleton-title" />
          <div className="x-skeleton x-skeleton-short" />
          <div className="x-skeleton x-skeleton-line" />
          <div className="x-skeleton x-skeleton-line" />
          <div className="x-skeleton-footer">
            <div className="x-skeleton x-skeleton-total" />
            <div className="x-skeleton x-skeleton-button" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getMyOrders();
      setOrders(data.orders || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true, state: { from: "/orders" } });
      return undefined;
    }

    load();

    // Real-time the server pushes every status / payment change of my orders
    return subscribeOrderUpdates((update) => {
      setBanner(`Live update: order ${shortId(update.orderId)} is now ${update.status} (payment ${update.paymentStatus})`);
      load();
    });
  }, [load, navigate]);

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this order?")) return;
    setBusyId(id);
    try {
      await cancelOrder(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  };

  const handlePay = async (id) => {
    setBusyId(id);
    try {
      await proceedToPayment(id, navigate);
    } catch (err) {
      setError(err.message);
      setBusyId("");
    }
  };

  return (
    <main className="x-page">
      <h1>My orders</h1>
      <p className="x-sub">Status changes appear here instantly, no refresh needed.</p>

      {banner && <div className="x-banner" role="status">{banner}</div>}
      {error && <div className="x-msg" role="alert">{error}</div>}
      {loading && <OrderSkeleton />}

        {!loading && !error && orders.length === 0 && (
        <div className="x-card">
          <p className="x-empty">You have not placed any orders yet.</p>
          <p><Link to="/products" className="x-btn">Start shopping</Link></p>
        </div>
      )}

    {!loading && (
      <div className="x-orders">
        {orders.map((order) => {
          const history = order.statusHistory?.length
            ? order.statusHistory
            : [{ status: order.status, at: order.createdAt }];
          const unpaidOnline =
            order.paymentProvider === "stripe" &&
            order.paymentStatus !== "paid" &&
            order.status === "pending";
          const canCancel = order.status === "pending" && order.paymentStatus !== "paid";

          return (
            <article className="x-card" key={order._id}>
              <div className="x-order-top">
                <div>
                  <strong>Order {shortId(order._id)}</strong>
                  <small>{formatDate(order.createdAt)}</small>
                </div>
                <div className="x-actions">
                  <span className={`x-badge ${order.status}`}>{order.status}</span>
                  <span className={`x-badge ${order.paymentStatus}`}>
                    {order.paymentProvider === "cash_on_delivery" ? "COD · " : ""}
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              <ul className="x-order-items">
                {order.items.map((item, index) => (
                  <li key={index}>
                    <span>{item.title} × {item.quantity}</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>

              <ol className="x-timeline" aria-label="Order tracking">
                {history.map((h, index) => (
                  <li key={index}>
                    <span>{h.status}</span>
                    <time>{formatDate(h.at)}</time>
                  </li>
                ))}
              </ol>

              <div className="x-order-foot">
                <strong>Total {formatPrice(order.totalAmount)}</strong>
                <div className="x-actions">
                  {unpaidOnline && (
                    <button className="x-btn sm" disabled={busyId === order._id} onClick={() => handlePay(order._id)}>
                      Pay now
                    </button>
                  )}
                  {canCancel && (
                    <button className="x-btn danger sm" disabled={busyId === order._id} onClick={() => handleCancel(order._id)}>
                      Cancel order
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    )}
    </main>
  );
}
