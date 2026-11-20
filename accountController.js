const { pool } = require('../config/db');
const { HttpError } = require('../middleware/errorHandler');
const { hashPassword } = require('../utils/auth');
const { open, seal } = require('../utils/vault');

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

// Log ins of vendors and suppliers (no passwords in the list - they are shown one at a time on request).
exports.list = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT user_id, username, role, vendor_id, supplier_id, (password_enc IS NOT NULL) AS has_password
     FROM users WHERE role IN ('VENDOR','SUPPLIER') ORDER BY username`);
  res.status(200).json(rows.map((r) => ({ ...r, has_password: !!r.has_password })));
});

const findAccount = async (id) => {
  const [[u]] = await pool.query('SELECT user_id, username, role, password_enc FROM users WHERE user_id = ?', [id]);
  if (!u) throw new HttpError(404, 'That log in does not exist');
  if (u.role === 'ADMIN') throw new HttpError(403, 'Admin passwords cannot be viewed here');
  return u;
};

// "Show password" - admin only (the route is protected).
exports.reveal = wrap(async (req, res) => {
  const u = await findAccount(req.params.id);
  const password = open(u.password_enc);
  if (!password) throw new HttpError(404, `No password is saved for ${u.username} yet. It is saved the next time they sign in, or you can set a new one.`);
  console.log(`[AUTH] ${req.user.username} viewed the password of ${u.username}`);
  res.set('Cache-Control', 'no-store').status(200).json({ username: u.username, password });
});

// Admin sets a new password for a vendor / supplier log in (it is then visible to the admin too).
exports.reset = wrap(async (req, res) => {
  const u = await findAccount(req.params.id);
  const password = String(req.body?.password || '');
  if (password.length < 6) throw new HttpError(400, 'password must be at least 6 characters');
  await pool.query('UPDATE users SET password_hash = ?, password_enc = ? WHERE user_id = ?', [hashPassword(password), seal(password), u.user_id]);
  console.log(`[AUTH] ${req.user.username} set a new password for ${u.username}`);
  res.status(200).json({ username: u.username, password });
});
