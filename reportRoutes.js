const router = require('express').Router();
const c = require('../controllers/reportController');
const v = require('../middleware/validate');

router.get('/top-fruits', c.topFruits);
router.get('/revenue', v.dateRangeRules, c.revenue);   // ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/top-vendor', c.topVendor);
router.get('/stock-levels', c.stockLevels);
router.get('/profit-loss', c.profitLoss);   // bought vs sold, stock left, profit / loss
module.exports = router;
