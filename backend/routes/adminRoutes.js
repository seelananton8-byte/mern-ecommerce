const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const authMiddleware = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Every route in this file is admin-only
router.use(authMiddleware, allowRoles("admin"));

// GET: Dashboard statistics (counts, revenue, last 7 days, top products, low stock)
router.get("/stats", async (req, res) => {
  try {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 6);

    const [users, products, orders, revenue, byStatus, daily, topProducts, lowStock] =
      await Promise.all([
        User.countDocuments(),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Order.aggregate([
          { $match: { createdAt: { $gte: since }, status: { $ne: "cancelled" } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              orders: { $sum: 1 },
              revenue: { $sum: "$totalAmount" },
            },
          },
        ]),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.title",
              quantity: { $sum: "$items.quantity" },
              revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            },
          },
          { $sort: { quantity: -1 } },
          { $limit: 5 },
        ]),
        Product.find({ stock: { $lte: 5 } })
          .select("title stock")
          .sort({ stock: 1 })
          .limit(8)
          .lean(),
      ]);

    // Fill days with no orders so the chart always has 7 points
    const dailyMap = new Map(daily.map((d) => [d._id, d]));
    const last7Days = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      const found = dailyMap.get(key);
      last7Days.push({ date: key, orders: found ? found.orders : 0, revenue: found ? found.revenue : 0 });
    }

    return res.status(200).json({
      success: true,
      stats: {
        users,
        products,
        orders,
        revenue: revenue[0] ? revenue[0].total : 0,
        byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
        last7Days,
        topProducts: topProducts.map((p) => ({ title: p._id, quantity: p.quantity, revenue: p.revenue })),
        lowStock,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load statistics." });
  }
});

// GET: Latest registered users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Admin users error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load users." });
  }
});

module.exports = router;
