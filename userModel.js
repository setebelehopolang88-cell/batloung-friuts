const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { HttpError } = require('../middleware/errorHandler');
const { hashPassword } = require('../utils/auth');
const { seal } = require('../utils/vault');

exports.findByUsername = async (username) => (await pool.query('SELECT * FROM users WHERE username = ?', [username]))[0][0];

// The business record behind a log in (vendor or supplier row), plus the vendor's balance.
exports.profile = async (user) => {
  if (user.role === 'VENDOR') {
    const [[v]] = await pool.query('SELECT * FROM vendors WHERE vendor_id = ?', [user.vendor_id]);
    const [[b]] = await pool.query(
      `SELECT COALESCE(SUM(s.total_amount),0) - COALESCE(SUM(p.paid),0) AS outstanding_balance
       FROM sales s LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id
       WHERE s.vendor_id = ?`, [user.vendor_id]);
    return { ...v, outstanding_balance: b.outstanding_balance };
  }
  if (user.role === 'SUPPLIER') return (await pool.query('SELECT * FROM suppliers WHERE supplier_id = ?', [user.supplier_id]))[0][0];
  return null;
};

const ensureFreeUsername = async (conn, username) => {
  const [r] = await conn.query('SELECT 1 FROM users WHERE username = ?', [username]);
  if (r.length) throw new HttpError(409, 'That username is already taken');
};

exports.registerVendor = ({ username, password, vendor_name, phone_number, location }) =>
  withTransaction(async (conn) => {
    await ensureFreeUsername(conn, username);
    const [v] = await conn.query('INSERT INTO vendors (vendor_name, phone_number, location, registration_date) VALUES (?,?,?,CURDATE())',
      [vendor_name, phone_number, location]);
    const [u] = await conn.query('INSERT INTO users (username, password_hash, password_enc, role, vendor_id) VALUES (?,?,?,?,?)',
      [username, hashPassword(password), seal(password), 'VENDOR', v.insertId]);
    return u.insertId;
  });

exports.registerSupplier = ({ username, password, business_name, contact_person, phone, province, address }) =>
  withTransaction(async (conn) => {
    await ensureFreeUsername(conn, username);
    const [s] = await conn.query('INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES (?,?,?,?,?)',
      [business_name, contact_person, phone, province, address]);
    const [u] = await conn.query('INSERT INTO users (username, password_hash, password_enc, role, supplier_id) VALUES (?,?,?,?,?)',
      [username, hashPassword(password), seal(password), 'SUPPLIER', s.insertId]);
    return u.insertId;
  });

// First start only (users table empty): an admin plus a log in for every vendor / supplier already in the database.
exports.seedDemoUsers = async () => {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (n > 0) return;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const demoPassword = 'password123';
  await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', ['admin', hashPassword(adminPassword), 'ADMIN']);
  const [vendors] = await pool.query('SELECT vendor_id FROM vendors ORDER BY vendor_id');
  for (const v of vendors)
    await pool.query('INSERT INTO users (username, password_hash, password_enc, role, vendor_id) VALUES (?,?,?,?,?)', [`vendor${v.vendor_id}`, hashPassword(demoPassword), seal(demoPassword), 'VENDOR', v.vendor_id]);
  const [suppliers] = await pool.query('SELECT supplier_id FROM suppliers ORDER BY supplier_id');
  for (const s of suppliers)
    await pool.query('INSERT INTO users (username, password_hash, password_enc, role, supplier_id) VALUES (?,?,?,?,?)', [`supplier${s.supplier_id}`, hashPassword(demoPassword), seal(demoPassword), 'SUPPLIER', s.supplier_id]);
  console.log(`[AUTH] Demo log ins created: admin / ${adminPassword}, vendor1..vendor${vendors.length} and supplier1..supplier${suppliers.length} / ${demoPassword}`);
};

// Accounts created before the "view password" feature have no saved copy; it is saved the next time they sign in.
exports.rememberPassword = (userId, password) =>
  pool.query('UPDATE users SET password_enc = ? WHERE user_id = ? AND password_enc IS NULL', [seal(password), userId]);
