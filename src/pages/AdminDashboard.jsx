import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAdminOrders,
  getAdminStats,
  getAdminUsers,
  updateOrderStatus,
} from "../services/adminService";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../services/productService";
import { shortId } from "../services/orderService";
import { getStoredUser } from "../services/api";
import { onSocketState, subscribeOrderUpdates } from "../services/socket";
import "../styles/app-extra.css";

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";

// Same transitions the server allows
const NEXT_STATUS = {
  pending: ["confirmed"],
  confirmed: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
};
const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const EMPTY_PRODUCT = { title: "", description: "", price: "", category: "", image: "", stock: "" };

/* Overview */
function Overview({ stats }) {
  if (!stats) return <p className="x-empty">Loading statistics...</p>;

  const maxRevenue = Math.max(1, ...stats.last7Days.map((d) => d.revenue));

  return (
    <>
      <div className="x-grid x-grid-4">
        <div className="x-card x-stat"><span>Total revenue (paid)</span><strong>{formatPrice(stats.revenue)}</strong></div>
        <div className="x-card x-stat"><span>Orders</span><strong>{stats.orders}</strong></div>
        <div className="x-card x-stat"><span>Products</span><strong>{stats.products}</strong></div>
        <div className="x-card x-stat"><span>Customers</span><strong>{stats.users}</strong></div>
      </div>

      <div className="x-grid x-grid-2" style={{ marginTop: 14 }}>
        <div className="x-card">
          <h2>Sales, last 7 days</h2>
          <div className="x-chart">
            {stats.last7Days.map((d) => (
              <div className="x-bar" key={d.date} title={`${d.orders} orders · ${formatPrice(d.revenue)}`}>
                <b>{d.orders}</b>
                <i style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%` }} />
                <small>{d.date.slice(5)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="x-card">
          <h2>Orders by status</h2>
          <ul className="x-list">
            {ORDER_STATUSES.map((s) => (
              <li key={s}>
                <span className={`x-badge ${s}`}>{s}</span>
                <strong>{stats.byStatus[s] || 0}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="x-card">
          <h2>Top selling products</h2>
          {stats.topProducts.length === 0 ? (
            <p className="x-empty">No sales yet.</p>
          ) : (
            <ul className="x-list">
              {stats.topProducts.map((p) => (
                <li key={p.title}><span>{p.title}</span><strong>{p.quantity} sold · {formatPrice(p.revenue)}</strong></li>
              ))}
            </ul>
          )}
        </div>

        <div className="x-card">
          <h2>Low stock (5 or fewer)</h2>
          {stats.lowStock.length === 0 ? (
            <p className="x-empty">All products are well stocked.</p>
          ) : (
            <ul className="x-list">
              {stats.lowStock.map((p) => (
                <li key={p._id}><span>{p.title}</span><strong className="x-low">{p.stock} left</strong></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

/* Orders */
function OrdersTab({ refreshKey, toast }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getAdminOrders(filter);
      setOrders(data.orders || []);
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const change = async (id, status) => {
    setBusyId(id);
    try {
      await updateOrderStatus(id, status);
      toast(`Order ${shortId(id)} marked ${status}`, "ok");
      await load();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <select className="x-select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <p className="x-empty">Loading orders...</p> : (
        <div className="x-table-wrap">
          <table className="x-table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Update</th></tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan="7" className="x-empty">No orders found.</td></tr>}
              {orders.map((o) => {
                const next = NEXT_STATUS[o.status] || [];
                const canCancel = ["pending", "confirmed", "processing"].includes(o.status) && o.paymentStatus !== "paid";
                return (
                  <tr key={o._id}>
                    <td><strong>{shortId(o._id)}</strong><br /><small>{formatDate(o.createdAt)}</small></td>
                    <td>{o.user?.name || "-"}<br /><small>{o.user?.email}</small></td>
                    <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td>{formatPrice(o.totalAmount)}</td>
                    <td>
                      <span className={`x-badge ${o.paymentStatus}`}>{o.paymentStatus}</span><br />
                      <small>{o.paymentProvider === "cash_on_delivery" ? "COD" : "Card"}</small>
                    </td>
                    <td><span className={`x-badge ${o.status}`}>{o.status}</span></td>
                    <td>
                      <div className="x-actions">
                        {next.map((s) => (
                          <button key={s} className="x-btn sm" disabled={busyId === o._id} onClick={() => change(o._id, s)}>
                            Mark {s}
                          </button>
                        ))}
                        {canCancel && (
                          <button className="x-btn danger sm" disabled={busyId === o._id} onClick={() => change(o._id, "cancelled")}>
                            Cancel
                          </button>
                        )}
                        {next.length === 0 && !canCancel && <small>-</small>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* Products */
function ProductsTab({ refreshKey, toast }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts(await getProducts());
    } catch (err) {
      toast(err.message, "err");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const reset = () => { setForm(EMPTY_PRODUCT); setEditingId(""); };

  const edit = (p) => {
    setEditingId(p.id);
    setForm({ title: p.title, description: p.description, price: p.price, category: p.category, image: p.image || "", stock: p.stock });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) await updateProduct(editingId, form);
      else await createProduct(form);
      toast(editingId ? "Product updated" : "Product added", "ok");
      reset();
      await load();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    try {
      await deleteProduct(p.id);
      toast("Product deleted", "ok");
      await load();
    } catch (err) {
      toast(err.message, "err");
    }
  };

  return (
    <>
      <form className="x-card x-form" onSubmit={submit}>
        <h2 className="full">{editingId ? "Edit product" : "Add new product"}</h2>
        <label className="x-field">Title<input value={form.title} onChange={set("title")} required minLength={2} /></label>
        <label className="x-field">Category<input value={form.category} onChange={set("category")} required /></label>
        <label className="x-field">Price (₹)<input type="number" min="0" step="0.01" value={form.price} onChange={set("price")} required /></label>
        <label className="x-field">Stock<input type="number" min="0" step="1" value={form.stock} onChange={set("stock")} required /></label>
        <label className="x-field full">Image URL<input type="url" value={form.image} onChange={set("image")} placeholder="https://..." /></label>
        <label className="x-field full">Description<textarea rows="3" value={form.description} onChange={set("description")} required /></label>
        <div className="x-actions full">
          <button className="x-btn" disabled={saving}>{saving ? "Saving..." : editingId ? "Update product" : "Add product"}</button>
          {editingId && <button type="button" className="x-btn ghost" onClick={reset}>Cancel edit</button>}
        </div>
      </form>

      <div className="x-table-wrap">
        <table className="x-table">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan="6" className="x-empty">No products yet.</td></tr>}
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.thumbnail ? <img className="x-thumb" src={p.thumbnail} alt="" /> : <div className="x-thumb" />}</td>
                <td><strong>{p.title}</strong></td>
                <td>{p.category}</td>
                <td>{formatPrice(p.price)}</td>
                <td className={p.stock <= 5 ? "x-low" : ""}>{p.stock}</td>
                <td>
                  <div className="x-actions">
                    <button className="x-btn ghost sm" onClick={() => edit(p)}>Edit</button>
                    <button className="x-btn danger sm" onClick={() => remove(p)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* Users */
function UsersTab({ toast }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getAdminUsers().then((d) => setUsers(d.users || [])).catch((e) => toast(e.message, "err"));
  }, [toast]);

  return (
    <div className="x-table-wrap">
      <table className="x-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.name}</td><td>{u.email}</td>
              <td><span className={`x-badge ${u.role === "admin" ? "processing" : ""}`}>{u.role}</span></td>
              <td>{formatDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Page */
export default function AdminDashboard() {
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((text, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text, type }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await getAdminStats();
      setStats(data.stats);
    } catch (err) {
      toast(err.message, "err");
    }
  }, [toast]);

  useEffect(() => { if (isAdmin) loadStats(); }, [isAdmin, loadStats, refreshKey]);

  // Real-time new orders / payments / status changes are pushed by Socket.io
  useEffect(() => {
    if (!isAdmin) return undefined;

    const offState = onSocketState(setLive);
    const offOrders = subscribeOrderUpdates((u) => {
      if (u.event === "created") toast(`New order ${shortId(u.orderId)} received`, "info");
      if (u.event === "paid") toast(`Payment received for ${shortId(u.orderId)}`, "ok");
      if (u.event === "cancelled") toast(`Order ${shortId(u.orderId)} was cancelled`, "err");
      setRefreshKey((k) => k + 1);
    });

    return () => { offState(); offOrders(); };
  }, [isAdmin, toast]);

  if (!isAdmin) {
    return (
      <main className="x-page">
        <div className="x-card">
          <h1>Admin access only</h1>
          <p className="x-sub">Please sign in with an administrator account.</p>
          <Link to="/login" className="x-btn">Go to login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="x-page">
      <div className="x-head">
        <div>
          <h1>Admin dashboard</h1>
          <p className="x-sub">Signed in as {user.name}</p>
        </div>
        <span className={`x-live ${live ? "on" : ""}`}>{live ? "Live" : "Offline"}</span>
      </div>

      <div className="x-tabs" role="tablist">
        {[["overview", "Overview"], ["orders", "Orders"], ["products", "Products"], ["users", "Users"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={`x-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview stats={stats} />}
      {tab === "orders" && <OrdersTab refreshKey={refreshKey} toast={toast} />}
      {tab === "products" && <ProductsTab refreshKey={refreshKey} toast={toast} />}
      {tab === "users" && <UsersTab toast={toast} />}

      <div className="x-toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`x-toast ${t.type}`}>{t.text}</div>)}
      </div>
    </main>
  );
}
