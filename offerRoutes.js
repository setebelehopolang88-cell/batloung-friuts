const router = require('express').Router();
const c = require('../controllers/offerController');
const v = require('../middleware/validate');

router.get('/', c.list);
router.post('/:id/accept', v.validateId, v.decisionRules, c.accept);   // { unit_cost?, note? }
router.post('/:id/reject', v.validateId, v.decisionRules, c.reject);   // { note? }
router.delete('/:id', v.validateId, c.removeAdmin);
module.exports = router;
