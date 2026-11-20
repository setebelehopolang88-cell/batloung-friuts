const Vendor = require('../models/vendorModel');
const { notifyVendor } = require('../models/notificationModel');
const { HttpError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try { res.status(200).json(await Vendor.findAll(req.query.include === 'deleted')); } catch (e) { next(e); }
};
exports.search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) throw new HttpError(400, 'Provide a search term, e.g. /api/vendors/search?q=Mpho');
    res.status(200).json(await Vendor.search(q));
  } catch (e) { next(e); }
};
exports.balances = async (req, res, next) => {
  try { res.status(200).json(await Vendor.balances()); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) throw new HttpError(404, `Vendor ${req.params.id} not found`);
    const [balance] = await Vendor.balances(req.params.id);
    res.status(200).json({ ...v, ...balance });
  } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).json(await Vendor.findById(await Vendor.create(req.body))); } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const before = await Vendor.findById(req.params.id);
    if (!before) throw new HttpError(404, `Vendor ${req.params.id} not found`);
    if ((await Vendor.update(req.params.id, req.body)) === null) throw new HttpError(400, 'No valid fields to update');
    const after = await Vendor.findById(req.params.id);
    const labels = { vendor_name: 'name', phone_number: 'phone number', location: 'location' };
    const changed = Object.keys(labels).filter((k) => String(before[k]) !== String(after[k])).map((k) => labels[k]);
    const notified = changed.length
      ? await notifyVendor(after.vendor_id, 'EDITED', `The farm desk (${req.user.username}) edited your details: ${changed.join(', ')}.`, req.user.username)
      : false;
    res.status(200).json({ ...after, notified });
  } catch (e) { next(e); }
};

// "View" button: returns the vendor's details and tells the vendor that the farm desk looked at their profile.
exports.view = async (req, res, next) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) throw new HttpError(404, `Vendor ${req.params.id} not found`);
    const [balance] = await Vendor.balances(req.params.id);
    const notified = await notifyVendor(v.vendor_id, 'VIEWED', `The farm desk (${req.user.username}) viewed your vendor profile.`, req.user.username);
    res.status(200).json({ ...v, ...balance, notified });
  } catch (e) { next(e); }
};

// Delete = the vendor is marked DELETED (their past sales stay in the records) and told straight away.
exports.remove = async (req, res, next) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) throw new HttpError(404, `Vendor ${req.params.id} not found`);
    if (v.status === 'DELETED') throw new HttpError(409, 'This vendor is already deleted');
    await Vendor.softDelete(v.vendor_id);
    const notified = await notifyVendor(v.vendor_id, 'DELETED', `Your vendor account was deleted by the farm desk (${req.user.username}). You can no longer sign in or order boxes.`, req.user.username);
    res.status(200).json({ ...(await Vendor.findById(v.vendor_id)), notified });
  } catch (e) { next(e); }
};

exports.restore = async (req, res, next) => {
  try {
    const v = await Vendor.findById(req.params.id);
    if (!v) throw new HttpError(404, `Vendor ${req.params.id} not found`);
    if (v.status !== 'DELETED') throw new HttpError(409, 'This vendor is not deleted');
    await Vendor.restore(v.vendor_id);
    const notified = await notifyVendor(v.vendor_id, 'RESTORED', `Your vendor account was restored by the farm desk (${req.user.username}). You can sign in and order again.`, req.user.username);
    res.status(200).json({ ...(await Vendor.findById(v.vendor_id)), notified });
  } catch (e) { next(e); }
};
