// Usage: node scripts/seedProducts.js   (uses MONGODB_URI, only seeds when empty)
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

const products = [
  ["Wireless Headphones", "Over-ear Bluetooth headphones with 30-hour battery life.", 2499, "electronics", 25, "headphones"],
  ["Smart Watch", "Fitness tracking, heart-rate monitor and notifications.", 3999, "electronics", 15, "smartwatch"],
  ["Bluetooth Speaker", "Portable waterproof speaker with deep bass.", 1799, "electronics", 30, "speaker"],
  ["Mechanical Keyboard", "RGB backlit keyboard with tactile blue switches.", 2899, "electronics", 12, "keyboard"],
  ["Running Shoes", "Lightweight breathable shoes for daily running.", 2199, "fashion", 40, "shoes"],
  ["Denim Jacket", "Classic fit denim jacket, 100% cotton.", 1999, "fashion", 18, "jacket"],
  ["Leather Wallet", "Slim genuine leather wallet with card slots.", 799, "fashion", 50, "wallet"],
  ["Backpack 25L", "Water-resistant backpack with laptop compartment.", 1499, "fashion", 22, "backpack"],
  ["Ceramic Coffee Mug Set", "Set of 4 handmade ceramic mugs.", 899, "home", 35, "mug"],
  ["Table Lamp", "Minimal LED desk lamp with adjustable brightness.", 1299, "home", 4, "lamp"],
  ["Yoga Mat", "Non-slip 6mm yoga mat with carry strap.", 699, "sports", 45, "yogamat"],
  ["Stainless Steel Bottle", "Insulated 1L bottle, keeps drinks cold for 24 hours.", 549, "sports", 3, "bottle"],
].map(([title, description, price, category, stock, seed]) => ({
  title, description, price, category, stock, image: img(seed),
}));

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    if ((await Product.countDocuments()) > 0) {
      console.log("Products already exist. Skipping seed.");
    } else {
      await Product.insertMany(products);
      console.log(`Seeded ${products.length} products.`);
    }
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
