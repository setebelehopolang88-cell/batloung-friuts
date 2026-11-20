const Sale = require('../models/saleModel');
const Order = require('../models/orderModel');
const { notifyVendor } = require('../models/notificationModel');
const Proof = require('../models/proofModel');
const { pool } = require('../config/db');
const { HttpError } = require('../middleware/errorHandler');

exports.create = async (req, res, next) => {
  try { res.status(201).json(await Sale.findById(await Sale.create(req.body))); } catch (e) { next(e); }
};
exports.getAll = async (req, res, next) => {
  try { res.status(200).json(await Sale.findAll()); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try {
    const s = await Sale.findById(req.params.id);
    if (!s) throw new HttpError(404, `Sale ${req.params.id} not found`);
    res.status(200).json(s);
  } catch (e) { next(e); }
};
exports.addPayment = async (req, res, next) => {
  try {
    await Sale.addPayment(req.params.id, req.body);
    res.status(201).json(await Sale.findById(req.params.id));
  } catch (e) { next(e); }
};

// Every sale with its items, for the "Download list" button.
exports.exportAll = async (req, res, next) => {
  try { res.status(200).json(await Order.list()); } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const { previous_vendor_id } = await Sale.update(req.params.id, req.body);
    const sale = await Sale.findById(req.params.id);
    const notified = await notifyVendor(sale.vendor_id, 'EDITED', `The farm desk (${req.user.username}) edited your order #${sale.sale_id}. The new total is M ${sale.total_amount.toFixed(2)}.`, req.user.username);
    res.status(200).json({ ...sale, notified, vendor_changed: previous_vendor_id !== sale.vendor_id });
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    const slips = await Proof.storedNamesForSale(req.params.id);
    const sale = await Sale.remove(req.params.id);
    Proof.deleteFiles(slips);
    const notified = await notifyVendor(sale.vendor_id, 'DELETED', `The farm desk (${req.user.username}) cancelled your order #${sale.sale_id}.`, req.user.username);
    res.status(200).json({ message: `Sale #${sale.sale_id} deleted and its boxes returned to stock`, notified });
  } catch (e) { next(e); }
};

// Admin notices to the vendor about an order: REJECTED (order cancelled, boxes back in stock), READY (come and take it) or DELAYED.
exports.notice = async (req, res, next) => {
  try {
    const { type, note } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) throw new HttpError(404, `Sale ${req.params.id} not found`);
    const extra = note ? ` ${type === 'REJECTED' ? 'Reason' : 'Note'}: ${note}` : '';
    const by = req.user.username;
    let message;
    if (type === 'REJECTED') {
      const slips = await Proof.storedNamesForSale(sale.sale_id);
      await Sale.remove(sale.sale_id);   // the boxes go back into stock
      Proof.deleteFiles(slips);
      message = `Your order #${sale.sale_id} was rejected by the farm desk (${by}). The order is cancelled.${extra}`;
    } else {
      await pool.query('UPDATE sales SET order_status = ? WHERE sale_id = ?', [type, sale.sale_id]);
      message = type === 'READY'
        ? `Your order #${sale.sale_id} is ready. Please come to Batloung Farm to take your order.${extra}`
        : `Your order #${sale.sale_id} is delayed. Sorry for the wait - we will let you know when it is ready.${extra}`;
    }
    const notified = await notifyVendor(sale.vendor_id, type, message, by);
    res.status(200).json({ type, sale_id: sale.sale_id, notified });
  } catch (e) { next(e); }
};
