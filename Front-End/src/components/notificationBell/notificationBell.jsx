import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  openNotificationStream,
} from "../../api/api.js"
import { useAuth } from "../AuthContext/authContext.jsx"
import "./notificationBell.css"

const PAGE_SIZE = 20

function mergeNotifications(current, incoming) {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => byId.set(item.id, item))
  return [...byId.values()].sort(
    (first, second) => new Date(second.createdAt) - new Date(first.createdAt)
  )
}

function NotificationIcon({ type }) {
  const iconProps = { size: 18, strokeWidth: 2 }

  if (type === "SUCCESS") return <CheckCircle2 {...iconProps} />
  if (type === "ERROR") return <AlertCircle {...iconProps} />
  if (type === "WARNING") return <TriangleAlert {...iconProps} />
  return <Info {...iconProps} />
}

function notificationTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

async function consumeEventStream(response, onEvent, signal) {
  if (!response.body) throw new Error("The notification stream is unavailable.")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const processFrame = (frame) => {
    let event = "message"
    const data = []

    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart())
    }

    if (!data.length) return
    try {
      onEvent(event, JSON.parse(data.join("\n")))
    } catch (error) {
      console.error("Could not process a live notification event:", error)
    }
  }

  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let frameEnd = buffer.indexOf("\n\n")
    while (frameEnd !== -1) {
      processFrame(buffer.slice(0, frameEnd))
      buffer = buffer.slice(frameEnd + 2)
      frameEnd = buffer.indexOf("\n\n")
    }
  }

  if (buffer.trim()) processFrame(buffer)
}

function NotificationBell() {
  const { user } = useAuth()
  const userId = user?._id || user?.id
  return <NotificationBellContent key={userId || "anonymous"} userId={userId} />
}

