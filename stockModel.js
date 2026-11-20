const { pool } = require('../config/db');

const BASE = `SELECT s.stock_id, s.fruit_id, f.fruit_name, f.image_url, f.status AS fruit_status, s.packaging_size, s.available_quantity,
                     s.selling_price, s.low_stock_threshold,
                     (s.available_quantity <= s.low_stock_threshold) AS is_low
              FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id`;
const ORDER = " ORDER BY f.fruit_name, FIELD(s.packaging_size,'SMALL','MEDIUM','LARGE')";

exports.findAll = async () => (await pool.query(BASE + ORDER))[0];
exports.findByFruit = async (fruitId) => (await pool.query(BASE + ' WHERE s.fruit_id = ?' + ORDER, [fruitId]))[0];
// threshold = null => use each row's own low_stock_threshold
exports.findLow = async (threshold) =>
  (await pool.query(BASE + ' WHERE s.available_quantity <= COALESCE(?, s.low_stock_threshold) AND f.status = \'ACTIVE\'' + ORDER, [threshold]))[0];
exports.findById = async (id) => (await pool.query(BASE + ' WHERE s.stock_id = ?', [id]))[0][0];
exports.update = async (id, { selling_price, low_stock_threshold }) => {
  const data = {};
  if (selling_price !== undefined) data.selling_price = Number(selling_price);
  if (low_stock_threshold !== undefined) data.low_stock_threshold = Number(low_stock_threshold);
  return (await pool.query('UPDATE stock SET ? WHERE stock_id = ?', [data, id]))[0];
};
