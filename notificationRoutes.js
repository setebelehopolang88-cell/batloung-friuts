const router = require('express').Router();
const c = require('../controllers/notificationController');
const v = require('../middleware/validate');

router.get('/', c.list);
router.get('/unread', c.unread);
router.post('/read-all', c.readAll);
router.post('/:id/read', v.validateId, c.readOne);
router.delete('/', c.removeAll);
router.delete('/:id', v.validateId, c.remove);
module.exports = router;
