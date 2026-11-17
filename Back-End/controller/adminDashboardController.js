import mongoose from "mongoose"
import User from "../models/userModel.js"
import Post from "../models/postModel.js"

const USER_PLANS = ["free", "starter", "pro", "business"]
const POST_STATUSES = ["draft", "scheduled", "publishing", "published", "failed"]
const PLATFORMS = ["instagram", "facebook", "linkedin", "x", "tiktok", "youtube"]

const countByKeys = (rows, keys) =>
  Object.fromEntries(keys.map((key) => [
    key,
    rows.find((row) => row._id === key)?.count || 0,
  ]))

const makeDailyCounts = (rows, startDate, days) => {
  const countsByDate = new Map(rows.map((row) => [row._id, row.count]))

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(startDate)
    date.setUTCDate(date.getUTCDate() + index)
    const dateText = date.toISOString().slice(0, 10)

    return { date: dateText, count: countsByDate.get(dateText) || 0 }
  })
}

const displayName = (fullname, email) =>
  fullname?.trim() || email.split("@")[0]

export const getAdminDashboard = async (req, res) => {
  try {
    const requestedDays = req.query.days === undefined ? "14" : req.query.days
    if (!["7", "14", "30"].includes(requestedDays)) {
      return res.status(400).json({ message: "Days must be 7, 14 or 30." })
    }

    const days = Number(requestedDays)
    const now = new Date()
    const startDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - days + 1,
    ))
    const recentFilter = { $gte: startDate, $lte: now }
    const staleBefore = new Date(now.getTime() - 5 * 60 * 1000)

    const userDailyPipeline = [
      { $match: { createdAt: recentFilter } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]
    const postDailyPipeline = [
      { $match: { createdAt: recentFilter } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      newUsers,
      userPlans,
      newUsersPerDay,
      totalPosts,
      postsByStatus,
      createdPosts,
      publishedPosts,
      postsByPlatform,
      postsPerDay,
      recentUsers,
      topUsers,
      failedPosts,
      overdueScheduled,
      stuckPublishing,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ createdAt: recentFilter }),
      User.aggregate([
        { $group: { _id: "$plan", count: { $sum: 1 } } },
      ]),
      User.aggregate(userDailyPipeline),
      Post.countDocuments({}),
      Post.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Post.countDocuments({ createdAt: recentFilter }),
      Post.countDocuments({ status: "published", publishedAt: recentFilter }),
      Post.aggregate([
        { $unwind: "$platforms" },
        { $group: { _id: "$platforms", count: { $sum: 1 } } },
      ]),
      Post.aggregate(postDailyPipeline),
      User.find({})
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .select("fullname email plan role isActive createdAt")
        .lean(),
      Post.aggregate([
        { $group: { _id: "$owner", postCount: { $sum: 1 } } },
        { $sort: { postCount: -1, _id: 1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: User.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "owner",
          },
        },
        { $unwind: "$owner" },
        {
          $project: {
            _id: 0,
            id: { $toString: "$owner._id" },
            email: "$owner.email",
            fullname: "$owner.fullname",
            postCount: 1,
          },
        },
      ]),
      Post.aggregate([
        { $match: { status: "failed" } },
        { $sort: { updatedAt: -1, _id: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: User.collection.name,
            localField: "owner",
            foreignField: "_id",
            as: "owner",
          },
        },
        { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            ownerEmail: { $ifNull: ["$owner.email", ""] },
            platforms: { $ifNull: ["$platforms", []] },
            publishError: 1,
            publishAttempts: 1,
            updatedAt: 1,
          },
        },
      ]),
      Post.countDocuments({
        status: "scheduled",
        scheduledAt: { $lt: staleBefore },
      }),
      Post.countDocuments({
        status: "publishing",
        updatedAt: { $lt: staleBefore },
      }),
    ])

    res.status(200).json({
      generatedAt: now.toISOString(),
      days,
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        admins: adminUsers,
        newInPeriod: newUsers,
        byPlan: countByKeys(userPlans, USER_PLANS),
      },
      posts: {
        total: totalPosts,
        byStatus: countByKeys(postsByStatus, POST_STATUSES),
        createdInPeriod: createdPosts,
        publishedInPeriod: publishedPosts,
        byPlatform: countByKeys(postsByPlatform, PLATFORMS),
      },
      activity: {
        newUsersPerDay: makeDailyCounts(newUsersPerDay, startDate, days),
        postsPerDay: makeDailyCounts(postsPerDay, startDate, days),
      },
      recentUsers: recentUsers.map((person) => ({
        id: String(person._id),
        name: displayName(person.fullname, person.email),
        email: person.email,
        plan: person.plan,
        role: person.role,
        isActive: person.isActive,
        createdAt: person.createdAt,
      })),
      topUsers: topUsers.map((person) => ({
        id: person.id,
        name: displayName(person.fullname, person.email),
        email: person.email,
        postCount: person.postCount,
      })),
      failedPosts,
      health: {
        database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        uptimeSeconds: Math.floor(process.uptime()),
        overdueScheduled,
        stuckPublishing,
      },
    })
  } catch (error) {
    console.error("Admin dashboard error:", error)
    res.status(500).json({ error: "Could not load the admin dashboard." })
  }
}
