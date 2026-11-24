import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { getPublishedPosts } from "../../api/api.js"
import Sidebar from "../sideBar/sidebar.jsx"
import TopBar from "../topBar/topBar.jsx"
import SimulatorPost from "./simulatorPost.jsx"
import "./simulatorPage.css"

const platforms = ["instagram", "facebook", "linkedin", "tiktok", "x"]
const platformNames = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
}

function getPostTime(post) {
  return new Date(post.publishedAt || post.updatedAt || 0).getTime()
}

function SimulatorPage() {
  const [posts, setPosts] = useState([])
  const [activePlatform, setActivePlatform] = useState("all")
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const loadPosts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setErrorMessage("")

    try {
      const loadedPosts = await getPublishedPosts()
      setPosts(loadedPosts.filter((post) => post.status === "published"))
    } catch (error) {
      setErrorMessage(error.message || "Could not load posts")
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = setTimeout(() => loadPosts(true), 0)
    const interval = setInterval(() => loadPosts(false), 20000)

    return () => {
      clearTimeout(initialLoad)
      clearInterval(interval)
    }
  }, [loadPosts])

  const sortedPosts = useMemo(
    () => [...posts].sort((first, second) => getPostTime(second) - getPostTime(first)),
    [posts]
  )

  const feedCards = useMemo(() => {
    return sortedPosts.flatMap((post) => {
      const postPlatforms = (post.platforms || []).filter((platform) => platforms.includes(platform))
      const matchingPlatforms = activePlatform === "all"
        ? postPlatforms
        : postPlatforms.filter((platform) => platform === activePlatform)

      return matchingPlatforms.map((platform) => ({ post, platform }))
    })
  }, [activePlatform, sortedPosts])

  function getTabCount(platform) {
    if (platform === "all") return sortedPosts.length
    return sortedPosts.filter((post) => post.platforms?.includes(platform)).length
  }

  return (
    <div className="db-layout sim-layout">
      <Sidebar />

      <main className="sim-main">
        <TopBar
          title="Social Simulator"
          subtitle="See how your published posts look on each network."
        />

        <div className="sim-content">
          <div className="sim-notice">
            Simulator view: posts are shown as if they were live. Nothing is sent to real social networks.
          </div>

          <div className="sim-controls">
            <nav className="sim-tabs" aria-label="Filter posts by platform">
              <button
                type="button"
                className={`sim-tab${activePlatform === "all" ? " sim-tab--active" : ""}`}
                aria-pressed={activePlatform === "all"}
                onClick={() => setActivePlatform("all")}
              >
                All <span>{getTabCount("all")}</span>
              </button>
              {platforms.map((platform) => (
                <button
                  type="button"
                  key={platform}
                  className={`sim-tab${activePlatform === platform ? " sim-tab--active" : ""}`}
                  aria-pressed={activePlatform === platform}
                  onClick={() => setActivePlatform(platform)}
                >
                  {platformNames[platform]} <span>{getTabCount(platform)}</span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              className="sim-refresh"
              onClick={() => loadPosts(true)}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {errorMessage ? (
            <div className="sim-error" role="alert">
              <span>{errorMessage}</span>
              <button type="button" className="sim-error-retry" onClick={() => loadPosts(true)}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <p className="sim-state-text">Loading posts...</p>
          ) : posts.length === 0 ? (
            <div className="sim-empty">
              <h2>No published posts yet.</h2>
              <p>Publish a post and it will appear here.</p>
              <Link to="/publishpage" className="sim-primary-button">Go to Publish</Link>
            </div>
          ) : feedCards.length === 0 ? (
            <p className="sim-state-text">No published posts for this platform yet.</p>
          ) : (
            <div className="sim-feed">
              {feedCards.map(({ post, platform }) => (
                <div className="sim-feed-item" key={`${post._id}-${platform}`}>
                  {activePlatform === "all" && (
                    <div className="sim-feed-platform">{platformNames[platform]}</div>
                  )}
                  <SimulatorPost post={post} platform={platform} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default SimulatorPage
