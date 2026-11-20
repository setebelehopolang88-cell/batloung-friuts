const Sale = require('../models/saleModel');
const Order = require('../models/orderModel');
const { notifyAdmins } = require('../models/notificationModel');
const { HttpError } = require('../middleware/errorHandler');

// Vendors can only order for themselves, and always on credit: the farm desk records the payment
// (Sales -> Open -> Record payment), so a vendor cannot mark their own order as paid.
exports.prepare = (req, res, next) => {
  if (req.user.role === 'VENDOR') {
    req.body = { ...(req.body || {}), vendor_id: req.user.vendor_id, payment: { method: 'CREDIT' } };
  }
  next();
};

exports.create = async (req, res, next) => {
  try {
    const saleId = await Sale.create(req.body); // same all-or-nothing transaction as the farm desk's sales
    const order = (await Order.list({ saleId }))[0];
    if (req.user.role === 'VENDOR') {
      const boxes = order.items.reduce((n, i) => n + i.quantity, 0);
      await notifyAdmins('ORDER', `${order.vendor_name} ordered ${boxes} box${boxes === 1 ? '' : 'es'} (order #${order.sale_id}, M ${order.total_amount.toFixed(2)}).`, req.user.username);
    }
    res.status(201).json(order);
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    let limit;
    if (req.query.limit !== undefined) {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, 'limit must be a whole number from 1 to 100');
    }
    const vendorId = req.user.role === 'VENDOR' ? req.user.vendor_id : undefined;
    res.status(200).json(await Order.list({ vendorId, limit }));
  } catch (e) { next(e); }
};
