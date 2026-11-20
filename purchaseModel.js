const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { HttpError } = require('../middleware/errorHandler');
const { calculatePurchaseTotal } = require('../utils/calc');

// Records a whole purchase atomically: header + all items + stock increase. Any failure => ROLLBACK.
exports.create = async ({ supplier_id, purchase_date, items }) =>
  withTransaction(async (conn) => {
    const [sup] = await conn.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [supplier_id]);
    if (!sup.length) throw new HttpError(404, `Supplier ${supplier_id} not found`);

    // Validate every item first
    for (const [i, it] of items.entries()) {
      const [fr] = await conn.query('SELECT fruit_name, status FROM fruits WHERE fruit_id = ?', [it.fruit_id]);
      if (!fr.length) throw new HttpError(404, `Item ${i + 1}: fruit ${it.fruit_id} not found`);
      if (fr[0].status !== 'ACTIVE') throw new HttpError(400, `Item ${i + 1}: ${fr[0].fruit_name} is inactive and cannot be purchased`);
    }

    const total = calculatePurchaseTotal(items); // calculated automatically
    const [p] = await conn.query('INSERT INTO purchases (supplier_id, purchase_date, total_amount) VALUES (?,?,?)',
      [supplier_id, purchase_date || new Date(), total]);

    for (const it of items) {
      await conn.query(
        'INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES (?,?,?,?,?)',
        [p.insertId, it.fruit_id, it.quantity, it.unit_cost, it.packaging_size]);
      // Increase the stock for this fruit AND packaging size
      const [u] = await conn.query(
        'UPDATE stock SET available_quantity = available_quantity + ? WHERE fruit_id = ? AND packaging_size = ?',
        [it.quantity, it.fruit_id, it.packaging_size]);
      if (u.affectedRows === 0)
        await conn.query('INSERT INTO stock (fruit_id, packaging_size, available_quantity) VALUES (?,?,?)',
          [it.fruit_id, it.packaging_size, it.quantity]);
    }
    return p.insertId;
  });

exports.findAll = async () =>
  (await pool.query(`SELECT p.purchase_id, p.supplier_id, s.business_name, s.province, p.purchase_date, p.total_amount
                     FROM purchases p JOIN suppliers s ON s.supplier_id = p.supplier_id
                     ORDER BY p.purchase_date DESC, p.purchase_id DESC`))[0];

exports.findById = async (id) => {
  const [[purchase]] = await pool.query(
    `SELECT p.*, s.business_name, s.province FROM purchases p JOIN suppliers s ON s.supplier_id = p.supplier_id WHERE p.purchase_id = ?`, [id]);
  if (!purchase) return null;
  const [items] = await pool.query(
    `SELECT d.*, f.fruit_name, (d.quantity * d.unit_cost) AS line_total
     FROM purchase_details d JOIN fruits f ON f.fruit_id = d.fruit_id WHERE d.purchase_id = ?`, [id]);
  return { ...purchase, items };
};

// Every purchase with its items, for the "Download list" button.
exports.findAllDetailed = async () => {
  const purchases = await exports.findAll();
  if (!purchases.length) return [];
  const [items] = await pool.query(
    `SELECT d.purchase_id, d.fruit_id, f.fruit_name, d.packaging_size, d.quantity, d.unit_cost, (d.quantity * d.unit_cost) AS line_total
     FROM purchase_details d JOIN fruits f ON f.fruit_id = d.fruit_id
     WHERE d.purchase_id IN (?) ORDER BY d.purchase_detail_id`, [purchases.map((p) => p.purchase_id)]);
  return purchases.map((p) => ({ ...p, items: items.filter((i) => i.purchase_id === p.purchase_id) }));
};

const sumByKey = (rows) => {
  const m = new Map();
  for (const r of rows) {
    const key = `${r.fruit_id}-${r.packaging_size}`;
    m.set(key, { fruit_id: r.fruit_id, packaging_size: r.packaging_size, quantity: (m.get(key)?.quantity || 0) + Number(r.quantity) });
  }
  return m;
};

