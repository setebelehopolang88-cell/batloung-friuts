const Offer = require('../models/offerModel');
const Purchase = require('../models/purchaseModel');
const { pool } = require('../config/db');
const { notifyAdmins, notifySupplier } = require('../models/notificationModel');
const { HttpError } = require('../middleware/errorHandler');

const SIZE = { SMALL: 'small', MEDIUM: 'medium', LARGE: 'large' };
const what = (o) => `${o.boxes} ${SIZE[o.packaging_size]} box${o.boxes === 1 ? '' : 'es'} of ${o.fruit_name}`;

// ---------- supplier: send, view, edit and delete the stock they offer ----------
const mine = async (req) => {
  const o = await Offer.findById(req.params.id);
  if (!o || o.supplier_id !== req.user.supplier_id) throw new HttpError(404, `Stock offer ${req.params.id} not found`);
  return o;
};
const registered = async (supplierId, fruitId) => {
  const [r] = await pool.query('SELECT 1 FROM supplier_fruits WHERE supplier_id = ? AND fruit_id = ?', [supplierId, fruitId]);
  if (!r.length) throw new HttpError(400, 'Register that fruit first (Register fruit), then you can send boxes of it');
};
const supplierName = async (id) => (await pool.query('SELECT business_name FROM suppliers WHERE supplier_id = ?', [id]))[0][0]?.business_name || 'A supplier';

exports.mineList = async (req, res, next) => {
  try { res.status(200).json(await Offer.listForSupplier(req.user.supplier_id)); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try {
    await registered(req.user.supplier_id, req.body.fruit_id);
    const o = await Offer.findById(await Offer.create(req.user.supplier_id, req.body));
    await notifyAdmins('OFFER', `${o.business_name} offers ${what(o)} at M ${o.price_per_box.toFixed(2)} a box (offer #${o.offer_id}).`, req.user.username);
    res.status(201).json(o);
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const before = await mine(req);
    if (before.status !== 'PENDING') throw new HttpError(409, `This offer was already ${before.status.toLowerCase()} by the farm desk, so it can no longer be edited`);
    await registered(req.user.supplier_id, req.body.fruit_id);
    if ((await Offer.update(before.offer_id, req.body)).affectedRows === 0) throw new HttpError(409, 'The farm desk just decided this offer, so it can no longer be edited');
    const o = await Offer.findById(before.offer_id);
    await notifyAdmins('OFFER', `${o.business_name} changed offer #${o.offer_id}: now ${what(o)} at M ${o.price_per_box.toFixed(2)} a box.`, req.user.username);
    res.status(200).json(o);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    const o = await mine(req);
    if (o.status === 'ACCEPTED') throw new HttpError(409, 'The farm desk already accepted this offer (it is a purchase now), so it cannot be deleted');
    await Offer.remove(o.offer_id);
    if (o.status === 'PENDING') await notifyAdmins('OFFER', `${o.business_name} withdrew offer #${o.offer_id} (${what(o)}).`, req.user.username);
    res.status(200).json({ message: `Offer #${o.offer_id} deleted` });
  } catch (e) { next(e); }
};

// ---------- admin: see every offer, accept (becomes a purchase, stock goes up) or reject ----------
exports.list = async (req, res, next) => {
  try { res.status(200).json(await Offer.listAll()); } catch (e) { next(e); }
};
exports.accept = async (req, res, next) => {
  try {
    const o = await Offer.findById(req.params.id);
    if (!o) throw new HttpError(404, `Offer ${req.params.id} not found`);
    const cost = req.body.unit_cost !== undefined && req.body.unit_cost !== '' ? Number(req.body.unit_cost) : o.price_per_box;
    if (!Number.isFinite(cost) || cost <= 0) throw new HttpError(400, 'unit_cost must be a number greater than 0');
    if ((await Offer.decide(o.offer_id, 'ACCEPTED', req.body.note)).affectedRows === 0) throw new HttpError(409, `This offer was already ${o.status.toLowerCase()}`);
    let purchaseId;
    try {
      purchaseId = await Purchase.create({ supplier_id: o.supplier_id, items: [{ fruit_id: o.fruit_id, packaging_size: o.packaging_size, quantity: o.boxes, unit_cost: cost }] });
    } catch (err) { await Offer.reopen(o.offer_id); throw err; }   // nothing is half-done: the offer goes back to PENDING
    await Offer.setPurchase(o.offer_id, purchaseId);
    const notified = await notifySupplier(o.supplier_id, 'ACCEPTED',
      `The farm desk (${req.user.username}) accepted your offer #${o.offer_id}: ${what(o)} at M ${cost.toFixed(2)} a box. It is now purchase #${purchaseId}.${req.body.note ? ' Note: ' + req.body.note : ''}`, req.user.username);
    res.status(200).json({ ...(await Offer.findById(o.offer_id)), notified });
  } catch (e) { next(e); }
};
exports.reject = async (req, res, next) => {
  try {
    const o = await Offer.findById(req.params.id);
    if (!o) throw new HttpError(404, `Offer ${req.params.id} not found`);
    if ((await Offer.decide(o.offer_id, 'REJECTED', req.body.note)).affectedRows === 0) throw new HttpError(409, `This offer was already ${o.status.toLowerCase()}`);
    const notified = await notifySupplier(o.supplier_id, 'REJECTED',
      `The farm desk (${req.user.username}) rejected your offer #${o.offer_id} (${what(o)}).${req.body.note ? ' Reason: ' + req.body.note : ''}`, req.user.username);
    res.status(200).json({ ...(await Offer.findById(o.offer_id)), notified });
  } catch (e) { next(e); }
};
exports.removeAdmin = async (req, res, next) => {
  try {
    const o = await Offer.findById(req.params.id);
    if (!o) throw new HttpError(404, `Offer ${req.params.id} not found`);
    if (o.status !== 'REJECTED') throw new HttpError(409, 'Only rejected offers can be deleted (pending ones need a decision, accepted ones are purchases)');
    await Offer.remove(o.offer_id);
    res.status(200).json({ message: `Offer #${o.offer_id} deleted` });
  } catch (e) { next(e); }
};
