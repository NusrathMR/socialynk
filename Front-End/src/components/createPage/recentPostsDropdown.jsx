import { useEffect, useRef, useState } from "react"
import { getRecentPosts } from "../../api/api.js"
import { timeAgo } from "../../utils/fakeStats.js"

const STATUS_LABELS = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
}

function RecentPostsDropdown({ currentPostId, onUsePost }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [posts, setPosts] = useState([])
  const [usingPost, setUsingPost] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const useLockRef = useRef(false)
  const useLockTimeoutRef = useRef(null)
  const requestIdRef = useRef(0)

  const loadPosts = () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError("")

    getRecentPosts()
      .then((recentPosts) => {
        if (requestId === requestIdRef.current) setPosts(recentPosts)
      })
      .catch((loadError) => {
        if (requestId === requestIdRef.current) {
          setError(loadError.message || "Could not load recent posts")
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false)
      })
  }

  const handleTriggerClick = () => {
    if (open) {
      requestIdRef.current += 1
      setOpen(false)
      return
    }

    setOpen(true)
    loadPosts()
  }

  useEffect(() => {
    if (!open) return undefined

    const handleOutsideClick = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        requestIdRef.current += 1
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        requestIdRef.current += 1
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  useEffect(() => () => {
    if (useLockTimeoutRef.current) {
      window.clearTimeout(useLockTimeoutRef.current)
    }
    requestIdRef.current += 1
  }, [])

  const visiblePosts = posts.filter((post) => {
    const postId = post._id || post.id
    return postId !== currentPostId && post.caption?.trim()
  })

  const handleUsePost = (caption) => {
    if (useLockRef.current) return

    useLockRef.current = true
    setUsingPost(true)
    onUsePost(caption)
    setOpen(false)
    useLockTimeoutRef.current = window.setTimeout(() => {
      useLockRef.current = false
      useLockTimeoutRef.current = null
      setUsingPost(false)
    }, 600)
  }

  return (
    <div className="rp-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="rp-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="rp-posts-panel"
        onClick={handleTriggerClick}
      >
        Use a previous post ⌄
      </button>

      {open && (
        <div className="rp-panel" id="rp-posts-panel" aria-label="Recent posts">
          {loading ? (
            <p className="rp-state">Loading your posts...</p>
          ) : error ? (
            <div className="rp-error" role="alert">
              <p>{error}</p>
              <button type="button" className="rp-retry" onClick={loadPosts}>
                Try again
              </button>
            </div>
          ) : visiblePosts.length === 0 ? (
            <p className="rp-state">No previous posts yet.</p>
          ) : (
            visiblePosts.map((post) => {
              const captionLine = post.caption.replace(/\r\n?|\n/g, " ")
              const preview = captionLine.length > 80 ? `${captionLine.slice(0, 80)}...` : captionLine
              const statusLabel = STATUS_LABELS[post.status]

              return (
                <div className="rp-item" key={post._id || post.id}>
                  <div className="rp-item-main">
                    <span className="rp-preview" title={preview}>{preview}</span>
                    <div className="rp-meta">
                      <span className={`rp-chip rp-chip--${post.status}`}>{statusLabel}</span>
                      <span className="rp-time">{timeAgo(post.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rp-use"
                    disabled={usingPost}
                    onClick={() => handleUsePost(post.caption)}
                  >
                    Use in editor
                  </button>
                </div>
              )
            })
          )}
          <div className="rp-note">Only the caption is copied. Add images again.</div>
        </div>
      )}
    </div>
  )
}

export default RecentPostsDropdown