// Moves stock by `delta` boxes (positive = more stock). Taking boxes away fails if some of them were already sold.
const moveStock = async (conn, fruit_id, packaging_size, delta) => {
  if (delta === 0) return;
  if (delta > 0) {
    const [u] = await conn.query('UPDATE stock SET available_quantity = available_quantity + ? WHERE fruit_id = ? AND packaging_size = ?', [delta, fruit_id, packaging_size]);
    if (u.affectedRows === 0) await conn.query('INSERT INTO stock (fruit_id, packaging_size, available_quantity) VALUES (?,?,?)', [fruit_id, packaging_size, delta]);
    return;
  }
  const [u] = await conn.query(
    'UPDATE stock SET available_quantity = available_quantity + ? WHERE fruit_id = ? AND packaging_size = ? AND available_quantity >= ?',
    [delta, fruit_id, packaging_size, -delta]);
  if (u.affectedRows !== 1) {
    const [[st]] = await conn.query(
      'SELECT s.available_quantity, f.fruit_name FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id WHERE s.fruit_id = ? AND s.packaging_size = ?', [fruit_id, packaging_size]);
    throw new HttpError(409, `${st?.fruit_name || 'This fruit'} (${packaging_size}): ${-delta} box(es) would have to leave stock, but only ${st?.available_quantity ?? 0} are left - the rest were already sold. Nothing was changed.`);
  }
};

// Edit a purchase (supplier and items). Only the difference goes in or out of stock, all-or-nothing.
exports.update = async (id, { supplier_id, items }) =>
  withTransaction(async (conn) => {
    const [[p]] = await conn.query('SELECT purchase_id FROM purchases WHERE purchase_id = ? FOR UPDATE', [id]);
    if (!p) throw new HttpError(404, `Purchase ${id} not found`);
    const [sup] = await conn.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [supplier_id]);
    if (!sup.length) throw new HttpError(404, `Supplier ${supplier_id} not found`);

    const [oldRows] = await conn.query('SELECT fruit_id, packaging_size, quantity FROM purchase_details WHERE purchase_id = ?', [id]);
    const old = sumByKey(oldRows);
    const next = sumByKey(items);
    for (const [i, it] of items.entries()) {
      const [fr] = await conn.query('SELECT fruit_name, status FROM fruits WHERE fruit_id = ?', [it.fruit_id]);
      if (!fr.length) throw new HttpError(404, `Item ${i + 1}: fruit ${it.fruit_id} not found`);
      if (fr[0].status !== 'ACTIVE' && !old.has(`${it.fruit_id}-${it.packaging_size}`))
        throw new HttpError(400, `Item ${i + 1}: ${fr[0].fruit_name} is inactive and cannot be purchased`);
    }
    for (const key of new Set([...old.keys(), ...next.keys()])) {
      const ref = old.get(key) || next.get(key);
      await moveStock(conn, ref.fruit_id, ref.packaging_size, (next.get(key)?.quantity || 0) - (old.get(key)?.quantity || 0));
    }
    await conn.query('DELETE FROM purchase_details WHERE purchase_id = ?', [id]);
    for (const it of items)
      await conn.query('INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES (?,?,?,?,?)',
        [id, it.fruit_id, it.quantity, it.unit_cost, it.packaging_size]);
    await conn.query('UPDATE purchases SET supplier_id = ?, total_amount = ? WHERE purchase_id = ?', [supplier_id, calculatePurchaseTotal(items), id]);
  });

// Delete a purchase: its boxes leave stock again (refused if some were already sold).
exports.remove = async (id) =>
  withTransaction(async (conn) => {
    const [[p]] = await conn.query('SELECT purchase_id, supplier_id, total_amount FROM purchases WHERE purchase_id = ? FOR UPDATE', [id]);
    if (!p) throw new HttpError(404, `Purchase ${id} not found`);
    const [rows] = await conn.query('SELECT fruit_id, packaging_size, quantity FROM purchase_details WHERE purchase_id = ?', [id]);
    for (const l of sumByKey(rows).values()) await moveStock(conn, l.fruit_id, l.packaging_size, -l.quantity);
    await conn.query('DELETE FROM purchases WHERE purchase_id = ?', [id]); // purchase_details go with it
    return p;
  });
