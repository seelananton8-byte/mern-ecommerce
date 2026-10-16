require("dotenv").config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const mongoSanitize = require("express-mongo-sanitize");

const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { initSocket } = require("./socket");

const app = express();
const isProd = process.env.NODE_ENV === "production";

if (isProd) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

// Stripe requires the exact raw request body for webhook signature verification.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), webhookRoutes);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Strip $ and . keys from req.body / req.params (NoSQL injection)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// Strict limiter: login / register only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later.",
  },
});

// Looser limiter for the rest of the API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests." },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/google", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "E-commerce backend is running!" });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({ success: false, message: "Origin not allowed." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Payload too large." });
  }

  console.error("Server error:", isProd ? err.message : err);
  return res.status(err.status || 500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});
initSocket(io);
app.set("io", io);

async function startServer() {
  try {
    const isTest = process.env.NODE_ENV === "test";
    const mongoUri = isTest ? process.env.TEST_MONGODB_URI : process.env.MONGODB_URI;

    if (!mongoUri || !process.env.JWT_SECRET) {
      throw new Error("Required MongoDB URI or JWT_SECRET is missing.");
    }
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters.");
    }

    mongoose.set("strictQuery", true);
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected (${isTest ? "TEST" : "NORMAL"} mode)`);

    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
}

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    io.close();
    await mongoose.connection.close();
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

startServer();

module.exports = app;