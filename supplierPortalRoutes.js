const router = require('express').Router();
const c = require('../controllers/supplierPortalController');
const offers = require('../controllers/offerController');
const v = require('../middleware/validate');

router.get('/overview', c.overview);
router.post('/fruits', v.supplierFruitRules, c.registerFruit);
router.delete('/fruits/:id', v.validateId, c.removeFruit);

// Stock the supplier sends to the business: send, view, edit and delete their own offers
router.get('/offers', offers.mineList);
router.post('/offers', v.offerRules, offers.create);
router.put('/offers/:id', v.validateId, v.offerRules, offers.update);
router.delete('/offers/:id', v.validateId, offers.remove);
module.exports = router;
