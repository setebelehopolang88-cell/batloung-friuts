const router = require('express').Router();
const c = require('../controllers/businessController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', c.get);                                              // public: the log in page shows the description
router.put('/', requireAuth, requireRole('ADMIN'), c.update);        // only the admin edits it
module.exports = router;
