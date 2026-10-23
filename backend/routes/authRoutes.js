
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const MAX_PASSWORD_BYTES = 72;
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RESET_EXPIRY_MS = 15 * 60 * 1000;

// HELPERS

function createMailTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP configuration is incomplete.");
  }

  const port = Number(SMTP_PORT || 587);

  if (![465, 587].includes(port)) {
    throw new Error("SMTP_PORT must be 465 or 587.");
  }

  if (port === 465 && SMTP_SECURE !== "true") {
    throw new Error("SMTP port 465 requires SMTP_SECURE=true.");
  }

  if (port === 587 && SMTP_SECURE === "true") {
    throw new Error("SMTP port 587 normally requires SMTP_SECURE=false.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

// PASSWORD RESET EMAIL
// Uses Brevo HTTPS API when configured.
// Falls back to the existing SMTP transport otherwise.

async function sendPasswordResetEmail(email, token) {
  const frontendOrigin =
    process.env.CLIENT_ORIGIN ||
    (isProd ? "" : "http://localhost:5173");

  if (!frontendOrigin) {
    throw new Error("CLIENT_ORIGIN is required in production.");
  }

  const baseUrl = frontendOrigin.replace(/\/+$/, "");
  const resetUrl = `${baseUrl}/reset-password/${encodeURIComponent(token)}`;

  const subject = "Reset your ShopSphere password";

  const textContent = [
    "We received a request to reset your ShopSphere password.",
    "",
    `Open this link to choose a new password: ${resetUrl}`,
    "",
    "This link expires in 15 minutes and can only be used once.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
      <h2>Reset your ShopSphere password</h2>
      <p>We received a request to reset your password.</p>
      <p>
        <a
          href="${resetUrl}"
          style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px"
        >
          Reset password
        </a>
      </p>
      <p>This link expires in 15 minutes and can only be used once.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  // Brevo API: preferred when BREVO_API_KEY is configured.
  if (process.env.BREVO_API_KEY) {
    const senderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!senderEmail) {
      throw new Error("BREVO_SENDER_EMAIL is not configured.");
    }

    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "ShopSphere",
            email: senderEmail,
          },
          to: [{ email }],
          subject,
          textContent,
          htmlContent,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const errorDetails = await response.text();

      console.error(
        "Brevo API error:",
        response.status,
        errorDetails
      );

      throw new Error(
        `Brevo email request failed (${response.status}).`
      );
    }

    console.log("Password reset email accepted by Brevo.");
    return;
  }

  // Existing SMTP fallback when Brevo is not configured.
  const transporter = createMailTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text: textContent,
    html: htmlContent,
  });
}

// REGISTER
// POST /api/auth/register

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must contain between 2 and 100 characters.",
      });
    }

    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !EMAIL_REGEX.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to register right now.",
    });
  }
});

// LOGIN
// POST /api/auth/login

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !EMAIL_REGEX.test(email.trim()) ||
      typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email and password.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    const passwordMatches = await bcrypt.compare(
      password,
      user ? user.password : DUMMY_HASH
    );

    if (!user || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
        algorithm: "HS256",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      expiresIn: 3600,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in right now.",
    });
  }
});

// GOOGLE LOGIN
// POST /api/auth/google

router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (
      typeof credential !== "string" ||
      !process.env.GOOGLE_CLIENT_ID
    ) {
      return res.status(400).json({
        success: false,
        message: "Google authentication is not configured correctly.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Unable to verify your Google account.",
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Please use a verified Google email address.",
      });
    }

    const normalizedEmail = payload.email.trim().toLowerCase();

    let user = await User.findOne({
      googleId: payload.sub,
    });

    if (!user) {
      const emailUser = await User.findOne({
        email: normalizedEmail,
      });

      if (emailUser) {
        return res.status(409).json({
          success: false,
          message:
            "An account already exists with this email. Please sign in using your existing login method.",
        });
      }

      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      try {
        user = await User.create({
          name:
            typeof payload.name === "string" && payload.name.trim()
              ? payload.name.trim().slice(0, 100)
              : "ShopSphere User",
          email: normalizedEmail,
          password: hashedPassword,
          googleId: payload.sub,
        });
      } catch (createError) {
        if (createError.code === 11000) {
          user = await User.findOne({
            googleId: payload.sub,
          });

          if (!user) {
            return res.status(409).json({
              success: false,
              message:
                "An account already exists with this email. Please try signing in again.",
            });
          }
        } else {
          throw createError;
        }
      }
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
        algorithm: "HS256",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Google login successful.",
      token,
      expiresIn: 3600,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Google login error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Google authentication failed. Please try again.",
    });
  }
});

// FORGOT PASSWORD
// POST /api/auth/forgot-password

router.post("/forgot-password", async (req, res) => {
  const genericMessage =
    "If an account exists for that email, password reset instructions will be sent.";

  try {
    const { email } = req.body || {};

    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !EMAIL_REGEX.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    // Do not reveal whether an account exists.
    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.passwordResetExpires = new Date(
      Date.now() + PASSWORD_RESET_EXPIRY_MS
    );

    await user.save();

    try {
      await sendPasswordResetEmail(user.email, rawToken);
    } catch (mailError) {
      console.error(
        "Password reset email delivery failed:",
        mailError.message
      );

      // Clear reset token if email delivery fails.
      try {
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();
      } catch (cleanupError) {
        console.error(
          "Password reset token cleanup failed:",
          cleanupError.message
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process your request right now.",
    });
  }
});

// RESET PASSWORD
// POST /api/auth/reset-password/:token

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: {
        $gt: new Date(),
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired.",
      });
    }

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. Please sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reset your password right now.",
    });
  }
});

// CURRENT USER
// GET /api/auth/me

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId =
      req.user && (req.user.id || req.user._id || req.user.userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your account right now.",
    });
  }
});

// ADMIN TEST ROUTE
// GET /api/auth/admin-test

router.get(
  "/admin-test",
  authMiddleware,
  allowRoles("admin"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Admin access granted.",
    });
  }
);

module.exports = router;
