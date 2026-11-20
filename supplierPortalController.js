const { pool } = require('../config/db');
const Fruit = require('../models/fruitModel');
const { HttpError } = require('../middleware/errorHandler');
const { round2 } = require('../utils/calc');

const myFruits = async (supplierId) =>
  (await pool.query(
    `SELECT f.fruit_id, f.fruit_name, f.description, f.image_url, f.status, sf.registered_at,
            COALESCE((SELECT SUM(s.available_quantity) FROM stock s WHERE s.fruit_id = f.fruit_id),0) AS boxes_in_stock
     FROM supplier_fruits sf JOIN fruits f ON f.fruit_id = sf.fruit_id
     WHERE sf.supplier_id = ? ORDER BY sf.registered_at DESC, f.fruit_name`, [supplierId]))[0];

// Dashboard data: the supplier's profile, their registered fruits (with pictures) and what the farm bought from them.
exports.overview = async (req, res, next) => {
  try {
    const id = req.user.supplier_id;
    const [[supplier]] = await pool.query('SELECT * FROM suppliers WHERE supplier_id = ?', [id]);
    const [purchases] = await pool.query(
      'SELECT purchase_id, purchase_date, total_amount FROM purchases WHERE supplier_id = ? ORDER BY purchase_date DESC, purchase_id DESC LIMIT 20', [id]);
    if (purchases.length) {
      const [items] = await pool.query(
        `SELECT d.purchase_id, d.fruit_id, f.fruit_name, f.image_url, d.packaging_size, d.quantity, d.unit_cost
         FROM purchase_details d JOIN fruits f ON f.fruit_id = d.fruit_id WHERE d.purchase_id IN (?) ORDER BY d.purchase_detail_id`,
        [purchases.map((p) => p.purchase_id)]);
      purchases.forEach((p) => { p.items = items.filter((i) => i.purchase_id === p.purchase_id).map((i) => ({ ...i, line_total: round2(i.quantity * i.unit_cost) })); });
    }
    res.status(200).json({ supplier, fruits: await myFruits(id), purchases });
  } catch (e) { next(e); }
};

// Register a fruit the supplier grows: pick an existing fruit, or type a new name (+ picture). Either way it
// is linked to the supplier so it shows on their dashboard and on the farm's dashboard.
exports.registerFruit = async (req, res, next) => {
  try {
    const id = req.user.supplier_id;
    const { fruit_id, fruit_name, description, image_url } = req.body;
    let fruit = fruit_id ? await Fruit.findById(Number(fruit_id)) : await Fruit.findByName(fruit_name);
    if (fruit_id && !fruit) throw new HttpError(404, `Fruit ${fruit_id} not found`);
    if (!fruit) {
      // New fruit: prices stay 0 until the farm desk sets them, so it cannot be sold by accident.
      const newId = await Fruit.create({ fruit_name, description, image_url, status: 'ACTIVE' });
      fruit = await Fruit.findById(newId);
    } else if (image_url && !fruit.image_url) {
      await Fruit.update(fruit.fruit_id, { image_url }); // only fills a missing picture, never replaces another supplier's
    }
    const [r] = await pool.query('INSERT IGNORE INTO supplier_fruits (supplier_id, fruit_id) VALUES (?,?)', [id, fruit.fruit_id]);
    const already = r.affectedRows === 0;
    res.status(already ? 200 : 201).json({ already_registered: already, fruits: await myFruits(id) });
  } catch (e) { next(e); }
};

exports.removeFruit = async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM supplier_fruits WHERE supplier_id = ? AND fruit_id = ?', [req.user.supplier_id, req.params.id]);
    if (!r.affectedRows) throw new HttpError(404, 'That fruit is not on your list');
    res.status(200).json({ fruits: await myFruits(req.user.supplier_id) });
  } catch (e) { next(e); }
};
