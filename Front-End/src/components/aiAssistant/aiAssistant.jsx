import { useState, useEffect, useRef } from "react";
import "./aiAssistant.css";
import {
  activateBrandMemory,
  deactivateBrandMemory,
  generateCaption,
  getBrandMemory,
} from "../../api/api.js";

const chips = ["✦ Generate Caption", "◎ Improve Hook", "✓ Fix Grammar", "# Hashtags", "Fix Tone"];

function getCurrentTime() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function AiAssistant({ onClose, onUseInEditor, onActiveMemoryChange }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "ai",
      text: "Hi! What would you like help creating?",
      time: getCurrentTime(),
      welcome: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [brandMemories, setBrandMemories] = useState([])
  const [activeMemory, setActiveMemory] = useState(null)
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [memorySaving, setMemorySaving] = useState(false)
  const [memoryError, setMemoryError] = useState("")
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const chatEndRef = useRef(null);
  const copiedTimeoutRef = useRef(null);
  const lastPromptRef = useRef("");

  // Close with the Escape key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimeoutRef.current);
  }, []);

  useEffect(() => {
    let active = true

    getBrandMemory()
      .then((result) => {
        if (!active) return
        setBrandMemories(result.memories)
        setActiveMemory(result.activeMemory)
        onActiveMemoryChange?.(result.activeMemory)
      })
      .catch((error) => {
        if (active) setMemoryError(error.message)
      })
      .finally(() => {
        if (active) setMemoryLoading(false)
      })

    return () => {
      active = false
    }
  }, [onActiveMemoryChange])

  // Scroll to the newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(prompt = input.trim(), isRetry = false) {
    const text = prompt.trim();
    if (loading || memorySaving) return;
    if (!text) return;

    if (!isRetry) {
      lastPromptRef.current = text;
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", text, time: getCurrentTime() },
      ]);
    }
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    try {
      const response = await generateCaption(text, controller.signal);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "AI request failed. Please try again.");
      }

      if (typeof data?.caption !== "string") {
        throw new Error("The server response did not include a caption.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          text: data.caption,
          time: getCurrentTime(),
        },
      ]);
    } catch (error) {
      const message =
        error?.name === "AbortError" || controller.signal.aborted
          ? "The AI took too long. Please try again."
          : error instanceof TypeError
            ? "Network error. Please check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Unable to generate a caption.";
      console.error("Could not generate a caption:", message);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          text: message,
          time: getCurrentTime(),
          error: true,
          retryable: true,
        },
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function copyMessage(messageId, text) {
    try {
      await navigator.clipboard.writeText(text);
      window.clearTimeout(copiedTimeoutRef.current);
      setCopiedMessageId(messageId);
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error("Could not copy the AI response:", error);
    }
  }

  async function handleMemoryChange(event) {
    const memoryId = event.target.value
    setMemorySaving(true)
    setMemoryError("")

    try {
      const selectedMemory = memoryId
        ? await activateBrandMemory(memoryId)
        : await deactivateBrandMemory()
      setActiveMemory(selectedMemory)
      onActiveMemoryChange?.(selectedMemory)
    } catch (error) {
      setMemoryError(error.message)
    } finally {
      setMemorySaving(false)
    }
  }

  function handleKeyDown(e) {
    // Enter sends, Shift+Enter makes a new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <header className="ai-header">
          <span className="ai-logo">✦</span>
          <div className="ai-title">
            <h2>AI Assistant <small className="ai-version">v2.4 Turbo</small></h2>
            <p>Create better social content with AI.</p>
          </div>
          <span className="ai-credits">⚡ AI Credits: 42 remaining</span>
          <button className="ai-close" onClick={onClose}>&times;</button>
        </header>

        {/* Context bar */}
        <div className="ai-context">
          <div className="ai-working">
            <span className="ai-green-dot"></span>
            <span>Working with:</span>
            <small>Social Post • Linked to editor caption</small>
          </div>
          <label className="ai-memory-control">
            <span>Memory:</span>
            <select
              value={activeMemory?.id || ""}
              onChange={handleMemoryChange}
              disabled={memoryLoading || memorySaving}
              aria-label="Active Brand Memory"
            >
              <option value="">{memoryLoading ? "Loading..." : "Memory Off"}</option>
              {brandMemories.map((memory) => (
                <option key={memory.id} value={memory.id}>{memory.brandName}</option>
              ))}
            </select>
          </label>
          <div className="ai-chips">
            {chips.map((chip) => (
              <button key={chip} type="button" onClick={() => setInput(chip.slice(2))}>
                {chip}
              </button>
            ))}
          </div>
        </div>
        {memoryError && <p className="ai-memory-error" role="alert">{memoryError}</p>}
        {!memoryError && !memoryLoading && (
          <p className="ai-memory-status" role="status">
            {memorySaving
              ? "Updating Brand Memory..."
              : activeMemory
                ? `Using ${activeMemory.brandName} memory`
                : "Memory is off"}
          </p>
        )}

        {/* Chat area */}
        <div className="ai-chat">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div className="ai-user-msg" key={msg.id}>
                <div className="ai-bubble">{msg.text}</div>
                <small>✓✓ {msg.time}</small>
              </div>
            ) : (
              <div className="ai-reply" key={msg.id}>
                <div className="ai-reply-head">
                  <span className="ai-mini-logo">✦</span>
                  <strong>AI Assistant</strong>
                  <small>• {msg.time}</small>
                  <div className="ai-reply-tools">
                    <button
                      type="button"
                      onClick={() => copyMessage(msg.id, msg.text)}
                    >
                      {copiedMessageId === msg.id ? "✓ Copied" : "⧉ Copy"}
                    </button>
                    <button type="button">↻</button>
                  </div>
                </div>

                {msg.error || msg.welcome ? (
                  <>
                    <p className={msg.error ? "ai-error ai-message-text" : "ai-message-text"}>
                      {msg.text}
                    </p>
                    {msg.retryable && (
                      <button
                        type="button"
                        className="ai-btn-light"
                        onClick={() => sendMessage(lastPromptRef.current, true)}
                        disabled={loading}
                      >
                        Try again
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="ai-intro">Here is your generated caption:</p>

                    <div className="ai-option">
                      <div className="ai-option-head">
                        <div>
                          <span className="ai-recommended">RECOMMENDED</span>
                          <strong>Generated caption</strong>
                        </div>
                        <small className="mono">{msg.text.length} characters</small>
                      </div>

                      <p className="ai-message-text">{msg.text}</p>

                      <div className="ai-option-actions">
                        <button
                          type="button"
                          className="ai-btn-dark"
                          onClick={() => onUseInEditor(msg.text)}
                        >
                          ✓ Use in Editor
                        </button>
                        <button
                          type="button"
                          className="ai-btn-light ai-btn-copy"
                          onClick={() => copyMessage(msg.id, msg.text)}
                        >
                          {copiedMessageId === msg.id ? "✓ Copied" : "⧉ Copy"}
                        </button>
                        <button type="button" className="ai-btn-light">⚙ Improve</button>
                        <span className="ai-adapt">⎘ Adapt for Reels</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          )}

          {loading && <p className="ai-intro">AI Assistant is typing...</p>}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="ai-input-area">
          <div className="ai-input-box">
            <textarea
              rows="2"
              placeholder="Ask AI to create or improve your content... (e.g. 'Make it shorter and add 3 punchy hooks')"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className="ai-input-bar">
              <div className="ai-input-left">
                <button type="button" className="ai-icon-btn">⌀</button>
                <button type="button" className="ai-select">🌐 All Platforms</button>
                <button type="button" className="ai-plain">≡ Tone</button>
              </div>
              <div className="ai-input-right">
                <span>Press Enter ↵</span>
                <button
                  type="button"
                  className="ai-send"
                  onClick={() => sendMessage()}
                  disabled={loading || memorySaving}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AiAssistant;