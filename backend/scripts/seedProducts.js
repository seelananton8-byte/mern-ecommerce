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
  // Electronics
  {
    title: "Wireless Mouse",
    description: "Ergonomic 2.4GHz wireless mouse with silent clicks and long battery life.",
    price: 699,
    category: "electronics",
    stock: 60,
    image: img("wirelessmouse"),
  },
  {
    title: "Power Bank 20000mAh",
    description: "Fast-charging power bank with dual USB ports and Type-C input.",
    price: 1899,
    category: "electronics",
    stock: 35,
    image: img("powerbank"),
  },
  {
    title: "USB-C Fast Charger 65W",
    description: "Compact GaN charger that powers laptops, tablets and phones.",
    price: 1499,
    category: "electronics",
    stock: 40,
    image: img("charger"),
  },
  {
    title: "Noise Cancelling Earbuds",
    description: "True wireless earbuds with active noise cancellation and 24-hour case.",
    price: 2999,
    category: "electronics",
    stock: 28,
    image: img("earbuds"),
  },

  // Fashion
  {
    title: "Cotton Crew T-Shirt",
    description: "Soft 100% cotton round-neck t-shirt, regular fit, pre-shrunk.",
    price: 499,
    category: "fashion",
    stock: 80,
    image: img("tshirt"),
  },
  {
    title: "Slim Fit Chinos",
    description: "Stretch cotton chinos with a tailored slim fit for work or weekends.",
    price: 1299,
    category: "fashion",
    stock: 30,
    image: img("chinos"),
  },
  {
    title: "Polarized Sunglasses",
    description: "UV400 polarized sunglasses with a lightweight durable frame.",
    price: 999,
    category: "fashion",
    stock: 45,
    image: img("sunglasses"),
  },
  {
    title: "Canvas Sneakers",
    description: "Everyday canvas sneakers with a cushioned insole and grippy sole.",
    price: 1599,
    category: "fashion",
    stock: 38,
    image: img("sneakers"),
  },

  // Home
  {
    title: "Cotton Bedsheet Set",
    description: "Double bedsheet with two pillow covers, 180 thread count cotton.",
    price: 1199,
    category: "home",
    stock: 25,
    image: img("bedsheet"),
  },
  {
    title: "Wall Clock",
    description: "Silent sweep wall clock with a minimalist dial, 12 inch.",
    price: 649,
    category: "home",
    stock: 32,
    image: img("wallclock"),
  },
  {
    title: "Storage Basket Set",
    description: "Set of 3 woven storage baskets for shelves, toys and laundry.",
    price: 799,
    category: "home",
    stock: 50,
    image: img("basket"),
  },
  {
    title: "Non-Stick Cookware Set",
    description: "3-piece non-stick cookware set with induction-friendly base.",
    price: 2299,
    category: "home",
    stock: 15,
    image: img("cookware"),
  },

  // Sports
  {
    title: "Adjustable Dumbbell Pair",
    description: "Pair of adjustable dumbbells, 2 to 10 kg each, with secure locks.",
    price: 2499,
    category: "sports",
    stock: 20,
    image: img("dumbbell"),
  },
  {
    title: "Badminton Racket Set",
    description: "Set of 2 lightweight rackets with 3 shuttlecocks and a carry bag.",
    price: 1099,
    category: "sports",
    stock: 42,
    image: img("badminton"),
  },
  {
    title: "Skipping Rope",
    description: "Speed skipping rope with ball bearings and adjustable length.",
    price: 299,
    category: "sports",
    stock: 70,
    image: img("skippingrope"),
  },

  // Beauty
  {
    title: "Vitamin C Face Serum",
    description: "Brightening 10% Vitamin C serum for a clear, even-looking skin tone.",
    price: 599,
    category: "beauty",
    stock: 55,
    image: img("serum"),
  },
  {
    title: "Herbal Shampoo 500ml",
    description: "Gentle sulphate-free herbal shampoo for daily use.",
    price: 349,
    category: "beauty",
    stock: 65,
    image: img("shampoo"),
  },
  {
    title: "Sunscreen SPF 50",
    description: "Lightweight, non-greasy sunscreen with broad spectrum protection.",
    price: 449,
    category: "beauty",
    stock: 48,
    image: img("sunscreen"),
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
      `Seed products in database: ${totalSeedProducts}/${products.length}`
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