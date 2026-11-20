const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

router.post('/login', v.loginRules, c.login);
router.post('/register', v.registerRules, c.register);   // vendors and suppliers sign themselves up
router.get('/me', requireAuth, c.me);
module.exports = router;
