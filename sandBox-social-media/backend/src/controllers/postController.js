import mongoose from 'mongoose';
import Post from '../models/Post.js';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'];

const normalizeMedia = (body) => {
  const rawMedia = [
    ...(Array.isArray(body.media) ? body.media : body.media ? [body.media] : []),
    ...(Array.isArray(body.images) ? body.images : body.images ? [body.images] : []),
    ...(Array.isArray(body.attachments) ? body.attachments : body.attachments ? [body.attachments] : []),
  ];
  const aliases = [body.imageUrl, body.mediaUrl, body.thumbnailUrl].filter(Boolean);
  const entries = [...rawMedia, ...aliases];
  const media = [];

  for (const entry of entries) {
    const item = typeof entry === 'string' ? { url: entry } : entry;
    const url = item?.url || item?.imageUrl || item?.mediaUrl || item?.src;
    if (typeof url !== 'string' || !url.trim()) continue;

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { error: 'Media URLs must be absolute HTTP or HTTPS URLs.' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { error: 'Media URLs must use HTTP or HTTPS.' };
    }

    const trimmedUrl = url.trim();
    if (!media.some((existing) => existing.url === trimmedUrl)) {
      media.push({
        url: trimmedUrl,
        type: item.type || item.mediaType || body.mediaType || '',
        alt: item.alt || item.altText || '',
        width: Number.isFinite(Number(item.width)) && item.width !== undefined ? Number(item.width) : undefined,
        height: Number.isFinite(Number(item.height)) && item.height !== undefined ? Number(item.height) : undefined,
        thumbnailUrl: item.thumbnailUrl || undefined,
        title: item.title || undefined,
        duration: item.duration || undefined,
      });
    }
  }

  if (media.length > 20) return { error: 'A post can contain at most 20 media items.' };
  return { media };
};

export const createPost = async (req, res, next) => {
  const { platform, text, authorName, sourcePostId } = req.body || {};
  const missingFields = ['platform', 'authorName', 'sourcePostId'].filter(
    (field) => typeof req.body?.[field] !== 'string' || !req.body[field].trim(),
  );

  if (req.body?.text !== undefined && typeof req.body.text !== 'string') {
    return res.status(400).json({ success: false, message: 'text must be a string when provided.' });
  }

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

  const normalizedMedia = normalizeMedia(req.body);
  if (normalizedMedia.error) {
    return res.status(400).json({ success: false, message: normalizedMedia.error });
  }

  try {
    const post = await Post.create({
      platform: normalizedPlatform,
      text: typeof text === 'string' ? text.trim() : '',
      authorName: authorName.trim(),
      sourcePostId: sourcePostId.trim(),
      originalPostId: typeof req.body.originalPostId === 'string' ? req.body.originalPostId.trim() : undefined,
      media: normalizedMedia.media,
      imageUrl: typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : undefined,
      mediaUrl: typeof req.body.mediaUrl === 'string' ? req.body.mediaUrl.trim() : undefined,
      mediaType: typeof req.body.mediaType === 'string' ? req.body.mediaType.trim() : undefined,
      thumbnailUrl: typeof req.body.thumbnailUrl === 'string' ? req.body.thumbnailUrl.trim() : undefined,
      displayName: typeof req.body.displayName === 'string' ? req.body.displayName.trim() : undefined,
      username: typeof req.body.username === 'string' ? req.body.username.trim() : undefined,
      profileImageUrl: typeof req.body.profileImageUrl === 'string' ? req.body.profileImageUrl.trim() : undefined,
      headline: typeof req.body.headline === 'string' ? req.body.headline.trim() : undefined,
      audience: typeof req.body.audience === 'string' ? req.body.audience.trim() : undefined,
      verified: typeof req.body.verified === 'boolean' ? req.body.verified : undefined,
      title: typeof req.body.title === 'string' ? req.body.title.trim() : undefined,
      duration: typeof req.body.duration === 'string' ? req.body.duration.trim() : undefined,
      viewCount: Number.isFinite(Number(req.body.viewCount)) && req.body.viewCount !== undefined
        ? Number(req.body.viewCount)
        : undefined,
      likeCount: Number.isFinite(Number(req.body.likeCount)) && req.body.likeCount !== undefined
        ? Number(req.body.likeCount)
        : undefined,
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
};

export const getPosts = async (req, res, next) => {
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
};

export const getPostById = async (req, res, next) => {
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
};

export default { createPost, getPosts, getPostById };
