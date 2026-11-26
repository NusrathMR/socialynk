import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const mediaSchema = new Schema(
  {
    url: { type: String, trim: true, maxlength: 4096 },
    type: { type: String, trim: true, maxlength: 100 },
    alt: { type: String, trim: true, maxlength: 1000 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    thumbnailUrl: { type: String, trim: true, maxlength: 4096 },
    title: { type: String, trim: true, maxlength: 500 },
    duration: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false },
);

const postSchema = new Schema(
  {
    platform: {
      type: String,
      required: true,
      enum: ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'],
      lowercase: true,
      trim: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 10000,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    sourcePostId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    originalPostId: { type: String, trim: true, maxlength: 256 },
    media: { type: [mediaSchema], default: [] },
    // Kept as aliases for Socialynk payloads and older integrations.
    imageUrl: { type: String, trim: true, maxlength: 4096 },
    mediaUrl: { type: String, trim: true, maxlength: 4096 },
    mediaType: { type: String, trim: true, maxlength: 100 },
    thumbnailUrl: { type: String, trim: true, maxlength: 4096 },
    displayName: { type: String, trim: true, maxlength: 200 },
    username: { type: String, trim: true, maxlength: 200 },
    profileImageUrl: { type: String, trim: true, maxlength: 4096 },
    headline: { type: String, trim: true, maxlength: 500 },
    audience: { type: String, trim: true, maxlength: 100 },
    verified: { type: Boolean },
    title: { type: String, trim: true, maxlength: 500 },
    duration: { type: String, trim: true, maxlength: 100 },
    viewCount: { type: Number, min: 0 },
    likeCount: { type: Number, min: 0 },
  },
  { timestamps: true },
);

postSchema.index({ platform: 1, sourcePostId: 1 }, { unique: true });

const Post = model('Post', postSchema);

export default Post;
