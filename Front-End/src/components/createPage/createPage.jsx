import "./createPage.css"
import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import api, { getBrandMemory, uploadImage, deleteImage } from "../../api/api.js"
import Sidebar from "../sideBar/sidebar.jsx"
import TopBar from "../topBar/topBar.jsx"
import AIAssistantModal from "../aiAssistant/aiAssistant.jsx"
import ScheduleModal from "../scheduleModel/scheduleModel.jsx"
import RecentPostsDropdown from "./recentPostsDropdown.jsx"

// The five content type cards. "id" must match the values the backend accepts.
const CONTENT_TYPES = [
  { id: "social_post", icon: "▤", title: "Social Post", text: "Multi-platform text & media" },
  { id: "image", icon: "▣", title: "Image", text: "Single visual asset" },
  { id: "video", icon: "▷", title: "Video", text: "Motion & clips" },
  { id: "carousel", icon: "◫", title: "Carousel", text: "Slide deck sequence" },
  { id: "reel", icon: "▶", title: "Reel", text: "Vertical 9:16 story" },
]

const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024
const SUPPORTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

// "2025-01-01T10:00:00Z" becomes "3 hours ago"
function timeAgo(dateString) {
  const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

function draftTitle(caption) {
  return caption.length > 30 ? caption.slice(0, 30) + "..." : caption
}

function CreatePage() {
  // The address can contain ?draft=<id>, which means "open this draft"
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const draftId = searchParams.get("draft")

  // What the editor holds
  const [caption, setCaption] = useState("")
  const [contentType, setContentType] = useState("social_post")
  const [images, setImages] = useState([])
  const [uploadedImageIds, setUploadedImageIds] = useState(() => new Set())
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploadProgress, setUploadProgress] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [removingId, setRemovingId] = useState("")
  const [postId, setPostId] = useState(null)        // null until the first save
  const lastSavedRef = useRef(JSON.stringify({
    caption: "",
    contentType: "social_post",
    media: [],
  }))
  const savingRef = useRef(false)
  const schedulingRef = useRef(false)
  const autosaveTimeoutRef = useRef(null)
  const previousPostInfoTimeoutRef = useRef(null)
  const draftLoadGenerationRef = useRef(0)
  const imageUploadGenerationRef = useRef(0)
  const imageUploadInProgressRef = useRef(false)
  const dragDepthRef = useRef(0)
  const imageInputRef = useRef(null)
  const forceAutosaveRef = useRef(false)

  // Save feedback
  const [saveStatus, setSaveStatus] = useState("idle")   // idle, saving, saved, error
  const [errorMessage, setErrorMessage] = useState("")
  const [previousPostInfo, setPreviousPostInfo] = useState("")

  // Recent Drafts panel
  const [drafts, setDrafts] = useState([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [draftsError, setDraftsError] = useState(false)

  // Popups
  const [showAI, setShowAI] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState("")
  const [activeBrandMemory, setActiveBrandMemory] = useState(null)
  const [brandMemoryLoading, setBrandMemoryLoading] = useState(true)
  const [brandMemoryLoadError, setBrandMemoryLoadError] = useState(false)
  const activeMemoryRequestRef = useRef(0)

  useEffect(() => {
    let active = true
    const requestId = activeMemoryRequestRef.current

    getBrandMemory()
      .then((result) => {
        if (active && requestId === activeMemoryRequestRef.current) {
          setActiveBrandMemory(result.activeMemory)
        }
      })
      .catch(() => {
        if (active && requestId === activeMemoryRequestRef.current) {
          setBrandMemoryLoadError(true)
        }
      })
      .finally(() => {
        if (active && requestId === activeMemoryRequestRef.current) {
          setBrandMemoryLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const handleActiveMemoryChange = useCallback((memory) => {
    activeMemoryRequestRef.current += 1
    setActiveBrandMemory(memory)
    setBrandMemoryLoading(false)
    setBrandMemoryLoadError(false)
  }, [])

  // ---------- Load the Recent Drafts list ----------
  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true)
    try {
      const response = await api.get("/posts?status=draft&limit=5")
      setDrafts(response.data.posts)
      setDraftsError(false)
    } catch (error) {
      console.error("Could not load drafts", error)
      setDraftsError(true)
    } finally {
      setDraftsLoading(false)
    }
  }, [])

  // Run once, when the page opens
  useEffect(() => {
    const timeout = setTimeout(loadDrafts, 0)
    return () => clearTimeout(timeout)
  }, [loadDrafts])

  // ---------- Open a draft when the address has ?draft=<id> ----------
  useEffect(() => {
    if (!draftId) return

    const generation = draftLoadGenerationRef.current + 1
    draftLoadGenerationRef.current = generation
    let active = true

    const openDraft = async () => {
      try {
        const response = await api.get(`/posts/${draftId}`)
        if (!active || generation !== draftLoadGenerationRef.current) return

        const post = response.data.post
        const postMedia = post.media || []
        lastSavedRef.current = JSON.stringify({
          caption: post.caption,
          contentType: post.contentType,
          media: postMedia,
        })
        setPostId(post._id)
        setCaption(post.caption)
        setContentType(post.contentType)
        setImages(postMedia)
        setUploadedImageIds(new Set())
        setSaveStatus("idle")
        setErrorMessage("")
      } catch {
        if (!active || generation !== draftLoadGenerationRef.current) return

        setErrorMessage("Draft not found...")
        setSearchParams({})          // remove the bad id from the address
      }
    }

    openDraft()
    return () => {
      active = false
    }
  }, [draftId, setSearchParams])

  // ---------- Save (create the first time, update afterwards) ----------
  // Returns the saved post, or null if saving failed
  const saveDraft = useCallback(async () => {
    if (!postId && caption.trim() === "" && images.length === 0) {
      setErrorMessage("Write something before you save...")
      return null
    }

    if (savingRef.current) return null
    savingRef.current = true
    setSaveStatus("saving")
    setErrorMessage("")

    try {
      const body = { caption, contentType, media: images }
      let savedPost

      if (postId) {
        const response = await api.put(`/posts/${postId}`, body)
        savedPost = response.data.post
      } else {
        const response = await api.post("/posts", body)
        savedPost = response.data.post
        setPostId(savedPost._id)       // remember it, so the next save updates
      }

      lastSavedRef.current = JSON.stringify({ caption, contentType, media: images })
      setSaveStatus("saved")
      loadDrafts()                     // refresh the Recent Drafts panel
      return savedPost
    } catch (error) {
      setSaveStatus("error")
      setErrorMessage(error.response?.data?.message || "Could not save the draft...")
      return null
    } finally {
      savingRef.current = false
    }
  }, [caption, contentType, images, postId, loadDrafts])

  // ---------- Autosave changed content ----------
  useEffect(() => {
    const current = JSON.stringify({ caption, contentType, media: images })
    if (current === lastSavedRef.current) return
    if (saveStatus === "saving") return
    if (saveStatus === "error") return
    if (
      !postId &&
      caption.trim().length < 3 &&
      images.length === 0 &&
      !forceAutosaveRef.current
    ) return

    const timeout = setTimeout(() => {
      autosaveTimeoutRef.current = null
      forceAutosaveRef.current = false
      saveDraft()
    }, 1500)
    autosaveTimeoutRef.current = timeout
    return () => {
      clearTimeout(timeout)
      if (autosaveTimeoutRef.current === timeout) autosaveTimeoutRef.current = null
    }
  }, [caption, contentType, images, saveStatus, postId, saveDraft])

  // ---------- Start a blank draft ----------
  const handleNewDraft = () => {
    draftLoadGenerationRef.current += 1
    imageUploadGenerationRef.current += 1
    forceAutosaveRef.current = false
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }
    lastSavedRef.current = JSON.stringify({
      caption: "",
      contentType: "social_post",
      media: [],
    })
    setPostId(null)
    setCaption("")
    setContentType("social_post")
    setImages([])
    setUploadedImageIds(new Set())
    setUploading(false)
    setUploadError("")
    setUploadProgress("")
    setSaveStatus("idle")
    setErrorMessage("")
    setSearchParams({})
  }

  const handleUsePreviousPost = (previousCaption) => {
    if (savingRef.current || saveStatus === "saving") return

    draftLoadGenerationRef.current += 1
    imageUploadGenerationRef.current += 1
    forceAutosaveRef.current = true
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }

    lastSavedRef.current = JSON.stringify({
      caption: "",
      contentType,
      media: [],
    })
    setPostId(null)
    setImages([])
    setUploadedImageIds(new Set())
    setUploading(false)
    setUploadError("")
    setCaption(previousCaption)
    setSaveStatus("idle")
    setErrorMessage("")
    setSearchParams({})
    setPreviousPostInfo("Started a new draft from a previous post. Your earlier draft is saved in Recent Drafts.")

    if (previousPostInfoTimeoutRef.current) {
      clearTimeout(previousPostInfoTimeoutRef.current)
    }
    previousPostInfoTimeoutRef.current = setTimeout(() => {
      setPreviousPostInfo("")
      previousPostInfoTimeoutRef.current = null
    }, 4000)
  }

  useEffect(() => () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    if (previousPostInfoTimeoutRef.current) clearTimeout(previousPostInfoTimeoutRef.current)
  }, [])

  // ---------- Delete a draft from the Recent Drafts panel ----------
  const handleDelete = async (e, id) => {
    e.stopPropagation()                // do not also "open" the draft
    if (!window.confirm("Delete this draft?")) return

    try {
      await api.delete(`/posts/${id}`)
      if (id === postId) handleNewDraft()   // the open draft was deleted
      loadDrafts()
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not delete the draft...")
    }
  }

  // ---------- Next: save first, then open the schedule popup ----------
  const handleNext = async (e) => {
    e.preventDefault()

    if (saveStatus === "saving" || savingRef.current) {
      setErrorMessage("Saving... try again in a moment.")
      return
    }

    if (caption.trim() === "") {
      setErrorMessage("Write a caption before you continue...")
      return
    }

    const saved = await saveDraft()
    if (saved) {
      setScheduleError("")
      setShowSchedule(true)
    }
  }

  async function handleContinue(scheduleData) {
    if (!postId) {
      setScheduleError("Save your draft first...")
      return
    }
    if (schedulingRef.current) return

    schedulingRef.current = true
    setScheduling(true)
    setScheduleError("")

    try {
      if (scheduleData.mode === "now") {
        const response = await api.post(`/posts/${postId}/publish-now`, {
          platforms: scheduleData.channels,
        })
        if (response.data.post.status === "failed") {
          setScheduleError(response.data.message)
          return
        }
      } else {
        await api.patch(`/posts/${postId}/schedule`, {
          platforms: scheduleData.channels,
          scheduledAt: scheduleData.scheduledAt,
        })
      }

      setShowSchedule(false)
      navigate("/publishpage")
    } catch (error) {
      setScheduleError(error.response?.data?.message || "Something went wrong. Please try again.")
    } finally {
      schedulingRef.current = false
      setScheduling(false)
    }
  }

  const visibleDrafts = drafts.filter((d) => d.caption && d.caption.trim() !== "")

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList)
    if (!files.length) return
    if (imageUploadInProgressRef.current) {
      setUploadError("Please wait for the current image upload to finish.")
      return
    }

    const generation = imageUploadGenerationRef.current
    setUploadError("")
    setUploadProgress("")

    const validFiles = []
    const errors = []
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase()
      const type = file.type.toLowerCase()
      if (
        !SUPPORTED_IMAGE_EXTENSIONS.includes(extension) ||
        (type && !SUPPORTED_IMAGE_TYPES.includes(type))
      ) {
        errors.push(`${file.name}: Unsupported format. Choose JPG, PNG, or WebP.`)
      } else if (file.size > MAX_IMAGE_SIZE_BYTES) {
        errors.push(`${file.name}: Image must be 25 MB or smaller.`)
      } else {
        validFiles.push(file)
      }
    }

    if (!validFiles.length) {
      setUploadError(errors.join(" "))
      return
    }

    imageUploadInProgressRef.current = true
    setUploading(true)

    try {
      for (const [index, file] of validFiles.entries()) {
        setUploadProgress(`Uploading ${index + 1} of ${validFiles.length}: ${file.name}`)
        try {
          const media = await uploadImage(file)
          if (generation !== imageUploadGenerationRef.current) break
          setImages((prev) => [...prev, media])
          setUploadedImageIds((prev) => new Set(prev).add(media.publicId || media.url))
        } catch (error) {
          if (generation !== imageUploadGenerationRef.current) break
          errors.push(`${file.name}: ${error.message || "Image upload failed."}`)
        }
      }

      if (generation === imageUploadGenerationRef.current) {
        setUploadError(errors.join(" "))
      }
    } finally {
      imageUploadInProgressRef.current = false
      if (generation === imageUploadGenerationRef.current) {
        setUploading(false)
        setUploadProgress("")
      }
    }
  }

  const handleFileChange = (e) => {
    void handleFiles(e.target.files)
    e.target.value = ""
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!Array.from(e.dataTransfer.types).includes("Files")) return
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      e.dataTransfer.dropEffect = "copy"
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setIsDragging(false)
    void handleFiles(e.dataTransfer.files)
  }

  useEffect(() => {
    const preventFileNavigation = (event) => {
      if (Array.from(event.dataTransfer?.types || []).includes("Files")) {
        event.preventDefault()
      }
    }

    document.addEventListener("dragover", preventFileNavigation)
    document.addEventListener("drop", preventFileNavigation)
    return () => {
      document.removeEventListener("dragover", preventFileNavigation)
      document.removeEventListener("drop", preventFileNavigation)
    }
  }, [])

  const handleRemoveImage = async (image) => {
    if (!window.confirm("Remove this image?")) return

    setUploadError("")
    setRemovingId(image.publicId)

    try {
      await deleteImage(image.publicId)
      setImages((prev) => prev.filter((img) => img.publicId !== image.publicId))
      setUploadedImageIds((prev) => {
        const next = new Set(prev)
        next.delete(image.publicId || image.url)
        return next
      })
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setRemovingId("")
    }
  }

  return (
    <>
      <div className="db-layout">

        <Sidebar />

        {/* Main */}
        <div className="cr-wrap">

          <TopBar
            title="Create Content"
            subtitle="Turn your ideas into amazing posts with AI."
          />

          <div className="cr-body">

            {/* Left column */}
            <div className="cr-left">

              {/* Content types: now built from the list at the top of the file */}
              <div className="cr-types">
                {CONTENT_TYPES.map((type) => {
                  const isActive = contentType === type.id
                  return (
                    <div
                      key={type.id}
                      className={isActive ? "cr-type active" : "cr-type"}
                      onClick={() => {
                        setContentType(type.id)
                        if (saveStatus === "saved" || saveStatus === "error") setSaveStatus("idle")
                      }}
                    >
                      <span className={isActive ? "cr-type-icon dark" : "cr-type-icon"}>{type.icon}</span>
                      <strong>{type.title}</strong>
                      <small>{type.text}</small>
                      {isActive && <i className="cr-type-dot"></i>}
                    </div>
                  )
                })}
              </div>

              {/* Editor */}
              <div className="cr-editor">
                <div className="cr-editor-head">
                  <h3>✎ Create your content</h3>
                  <div className="cr-editor-actions">
                    <span className="cr-memory-indicator">
                      {brandMemoryLoading
                        ? "Loading memory..."
                        : brandMemoryLoadError
                          ? "Memory status unavailable"
                          : activeBrandMemory
                            ? `Using: ${activeBrandMemory.brandName}`
                            : "Memory is off"}
                    </span>
                    <RecentPostsDropdown currentPostId={postId || draftId} onUsePost={handleUsePreviousPost} />
                    <button type="button" className="cr-ai-btn" onClick={() => setShowAI(true)}>✦ AI Assistant</button>
                  </div>
                </div>

                {previousPostInfo && <p className="rp-info" role="status">{previousPostInfo}</p>}

                <div className="cr-toolbar">
                  <select>
                    <option>Paragraph</option>
                    <option>Heading 1</option>
                    <option>Heading 2</option>
                  </select>
                  <span className="cr-sep"></span>
                  <button type="button"><b>B</b></button>
                  <button type="button"><i>I</i></button>
                  <button type="button"><u>U</u></button>
                  <span className="cr-sep"></span>
                  <button type="button">☰</button>
                  <button type="button">≡</button>
                  <button type="button">⛓</button>
                  <button type="button">☺</button>
                  <button type="button" className="cr-hashtag"># Suggest Hashtags</button>
                </div>

                <textarea
                  value={caption}
                  maxLength={2200}
                  onChange={(e) => {
                    setCaption(e.target.value)
                    if (saveStatus === "saved" || saveStatus === "error") setSaveStatus("idle")
                  }}
                  placeholder="Write your caption, idea or description here... Type '/' to quickly summon AI prompts or templates."
                ></textarea>

                {showAI && (
                  <AIAssistantModal
                    onClose={() => setShowAI(false)}
                    onActiveMemoryChange={handleActiveMemoryChange}
                    onUseInEditor={(text) => {
                      setCaption(text)      // put the AI text into the editor
                      setShowAI(false)      // close the popup
                    }}
                  />
                )}

                <div className="cr-editor-foot">
                  <span>✓ Grammar Check Active &nbsp;•&nbsp; Supports Markdown</span>
                  <span className="mono">
                    {saveStatus === "saving" && <>Saving...{"  •  "}</>}
                    {saveStatus === "saved" && <>✓ All changes saved{"  •  "}</>}
                    {errorMessage && <><span className="cr-error">{errorMessage}</span>{"  •  "}</>}
                    {caption.length} / 2,200 characters
                  </span>
                </div>

              </div>

              {/* Image editing (not connected yet, only className fixed) */}
              <div className="cr-edit-head">
                <h3>Image Editing</h3>
                <div className="cr-edit-links">
                  <a href="#">Add Footer</a>
                  <a href="#">Add Watermark</a>
                  <a href="#">Enhance Image Quality</a>
                </div>
              </div>

              <div className="cr-edit-grid">
                <div
                  className={isDragging ? "cr-upload dragging" : "cr-upload"}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    id="image-input"
                    ref={imageInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/jpg"
                    multiple
                    onChange={handleFileChange}
                    className="cr-upload-input"
                    tabIndex={-1}
                    aria-label="Choose images to upload"
                  />
                  <button
                    type="button"
                    className="cr-dropzone"
                    onClick={() => imageInputRef.current?.click()}
                    aria-label="Upload images. Drag and drop files here or press to browse."
                  >
                    <span className="cr-upload-icon" aria-hidden="true">☁</span>
                    <strong>{isDragging ? "Drop your images here" : "Drag and drop your images here"}</strong>
                    <span className="cr-upload-browse">or click to browse files</span>
                    <small>JPG, JPEG, PNG, WebP · up to 25 MB per image</small>
                  </button>
                  {uploading && (
                    <p className="cr-upload-status" role="status" aria-live="polite">
                      {uploadProgress || "Uploading..."}
                    </p>
                  )}
                  {uploadedImageIds.size > 0 && (
                    <p className="cr-upload-success" role="status">
                      {uploadedImageIds.size} image{uploadedImageIds.size === 1 ? "" : "s"} uploaded successfully.
                    </p>
                  )}
                  {uploadError && <p className="cr-upload-error" role="alert">{uploadError}</p>}
                  {images.length > 0 && (
                    <div className="cr-images">
                      {images.map((img) => (
                        <div
                          className={removingId === img.publicId ? "cr-image-item removing" : "cr-image-item"}
                          key={img.publicId || img.url}
                        >
                          <img src={img.url} alt="" className="cr-image" />
                          <button
                            type="button"
                            className="cr-image-remove"
                            onClick={() => handleRemoveImage(img)}
                            disabled={removingId === img.publicId}
                            aria-label="Remove image"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="cr-tool">
                  <span className="cr-tool-icon">⛉</span>
                  <h4>Add Watermark</h4>
                  <p>Protect your content with a custom watermark or logo overlay.</p>
                  <button type="button">+ Add watermark</button>
                </div>

                <div className="cr-tool">
                  <span className="cr-tool-icon">▯</span>
                  <h4>Add Footer</h4>
                  <p>Add your logo, website URL, or custom legal disclaimer strip.</p>
                  <button type="button">+ Add footer</button>
                </div>

                <div className="cr-tool">
                  <span className="cr-tool-icon">✦</span>
                  <h4>Enhance Image</h4>
                  <p>Improve brightness, clarity, and image quality via neural upscaling.</p>
                  <button type="button">Enhance</button>
                </div>
              </div>

              {/* Steps bar */}
              <div className="cr-steps">
                <div className="cr-steps-list">
                  <span className="cr-s active"><b>01</b> Create Content ›</span>
                  <span className="cr-s"><b>02</b> Add Image ›</span>
                  <span className="cr-s"><b>03</b> Add Branding ›</span>
                  <span className="cr-s"><b>04</b> Preview ›</span>
                  <span className="cr-s"><b>05</b> Publish / Schedule</span>
                </div>

                <a href="#" className="cr-next" onClick={handleNext}>Next &rarr;</a>

                {showSchedule && (
                  <ScheduleModal
                    postTitle={caption}
                    postId={postId}
                    busy={scheduling}
                    errorMessage={scheduleError}
                    onClose={() => setShowSchedule(false)}
                    onBack={() => setShowSchedule(false)}
                    onContinue={handleContinue}
                  />
                )}
              </div>
            </div>

            {/* Right column (Templates panel removed) */}
            <aside className="cr-right">

              {/* Recent drafts: now real data */}
              <div className="cr-panel">
                <div className="cr-panel-head">
                  <h3>▤ Recent Drafts</h3>
                  <a href="#" onClick={(e) => { e.preventDefault(); handleNewDraft() }}>+ New</a>
                </div>

                {draftsLoading ? (
                  <p className="cr-empty">Loading drafts...</p>
                ) : draftsError ? (
                  <p className="cr-empty">Could not load drafts.</p>
                ) : visibleDrafts.length === 0 ? (
                  <p className="cr-empty">No recent drafts available.</p>
                ) : (
                  visibleDrafts.map((draft) => (
                    <div
                      className="cr-draft"
                      key={draft._id}
                      onClick={() => setSearchParams({ draft: draft._id })}
                    >
                      <span className="cr-draft-icon">▤</span>
                      <div>
                        <strong>{draftTitle(draft.caption)}</strong>
                        <small>Edited {timeAgo(draft.updatedAt)}</small>
                      </div>
                      <button
                        type="button"
                        className="cr-dots"
                        title="Delete draft"
                        onClick={(e) => handleDelete(e, draft._id)}
                      >✕</button>
                    </div>
                  ))
                )}
              </div>

              {/* Pro tip */}
              <div className="cr-tip">
                <span className="cr-tip-icon">💡</span>
                <div>
                  <strong>Pro Tip</strong>
                  <p>Posts with 3–5 specific hashtags achieve 28% higher organic reach across LinkedIn and Instagram.</p>
                </div>
              </div>

            </aside>
          </div>
        </div>
      </div>
    </>
  )
}

export default CreatePage