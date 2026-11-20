const router = require('express').Router();
const c = require('../controllers/proofController');
const v = require('../middleware/validate');

router.get('/:id/file', v.validateId, c.file);      // admin: any slip; vendor: their own
router.delete('/:id', v.validateId, c.remove);
module.exports = router;
