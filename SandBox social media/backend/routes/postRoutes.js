const express = require('express');
const { createPost, getPostById, getPosts } = require('../controllers/postController');
const apiKeyAuth = require('../middleware/apiKeyAuth');

const router = express.Router();

router.get('/', getPosts);
router.get('/:id', getPostById);
router.post('/', apiKeyAuth, createPost);

module.exports = router;
