const { pool } = require('../config/db');

const BASE = `SELECT o.offer_id, o.supplier_id, s.business_name, o.fruit_id, f.fruit_name, f.image_url, o.packaging_size, o.boxes, o.price_per_box,
                     ROUND(o.boxes * o.price_per_box, 2) AS total, o.note, o.status, o.admin_note, o.purchase_id, o.created_at, o.updated_at
              FROM supplier_offers o JOIN suppliers s ON s.supplier_id = o.supplier_id JOIN fruits f ON f.fruit_id = o.fruit_id`;
const ORDER = ' ORDER BY o.offer_id DESC';

exports.listForSupplier = async (supplierId) => (await pool.query(BASE + ' WHERE o.supplier_id = ?' + ORDER, [supplierId]))[0];
exports.listAll = async () => (await pool.query(BASE + ORDER))[0];
exports.findById = async (id) => (await pool.query(BASE + ' WHERE o.offer_id = ?', [id]))[0][0];

exports.create = async (supplierId, { fruit_id, packaging_size, boxes, price_per_box, note }) =>
  (await pool.query('INSERT INTO supplier_offers (supplier_id, fruit_id, packaging_size, boxes, price_per_box, note) VALUES (?,?,?,?,?,?)',
    [supplierId, fruit_id, packaging_size, boxes, price_per_box, note || null]))[0].insertId;
exports.update = async (id, { fruit_id, packaging_size, boxes, price_per_box, note }) =>
  (await pool.query('UPDATE supplier_offers SET fruit_id = ?, packaging_size = ?, boxes = ?, price_per_box = ?, note = ? WHERE offer_id = ? AND status = \'PENDING\'',
    [fruit_id, packaging_size, boxes, price_per_box, note || null, id]))[0];
exports.remove = async (id) => (await pool.query('DELETE FROM supplier_offers WHERE offer_id = ?', [id]))[0];

// Moves a PENDING offer to a new status in one step (so two admins cannot decide the same offer twice).
exports.decide = async (id, status, adminNote, purchaseId = null) =>
  (await pool.query('UPDATE supplier_offers SET status = ?, admin_note = ?, purchase_id = ? WHERE offer_id = ? AND status = \'PENDING\'',
    [status, adminNote || null, purchaseId, id]))[0];
exports.setPurchase = async (id, purchaseId) => pool.query('UPDATE supplier_offers SET purchase_id = ? WHERE offer_id = ?', [purchaseId, id]);
exports.reopen = async (id) => pool.query("UPDATE supplier_offers SET status = 'PENDING', purchase_id = NULL WHERE offer_id = ?", [id]);
