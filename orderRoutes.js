const router = require('express').Router();
const c = require('../controllers/orderController');
const proof = require('../controllers/proofController');
const v = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');

router.get('/', c.list);                                  // vendor: own orders; admin: all orders (?limit=6 for the latest)
router.post('/', c.prepare, v.saleRules, c.create);       // { items: [{ fruit_id, packaging_size, quantity }] }
router.post('/:id/proofs', requireRole('VENDOR'), v.validateId, proof.add);   // vendor sends a PDF proof of payment
module.exports = router;
