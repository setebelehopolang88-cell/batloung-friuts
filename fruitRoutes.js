const router = require('express').Router();
const c = require('../controllers/fruitController');
const v = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const admin = requireRole('ADMIN');

router.get('/', c.getAll);
router.post('/', admin, v.fruitRules(false), c.create);
router.get('/:id', v.validateId, c.getOne);
router.put('/:id', admin, v.validateId, v.fruitRules(true), c.update);
router.delete('/:id', admin, v.validateId, c.remove);
module.exports = router;
