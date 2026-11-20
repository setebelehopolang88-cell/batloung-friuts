const router = require('express').Router();
const c = require('../controllers/vendorController');
const v = require('../middleware/validate');

router.get('/', c.getAll);
router.post('/', v.vendorRules(false), c.create);
router.get('/search', c.search);          // ?q=name or phone
router.get('/balances', c.balances);      // outstanding balance for every vendor
router.get('/:id', v.validateId, c.getOne);
router.put('/:id', v.validateId, v.vendorRules(true), c.update);
router.post('/:id/view', v.validateId, c.view);           // admin looked at the vendor -> vendor is notified
router.delete('/:id', v.validateId, c.remove);            // admin deletes the vendor -> vendor is notified
router.post('/:id/restore', v.validateId, c.restore);
module.exports = router;
