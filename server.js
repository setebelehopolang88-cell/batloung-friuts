require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { pool, testConnection } = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const { requireAuth, requireRole } = require('./src/middleware/auth');
const { seedDemoUsers } = require('./src/models/userModel');
const { ensureSchema, ensureAdmins } = require('./src/utils/migrate');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '4mb' })); // 4 MB: picture uploads arrive as base64

// Uploaded pictures (fruit photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));

app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.status(200).json({ status: 'ok', database: 'connected' }); }
  catch (e) { res.status(503).json({ status: 'degraded', database: 'unavailable' }); }
});

const admin = requireRole('ADMIN');
app.use('/api/auth', require('./src/routes/authRoutes'));

// Business description + map location: anyone can read it, only the admin can change it (see the route file)
app.use('/api/business', require('./src/routes/businessRoutes'));
// Each signed-in user reads their own notifications (vendors are told when the admin views, edits or deletes them)
app.use('/api/notifications', requireAuth, require('./src/routes/notificationRoutes'));

// Admin (farm desk) only
app.use('/api/suppliers', requireAuth, admin, require('./src/routes/supplierRoutes'));
app.use('/api/vendors', requireAuth, admin, require('./src/routes/vendorRoutes'));
app.use('/api/purchases', requireAuth, admin, require('./src/routes/purchaseRoutes'));
app.use('/api/sales', requireAuth, admin, require('./src/routes/saleRoutes'));
app.use('/api/reports', requireAuth, admin, require('./src/routes/reportRoutes'));
// Vendor / supplier log ins: the farm desk can view or reset their passwords
app.use('/api/accounts', requireAuth, admin, require('./src/routes/accountRoutes'));

// Any signed-in user can see fruits and stock (pictures, prices); only admin edits them (see the route files)
app.use('/api/fruits', requireAuth, require('./src/routes/fruitRoutes'));
app.use('/api/stock', requireAuth, require('./src/routes/stockRoutes'));

// Vendors order boxes; suppliers manage their fruits; admin and suppliers can upload pictures
app.use('/api/orders', requireAuth, requireRole('ADMIN', 'VENDOR'), require('./src/routes/orderRoutes'));
app.use('/api/supplier', requireAuth, requireRole('SUPPLIER'), require('./src/routes/supplierPortalRoutes'));
// Vendors' PDF payment slips: the admin opens any slip, a vendor only their own (files are private, not in /uploads)
app.use('/api/proofs', requireAuth, requireRole('ADMIN', 'VENDOR'), require('./src/routes/proofRoutes'));
// Stock offers from suppliers: the farm desk accepts or rejects them
app.use('/api/offers', requireAuth, admin, require('./src/routes/offerRoutes'));
app.use('/api/uploads', requireAuth, requireRole('ADMIN', 'SUPPLIER'), require('./src/routes/uploadRoutes'));

app.use(notFound);
app.use(errorHandler);

// The process must not die because of a database problem
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`Batloung Farm API running on http://localhost:${PORT}`);
  testConnection().then(async (ok) => {
    if (!ok) return;
    try { await ensureSchema(); } catch (e) { console.error('[DB] Could not update the database tables:', e.message); }
    try { await seedDemoUsers(); await ensureAdmins(); } catch (e) { console.error('[AUTH] Could not create demo log ins:', e.message); }
  });
});
