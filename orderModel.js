const { pool } = require('../config/db');
const { round2 } = require('../utils/calc');

// Sales shown as "orders": every sale with its items AND the fruit pictures.
// Options: vendorId (one vendor), saleId (one sale), limit (latest N).
exports.list = async ({ vendorId, saleId, limit } = {}) => {
  const where = []; const params = [];
  if (vendorId) { where.push('s.vendor_id = ?'); params.push(vendorId); }
  if (saleId) { where.push('s.sale_id = ?'); params.push(saleId); }
  if (limit) params.push(limit);
  const [sales] = await pool.query(
    `SELECT s.sale_id, s.vendor_id, v.vendor_name, s.sale_date, s.payment_status, s.order_status, s.total_amount,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = s.sale_id),0) AS amount_paid
     FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.sale_date DESC, s.sale_id DESC ${limit ? 'LIMIT ?' : ''}`, params);
  if (!sales.length) return [];
  const [items] = await pool.query(
    `SELECT d.sale_id, d.fruit_id, f.fruit_name, f.image_url, d.packaging_size, d.quantity, d.unit_price
     FROM sales_details d JOIN fruits f ON f.fruit_id = d.fruit_id
     WHERE d.sale_id IN (?) ORDER BY d.sales_detail_id`, [sales.map((s) => s.sale_id)]);
  const [proofs] = await pool.query('SELECT proof_id, sale_id, file_name, uploaded_at FROM payment_proofs WHERE sale_id IN (?) ORDER BY proof_id', [sales.map((s) => s.sale_id)]);
  return sales.map((s) => ({
    ...s,
    proofs: proofs.filter((p) => p.sale_id === s.sale_id),
    outstanding_balance: round2(Math.max(s.total_amount - s.amount_paid, 0)),
    items: items.filter((i) => i.sale_id === s.sale_id).map((i) => ({ ...i, line_total: round2(i.quantity * i.unit_price) })),
  }));
};
