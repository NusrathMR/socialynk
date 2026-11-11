import mongoose from "mongoose"
import User from "../models/userModel.js"
import Post from "../models/postModel.js"

const ROLES = ["user", "admin"]
const PLANS = ["free", "starter", "pro", "business"]
const STATUSES = ["active", "inactive"]
const SORTS = ["createdAt", "-createdAt", "lastLoginAt", "-lastLoginAt", "email", "-email"]
const MAX_SEARCH_LENGTH = 100

// The password is never included in admin responses.
const USER_FIELDS = "fullname email role plan isActive isEmailVerified lastLoginAt createdAt"
const USER_DETAILS_FIELDS = `${USER_FIELDS} profilePicture updatedAt`
const EDITABLE_FIELDS = [
  "email",
  "plan",
  "role",
  "isEmailVerified",
  "profilePicture",
  "fullname",
]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---------- Helpers ----------

// Turn a database user into the shape the Manage Users page expects
const toAdminUser = (user) => ({
  _id: user._id,
  name: user.fullname?.trim() || user.email.split("@")[0],
  email: user.email,
  role: user.role,
  plan: user.plan,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
})

const toUserDetails = (user) => ({
  _id: user._id,
  fullname: user.fullname,
  email: user.email,
  profilePicture: user.profilePicture,
  role: user.role,
  plan: user.plan,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

// Make the search text safe: "." or "(" must be treated as plain characters
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// How many OTHER admins are still active
const countOtherActiveAdmins = (excludeId) =>
  User.countDocuments({ role: "admin", isActive: true, _id: { $ne: excludeId } })

// One place that turns errors into clean responses
const handleError = (error, res) => {
  if (error.code === 11000) {
    return res.status(409).json({ message: "That email address is already in use.", errors: { email: "That email address is already in use." } })
  }
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

const validateUserUpdate = (body) => {
  const updates = {}
  const errors = {}
  const fields = Object.keys(body)

  if (fields.length === 0) {
    return { updates, errors: { general: "Provide at least one field to update." } }
  }

  for (const field of fields) {
    if (!EDITABLE_FIELDS.includes(field)) {
      errors[field] = `The ${field} field cannot be changed here.`
    }
  }

  if (Object.keys(errors).length > 0) return { updates, errors }

  for (const [field, value] of Object.entries(body)) {
    if (field === "email") {
      if (typeof value !== "string" || value.trim().length > 254 || !EMAIL_PATTERN.test(value.trim())) {
        errors.email = "Enter a valid email address."
      } else {
        updates.email = value.trim().toLowerCase()
      }
    } else if (field === "plan") {
      if (!PLANS.includes(value)) errors.plan = "Plan must be free, starter, pro, or business."
      else updates.plan = value
    } else if (field === "role") {
      if (!ROLES.includes(value)) errors.role = "Role must be user or admin."
      else updates.role = value
    } else if (field === "isEmailVerified") {
      if (typeof value !== "boolean") errors.isEmailVerified = "Email verification status must be true or false."
      else updates.isEmailVerified = value
    } else if (field === "profilePicture") {
      if (typeof value !== "string" || value.length > 2048) {
        errors.profilePicture = "Profile picture must be text no longer than 2048 characters."
      } else {
        updates.profilePicture = value.trim()
      }
    } else if (field === "fullname") {
      if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 100) {
        errors.fullname = "Name must be between 2 and 100 characters."
      } else {
        updates.fullname = value.trim()
      }
    }
  }

  return { updates, errors }
}

// ---------- GET /api/admin/users ----------
// ?search=  ?role=  ?plan=  ?status=active|inactive  ?sort=  ?page=  ?limit=
export const getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
    const sort = SORTS.includes(req.query.sort) ? req.query.sort : "-createdAt"
    const { role, plan, status } = req.query
    const search = String(req.query.search || "").trim()

    const filter = {}

    if (role) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role..." })
      }
      filter.role = role
    }

    if (plan) {
      if (!PLANS.includes(plan)) {
        return res.status(400).json({ message: "Invalid plan..." })
      }
      filter.plan = plan
    }

    if (status) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status..." })
      }
      filter.isActive = status === "active"
    }

    if (search) {
      if (search.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({ message: "Search text is too long..." })
      }
      // The name shown on the page comes from the email, so searching the email covers both
      filter.email = new RegExp(escapeRegex(search), "i")
    }

    // "-createdAt" becomes field "createdAt" and direction -1.
    // _id is added as a tie-breaker so pages never repeat or skip a user.
    const sortField = sort.replace("-", "")
    const sortOrder = sort.startsWith("-") ? -1 : 1

    const [users, total, totalUsers] = await Promise.all([
      User.find(filter)
        .sort({ [sortField]: sortOrder, _id: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(USER_FIELDS)
        .lean(),
      User.countDocuments(filter),   // users matching the filters
      User.countDocuments({}),       // all users, for "Showing X of Y"
    ])

    res.status(200).json({
      users: users.map(toAdminUser),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      totalUsers,
    })
  } catch (error) {
    handleError(error, res)
  }
}

