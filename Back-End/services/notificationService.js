import Notification from "../models/notificationModel.js"

const userConnections = new Map()

export function formatNotification(notification) {
  return {
    id: String(notification._id),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    postId: notification.post ? String(notification.post) : null,
    platform: notification.platform,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  }
}

export function subscribeToNotifications(userId, response) {
  const key = String(userId)
  let connections = userConnections.get(key)
  if (!connections) {
    connections = new Set()
    userConnections.set(key, connections)
  }
  connections.add(response)

  let heartbeat
  const removeConnection = () => {
    clearInterval(heartbeat)
    connections.delete(response)
    if (connections.size === 0) userConnections.delete(key)
    response.off("close", removeConnection)
  }

  heartbeat = setInterval(() => {
    if (response.destroyed || response.writableEnded || !response.writable) {
      removeConnection()
      return
    }
    response.write(": keep-alive\n\n")
  }, 25000)
  response.once("close", removeConnection)

  return removeConnection
}

export function sendUserNotificationEvent(userId, event, payload) {
  const connections = userConnections.get(String(userId))
  if (!connections) return

  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const response of connections) {
    if (response.destroyed || response.writableEnded || !response.writable) {
      connections.delete(response)
      continue
    }
    response.write(frame)
  }
  if (connections.size === 0) userConnections.delete(String(userId))
}

export async function createNotification({
  userId,
  title,
  message,
  type,
  postId,
  platform = "",
  eventKey,
}) {
  const now = new Date()
  let created = false

  try {
    const result = await Notification.updateOne(
      { user: userId, eventKey },
      {
        $setOnInsert: {
          user: userId,
          title,
          message,
          type,
          post: postId || null,
          platform,
          eventKey,
          isRead: false,
          readAt: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, timestamps: false }
    )
    created = result.upsertedCount === 1
  } catch (error) {
    if (error.code !== 11000) throw error
  }

  const notification = await Notification.findOne({ user: userId, eventKey }).lean()
  if (!notification) {
    throw new Error("Notification could not be saved or retrieved.")
  }

  const formatted = formatNotification(notification)
  if (created) {
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false })
    sendUserNotificationEvent(userId, "notification:new", {
      notification: formatted,
      unreadCount,
    })
  }

  return formatted
}
