require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const args = process.argv.slice(2);
  const email = (args.find((a) => !a.startsWith("--")) || "")
    .trim()
    .toLowerCase();
  const revoke = args.includes("--revoke");
  const create = args.includes("--create");
  const confirm = args.includes("--confirm");

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    throw new Error("Usage: node scripts/makeAdmin.js <email> [--revoke | --create] [--confirm]");
  }

  if (revoke && create) {
    throw new Error("Use either --revoke or --create, not both.");
  }

  if (process.env.NODE_ENV === "production" && !confirm) {
    throw new Error("Running in production. Add --confirm to proceed.");
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in .env");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email }).select("_id email role");

  if (!user) {
    if (!create) {
      throw new Error(
        "User not found. Register first, or add --create with ADMIN_PASSWORD set."
      );
    }

    const password = process.env.ADMIN_PASSWORD;

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new Error(
        "Set ADMIN_PASSWORD (12–72 characters) in the environment to create an admin."
      );
    }

    const name = (process.env.ADMIN_NAME || "Admin").trim().slice(0, 100);

    await User.create({
      name: name.length >= 2 ? name : "Admin",
      email,
      password: await bcrypt.hash(password, 12),
      role: "admin",
    });

    console.log(`New admin created: ${email}`);
    return;
  }

  if (create) {
    throw new Error("User already exists. Run without --create to promote it.");
  }

  const newRole = revoke ? "user" : "admin";

  if (user.role === newRole) {
    console.log(`${email} already has role "${newRole}". Nothing changed.`);
    return;
  }

  await User.updateOne({ _id: user._id }, { role: newRole });
  console.log(`${email} role changed: ${user.role} -> ${newRole}`);
}

main()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });