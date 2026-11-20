const Purchase = require('../models/purchaseModel');
const { HttpError } = require('../middleware/errorHandler');

exports.create = async (req, res, next) => {
  try { res.status(201).json(await Purchase.findById(await Purchase.create(req.body))); } catch (e) { next(e); }
};
exports.getAll = async (req, res, next) => {
  try { res.status(200).json(await Purchase.findAll()); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try {
    const p = await Purchase.findById(req.params.id);
    if (!p) throw new HttpError(404, `Purchase ${req.params.id} not found`);
    res.status(200).json(p);
  } catch (e) { next(e); }
};
exports.exportAll = async (req, res, next) => {
  try { res.status(200).json(await Purchase.findAllDetailed()); } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try { await Purchase.update(req.params.id, req.body); res.status(200).json(await Purchase.findById(req.params.id)); } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    const p = await Purchase.remove(req.params.id);
    res.status(200).json({ message: `Purchase #${p.purchase_id} deleted and its boxes taken out of stock` });
  } catch (e) { next(e); }
};
