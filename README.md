# ShopSphere

ShopSphere is a full-stack e-commerce website I built with the MERN stack (MongoDB, Express, React, Node.js). Customers can browse products, add them to the cart and pay with Stripe or Cash on Delivery. There is also an admin dashboard where the store owner can manage products, orders and users.

Live site: https://mern-ecommerce-eight-rho.vercel.app

Made by S. Anton Sureshkumar

The backend is on Render's free plan, so if nobody has used the site for a while the first load can take up to a minute.

To try a payment use the Stripe test card `4242 4242 4242 4242` with any future date and any CVC. It is test mode, so no real money is used.

## What it can do

- Register and login with email and password, or with Google
- Forgot password / reset password through an email link
- Browse products, filter by category, search and sort
- Cart and wishlist
- Checkout with Stripe or Cash on Delivery
- My Orders page where the status updates live without refreshing (Socket.io)
- Cancel your own order while it is still pending (stock goes back automatically)
- Admin dashboard with revenue, orders by status, last 7 days sales chart, product add/edit/delete, order status updates and a user list

## Things I paid attention to

- Prices are calculated on the server from the database, not from the browser.
- Stripe sends a webhook after payment, and the server checks its signature before marking the order as paid. So the order is confirmed even if the customer closes the tab after paying.
- Stock is reduced inside a MongoDB transaction, so two people cannot buy the last item together.
- An idempotency key is sent with every order so a double click does not create two orders.
- Passwords are hashed with bcrypt, JWT expires in 1 hour, and admin routes are checked on the server by role.
- Login and register are rate limited, and the API uses helmet, CORS and input sanitizing.

## Tech used

- Frontend: React 19, Vite, React Router, Context API
- Backend: Node.js, Express 5, Mongoose
- Database: MongoDB Atlas
- Payments: Stripe Checkout + webhooks
- Real time: Socket.io
- Auth: JWT, bcrypt, Google Sign-In
- Email: Nodemailer
- Tests: Vitest
- Hosting: Vercel (frontend), Render (backend)

## Folder structure

```
backend/
  middleware/     auth + role checks
  models/         User, Product, Order
  routes/         auth, products, orders, payments, webhooks, admin
  services/       payment logic
  scripts/        seedProducts.js, makeAdmin.js
  test/           API tests
  server.js, socket.js
src/
  pages/          Home, Products, Cart, Checkout, MyOrders, AdminDashboard...
  components/     Navbar, ProductCard, GoogleAuthButton
  context/        cart and wishlist
  hooks/          useAuthSync
  services/       api, orders, products, socket
vercel.json       makes page refresh work on Vercel
```

## How to run it on your computer

You need Node.js 20 or newer, a MongoDB Atlas database and a Stripe account (test mode).

Backend:

```
cd backend
npm install
copy .env.example .env
npm run dev
```

Open `backend/.env` and put your own values. The backend runs on http://localhost:5000

Add the sample products (30 products):

```
node scripts/seedProducts.js
```

Make a registered user an admin:

```
node scripts/makeAdmin.js your-email@gmail.com
```

Frontend (from the main project folder):

```
npm install
copy .env.example .env
npm run dev
```

It runs on http://localhost:5173

To test the Stripe webhook locally I use the Stripe CLI:

```
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

It prints a `whsec_...` key, put that in `STRIPE_WEBHOOK_SECRET`.

## Environment variables

Backend (`backend/.env`):

```
MONGODB_URI
JWT_SECRET            (at least 32 characters)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CURRENCY
CLIENT_URL
CLIENT_ORIGIN
GOOGLE_CLIENT_ID
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
```

Frontend (`.env`):

```
VITE_API_URL          backend url ending with /api
VITE_SOCKET_URL       backend url without /api
VITE_GOOGLE_CLIENT_ID
```

The `VITE_` values are read when the site is built, so after changing them on Vercel I have to redeploy.

## Tests

There are 74 tests. They call the running API, so start the server first and run the tests in another terminal:

```
cd backend
npm start
npm test
```

The tests make some temporary users, products and orders (names start with `__test_` or `__TEST__`) and delete them at the end. Login and register are limited to 10 requests per 15 minutes, so if you run the tests twice quickly you may get a 429. Restart the server and run again.

## Deployment

- Backend on Render: root directory `backend`, build command `npm install`, start command `npm start`, and all the backend variables added in Environment.
- Frontend on Vercel: add the three `VITE_` variables and redeploy.
- In the Stripe dashboard I added a webhook to `https://<backend-url>/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`.
- In Google Cloud Console I added the Vercel URL to the authorized JavaScript origins.
- In MongoDB Atlas I allowed network access for Render.