function NotificationBellContent({ userId }) {
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const knownIdsRef = useRef(new Set())
  const streamEventVersionRef = useRef(0)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [actionError, setActionError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) return undefined

    let active = true
    let reconnectTimer
    const controller = new AbortController()

    async function loadLatest(merge = false) {
      const eventVersionAtStart = streamEventVersionRef.current
      try {
        const result = await getNotifications(1, PAGE_SIZE)
        if (!active) return
        result.notifications.forEach((notification) => {
          knownIdsRef.current.add(notification.id)
        })
        setNotifications((current) => mergeNotifications(current, result.notifications))
        if (eventVersionAtStart === streamEventVersionRef.current) {
          setUnreadCount(result.unreadCount)
        }
        setTotal((current) => Math.max(current, result.total))
        setPage((current) => merge ? Math.max(current, result.page) : result.page)
        setLoadError("")
      } catch (error) {
        if (active) setLoadError(error.message || "Could not load notifications.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    function handleEvent(event, payload) {
      if (!active) return

      if (event === "ready") {
        void loadLatest(true)
      } else if (event === "notification:new" && payload.notification) {
        streamEventVersionRef.current += 1
        const isNew = !knownIdsRef.current.has(payload.notification.id)
        knownIdsRef.current.add(payload.notification.id)
        setNotifications((current) => mergeNotifications(current, [payload.notification]))
        setUnreadCount(payload.unreadCount)
        if (isNew) setTotal((current) => current + 1)
      } else if (event === "notification:read") {
        streamEventVersionRef.current += 1
        setNotifications((current) => current.map((item) =>
          item.id === payload.id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        ))
        setUnreadCount(payload.unreadCount)
      } else if (event === "notification:read-all") {
        streamEventVersionRef.current += 1
        setNotifications((current) => current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        })))
        setUnreadCount(payload.unreadCount)
      }
    }

    async function runStream() {
      let delay = 1000
      while (active && !controller.signal.aborted) {
        try {
          const response = await openNotificationStream(controller.signal)
          delay = 1000
          await consumeEventStream(response, handleEvent, controller.signal)
        } catch (error) {
          if (!active || controller.signal.aborted) return
          if (error.name === "AbortError") return
        }

        if (!active || controller.signal.aborted) return
        await new Promise((resolve) => {
          const signal = controller.signal
          const onAbort = () => {
            window.clearTimeout(reconnectTimer)
            resolve()
          }
          reconnectTimer = window.setTimeout(() => {
            signal.removeEventListener("abort", onAbort)
            resolve()
          }, delay)
          signal.addEventListener("abort", onAbort, { once: true })
        })
        delay = Math.min(delay * 2, 30000)
      }
    }

    void loadLatest()
    void runStream()

    return () => {
      active = false
      controller.abort()
      window.clearTimeout(reconnectTimer)
    }
  }, [userId, reloadKey])

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsideClick)
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick)
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [isOpen])

  async function loadMore() {
    if (isLoadingMore || notifications.length >= total) return

    setIsLoadingMore(true)
    setActionError("")
    try {
      const nextPage = page + 1
      const eventVersionAtStart = streamEventVersionRef.current
      const result = await getNotifications(nextPage, PAGE_SIZE)
      result.notifications.forEach((notification) => {
        knownIdsRef.current.add(notification.id)
      })
      setNotifications((current) => mergeNotifications(current, result.notifications))
      if (eventVersionAtStart === streamEventVersionRef.current) {
        setUnreadCount(result.unreadCount)
      }
      setTotal((current) => Math.max(current, result.total))
      setPage(result.page)
    } catch (error) {
      setActionError(error.message || "Could not load more notifications.")
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function markRead(id) {
    setActionError("")
    const eventVersionAtStart = streamEventVersionRef.current
    try {
      const result = await markNotificationRead(id)
      setNotifications((current) => current.map((item) =>
        item.id === id ? result.notification : item
      ))
      if (eventVersionAtStart === streamEventVersionRef.current) {
        setUnreadCount(result.unreadCount)
      }
    } catch (error) {
      setActionError(error.message || "Could not mark the notification as read.")
    }
  }

  async function markAllRead() {
    setActionError("")
    const eventVersionAtStart = streamEventVersionRef.current
    try {
      const result = await markAllNotificationsRead()
      setNotifications((current) => current.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || new Date().toISOString(),
      })))
      if (eventVersionAtStart === streamEventVersionRef.current) {
        setUnreadCount(result.unreadCount)
      }
    } catch (error) {
      setActionError(error.message || "Could not mark notifications as read.")
    }
  }

  function openNotification(notification) {
    if (!notification.isRead) void markRead(notification.id)
    setIsOpen(false)
    if (notification.postId) navigate("/publishpage")
  }

  return (
    <div className="notification-bell-wrap" ref={wrapperRef}>
      <button
        type="button"
        className="top-bar-bell notification-bell"
        aria-label={unreadCount
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"}
        aria-expanded={isOpen}
        aria-controls="notification-dropdown"
        onClick={() => setIsOpen((open) => !open)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className="notification-dropdown"
          id="notification-dropdown"
          aria-label="Notifications"
        >
          <header className="notification-dropdown-header">
            <div>
              <h2>Notifications</h2>
              <span>{unreadCount} unread</span>
            </div>
            <button
              type="button"
              className="notification-mark-all"
              onClick={markAllRead}
              disabled={!unreadCount}
            >
              Mark All as Read
            </button>
          </header>

          {actionError && <p className="notification-error" role="alert">{actionError}</p>}

          {isLoading ? (
            <p className="notification-state" role="status">Loading notifications...</p>
          ) : loadError ? (
            <div className="notification-state">
              <p role="alert">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError("")
                  setIsLoading(true)
                  setReloadKey((key) => key + 1)
                }}
              >
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <p className="notification-state">You're all caught up!</p>
          ) : (
            <>
              <div className="notification-list">
                {notifications.map((notification) => (
                  <article
                    className={`notification-item${notification.isRead ? "" : " unread"}`}
                    key={notification.id}
                  >
                    <span className={`notification-type-icon ${notification.type.toLowerCase()}`}>
                      <NotificationIcon type={notification.type} />
                    </span>
                    <div className="notification-copy">
                      <button
                        type="button"
                        className="notification-open"
                        onClick={() => openNotification(notification)}
                      >
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                      </button>
                      <time dateTime={notification.createdAt}>
                        {notificationTime(notification.createdAt)}
                      </time>
                      {!notification.isRead && (
                        <button
                          type="button"
                          className="notification-mark-read"
                          onClick={() => markRead(notification.id)}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                    {!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
                  </article>
                ))}
              </div>
              {notifications.length < total && (
                <button
                  type="button"
                  className="notification-load-more"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default NotificationBell
