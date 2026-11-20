const Report = require('../models/reportModel');

const wrap = (fn) => async (req, res, next) => {
  try { res.status(200).json(await fn(req)); } catch (e) { next(e); }
};
exports.topFruits = wrap(() => Report.topFruits());
exports.revenue = wrap((req) => Report.revenue(req.query.from, req.query.to).then((r) => ({ from: req.query.from, to: req.query.to, ...r })));
exports.topVendor = wrap(() => Report.topVendor());
exports.stockLevels = wrap(() => Report.stockLevels());
exports.profitLoss = wrap(() => Report.profitLoss());
