const mongoose = require('mongoose');
const Post = require('../models/Post');

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'];

async function createPost(req, res, next) {
  const { platform, text, authorName, sourcePostId } = req.body || {};
  const missingFields = ['platform', 'text', 'authorName', 'sourcePostId'].filter(
    (field) => typeof req.body?.[field] !== 'string' || !req.body[field].trim(),
  );

  if (missingFields.length) {
    return res.status(400).json({
      success: false,
      message: 'Required fields must be non-empty strings.',
      errors: missingFields.map((field) => ({ field, message: `${field} is required.` })),
    });
  }

  const normalizedPlatform = platform.trim().toLowerCase();
  if (!PLATFORMS.includes(normalizedPlatform)) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported platform.',
      errors: [{ field: 'platform', message: `platform must be one of: ${PLATFORMS.join(', ')}.` }],
    });
  }

  try {
    const post = await Post.create({
      platform: normalizedPlatform,
      text: text.trim(),
      authorName: authorName.trim(),
      sourcePostId: sourcePostId.trim(),
    });

    return res.status(201).json({
      success: true,
      published: true,
      message: 'Post published to the Sandbox Social feed.',
      data: post,
    });
  } catch (error) {
    if (error.code === 11000) {
      try {
        const existingPost = await Post.findOne({
          platform: normalizedPlatform,
          sourcePostId: sourcePostId.trim(),
        });
        if (existingPost) {
          return res.status(200).json({
            success: true,
            published: false,
            message: 'This post already exists in the Sandbox Social feed.',
            data: existingPost,
          });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    return next(error);
  }
}

async function getPosts(req, res, next) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 12);
  const requestedPlatform = req.query.platform === undefined
    ? undefined
    : typeof req.query.platform === 'string'
      ? req.query.platform.trim().toLowerCase()
      : null;

  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ success: false, message: 'page must be a positive integer.' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'limit must be an integer between 1 and 100.' });
  }
  if (requestedPlatform === null || (requestedPlatform && !PLATFORMS.includes(requestedPlatform))) {
    return res.status(400).json({
      success: false,
      message: `platform must be one of: ${PLATFORMS.join(', ')}.`,
    });
  }

  try {
    const filter = requestedPlatform ? { platform: requestedPlatform } : {};
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getPostById(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Post id must be a valid MongoDB ObjectId.' });
  }
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }
    return res.status(200).json({ success: true, data: post });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createPost, getPosts, getPostById };
