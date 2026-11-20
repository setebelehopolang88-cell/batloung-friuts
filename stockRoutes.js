const router = require('express').Router();
const c = require('../controllers/stockController');
const v = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const admin = requireRole('ADMIN');

router.get('/', c.getAll);                                   // every fruit x packaging size
router.get('/low', admin, c.getLow);                                // low-stock items (?threshold=15 optional)
router.get('/fruit/:id', v.validateId, c.getByFruit);        // small/medium/large for one fruit
router.put('/:id', admin, v.validateId, v.stockRules, c.update);    // selling price / low-stock threshold
module.exports = router;
