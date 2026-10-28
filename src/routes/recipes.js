'use strict';

const express = require('express');
const controller = require('../controllers/recipeController');

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);

// IMPORTANTE: /stats va ANTES de /:id; si no, Express trataría "stats" como un id.
router.get('/stats', controller.stats);

router.get('/:id', controller.getOne);
router.put('/:id', controller.replace);
router.patch('/:id', controller.patch);
router.delete('/:id', controller.remove);

module.exports = router;