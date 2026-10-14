const express = require('express');
const requestController = require('../controllers/request.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

// GET /paz-y-salvo/mi-estado (RF-004)
router.get('/mi-estado', requestController.getMyStatus);

module.exports = router;
