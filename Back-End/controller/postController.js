import mongoose from "mongoose"
import Post from "../models/postModel.js"
import { publishAndSave } from "../services/publisherServices.js"
import { syncPostToSandbox } from "../services/fakeSocialService.js"

// The ONLY fields a client may send. Anything else is ignored.
const ALLOWED_FIELDS = ["caption", "hashtags", "contentType", "platforms", "branding", "media"]
const STATUSES = ["draft", "scheduled", "publishing", "published", "failed"]
const SORTS = ["updatedAt", "-updatedAt", "scheduledAt", "-scheduledAt", "publishedAt", "-publishedAt"]
const PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "x", "youtube"]
const PUBLISHABLE = ["draft", "scheduled", "failed"]
const ONE_MINUTE = 60 * 1000
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000

// Helper 1: copy only the allowed fields from the request body
const pickAllowedFields = (body = {}) => {
  const data = {}
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field]
    }
  }
  return data
}

// Helper 2: find a post by id that belongs to THIS user (or return null)
const findMyPost = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) return null
  return Post.findOne({ _id: id, owner: userId })
}

// Helper 3: one place that turns errors into clean responses
const handleError = (error, res) => {
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors).map((e) => e.message).join(", ")
    return res.status(400).json({ message })
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: "Invalid value sent..." })
  }
  console.error(error)
  res.status(500).json({ error: "Internal server error..." })
}

// POST /api/posts  -> create a draft
export const createPost = async (req, res) => {
  try {
    const data = pickAllowedFields(req.body)
    const post = await Post.create({ ...data, owner: req.user._id })
    res.status(201).json({ post })
  } catch (error) {
    handleError(error, res)
  }
}

// GET /api/posts  -> list my posts (newest first)
export const getMyPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
    const sort = SORTS.includes(req.query.sort) ? req.query.sort : "-updatedAt"

    const filter = { owner: req.user._id }
    if (req.query.status) {
      const statuses = String(req.query.status).split(",")
      if (!statuses.every((status) => STATUSES.includes(status))) {
        return res.status(400).json({ message: "Invalid status..." })
      }
      filter.status = { $in: statuses }
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select("contentType caption hashtags media status platforms scheduledAt publishedAt publishError publishAttempts platformResults sandboxSyncStatus sandboxSyncedAt sandboxSyncError sandboxSyncResults createdAt updatedAt")
        .lean(),
      Post.countDocuments(filter),
    ])

    res.status(200).json({ posts, page, limit, total })
  } catch (error) {
    handleError(error, res)
  }
}

// GET /api/posts/:id  -> get one of my posts
export const getPostById = async (req, res) => {
  try {
    const post = await findMyPost(req.params.id, req.user._id)
    if (!post) {
      return res.status(404).json({ message: "Post not found..." })
    }
    res.status(200).json({ post })
  } catch (error) {
    handleError(error, res)
  }
}

// PUT /api/posts/:id  -> update one of my posts
export const updatePost = async (req, res) => {
  try {
    const post = await findMyPost(req.params.id, req.user._id)
    if (!post) {
      return res.status(404).json({ message: "Post not found..." })
    }
    if (["publishing", "published"].includes(post.status)) {
      return res.status(400).json({ message: "This post can no longer be edited..." })
    }

    post.set(pickAllowedFields(req.body))
    await post.save()          // save() runs the model's validation rules
    res.status(200).json({ post })
  } catch (error) {
    handleError(error, res)
  }
}

// DELETE /api/posts/:id  -> delete one of my posts
export const deletePost = async (req, res) => {
  try {
    const post = await findMyPost(req.params.id, req.user._id)
    if (!post) {
      return res.status(404).json({ message: "Post not found..." })
    }
    if (post.status === "publishing") {
      return res.status(400).json({ message: "This post is being published right now. Try again in a moment..." })
    }
    await post.deleteOne()
    res.status(200).json({ message: "Post deleted successfully..." })
  } catch (error) {
    handleError(error, res)
  }
}

