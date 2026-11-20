const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { SIZES } = require('../middleware/validate');

exports.findAll = async (status) => {
  // suppliers = the suppliers who registered this fruit (shown with its picture on the dashboards)
  const sql = `SELECT f.*, (SELECT GROUP_CONCAT(s.business_name ORDER BY s.business_name SEPARATOR ', ')
                            FROM supplier_fruits sf JOIN suppliers s ON s.supplier_id = sf.supplier_id
                            WHERE sf.fruit_id = f.fruit_id) AS suppliers
               FROM fruits f` + (status ? ' WHERE f.status = ?' : '') + ' ORDER BY f.fruit_name';
  return (await pool.query(sql, status ? [status] : []))[0];
};
exports.findById = async (id) => (await pool.query('SELECT * FROM fruits WHERE fruit_id = ?', [id]))[0][0];
exports.findByName = async (name) => (await pool.query('SELECT * FROM fruits WHERE LOWER(fruit_name) = LOWER(?)', [name]))[0][0];

// A new fruit automatically gets three stock rows (small / medium / large) with 0 boxes.
exports.create = async ({ fruit_name, description, image_url, status, prices = {} }) =>
  withTransaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO fruits (fruit_name, description, image_url, status) VALUES (?,?,?,?)',
      [fruit_name, description || null, image_url || null, status || 'ACTIVE']);
    for (const size of SIZES) {
      await conn.query('INSERT INTO stock (fruit_id, packaging_size, available_quantity, selling_price) VALUES (?,?,0,?)',
        [r.insertId, size, prices[size] || 0]);
    }
    return r.insertId;
  });

exports.update = async (id, { fruit_name, description, image_url, status, prices }) =>
  withTransaction(async (conn) => {
    const data = {};
    if (fruit_name !== undefined) data.fruit_name = fruit_name;
    if (description !== undefined) data.description = description;
    if (image_url !== undefined) data.image_url = image_url || null;
    if (status !== undefined) data.status = status;
    if (Object.keys(data).length) await conn.query('UPDATE fruits SET ? WHERE fruit_id = ?', [data, id]);
    for (const [size, price] of Object.entries(prices || {}))
      await conn.query('UPDATE stock SET selling_price = ? WHERE fruit_id = ? AND packaging_size = ?', [price, id, size]);
  });

exports.countRecords = async (id) => {
  const [[a]] = await pool.query('SELECT COUNT(*) AS n FROM purchase_details WHERE fruit_id = ?', [id]);
  const [[b]] = await pool.query('SELECT COUNT(*) AS n FROM sales_details WHERE fruit_id = ?', [id]);
  return a.n + b.n;
};
exports.remove = async (id) => (await pool.query('DELETE FROM fruits WHERE fruit_id = ?', [id]))[0];
