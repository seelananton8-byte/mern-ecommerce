require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

async function makeAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const email = "demo.user101@example.com";

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      console.log("User not found. Register this user first.");
      return;
    }

    user.role = "admin";
    await user.save();

    console.log("Admin role assigned successfully!");
    console.log("Email:", user.email);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

makeAdmin();