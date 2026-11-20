const router = require('express').Router();
const c = require('../controllers/accountController');
const v = require('../middleware/validate');

router.get('/', c.list);
router.get('/:id/password', v.validateId, c.reveal);
router.put('/:id/password', v.validateId, c.reset);
module.exports = router;
