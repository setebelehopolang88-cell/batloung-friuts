# Batloung Farm - Fresh Produce Distribution Management System

React (Vite) frontend + Node.js / Express REST API + MySQL.

```
batloung-farm/
  backend/
    server.js
    .env.example            <- copy to .env and add your MySQL password
    sql/schema.sql seed.sql reports.sql     (Part A + SQL reports)
    scripts/initDb.js       <- npm run db:init
    src/config/db.js        <- mysql2 pool (reads .env)
    src/routes  controllers  models  middleware  utils
  frontend/                 <- React app (proxy /api -> localhost:5000)
```

## Quick start (easiest)
1. Install **Node.js 18+** and **MySQL** (keep MySQL running).
2. Open `backend/.env` and type your MySQL password after `DB_PASSWORD=`.
3. **Windows:** double-click `start.bat`. **Mac/Linux:** run `./start.sh`.
   It installs everything, creates the database, starts the API and the website, and opens http://localhost:5173.
4. Sign in with `admin` / `admin123` or `admin2` / `admin123` (two farm-desk admins; vendors: `vendor1`, suppliers: `supplier1`, password `password123`).

Prefer MySQL Workbench? Open `backend/sql/full_setup.sql` and run it - it creates every table, the sample data **and** the login accounts in one go. Then run `npm install` and `npm run dev` in both `backend` and `frontend`.

## Run it (manual steps)
Requires Node 18+ and MySQL 8 (or MariaDB 10.5+) running.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # then edit DB_USER / DB_PASSWORD
npm run db:init             # creates batloung_farm, tables and sample data
npm run dev                 # API on http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # app on http://localhost:5173
```
(Or run `sql/schema.sql` then `sql/seed.sql` in MySQL Workbench instead of `npm run db:init`; the log in accounts are then created the first time the server starts.)

> `npm run db:init` rebuilds the database from scratch (sample data only). Run it again after updating to this version: it adds the `users` and `supplier_fruits` tables and the fruit `image_url` column.

## Log in (admin, vendor, supplier)
Open http://localhost:5173 - everyone signs in first. Each role gets its own top menu:

| Role | Demo account | What they see |
|---|---|---|
| Farm desk (admin) | `admin` or `admin2` / `admin123` | Dashboard (fruit pictures, suppliers, latest vendor orders), Sales, Purchases, Stock, Fruits, Vendors, Suppliers, Reports, **Batloung Fruits** |
| Vendor | `vendor1` ... `vendor6` / `password123` | Dashboard, **Order boxes**, My orders, **Notifications**, Batloung Fruits |
| Supplier | `supplier1` ... `supplier8` / `password123` | Dashboard (their fruits with pictures), Register fruit, Batloung Fruits |

New vendors and suppliers can also use **Create account** on the log in page. Change the demo passwords (and `JWT_SECRET` in `backend/.env`) before real use.

- **Order boxes (vendor):** pick Small / Medium / Large, then tap fruits. The chosen fruits appear inside the box on the right with their pictures; the total is calculated by the server from the box-size prices. The order is a normal sale (same all-or-nothing transaction and stock checks), recorded on credit - the farm desk records the payment later. Every order has a **Download order** button (CSV).
- **Pictures:** each fruit has a picture (`fruits.image_url`). Suppliers and the farm desk upload pictures (saved in `backend/uploads`, served at `/uploads`). The five sample pictures are in `frontend/public/fruits`; Grapes has none yet, so an emoji tile is shown until one is uploaded.
- **Supplier registers a fruit:** it appears with its picture on the supplier's dashboard and on the admin dashboard ("Fruits and their suppliers"). A brand-new fruit has no selling price until the farm desk sets it (Fruits page), so vendors see "Price not set yet" and cannot order it.

## Database (Part A)
9 tables: the 8 required + `payments` (cash / mobile money / credit and part-payments).
`stock` has one row per **fruit + packaging size** (UNIQUE(fruit_id, packaging_size), CHECK available_quantity >= 0)
and holds each size's `selling_price` and `low_stock_threshold`.

## API (Part C)
Every endpoint except `/api/auth/login`, `/api/auth/register` and `/api/health` needs `Authorization: Bearer <token>`. Suppliers, vendors, purchases, sales and reports are admin only (403 for other roles).

| Area | Endpoints |
|---|---|
| Suppliers | `POST/GET /api/suppliers`, `GET/PUT/DELETE /api/suppliers/:id` (delete blocked with 409 if it has purchases) |
| Fruits | `POST/GET /api/fruits`, `GET/PUT /api/fruits/:id` (a new fruit gets small/medium/large stock rows) |
| Stock | `GET /api/stock`, `GET /api/stock/fruit/:id`, `GET /api/stock/low[?threshold=n]`, `PUT /api/stock/:id` |
| Vendors | `POST/GET /api/vendors`, `GET /api/vendors/search?q=`, `GET /api/vendors/balances`, `GET/PUT /api/vendors/:id` |
| Purchases | `POST/GET /api/purchases`, `GET /api/purchases/:id` |
| Sales | `POST/GET /api/sales`, `GET /api/sales/:id`, `POST /api/sales/:id/payments` |
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| Orders (admin, vendor) | `GET /api/orders[?limit=n]` (vendor: own orders, with fruit pictures), `POST /api/orders` `{ items: [{ fruit_id, packaging_size, quantity }] }` |
| Supplier portal | `GET /api/supplier/overview`, `POST /api/supplier/fruits`, `DELETE /api/supplier/fruits/:id` |
| Pictures (admin, supplier) | `POST /api/uploads` `{ data: "data:image/jpeg;base64,..." }` -> `{ url }` (max 2 MB) |
| Reports | `/api/reports/top-fruits`, `/revenue?from=&to=`, `/top-vendor`, `/stock-levels` |

Status codes: 200, 201, 400 (validation / insufficient stock), 404, 409 (duplicate / in use), 503 (database down), 500.

```json
POST /api/purchases
{ "supplier_id": 1, "items": [ { "fruit_id": 1, "packaging_size": "LARGE", "quantity": 20, "unit_cost": 70 } ] }

