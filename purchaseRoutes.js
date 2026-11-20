const router = require('express').Router();
const c = require('../controllers/purchaseController');
const v = require('../middleware/validate');

router.get('/', c.getAll);
router.post('/', v.purchaseRules, c.create);
router.get('/export', c.exportAll);
router.get('/:id', v.validateId, c.getOne);
router.put('/:id', v.validateId, v.purchaseRules, c.update);
router.delete('/:id', v.validateId, c.remove);
module.exports = router;
