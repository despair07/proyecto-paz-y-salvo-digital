const express = require('express');
const lockController = require('../controllers/lock.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);
router.get('/', lockController.list);
router.post('/', lockController.create);
router.patch('/:id/resolve', lockController.resolve);

module.exports = router;
