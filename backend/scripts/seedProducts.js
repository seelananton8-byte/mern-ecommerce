/**
 * Usage: node scripts/seedProducts.js
 * Requires MONGODB_URI in .env
 * Adds missing products until all 12 seed products exist.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("../models/product");

const img = (seed) =>
  `https://picsum.photos/seed/${seed}/600/600`;

const products = [
  {
    title: "Wireless Headphones",
    description: "Over-ear Bluetooth headphones with 30-hour battery life.",
    price: 2499,
    category: "electronics",
    stock: 25,
    image: img("headphones"),
  },
  {
    title: "Smart Watch",
    description: "Fitness tracking, heart-rate monitor and notifications.",
    price: 3999,
    category: "electronics",
    stock: 15,
    image: img("smartwatch"),
  },
  {
    title: "Bluetooth Speaker",
    description: "Portable waterproof speaker with deep bass.",
    price: 1799,
    category: "electronics",
    stock: 30,
    image: img("speaker"),
  },
  {
    title: "Mechanical Keyboard",
    description: "RGB backlit keyboard with tactile blue switches.",
    price: 2899,
    category: "electronics",
    stock: 12,
    image: img("keyboard"),
  },
  {
    title: "Running Shoes",
    description: "Lightweight breathable shoes for daily running.",
    price: 2199,
    category: "fashion",
    stock: 40,
    image: img("shoes"),
  },
  {
    title: "Denim Jacket",
    description: "Classic fit denim jacket, 100% cotton.",
    price: 1999,
    category: "fashion",
    stock: 18,
    image: img("jacket"),
  },
  {
    title: "Leather Wallet",
    description: "Slim genuine leather wallet with card slots.",
    price: 799,
    category: "fashion",
    stock: 50,
    image: img("wallet"),
  },
  {
    title: "Backpack 25L",
    description: "Water-resistant backpack with laptop compartment.",
    price: 1499,
    category: "fashion",
    stock: 22,
    image: img("backpack"),
  },
  {
    title: "Ceramic Coffee Mug Set",
    description: "Set of 4 handmade ceramic mugs.",
    price: 899,
    category: "home",
    stock: 35,
    image: img("mug"),
  },
  {
    title: "Table Lamp",
    description: "Minimal LED desk lamp with adjustable brightness.",
    price: 1299,
    category: "home",
    stock: 4,
    image: img("lamp"),
  },
  {
    title: "Yoga Mat",
    description: "Non-slip 6mm yoga mat with carry strap.",
    price: 699,
    category: "sports",
    stock: 45,
    image: img("yogamat"),
  },
  {
    title: "Stainless Steel Bottle",
    description: "Insulated 1L bottle, keeps drinks cold for 24 hours.",
    price: 549,
    category: "sports",
    stock: 3,
    image: img("bottle"),
  },
];

async function seedProducts() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Connected to MongoDB.");

    // Find existing seed products by title.
    const existingProducts = await Product.find(
      {
        title: {
          $in: products.map((product) => product.title),
        },
      },
      { title: 1 }
    );

    const existingTitles = new Set(
      existingProducts.map((product) => product.title)
    );

    const missingProducts = products.filter(
      (product) => !existingTitles.has(product.title)
    );

    if (missingProducts.length === 0) {
      console.log("Products already exist. Skipping seed.");
    } else {
      await Product.insertMany(missingProducts);

      console.log(
        `Seeded ${missingProducts.length} products.`
      );
    }

    const totalSeedProducts = await Product.countDocuments({
      title: {
        $in: products.map((product) => product.title),
      },
    });

    console.log(
      `Seed products in database: ${totalSeedProducts}/12`
    );
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

seedProducts();