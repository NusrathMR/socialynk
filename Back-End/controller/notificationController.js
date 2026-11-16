import mongoose from "mongoose"
import Notification from "../models/notificationModel.js"
import {
  formatNotification,
  sendUserNotificationEvent,
  subscribeToNotifications,
} from "../services/notificationService.js"

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null

  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function sendDatabaseError(error, res, fallbackMessage) {
  console.error(error)
  return res.status(500).json({ message: fallbackMessage })
}

export async function getNotifications(req, res) {
  const page = parsePositiveInteger(req.query.page, 1)
  const requestedLimit = parsePositiveInteger(req.query.limit, 20)
  if (!page || page > 100000 || !requestedLimit) {
    return res.status(400).json({ message: "Invalid notification pagination." })
  }
  const limit = Math.min(requestedLimit, 50)
  const user = req.user._id

  try {
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ user })
        .select("title message type post platform isRead readAt createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user }),
      Notification.countDocuments({ user, isRead: false }),
    ])

    return res.status(200).json({
      notifications: notifications.map(formatNotification),
      page,
      limit,
      total,
      unreadCount,
    })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not load notifications.")
  }
}

export function streamNotifications(req, res) {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  })
  res.flushHeaders()
  subscribeToNotifications(req.user._id, res)
  res.write("event: ready\ndata: {}\n\n")
}

export async function markNotificationRead(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Notification ID is not valid." })
  }

  const filter = { _id: req.params.id, user: req.user._id }

  try {
    const updated = await Notification.findOneAndUpdate(
      { ...filter, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    ).lean()
    const notification = updated || await Notification.findOne(filter).lean()

    if (!notification) {
      return res.status(404).json({ message: "Notification was not found." })
    }

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    })
    if (updated) {
      sendUserNotificationEvent(req.user._id, "notification:read", {
        id: String(notification._id),
        unreadCount,
      })
    }

    return res.status(200).json({
      notification: formatNotification(notification),
      unreadCount,
    })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not mark the notification as read.")
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    )
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    })

    sendUserNotificationEvent(req.user._id, "notification:read-all", {
      unreadCount,
    })

    return res.status(200).json({ unreadCount })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not mark notifications as read.")
  }
}
