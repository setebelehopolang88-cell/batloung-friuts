const { pool } = require('../config/db');

const FIELDS = ['vendor_name', 'phone_number', 'location', 'registration_date'];
const pick = (body) => Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

// Deleted vendors are kept (their sales history stays intact) but hidden unless includeDeleted is true.
exports.findAll = async (includeDeleted = false) =>
  (await pool.query(`SELECT * FROM vendors ${includeDeleted ? '' : "WHERE status = 'ACTIVE'"} ORDER BY vendor_name`))[0];
exports.findById = async (id) => (await pool.query('SELECT * FROM vendors WHERE vendor_id = ?', [id]))[0][0];
exports.search = async (q) => {
  const like = `%${q}%`;
  return (await pool.query('SELECT * FROM vendors WHERE (vendor_name LIKE ? OR phone_number LIKE ?) ORDER BY vendor_name', [like, like]))[0];
};
exports.create = async (body) => {
  const data = pick(body);
  if (!data.registration_date) data.registration_date = new Date().toISOString().slice(0, 10);
  return (await pool.query('INSERT INTO vendors SET ?', [data]))[0].insertId;
};
exports.update = async (id, body) => {
  const data = pick(body);
  if (!Object.keys(data).length) return null;
  return (await pool.query('UPDATE vendors SET ? WHERE vendor_id = ?', [data, id]))[0];
};

// Outstanding balance per vendor = everything billed - everything paid
exports.balances = async (vendorId) => {
  const sql = `SELECT v.vendor_id, v.vendor_name, v.phone_number,
                      COALESCE(SUM(s.total_amount),0) AS total_billed,
                      COALESCE(SUM(p.paid),0)         AS total_paid,
                      COALESCE(SUM(s.total_amount),0) - COALESCE(SUM(p.paid),0) AS outstanding_balance
               FROM vendors v
               LEFT JOIN sales s ON s.vendor_id = v.vendor_id
               LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id
               ${vendorId ? 'WHERE v.vendor_id = ?' : ''}
               GROUP BY v.vendor_id, v.vendor_name, v.phone_number
               ORDER BY outstanding_balance DESC, v.vendor_name`;
  return (await pool.query(sql, vendorId ? [vendorId] : []))[0];
};

exports.softDelete = async (id) =>
  (await pool.query("UPDATE vendors SET status = 'DELETED', deleted_at = NOW() WHERE vendor_id = ?", [id]))[0];
exports.restore = async (id) =>
  (await pool.query("UPDATE vendors SET status = 'ACTIVE', deleted_at = NULL WHERE vendor_id = ?", [id]))[0];
