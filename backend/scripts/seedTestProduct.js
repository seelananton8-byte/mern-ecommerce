require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

async function seedTestProduct() {
  try {
    const uri = process.env.TEST_MONGODB_URI;

    if (!uri || !uri.includes("ecommerce_test")) {
      throw new Error(
        "TEST_MONGODB_URI must point to ecommerce_test."
      );
    }

    await mongoose.connect(uri);

    const existing = await Product.findOne({
      title: "Stock Test Product",
    });

    if (existing) {
      console.log("Test product already exists:", existing._id);
      return;
    }

    const product = await Product.create({
      title: "Stock Test Product",
      description: "Product for testing stock deduction",
      price: 100,
      category: "Testing",
      stock: 5,
    });

    console.log("Test product created successfully:");
    console.log("ID:", product._id.toString());
    console.log("Initial stock:", product.stock);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedTestProduct();