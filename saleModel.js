const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { HttpError } = require('../middleware/errorHandler');
const { calculateSaleTotal, calculateLineTotal, derivePaymentStatus, outstandingBalance, round2 } = require('../utils/calc');

// Records a sale atomically. If ANY item is invalid or out of stock the whole sale is rolled back:
// no stock is reduced and no sale/detail/payment rows are left behind.
exports.create = async ({ vendor_id, items, payment }) =>
  withTransaction(async (conn) => {
    const [v] = await conn.query('SELECT vendor_id FROM vendors WHERE vendor_id = ?', [vendor_id]);
    if (!v.length) throw new HttpError(404, `Vendor ${vendor_id} not found`);

    // Merge repeated lines (same fruit + size) so stock is checked against the combined quantity
    const merged = new Map();
    for (const it of items) {
      const key = `${it.fruit_id}-${it.packaging_size}`;
      merged.set(key, { ...it, quantity: (merged.get(key)?.quantity || 0) + it.quantity });
    }

    const lines = [];
    for (const it of merged.values()) {
      // FOR UPDATE locks the stock row so two simultaneous sales cannot both take the last boxes
      const [rows] = await conn.query(
        `SELECT s.stock_id, s.available_quantity, s.selling_price, f.fruit_name, f.status
         FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id
         WHERE s.fruit_id = ? AND s.packaging_size = ? FOR UPDATE`, [it.fruit_id, it.packaging_size]);
      if (!rows.length) throw new HttpError(404, `Fruit ${it.fruit_id} (${it.packaging_size}) does not exist in stock`);
      const st = rows[0];
      if (st.status !== 'ACTIVE') throw new HttpError(400, `${st.fruit_name} is inactive and cannot be sold`);
      if (st.selling_price <= 0) throw new HttpError(400, `No selling price set for ${st.fruit_name} (${it.packaging_size})`);
      if (st.available_quantity < it.quantity)
        throw new HttpError(400, `Insufficient stock for ${st.fruit_name} (${it.packaging_size}): requested ${it.quantity}, available ${st.available_quantity}. Sale rejected.`);
      // Guarded decrease: can never produce a negative quantity
      const [u] = await conn.query(
        'UPDATE stock SET available_quantity = available_quantity - ? WHERE stock_id = ? AND available_quantity >= ?',
        [it.quantity, st.stock_id, it.quantity]);
      if (u.affectedRows !== 1) throw new HttpError(400, `Insufficient stock for ${st.fruit_name} (${it.packaging_size})`);
      lines.push({ fruit_id: it.fruit_id, packaging_size: it.packaging_size, quantity: it.quantity, unit_price: st.selling_price });
    }

    const total = calculateSaleTotal(lines); // calculated automatically from packaging-specific prices

    // Payment: CASH / MOBILE_MONEY with an amount (default = full total), or CREDIT (nothing paid now)
    const method = payment?.method || 'CREDIT';
    const paid = method === 'CREDIT' ? 0 : round2(payment.amount ?? total);
    if (paid > total) throw new HttpError(400, `Payment (${paid}) is more than the sale total (${total})`);
    const status = derivePaymentStatus(total, paid);

    const [s] = await conn.query('INSERT INTO sales (vendor_id, payment_status, total_amount) VALUES (?,?,?)', [vendor_id, status, total]);
    for (const l of lines)
      await conn.query('INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (?,?,?,?,?)',
        [s.insertId, l.fruit_id, l.packaging_size, l.quantity, l.unit_price]);
    await conn.query('INSERT INTO payments (sale_id, payment_method, amount) VALUES (?,?,?)', [s.insertId, method, paid]);
    return s.insertId;
  });

const mergeLines = (items) => {
  const merged = new Map();
  for (const it of items) {
    const key = `${it.fruit_id}-${it.packaging_size}`;
    merged.set(key, { fruit_id: it.fruit_id, packaging_size: it.packaging_size, quantity: (merged.get(key)?.quantity || 0) + it.quantity });
  }
  return merged;
};

