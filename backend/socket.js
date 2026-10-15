const jwt = require("jsonwebtoken");
const User = require("./models/User");

function initSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (typeof token !== "string" || !token) {
        return next(new Error("Authentication required"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (typeof decoded.userId !== "string" || !/^[a-f\d]{24}$/i.test(decoded.userId)) {
        return next(new Error("Invalid authentication token"));
      }
      const user = await User.findById(decoded.userId).select("_id role").lean();
      if (!user) return next(new Error("User account not found"));
      socket.user = { id: String(user._id), role: user.role };
      return next();
    } catch (_error) {
      return next(new Error("Invalid or expired authentication token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === "admin") socket.join("admins");
  });
}

function emitOrderUpdate(io, order, event = "updated") {
  if (!io || !order) return;
  const payload = {
    event,
    orderId: String(order._id),
    status: order.status,
    paymentStatus: order.paymentStatus,
    updatedAt: new Date().toISOString(),
  };
  if (order.user) io.to(`user:${String(order.user._id || order.user)}`).emit("order:update", payload);
  io.to("admins").emit("order:update", payload);
}

module.exports = { initSocket, emitOrderUpdate };
