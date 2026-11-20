const { pool } = require('../config/db');

const insert = (userId, kind, message, createdBy) =>
  pool.query('INSERT INTO notifications (user_id, kind, message, created_by) VALUES (?,?,?,?)', [userId, kind, String(message).slice(0, 255), createdBy || null]);

// Sends a notification to the log in behind a vendor. Vendors the admin typed in by hand have no log in, so nobody is told.
exports.notifyVendor = async (vendorId, kind, message, createdBy) => {
  const [[u]] = await pool.query('SELECT user_id FROM users WHERE vendor_id = ?', [vendorId]);
  if (!u) return false;
  await insert(u.user_id, kind, message, createdBy);
  return true;
};

// Same for the log in behind a supplier.
exports.notifySupplier = async (supplierId, kind, message, createdBy) => {
  const [[u]] = await pool.query('SELECT user_id FROM users WHERE supplier_id = ?', [supplierId]);
  if (!u) return false;
  await insert(u.user_id, kind, message, createdBy);
  return true;
};

// Tells every farm-desk (admin) log in, e.g. when a vendor orders or a supplier makes an offer.
// Never throws: a failed notification must not undo the order / offer that caused it.
exports.notifyAdmins = async (kind, message, createdBy) => {
  try {
    const [admins] = await pool.query("SELECT user_id FROM users WHERE role = 'ADMIN'");
    for (const a of admins) await insert(a.user_id, kind, message, createdBy);
    return admins.length > 0;
  } catch (e) { console.error('[NOTIFY] could not notify the farm desk:', e.message); return false; }
};

exports.listFor = async (userId) =>
  (await pool.query('SELECT notification_id, kind, message, created_by, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY notification_id DESC LIMIT 100', [userId]))[0];
exports.unreadCount = async (userId) =>
  (await pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [userId]))[0][0].n;
exports.markRead = async (userId, id) =>
  (await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND notification_id = ?', [userId, id]))[0];
exports.markAllRead = async (userId) =>
  (await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]))[0];
exports.remove = async (userId, id) =>
  (await pool.query('DELETE FROM notifications WHERE user_id = ? AND notification_id = ?', [userId, id]))[0];
exports.removeAll = async (userId) =>
  (await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId]))[0];