// Edit a sale (vendor and items). Only the difference is moved in and out of stock, all-or-nothing.
// Lines that were already on the sale keep the price they were sold at; new lines use today's selling price.
// Payments already recorded are kept; the status is worked out again from the new total.
exports.update = async (saleId, { vendor_id, items }) =>
  withTransaction(async (conn) => {
    const [[sale]] = await conn.query('SELECT sale_id, vendor_id FROM sales WHERE sale_id = ? FOR UPDATE', [saleId]);
    if (!sale) throw new HttpError(404, `Sale ${saleId} not found`);
    const [v] = await conn.query('SELECT vendor_id FROM vendors WHERE vendor_id = ?', [vendor_id]);
    if (!v.length) throw new HttpError(404, `Vendor ${vendor_id} not found`);

    const [oldRows] = await conn.query('SELECT fruit_id, packaging_size, quantity, unit_price FROM sales_details WHERE sale_id = ?', [saleId]);
    const old = new Map();
    for (const o of oldRows) {
      const key = `${o.fruit_id}-${o.packaging_size}`;
      old.set(key, { ...o, quantity: (old.get(key)?.quantity || 0) + o.quantity });
    }
    const next = mergeLines(items);

    const lines = [];
    for (const key of new Set([...old.keys(), ...next.keys()])) {
      const o = old.get(key); const n = next.get(key);
      const delta = (n?.quantity || 0) - (o?.quantity || 0); // boxes that must now come out of stock (negative = go back in)
      const ref = o || n;
      let price = o?.unit_price;
      if (delta !== 0 || !o) {
        const [rows] = await conn.query(
          `SELECT s.stock_id, s.available_quantity, s.selling_price, f.fruit_name, f.status
           FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id
           WHERE s.fruit_id = ? AND s.packaging_size = ? FOR UPDATE`, [ref.fruit_id, ref.packaging_size]);
        if (!rows.length) throw new HttpError(404, `Fruit ${ref.fruit_id} (${ref.packaging_size}) does not exist in stock`);
        const st = rows[0];
        if (!o) { // a brand-new line on this sale
          if (st.status !== 'ACTIVE') throw new HttpError(400, `${st.fruit_name} is inactive and cannot be sold`);
          if (st.selling_price <= 0) throw new HttpError(400, `No selling price set for ${st.fruit_name} (${ref.packaging_size})`);
          price = st.selling_price;
        }
        if (delta > 0) {
          const [u] = await conn.query('UPDATE stock SET available_quantity = available_quantity - ? WHERE stock_id = ? AND available_quantity >= ?', [delta, st.stock_id, delta]);
          if (u.affectedRows !== 1)
            throw new HttpError(400, `Insufficient stock for ${st.fruit_name} (${ref.packaging_size}): ${delta} more box(es) needed, available ${st.available_quantity}. Nothing was changed.`);
        } else if (delta < 0) {
          await conn.query('UPDATE stock SET available_quantity = available_quantity + ? WHERE stock_id = ?', [-delta, st.stock_id]);
        }
      }
      if (n) lines.push({ fruit_id: n.fruit_id, packaging_size: n.packaging_size, quantity: n.quantity, unit_price: price });
    }

    const total = calculateSaleTotal(lines);
    const [[{ paid }]] = await conn.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE sale_id = ?', [saleId]);
    if (paid > total) throw new HttpError(400, `Payments already recorded (${paid}) are more than the new total (${total}). Nothing was changed.`);

    await conn.query('DELETE FROM sales_details WHERE sale_id = ?', [saleId]);
    for (const l of lines)
      await conn.query('INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (?,?,?,?,?)',
        [saleId, l.fruit_id, l.packaging_size, l.quantity, l.unit_price]);
    await conn.query('UPDATE sales SET vendor_id = ?, total_amount = ?, payment_status = ? WHERE sale_id = ?',
      [vendor_id, total, derivePaymentStatus(total, paid), saleId]);
    return { previous_vendor_id: sale.vendor_id };
  });

// Delete a sale: every box goes back into stock and its payments are removed. All-or-nothing.
exports.remove = async (saleId) =>
  withTransaction(async (conn) => {
    const [[sale]] = await conn.query('SELECT sale_id, vendor_id, total_amount FROM sales WHERE sale_id = ? FOR UPDATE', [saleId]);
    if (!sale) throw new HttpError(404, `Sale ${saleId} not found`);
    const [lines] = await conn.query('SELECT fruit_id, packaging_size, SUM(quantity) AS quantity FROM sales_details WHERE sale_id = ? GROUP BY fruit_id, packaging_size', [saleId]);
    for (const l of lines)
      await conn.query('UPDATE stock SET available_quantity = available_quantity + ? WHERE fruit_id = ? AND packaging_size = ?', [Number(l.quantity), l.fruit_id, l.packaging_size]);
    await conn.query('DELETE FROM sales WHERE sale_id = ?', [saleId]); // sales_details and payments go with it
    return sale;
  });

// Later payment on a credit / part-paid sale
exports.addPayment = async (saleId, { method, amount }) =>
  withTransaction(async (conn) => {
    const [[sale]] = await conn.query('SELECT sale_id, total_amount FROM sales WHERE sale_id = ? FOR UPDATE', [saleId]);
    if (!sale) throw new HttpError(404, `Sale ${saleId} not found`);
    const [[{ paid }]] = await conn.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE sale_id = ?', [saleId]);
    const balance = outstandingBalance(sale.total_amount, paid);
    if (balance <= 0) throw new HttpError(400, 'This sale is already fully paid');
    if (amount > balance) throw new HttpError(400, `Payment (${amount}) is more than the outstanding balance (${balance})`);
    await conn.query('INSERT INTO payments (sale_id, payment_method, amount) VALUES (?,?,?)', [saleId, method, amount]);
    await conn.query('UPDATE sales SET payment_status = ? WHERE sale_id = ?',
      [derivePaymentStatus(sale.total_amount, round2(paid + amount)), saleId]);
  });

const withBalance = (s) => ({ ...s, outstanding_balance: outstandingBalance(s.total_amount, s.amount_paid) });

exports.findAll = async () => {
  const [rows] = await pool.query(
    `SELECT s.sale_id, s.vendor_id, v.vendor_name, s.sale_date, s.payment_status, s.total_amount,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = s.sale_id),0) AS amount_paid
     FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id
     ORDER BY s.sale_date DESC, s.sale_id DESC`);
  return rows.map(withBalance);
};

exports.findById = async (id) => {
  const [[sale]] = await pool.query(
    `SELECT s.*, v.vendor_name, v.phone_number,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = s.sale_id),0) AS amount_paid
     FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id WHERE s.sale_id = ?`, [id]);
  if (!sale) return null;
  const [items] = await pool.query(
    `SELECT d.*, f.fruit_name FROM sales_details d JOIN fruits f ON f.fruit_id = d.fruit_id WHERE d.sale_id = ?`, [id]);
  const [payments] = await pool.query('SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date, payment_id', [id]);
  return { ...withBalance(sale), items: items.map((i) => ({ ...i, line_total: calculateLineTotal(i.quantity, i.unit_price) })), payments };
};
