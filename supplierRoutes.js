const router = require('express').Router();
const c = require('../controllers/supplierController');
const v = require('../middleware/validate');

router.get('/', c.getAll);
router.post('/', v.supplierRules(false), c.create);
router.get('/:id', v.validateId, c.getOne);
router.put('/:id', v.validateId, v.supplierRules(true), c.update);
router.delete('/:id', v.validateId, c.remove);
module.exports = router;
