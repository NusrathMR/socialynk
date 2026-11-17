import "./scheduleModel.css"
import { useState, useEffect } from "react";

const channelList = [
  { id: "instagram", name: "Instagram", detail: "@socialynk_hq", icon: "◎", mono: true, connected: true },
  { id: "facebook", name: "Facebook", detail: "Socialynk Official Page", icon: "f", connected: true },
  { id: "linkedin", name: "LinkedIn", detail: "Socialynk Enterprise Suite", icon: "in", connected: true },
  { id: "x", name: "X (Twitter)", detail: "@socialynk", icon: "X", mono: true },
  { id: "tiktok", name: "TikTok", detail: "@socialynk_global", icon: "♪", mono: true },
  { id: "youtube", name: "YouTube", detail: "Socialynk Channel", icon: "▶", mono: true },
];

// "2026-09-30" -> "30 Sep 2026"
function formatDate(value) {
  if (!value) return "No date";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// "19:30" -> "07:30 PM"s
function formatTime(value) {
  if (!value) return "No time";
  const [h, m] = value.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${m} ${suffix}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// A Date -> "2026-10-28" (local date, the format an <input type="date"> uses)
function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A Date -> "19:30" (local time, the format an <input type="time"> uses)
function toTimeInput(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Starting values: today, 15 minutes from now
function defaultSchedule() {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  return { date: toDateInput(d), time: toTimeInput(d) };
}

function ScheduleModal({ postTitle, postId, busy, errorMessage, onClose, onBack, onContinue, initialChannels }) {
  const [selected, setSelected] = useState(initialChannels?.length ? initialChannels : ["instagram", "facebook", "linkedin"]);
  const [mode, setMode] = useState("later"); // "now" or "later"
  const [defaults] = useState(defaultSchedule);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);

  // Close with the Escape key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const allSelected = selected.length === channelList.length;

  function toggleChannel(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : channelList.map((c) => c.id));
  }

// The chosen moment as a real Date (local time), or null for "Publish Now"
const scheduledAt =
  mode === "later" && date && time ? new Date(`${date}T${time}`) : null;

// True when the chosen time has already passed
const isPast = scheduledAt !== null && scheduledAt.getTime() < Date.now();

const canContinue =
  !busy && !isPast && selected.length > 0 && (mode === "now" || (date && time));

function handleContinue() {
  onContinue({
    channels: selected,
    mode,
    date: mode === "later" ? date : null,
    time: mode === "later" ? time : null,
    scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,   // UTC, ready for the server
  });
}
  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <header className="sc-header">
          <div className="sc-header-top">
            <div>
              <h2>Schedule &amp; Select Channels</h2>
              <p>Choose where and when you want to publish your content.</p>
            </div>
            <button className="sc-close" onClick={onClose}>&times;</button>
          </div>

          <div className="sc-stepper">
            <span className="sc-step done"><b>✓</b> 1. Create Content</span>
            <span className="sc-arrow">›</span>
            <span className="sc-step active"><b>●</b> 2. Schedule &amp; Channels</span>
            <span className="sc-arrow">›</span>
            <span className="sc-step"><b>3</b> Publish</span>
          </div>
        </header>

        {/* Body */}
        <div className="sc-body">

          {/* Post preview */}
          <div className="sc-post">
            <span className="sc-post-icon">▤</span>
            <div className="sc-post-info">
              <div className="sc-post-meta">
                <span className="sc-post-tag">SOCIAL POST</span>
                <small className="mono">Draft #{postId ? postId.slice(-4).toUpperCase() : "----"}</small>
              </div>
              <p>{postTitle || "Untitled post"}</p>
            </div>
            <button type="button" className="sc-edit" onClick={onClose}>✎ Edit Content</button>
          </div>

          <div className="sc-columns">

            {/* Left: channels */}
            <div className="sc-col">
              <div className="sc-col-head">
                <div>
                  <h3>Select Channels</h3>
                  <p>Choose target profiles for this post</p>
                </div>
                <label className="sc-select-all">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  Select All
                </label>
              </div>

              {channelList.map((ch) => {
                const isOn = selected.includes(ch.id);
                return (
                  <label key={ch.id} className={"sc-channel" + (isOn ? " selected" : "")}>
                    <span className={"sc-ch-icon" + (isOn ? "" : " light")}>{ch.icon}</span>
                    <div className="sc-ch-text">
                      <strong>
                        {ch.name} {ch.connected && <i className="sc-live"></i>}
                      </strong>
                      <small className={ch.mono ? "mono" : ""}>{ch.detail}</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggleChannel(ch.id)}
                    />
                  </label>
                );
              })}

              <p className="sc-manage">
                Need to add more accounts? <a href="#">Manage Channels ↗</a>
              </p>
            </div>

            {/* Right: timing */}
            <div className="sc-col">
              <div className="sc-col-head">
                <div>
                  <h3>When do you want to publish?</h3>
                  <p>Choose immediate broadcast or automated timing</p>
                </div>
              </div>

              <label className={"sc-option" + (mode === "now" ? " selected" : "")}>
                <input
                  type="radio"
                  name="when"
                  checked={mode === "now"}
                  onChange={() => setMode("now")}
                />
                <div className="sc-option-body">
                  <div className="sc-option-top">
                    <strong>Publish Now</strong>
                    {mode === "now" && <span className="sc-active">ACTIVE</span>}
                  </div>
                  <small>Your content will be sent to the selected channels immediately.</small>
                </div>
              </label>

              <label className={"sc-option" + (mode === "later" ? " selected" : "")}>
                <input
                  type="radio"
                  name="when"
                  checked={mode === "later"}
                  onChange={() => setMode("later")}
                />
                <div className="sc-option-body">
                  <div className="sc-option-top">
                    <strong>Schedule for Later</strong>
                    {mode === "later" && <span className="sc-active">ACTIVE</span>}
                  </div>
                  <small>Pick a specific date and time to broadcast your post.</small>

                  {mode === "later" && (
                    <div className="sc-schedule">
                      <div className="sc-fields">
                        <div>
                          <span className="sc-label mono">DATE</span>
                          <input
                            type="date"
                            value={date}
                            min={toDateInput(new Date())}
                            onChange={(e) => setDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="sc-label mono">TIME</span>
                          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                        </div>
                      </div>
                      <div className="sc-timezone">
                        <span>◍ Local Timezone:</span>
                        <b className="mono">{Intl.DateTimeFormat().resolvedOptions().timeZone}</b>
                      </div>
                      {isPast && <p className="sc-error">Choose a time in the future.</p>}
                    </div>
                  )}
                </div>
              </label>

              <div className="sc-summary">
                <span className="sc-label mono">BROADCAST SUMMARY</span>
                <div className="sc-summary-row">
                  <span>{mode === "later" ? "Scheduled For:" : "Publishing:"}</span>
                  <b>
                    {mode === "later"
                      ? `${formatDate(date)} • ${formatTime(time)}`
                      : "Immediately"}
                  </b>
                </div>
                <div className="sc-summary-row">
                  <span>Active Destinations:</span>
                  <b>{selected.length} Channel{selected.length === 1 ? "" : "s"} Selected</b>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        {errorMessage && <p className="sc-error sc-error-bar">{errorMessage}</p>}
        <footer className="sc-footer">
          <button type="button" className="sc-back" disabled={busy} onClick={onBack}>← Back</button>
          <button
            type="button"
            className="sc-continue"
            disabled={!canContinue}
            onClick={handleContinue}
          >
            {busy ? "Working..." : mode === "now" ? "Publish Now →" : "Schedule Post →"}
          </button>
        </footer>

      </div>
    </div>
  );
}

export default ScheduleModal;