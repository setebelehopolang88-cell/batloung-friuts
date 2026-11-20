const router = require('express').Router();
const c = require('../controllers/saleController');
const v = require('../middleware/validate');

router.get('/', c.getAll);
router.post('/', v.saleRules, c.create);
router.get('/export', c.exportAll);
router.get('/:id', v.validateId, c.getOne);
router.put('/:id', v.validateId, v.saleEditRules, c.update);
router.delete('/:id', v.validateId, c.remove);
router.post('/:id/notice', v.validateId, v.noticeRules, c.notice);   // rejected / come to take the order / delayed
router.post('/:id/payments', v.validateId, v.paymentRules, c.addPayment);
module.exports = router;
