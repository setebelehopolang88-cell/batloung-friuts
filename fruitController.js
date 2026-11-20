const Fruit = require('../models/fruitModel');
const Stock = require('../models/stockModel');
const { HttpError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status && !['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) throw new HttpError(400, 'status must be ACTIVE or INACTIVE');
    // "available fruits" = ACTIVE by default; ?status=ALL not needed - pass status=INACTIVE to see the rest
    res.status(200).json(await Fruit.findAll(status ? status.toUpperCase() : undefined));
  } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try {
    const f = await Fruit.findById(req.params.id);
    if (!f) throw new HttpError(404, `Fruit ${req.params.id} not found`);
    res.status(200).json({ ...f, stock: await Stock.findByFruit(f.fruit_id) });
  } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try {
    const id = await Fruit.create(req.body);
    res.status(201).json({ ...(await Fruit.findById(id)), stock: await Stock.findByFruit(id) });
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    if (!(await Fruit.findById(req.params.id))) throw new HttpError(404, `Fruit ${req.params.id} not found`);
    await Fruit.update(req.params.id, req.body);
    res.status(200).json({ ...(await Fruit.findById(req.params.id)), stock: await Stock.findByFruit(req.params.id) });
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    const f = await Fruit.findById(req.params.id);
    if (!f) throw new HttpError(404, `Fruit ${req.params.id} not found`);
    const used = await Fruit.countRecords(f.fruit_id);
    if (used > 0) throw new HttpError(409, `${f.fruit_name} is on ${used} purchase / sale record(s) and cannot be deleted. Set it to INACTIVE instead.`);
    await Fruit.remove(f.fruit_id);
    res.status(200).json({ message: `${f.fruit_name} deleted` });
  } catch (e) { next(e); }
};
