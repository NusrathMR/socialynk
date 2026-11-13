import "./dashBoard.css"
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext/authContext.jsx";
import api, { getDashboardStats } from "../../api/api.js"
import Sidebar from "../sideBar/sidebar.jsx";
import TopBar from "../topBar/topBar.jsx";
import ScheduleModal from "../scheduleModel/scheduleModel.jsx";
import { getFirstName } from "../../utils/getFirstName.js";
import { getGreeting } from "../../utils/getGreeting.js";

const PLATFORM_ICONS = { instagram: "◎", facebook: "👍", linkedin: "▣", x: "#", tiktok: "♪" };
const PLATFORM_NAMES = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", tiktok: "TikTok" };

function DashBoard(){
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();
    const [stats, setStats] = useState({ scheduled: 0, drafts: 0, totalPublishedPosts: 0 });
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState(false);
    const [nextPost, setNextPost] = useState(null);
    const [showSchedule, setShowSchedule] = useState(false);
    const [scheduling, setScheduling] = useState(false);
    const [scheduleError, setScheduleError] = useState("");
    const [notice, setNotice] = useState("");
    const schedulingRef = useRef(false);
    const greeting = getGreeting();
    const firstName = isLoading ? "" : getFirstName(user);
    const fullName = typeof user?.name === "string" ? user.name.trim() : "";

    async function loadStats() {
        try {
            const [scheduledResponse, draftsResponse, dashboardResponse] = await Promise.all([
                api.get("/posts?status=scheduled,publishing&sort=scheduledAt&limit=50"),
                api.get("/posts?status=draft&limit=1"),
                getDashboardStats(),
            ]);
            const scheduledPosts = scheduledResponse.data.posts;
            setNextPost(scheduledPosts[0] || null);

            setStats({
                scheduled: scheduledResponse.data.total,
                drafts: draftsResponse.data.total,
                totalPublishedPosts: dashboardResponse.totalPublishedPosts,
            });
            setStatsError(false);
        } catch (error) {
            console.error("Could not load dashboard stats", error);
            setNextPost(null);
            setStatsError(true);
        } finally {
            setStatsLoading(false);
        }
    }

    useEffect(() => {
        const initialLoad = setTimeout(loadStats, 0);
        const interval = setInterval(loadStats, 30000);
        return () => {
            clearTimeout(initialLoad);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timeout = setTimeout(() => setNotice(""), 4000);
        return () => clearTimeout(timeout);
    }, [notice]);

    async function handleContinue(scheduleData) {
        if (!nextPost || schedulingRef.current) return;

        schedulingRef.current = true;
        setScheduling(true);
        setScheduleError("");
        try {
            if (scheduleData.mode === "now") {
                const response = await api.post(`/posts/${nextPost._id}/publish-now`, {
                    platforms: scheduleData.channels,
                });
                if (response.data.post.status === "failed") {
                    setScheduleError(response.data.message);
                    await loadStats();
                    return;
                }
                setShowSchedule(false);
                setNotice("Post published.");
            } else {
                await api.patch(`/posts/${nextPost._id}/schedule`, {
                    platforms: scheduleData.channels,
                    scheduledAt: scheduleData.scheduledAt,
                });
                setShowSchedule(false);
                setNotice("Post rescheduled.");
            }
            await loadStats();
        } catch (error) {
            setScheduleError(error.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            schedulingRef.current = false;
            setScheduling(false);
        }
    }

    return(
        <>

        
            <div className="db-layout">

                <Sidebar />

                {/* <!-- Main --> */}
                <main class="db-main">

                    <TopBar
                        title={
                            <>
                                {greeting}
                                {firstName && (
                                    <>
                                        {", "}
                                        <span className="db-greeting-name" title={fullName || firstName}>
                                            {firstName}
                                        </span>
                                    </>
                                )}{" "}
                                👋
                            </>
                        }
npm                         subtitle="Create. Edit. Publish. Grow. All in one place."
                        searchShortcut="⌘K"
                    />
                    {notice && <p className="db-notice">{notice}</p>}

                    {/* <!-- Stats --> */}
                    <section class="db-stats">
                    <div class="db-stat">
                        <div class="db-stat-top"><span class="db-stat-icon">◷</span><span>···</span></div>
                        <h2>{statsLoading || statsError ? "—" : stats.scheduled}</h2>
                        <p>Scheduled Posts</p>
                        <div class="db-stat-foot">Waiting to be published</div>
                    </div>

                    <div class="db-stat">
                        <div class="db-stat-top"><span class="db-stat-icon">◎</span><span>···</span></div>
                        <h2>{statsLoading || statsError ? "—" : stats.drafts}</h2>
                        <p>Drafts</p>
                        <div class="db-stat-foot">Not scheduled yet</div>
                    </div>

                    <div class="db-stat">
                        <div class="db-stat-top"><span class="db-stat-icon">✓</span><span>···</span></div>
                        <h2>{statsLoading || statsError ? "—" : stats.totalPublishedPosts}</h2>
                        <p>Total published posts</p>
                        <div class="db-stat-foot">Published successfully</div>
                    </div>
                    </section>
                    {statsError && <p class="db-stats-error">Could not load</p>}

                    {/* <!-- Steps --> */}
                    <div class="db-section-head">
                    <h3>Steps to post</h3>
                    <a href="#">Quick setup guide</a>
                    </div>

                    <section class="db-steps">
                    <a href="/createpage" class="db-step" onClick={(event) => { event.preventDefault(); navigate("/createpage"); }}>
                        <div class="db-step-top"><span class="db-step-num">01</span><span>→</span></div>
                        <h4>Create a post</h4>
                        <p>Create your social media content using the Socialynk editor.</p>
                        <div class="db-step-visual">▤</div>
                        <span class="db-step-btn">Go to create page →</span>
                    </a>

                    <a href="/aitools" class="db-step" onClick={(event) => { event.preventDefault(); navigate("/aitools"); }}>
                        <div class="db-step-top"><span class="db-step-num">02</span><span>✦</span></div>
                        <h4>Explore AI tools</h4>
                        <p>See the AI features planned for your content workflow.</p>
                        <div class="db-ai-box">◎ AI tools overview</div>
                        <span class="db-step-btn">Explore AI tools →</span>
                    </a>
                    </section>

                    <section class="db-bottom">
                    <div class="db-ad">
                        <div class="db-ad-content">
                            <small class="db-ad-label">SOCIALYNK</small>
                            <h3>Create Once. Improve with AI. Publish Everywhere.</h3>
                            <p>Your ideas, drafts and schedule in one calm workspace.</p>
                            <div class="db-ad-chips">
                                <span>Autosaved drafts</span>
                                <span>Smart scheduling</span>
                                <span>One-click publishing</span>
                            </div>
                            <button type="button" onClick={() => navigate("/createpage")}>Create a post →</button>
                        </div>
                    </div>

                    <div class="db-box">
                        <div class="db-box-head">
                        <h4>▷ Next Scheduled Post</h4>
                        {nextPost && <span class="db-chip dark">Scheduled</span>}
                        </div>

                        {statsLoading ? (
                            <p class="db-preview-empty">Loading preview...</p>
                        ) : statsError ? (
                            <p class="db-preview-empty">Could not load the preview.</p>
                        ) : nextPost ? (
                            <>
                                <p class="db-post-text">{nextPost.caption}</p>
                                <div class="db-preview-platforms">
                                    {nextPost.platforms.map((platform) => (
                                        <span key={platform}>{PLATFORM_ICONS[platform]} {PLATFORM_NAMES[platform] || platform}</span>
                                    ))}
                                </div>
                                <p class="db-post-date">◷ Scheduled for {new Date(nextPost.scheduledAt).toLocaleString()}</p>
                                {nextPost.publishError && (
                                    <p class="db-preview-error">Last attempt failed: {nextPost.publishError}. It will retry automatically.</p>
                                )}
                                <div class="db-post-buttons">
                                    <button type="button" class="db-btn-light" onClick={() => navigate(`/createpage?draft=${nextPost._id}`)}>Edit post</button>
                                    <button
                                        type="button"
                                        class="db-btn-dark"
                                        onClick={() => {
                                            setScheduleError("");
                                            setShowSchedule(true);
                                        }}
                                    >Reschedule</button>
                                </div>
                            </>
                        ) : (
                            <div class="db-preview-empty">
                                <p>No scheduled posts yet.</p>
                                <button type="button" class="db-btn-dark" onClick={() => navigate("/createpage")}>Create a post</button>
                            </div>
                        )}
                    </div>

                    </section>
                </main>
            </div>
            {showSchedule && nextPost && (
                <ScheduleModal
                    postTitle={nextPost.caption}
                    postId={nextPost._id}
                    initialChannels={nextPost.platforms}
                    busy={scheduling}
                    errorMessage={scheduleError}
                    onClose={() => setShowSchedule(false)}
                    onBack={() => setShowSchedule(false)}
                    onContinue={handleContinue}
                />
            )}
        </>
    )
}

export default DashBoard;

//Nothing 