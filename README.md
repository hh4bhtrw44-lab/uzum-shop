# UZUM Platform - Private E-commerce System

A UZUM-inspired e-commerce commission platform with user frontend and admin panel.

## Quick Start

```bash
cd /tmp/uzum-platform
rm -f uzum.db          # clean database
npm install            # install dependencies
node server.js         # start server
```

## Access

| Component | URL | Credentials |
|-----------|-----|-------------|
| 🛍️ User Frontend | http://localhost:3000/frontend | `testuser` / `test123` |
| ⚙️ Admin Panel | http://localhost:3000/admin | `admin` / `admin123` |

## Features

### User Frontend
- **Home Page** — VIP tiers overview, real-time commission scroll, new products
- **Grab Orders** — Browse 20 products, grab with 3–8% commission on each order
- **My Orders** — View order history with earned commissions
- **Wallet** — View balance, deposit funds, withdraw earnings
- **Profile** — Account stats, referral code, VIP level

### Admin Panel
- **Dashboard** — Real-time stats (users, orders, revenue, pending withdrawals)
- **Users** — View all users, their balances, earnings, VIP levels
- **Orders** — Track all orders across users
- **Withdrawals** — Approve/reject withdrawal requests with refunds

## Architecture

```
uzum-platform/
├── server.js          # Express API + sql.js database
├── package.json
├── frontend/
│   ├── index.html     # User SPA (login + app)
│   ├── style.css      # Dark theme UZUM-style UI
│   └── app.js         # Frontend logic (API, navigation, modals)
├── admin/
│   └── index.html     # Admin panel SPA
└── uploads/           # File upload directory
```

## Project Structure

- **Backend**: Node.js + Express + sql.js (pure JS SQLite, no native deps)
- **Frontend**: Vanilla JS SPA with tab navigation, modals, toast notifications
- **DB**: Auto-initializing SQLite with seeded demo data
- **Auth**: JWT-based with user/admin role separation
