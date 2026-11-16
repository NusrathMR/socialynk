import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/api.js";
import Sidebar from "../sideBar/sidebar.jsx";
import TopBar from "../topBar/topBar.jsx";
import ScheduleModal from "../scheduleModel/scheduleModel.jsx";
import { plainTextToHtml, sanitizeRichTextHtml } from "../../utils/postContent.js";
import "./publishPage.css";

const tabs = ["Schedule", "Drafts", "Sent"];

const PLATFORM_ICONS = { instagram: "◎", facebook: "👍", linkedin: "▣", x: "#", tiktok: "♪" };
const PLATFORM_NAMES = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", tiktok: "TikTok" };
const STATUS_LABELS = { draft: "Draft", scheduled: "Scheduled", publishing: "Publishing", published: "Sent", failed: "Failed" };

function formatPreviewDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function dayLabel(date) {
  const day = new Date(date);
  const today = new Date();
  day.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const difference = Math.round((day - today) / (24 * 60 * 60 * 1000));

  if (difference === 0) return "TODAY";
  if (difference === 1) return "TOMORROW";
  if (difference === -1) return "YESTERDAY";
  return day.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();
}

function toCard(post) {
  const when = new Date(post.status === "published"
    ? post.publishedAt || post.scheduledAt || post.updatedAt
    : post.scheduledAt || post.updatedAt);
  const caption = post.contentText || post.caption || "";
  const contentHtml = post.contentHtml
    ? sanitizeRichTextHtml(post.contentHtml)
    : plainTextToHtml(caption);

  return {
    id: post._id,
    day: dayLabel(when),
    date: when.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    title: caption ? (caption.length > 60 ? caption.slice(0, 60) + "..." : caption) : "Untitled post",
    text: caption,
    contentHtml,
    status: STATUS_LABELS[post.status] || post.status,
    icons: post.platforms.map((platform) => PLATFORM_ICONS[platform]).filter(Boolean).join(" "),
    img: null,
    rawStatus: post.status,
    platforms: post.platforms,
    platformResults: post.platformResults,
    publishError: post.publishError,
    scheduledAt: post.scheduledAt,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  };
}

function PublishPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Schedule");
  const activeTabRef = useRef("Schedule");
  const [posts, setPosts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [busyAction, setBusyAction] = useState(false);
  const busyActionRef = useRef(false);
  const schedulingRef = useRef(false);

  async function loadPosts(tab = activeTab) {
    if (activeTabRef.current !== tab) return;
    const query = {
      Schedule: "status=scheduled,publishing,failed&sort=scheduledAt",
      Drafts: "status=draft&sort=-updatedAt",
      Sent: "status=published&sort=-publishedAt",
    }[tab];
    setLoading(true);
    try {
      const response = await api.get(`/posts?${query}&limit=50`);
      if (activeTabRef.current !== tab) return;
      const loadedPosts = response.data.posts.map(toCard);
      setPosts(loadedPosts);
      setSelectedId((currentId) =>
        loadedPosts.some((post) => post.id === currentId) ? currentId : loadedPosts[0]?.id ?? null
      );
      setLoadError(false);
    } catch (error) {
      if (activeTabRef.current !== tab) return;
      console.error("Could not load posts", error);
      setLoadError(true);
    } finally {
      if (activeTabRef.current === tab) setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts(activeTab);
    const interval = setInterval(() => loadPosts(activeTab), 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // The post shown in the preview panel
  const selectedPost = posts.find((p) => p.id === selectedId);

  // Filter the list by the search text
  const visiblePosts = posts.filter((p) =>
    p.text.toLowerCase().includes(search.toLowerCase())
  );

  function showNotice(message) {
    setNotice(message);
  }

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timeout);
  }, [notice]);

  function changeTab(tab) {
    if (activeTabRef.current === tab) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
    setPosts([]);
    setSelectedId(null);
  }

  async function runRowAction(action) {
    if (busyActionRef.current) return;
    busyActionRef.current = true;
    setBusyAction(true);
    try {
      await action();
    } catch (error) {
      showNotice(error.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      busyActionRef.current = false;
      setBusyAction(false);
    }
  }

  async function deletePost(e, id) {
    e.stopPropagation();
    if (!window.confirm("Delete this post?")) return;

    await runRowAction(async () => {
      await api.delete(`/posts/${id}`);
      showNotice("Post deleted.");
      await loadPosts();
    });
  }

  async function unschedulePost(e, post) {
    e.stopPropagation();
    await runRowAction(async () => {
      await api.patch(`/posts/${post.id}/unschedule`);
      showNotice("Post moved back to drafts.");
      if (activeTab === "Schedule") changeTab("Drafts");
      else await loadPosts();
    });
  }

  async function retryPost(e, post) {
    e.stopPropagation();
    await runRowAction(async () => {
      const response = await api.post(`/posts/${post.id}/publish-now`);
      if (response.data.post.status === "failed") {
        showNotice(response.data.message);
      } else {
        showNotice("Post published.");
      }
      await loadPosts();
    });
  }

  async function handleContinue(scheduleData) {
    if (!selectedPost || schedulingRef.current) return;

    schedulingRef.current = true;
    setScheduling(true);
    setScheduleError("");
    try {
      if (scheduleData.mode === "now") {
        const response = await api.post(`/posts/${selectedPost.id}/publish-now`, {
          platforms: scheduleData.channels,
        });
        if (response.data.post.status === "failed") {
          setScheduleError(response.data.message);
          await loadPosts();
          return;
        }
        setShowSchedule(false);
        showNotice("Post published.");
        if (activeTab === "Sent") await loadPosts();
        else changeTab("Sent");
      } else {
        await api.patch(`/posts/${selectedPost.id}/schedule`, {
          platforms: scheduleData.channels,
          scheduledAt: scheduleData.scheduledAt,
        });
        setShowSchedule(false);
        showNotice("Post scheduled.");
        if (activeTab === "Schedule") await loadPosts();
        else changeTab("Schedule");
      }
    } catch (error) {
      setScheduleError(error.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      schedulingRef.current = false;
      setScheduling(false);
    }
  }

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="pb-wrap">

        <TopBar
          title="Publish"
          subtitle="Schedule your content and reach your audience across multiple platforms."
          titleIcon="▷"
          searchValue={search}
          onSearchChange={setSearch}
        />

        {/* Tabs */}
        <nav className="pb-tabs">
          {tabs.map((tab) => (
            <a
              key={tab}
              href="#"
              className={activeTab === tab ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                changeTab(tab);
              }}
            >
              {tab}
            </a>
          ))}
        </nav>

        <div className="pb-body">

          {/* Left column */}
          <div className="pb-left">
            <div className="pb-head">
              <div>
                <h2>{activeTab}</h2>
                <p>
                  {activeTab === "Schedule"
                    ? "Posts waiting to be published."
                    : activeTab === "Drafts"
                      ? "Posts you have not scheduled yet."
                      : "Posts that have been published."}
                </p>
              </div>
              <Link to="/simulator" className="pb-open-simulator">Open Simulator</Link>
            </div>

            {notice && <p className="pb-notice">{notice}</p>}

              <div className="pb-list">
                {visiblePosts.map((post) => (
                  <div
                    key={post.id}
                    className={"pb-post" + (post.id === selectedId ? " active" : "")}
                    onClick={() => setSelectedId(post.id)}
                  >
                    <div className="pb-date">
                      <small>{post.day}</small>
                      <strong>{post.date}</strong>
                      <span>{post.time}</span>
                    </div>
                    {post.img && <img className="pb-thumb" src={post.img} alt="" />}
                    <div className="pb-post-info">
                      <h4>{post.title}</h4>
                      <div className="pb-post-meta">
                        <span>{post.icons}</span>
                        <i>•</i>
                        <span className={"pb-status" + (post.rawStatus === "failed" ? " failed" : post.rawStatus === "published" ? " sent" : "")}>{post.status}</span>
                      </div>
                    </div>
                    <div className="pb-post-actions">
                      {post.rawStatus !== "published" && post.rawStatus !== "publishing" && (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/createpage?draft=${post.id}`);
                          }}
                        >✎</button>
                      )}
                      <button type="button" disabled={busyAction} onClick={(e) => deletePost(e, post.id)}>🗑</button>
                      {post.rawStatus === "scheduled" && (
                        <button type="button" className="pb-context-action" disabled={busyAction} onClick={(e) => unschedulePost(e, post)}>Unschedule</button>
                      )}
                      {post.rawStatus === "failed" && (
                        <button type="button" className="pb-context-action" disabled={busyAction} onClick={(e) => retryPost(e, post)}>Retry</button>
                      )}
                    </div>
                  </div>
                ))}
                {loading ? (
                  <p className="pb-empty">Loading posts...</p>
                ) : loadError ? (
                  <p className="pb-empty">Could not load posts.</p>
                ) : posts.length === 0 ? (
                  <p className="pb-empty">
                    {activeTab === "Schedule" ? "No scheduled posts yet." : activeTab === "Drafts" ? "No drafts yet." : "No sent posts yet."}
                  </p>
                ) : visiblePosts.length === 0 ? (
                  <p className="pb-empty">No posts found.</p>
                ) : null}
              </div>

            <button type="button" className="pb-add" onClick={() => navigate("/createpage")}>+ Add More Scheduled Posts</button>

            <button
              type="button"
              className="pb-schedule-btn"
              disabled={!selectedPost || selectedPost.rawStatus === "published" || selectedPost.rawStatus === "publishing"}
              onClick={() => {
                setScheduleError("");
                setShowSchedule(true);
              }}
            >
              Schedule Post →
            </button>
          </div>

          {/* Right column */}
          <aside className="pb-right">

            {selectedPost && (
              <div className="pb-panel">
                <div className="pb-panel-head">
                  <h3>◉ Post Preview</h3>
                  {selectedPost.rawStatus !== "published" && selectedPost.rawStatus !== "publishing" && (
                    <a
                      href={`/createpage?draft=${selectedPost.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/createpage?draft=${selectedPost.id}`);
                      }}
                    >✎ Edit</a>
                  )}
                </div>

                <div className="pb-preview">
                  <div className="pb-preview-top">
                    <span className="pb-preview-logo">✦</span>
                    <div>
                      <strong>Socialynk ✔</strong>
                      <small>
                        {selectedPost.rawStatus === "scheduled"
                          ? `Scheduled for ${formatPreviewDate(selectedPost.scheduledAt)}`
                          : selectedPost.rawStatus === "published"
                            ? `Sent on ${formatPreviewDate(selectedPost.publishedAt)}`
                            : selectedPost.rawStatus === "draft"
                              ? `Edited ${formatPreviewDate(selectedPost.updatedAt)}`
                              : selectedPost.rawStatus === "failed"
                                ? "Failed"
                                : selectedPost.status}
                      </small>
                    </div>
                    <span className="pb-preview-dots">···</span>
                  </div>

                  <div
                    className="pb-preview-content"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(
                        selectedPost.contentHtml || plainTextToHtml(selectedPost.text)
                      ),
                    }}
                  />
                  {selectedPost.rawStatus === "failed" && selectedPost.publishError && (
                    <p className="pb-error">{selectedPost.publishError}</p>
                  )}
                  {selectedPost.rawStatus === "scheduled" && selectedPost.publishError && (
                    <p className="pb-error">Last attempt failed: {selectedPost.publishError}. It will retry automatically.</p>
                  )}

                  {selectedPost.img && (
                    <div className="pb-preview-img">
                      <img src={selectedPost.img} alt="" />
                      <div className="pb-preview-caption">
                        <strong>{selectedPost.title}</strong>
                        <small>Smarter • Faster • Together</small>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            <div className="pb-platforms">
              <h4>Selected Platforms</h4>
              {selectedPost?.platforms.length ? (
                selectedPost.platforms.map((platform) => {
                  const result = selectedPost.platformResults?.find((item) => item.platform === platform);
                  return (
                    <div key={platform} className="pb-platform">
                      <span>{PLATFORM_ICONS[platform]} {PLATFORM_NAMES[platform] || platform}</span>
                      {result && (
                        <small
                          className={"pb-platform-result " + result.status}
                          title={result.error || ""}
                        >
                          {result.status === "success" ? "Sent" : result.status === "failed" ? "Failed" : ""}
                        </small>
                      )}
                    </div>
                  );
                })
              ) : selectedPost ? (
                <p className="pb-empty">No platforms selected yet.</p>
              ) : null}
            </div>

          </aside>
        </div>
      </div>
      {showSchedule && selectedPost && (
        <ScheduleModal
          postTitle={selectedPost.text}
          postId={selectedPost.id}
          busy={scheduling}
          errorMessage={scheduleError}
          onClose={() => setShowSchedule(false)}
          onBack={() => setShowSchedule(false)}
          onContinue={handleContinue}
          initialChannels={selectedPost.platforms}
        />
      )}
    </div>
  );
}

export default PublishPage;