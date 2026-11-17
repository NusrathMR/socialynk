const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
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
      required: true,
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
  },
  { timestamps: true },
);

postSchema.index({ platform: 1, sourcePostId: 1 }, { unique: true });

module.exports = mongoose.model('Post', postSchema);
