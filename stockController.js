const Stock = require('../models/stockModel');
const Fruit = require('../models/fruitModel');
const { HttpError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try { res.status(200).json(await Stock.findAll()); } catch (e) { next(e); }
};
exports.getLow = async (req, res, next) => {
  try {
    let threshold = null;
    if (req.query.threshold !== undefined) {
      threshold = Number(req.query.threshold);
      if (!Number.isInteger(threshold) || threshold < 0) throw new HttpError(400, 'threshold must be a whole number >= 0');
    }
    res.status(200).json(await Stock.findLow(threshold));
  } catch (e) { next(e); }
};
exports.getByFruit = async (req, res, next) => {
  try {
    if (!(await Fruit.findById(req.params.id))) throw new HttpError(404, `Fruit ${req.params.id} not found`);
    res.status(200).json(await Stock.findByFruit(req.params.id));
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    if (!(await Stock.findById(req.params.id))) throw new HttpError(404, `Stock record ${req.params.id} not found`);
    await Stock.update(req.params.id, req.body);
    res.status(200).json(await Stock.findById(req.params.id));
  } catch (e) { next(e); }
};
