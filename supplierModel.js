const { pool } = require('../config/db');

const FIELDS = ['business_name', 'contact_person', 'phone', 'province', 'address'];
const pick = (body) => Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

// Each supplier with how many purchases we made from them and the total amount paid for them.
exports.findAll = async () =>
  (await pool.query(
    `SELECT s.*, COALESCE(p.purchase_count,0) AS purchase_count, COALESCE(p.total_bought,0) AS total_bought
     FROM suppliers s
     LEFT JOIN (SELECT supplier_id, COUNT(*) AS purchase_count, SUM(total_amount) AS total_bought FROM purchases GROUP BY supplier_id) p
            ON p.supplier_id = s.supplier_id
     ORDER BY s.business_name`))[0];
exports.findById = async (id) => (await pool.query('SELECT * FROM suppliers WHERE supplier_id = ?', [id]))[0][0];
exports.create = async (body) => (await pool.query('INSERT INTO suppliers SET ?', [pick(body)]))[0].insertId;
exports.update = async (id, body) => {
  const data = pick(body);
  if (!Object.keys(data).length) return null;
  return (await pool.query('UPDATE suppliers SET ? WHERE supplier_id = ?', [data, id]))[0];
};
exports.countPurchases = async (id) =>
  (await pool.query('SELECT COUNT(*) AS n FROM purchases WHERE supplier_id = ?', [id]))[0][0].n;
exports.remove = async (id) => (await pool.query('DELETE FROM suppliers WHERE supplier_id = ?', [id]))[0];
