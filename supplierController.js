const Supplier = require('../models/supplierModel');
const { HttpError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try { res.status(200).json(await Supplier.findAll()); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try {
    const s = await Supplier.findById(req.params.id);
    if (!s) throw new HttpError(404, `Supplier ${req.params.id} not found`);
    res.status(200).json(s);
  } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).json(await Supplier.findById(await Supplier.create(req.body))); } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    if (!(await Supplier.findById(req.params.id))) throw new HttpError(404, `Supplier ${req.params.id} not found`);
    if ((await Supplier.update(req.params.id, req.body)) === null) throw new HttpError(400, 'No valid fields to update');
    res.status(200).json(await Supplier.findById(req.params.id));
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    const s = await Supplier.findById(req.params.id);
    if (!s) throw new HttpError(404, `Supplier ${req.params.id} not found`);
    // Business constraint: suppliers with purchase history must be kept for the records
    const n = await Supplier.countPurchases(req.params.id);
    if (n > 0) throw new HttpError(409, `${s.business_name} has ${n} purchase record(s) and cannot be deleted`);
    await Supplier.remove(req.params.id);
    res.status(200).json({ message: `Supplier ${s.business_name} deleted` });
  } catch (e) { next(e); }
};