POST /api/sales            (payment optional: CASH | MOBILE_MONEY | CREDIT)
{ "vendor_id": 1, "items": [ { "fruit_id": 1, "packaging_size": "LARGE", "quantity": 10 } ],
  "payment": { "method": "MOBILE_MONEY", "amount": 500 } }
```
Totals are never sent by the client: the server reads each packaging size's selling price and calculates them (`utils/calc.js`).

## Transactions demo (Part D)
Apples LARGE has 50 boxes. This sale has one valid item and one impossible item:
```json
POST /api/sales
{ "vendor_id": 1, "items": [ { "fruit_id": 1, "packaging_size": "SMALL", "quantity": 5 },
                             { "fruit_id": 1, "packaging_size": "LARGE", "quantity": 999 } ] }
```
Response 400: `Insufficient stock for Apples (LARGE): requested 999, available 50. Sale rejected.`
The code runs BEGIN, reduces SMALL stock, hits the LARGE failure, then ROLLBACK: SMALL stock is back to 75 and no sale rows exist
(`src/utils/transaction.js`, `src/models/saleModel.js`). Purchases work the same way.

## Reliability
- The server keeps running if MySQL is down; DB errors return 503 with a clear message and `/api/health` reports the state.
- Credentials and `JWT_SECRET` come only from `.env`.
- Passwords are stored as salted scrypt hashes; log in tokens are signed and expire after 8 hours. Status 401 = not signed in, 403 = wrong role.

## Admin vendor management, notifications, business page (latest changes)
- **Vendors (admin / admin2):** *View*, *Edit* and *Delete* each vendor (and *Restore* a deleted one). Delete keeps the vendor's past sales in the records; the vendor can no longer sign in or order. A deleted vendor who tries to sign in sees why, and a vendor who is signed in when deleted is signed out on their next click.
- **Notifications:** every View, Edit, Delete and Restore sends the vendor a message. Vendors see a red count on the **Notifications** menu item (checked every 30 seconds). Vendors added by hand by the admin have no log in, so nobody is notified for them.
- **Batloung Fruits (menu):** a photo banner, the business description and a map. Everyone can read it; **only the admin** can edit the description and pick the location (click the map, drag the marker, search for a place, or use the current location). The description is also shown on the log in page, which no longer has pictures.
- **Colours:** green was replaced by sky blue.
- **Existing database?** Just restart the backend: it adds the new columns/tables (`vendors.status`, `notifications`, `business_info`) and the `admin2` log in by itself. No data is lost. Fresh installs get everything from `schema.sql` / `seed.sql` / `full_setup.sql`.
- The map uses OpenStreetMap through Leaflet, loaded from the internet, so the map needs an internet connection.


## What's new in this version
- **View passwords (farm desk only):** on **Vendors** and **Suppliers**, each log in shows its user name and an eye button to reveal the password (it hides again after 20 seconds) and a key button to set a new one. Passwords are still protected by a salted hash for sign-in; a second, *encrypted* copy (AES-256-GCM, key from `PASSWORD_VAULT_KEY` or `JWT_SECRET` in `backend/.env`) is kept so the admin can read it. Older accounts have no copy yet: it is saved the next time that person signs in, or use the key button. Do not change `JWT_SECRET` afterwards or saved passwords can no longer be read.
- **Suppliers, Purchases and Sales:** soft-coloured **View / Edit / Delete / Download** buttons with symbols on every row, **Download list** (CSV for Excel, one row per fruit added with "Add another fruit", with totals), and totals for all purchases, all sales, all payments received and what is still owed. Editing or deleting a sale or purchase moves the stock back or forward automatically (a purchase cannot be reduced below what was already sold).
- **Reports:** *Stock bought, sold and left* (left = bought - sold) per fruit or per fruit and box size, plus **Profit and loss** (sales minus the cost of the boxes sold). **Download report** (CSV) and **Print / save as PDF**.
- **Menu:** every menu item has a symbol, and the yellow-line **Batloung Farm** logo (with a home symbol) takes you back to the dashboard.
- **Batloung Fruits photo:** the farm desk can **Change photo** (or go back to the original) directly on the page.
- Run `npm run db:init` for a fresh database, or just restart the backend: it adds the new columns (`users.password_enc`, `business_info.image_url`) to an existing database by itself.

## New in this version
- **Suppliers: Send stock** - a supplier says how many boxes (fruit, box size, price per box) they are selling to the business, and can view, edit or delete the offer while it is still pending.
- **Farm desk: Offers** - see every supplier offer; accept (records a purchase and adds the boxes to stock) or reject (with a reason). The supplier is notified either way.
- **Vendors: payment slip** - on each order a vendor can send a proof of payment as a **PDF only** (max 2 MB). The farm desk opens or downloads it from Sales. Slips are stored privately in `backend/private/proofs`.
- **Farm desk notices** - on every sale, the bell icon sends the vendor: *order rejected* (cancels the order and returns the boxes to stock), *come to take your order*, or *order delayed*.
- **Notifications for everyone** - the farm desk is told when a vendor orders or sends a slip, and when a supplier sends, changes or withdraws an offer. Suppliers are told when an offer is accepted or rejected. Notifications can be deleted.
- View / Edit / Delete icons added on Fruits (fruits that are on purchases or sales cannot be deleted, set them INACTIVE), Stock, supplier fruits and notifications.
- The database updates itself when the backend starts; to rebuild from scratch run `backend/sql/full_setup.sql`.