// ---------- GET /api/admin/users/:id ----------
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "User not found." })
    }

    const user = await User.findById(id).select(USER_DETAILS_FIELDS).lean()
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    const [statsResult, posts] = await Promise.all([
      Post.aggregate([
        { $match: { owner: user._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            drafts: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
            scheduled: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } },
            sent: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          },
        },
      ]),
      Post.find({ owner: user._id })
        .sort({ updatedAt: -1, _id: -1 })
        .limit(5)
        .select("caption status createdAt updatedAt scheduledAt publishedAt")
        .lean(),
    ])

    const stats = statsResult[0] || { total: 0, drafts: 0, scheduled: 0, sent: 0, failed: 0 }

    res.status(200).json({
      user: toUserDetails(user),
      activity: {
        total: stats.total,
        drafts: stats.drafts,
        scheduled: stats.scheduled,
        sent: stats.sent,
        failed: stats.failed,
        recentPosts: posts.map((post) => ({
          id: String(post._id),
          caption: (post.caption || "").slice(0, 160),
          status: post.status,
          date: post.publishedAt || post.scheduledAt || post.updatedAt || post.createdAt,
        })),
      },
    })
  } catch (error) {
    handleError(error, res)
  }
}

// ---------- PATCH /api/admin/users/:id ----------
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "User not found." })
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Provide user fields as a JSON object." })
    }

    const { updates, errors } = validateUserUpdate(req.body)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Please correct the highlighted fields.", errors })
    }

    const target = await User.findById(id).select(USER_DETAILS_FIELDS).lean()
    if (!target) {
      return res.status(404).json({ message: "User not found." })
    }

    if (
      String(req.user._id) === String(target._id) &&
      updates.role === "user" &&
      target.role === "admin"
    ) {
      return res.status(400).json({ message: "You cannot remove your own admin role." })
    }

    if (target.role === "admin" && updates.role === "user" && target.isActive) {
      const others = await countOtherActiveAdmins(target._id)
      if (others === 0) {
        return res.status(400).json({ message: "At least one active admin is required." })
      }
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    )
      .select(USER_DETAILS_FIELDS)
      .lean()

    if (!updated) {
      return res.status(404).json({ message: "User not found." })
    }

    res.status(200).json({ user: toUserDetails(updated) })
  } catch (error) {
    handleError(error, res)
  }
}

// ---------- PATCH /api/admin/users/:id/role ----------
// body: { "role": "user" | "admin" }
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params
    const role = req.body?.role

    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Role must be user or admin..." })
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "User not found..." })
    }
    const target = await User.findById(id).select(USER_FIELDS).lean()
    if (!target) {
      return res.status(404).json({ message: "User not found..." })
    }
    if (String(req.user._id) === String(target._id) && role === "user") {
      return res.status(400).json({ message: "You cannot remove your own admin role." })
    }

    // Nothing to change
    if (target.role === role) {
      return res.status(200).json({ user: toAdminUser(target) })
    }

    // Safety net: the system must always keep an active admin
    if (target.role === "admin" && role === "user") {
      const others = await countOtherActiveAdmins(target._id)
      if (others === 0) {
        return res.status(400).json({ message: "At least one active admin is required..." })
      }
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: { role } },
      { returnDocument: "after", runValidators: true }
    )
      .select(USER_FIELDS)
      .lean()

    if (!updated) {
      return res.status(404).json({ message: "User not found..." })
    }

    console.log(`[admin] ${req.user.email} changed the role of ${updated.email}: ${target.role} -> ${role}`)
    res.status(200).json({ user: toAdminUser(updated) })
  } catch (error) {
    handleError(error, res)
  }
}

// ---------- PATCH /api/admin/users/:id/status ----------
// body: { "isActive": true | false }
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params
    const isActive = req.body?.isActive

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be true or false..." })
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "User not found..." })
    }
    const target = await User.findById(id).select(USER_FIELDS).lean()
    if (!target) {
      return res.status(404).json({ message: "User not found..." })
    }
    if (String(req.user._id) === String(target._id) && !isActive) {
      return res.status(400).json({ message: "You cannot deactivate your own account." })
    }

    // Nothing to change
    if (target.isActive === isActive) {
      return res.status(200).json({ user: toAdminUser(target) })
    }

    // Safety net: do not switch off the last active admin
    if (!isActive && target.role === "admin") {
      const others = await countOtherActiveAdmins(target._id)
      if (others === 0) {
        return res.status(400).json({ message: "At least one active admin is required..." })
      }
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { returnDocument: "after", runValidators: true }
    )
      .select(USER_FIELDS)
      .lean()

    if (!updated) {
      return res.status(404).json({ message: "User not found..." })
    }

    console.log(`[admin] ${req.user.email} ${isActive ? "activated" : "deactivated"} ${updated.email}`)
    res.status(200).json({ user: toAdminUser(updated) })
  } catch (error) {
    handleError(error, res)
  }
}