// PATCH /api/posts/:id/schedule  -> choose channels and a time
export const schedulePost = async (req, res) => {
  try {
    const post = await findMyPost(req.params.id, req.user._id)
    if (!post) {
      return res.status(404).json({ message: "Post not found..." })
    }

    // Only these can be (re)scheduled
    if (!["draft", "scheduled", "failed"].includes(post.status)) {
      return res.status(400).json({ message: "This post cannot be scheduled right now..." })
    }

    const { platforms, scheduledAt } = req.body

    // 1. Channels
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ message: "Select at least one channel..." })
    }
    const cleanPlatforms = [...new Set(platforms)]          // remove duplicates
    if (!cleanPlatforms.every((p) => PLATFORMS.includes(p))) {
      return res.status(400).json({ message: "One or more channels are not supported..." })
    }

    // 2. Content
    if (!post.caption || post.caption.trim() === "") {
      return res.status(400).json({ message: "Write a caption before scheduling..." })
    }

    // 3. Date and time
    const when = new Date(scheduledAt)
    if (!scheduledAt || Number.isNaN(when.getTime())) {
      return res.status(400).json({ message: "Choose a valid date and time..." })
    }
    const now = Date.now()
    if (when.getTime() < now - ONE_MINUTE) {
      return res.status(400).json({ message: "The scheduled time must be in the future..." })
    }
    if (when.getTime() > now + ONE_YEAR) {
      return res.status(400).json({ message: "You can schedule up to one year ahead..." })
    }

    // 4. Save
    post.platforms = cleanPlatforms
    post.scheduledAt = when
    post.status = "scheduled"
    post.publishError = ""
    post.publishAttempts = 0
    post.platformResults = []
    await post.save()

    res.status(200).json({ post })
  } catch (error) {
    handleError(error, res)
  }
}

// PATCH /api/posts/:id/unschedule  -> cancel the schedule
export const unschedulePost = async (req, res) => {
  try {
    const post = await findMyPost(req.params.id, req.user._id)
    if (!post) {
      return res.status(404).json({ message: "Post not found..." })
    }
    if (post.status !== "scheduled") {
      return res.status(400).json({ message: "Only scheduled posts can be unscheduled..." })
    }

    post.status = "draft"
    post.scheduledAt = null
    await post.save()

    res.status(200).json({ post })
  } catch (error) {
    handleError(error, res)
  }
}

// POST /api/posts/:id/publish-now  -> publish immediately
export const publishNow = async (req, res) => {
  try {
    const existing = await findMyPost(req.params.id, req.user._id)
    if (!existing) {
      return res.status(404).json({ message: "Post not found..." })
    }

    if (existing.status === "published") {
      return res.status(400).json({ message: "This post is already published..." })
    }
    if (!PUBLISHABLE.includes(existing.status)) {
      return res.status(400).json({ message: "This post cannot be published right now..." })
    }

    // Channels: from the request, otherwise the ones already on the post
    const requested = req.body?.platforms ?? existing.platforms
    if (!Array.isArray(requested) || requested.length === 0) {
      return res.status(400).json({ message: "Select at least one channel..." })
    }
    const cleanPlatforms = [...new Set(requested)]
    if (!cleanPlatforms.every((p) => PLATFORMS.includes(p))) {
      return res.status(400).json({ message: "One or more channels are not supported..." })
    }

    if (!existing.caption || existing.caption.trim() === "") {
      return res.status(400).json({ message: "Write a caption before publishing..." })
    }

    // CLAIM the post in one atomic step. If it is already being published
    // (for example a double click), this finds nothing and we stop.
    const post = await Post.findOneAndUpdate(
      { _id: existing._id, owner: req.user._id, status: { $in: PUBLISHABLE } },
      {
        $set: {
          status: "publishing",
          platforms: cleanPlatforms,
          scheduledAt: null,
          publishError: "",
        },
        $inc: { publishAttempts: 1 },
      },
      { returnDocument: "after" }
    )

    if (!post) {
      return res.status(409).json({ message: "This post is already being published..." })
    }

    await publishAndSave(post)

    const message =
      post.status === "published"
        ? "Post published successfully..."
        : `Publishing failed: ${post.publishError}`

    res.status(200).json({ message, post })
  } catch (error) {
    handleError(error, res)
  }
}

export const retrySandboxSync = async (req, res) => {
  try {
    const post = await findMyPost(req.params.id, req.user._id)
    if (!post) {
      return res.status(404).json({ message: "Post not found..." })
    }
    if (post.status !== "published") {
      return res.status(409).json({ message: "Only successfully published posts can be synced..." })
    }

    const result = await syncPostToSandbox(post._id, { retryFailed: true })
    if (result.status === "disabled") {
      return res.status(409).json({
        message: "Sandbox synchronization is disabled. The Socialynk post remains published.",
        post: result.post,
      })
    }
    if (result.status === "failed") {
      return res.status(502).json({
        message: "Sandbox synchronization failed. The Socialynk post remains published.",
        post: result.post,
      })
    }
    if (result.status !== "synced") {
      return res.status(409).json({ message: "This post cannot be synchronized right now..." })
    }

    return res.status(200).json({ message: "Post synchronized to Sandbox Social.", post: result.post })
  } catch (error) {
    handleError(error, res)
  }
}
