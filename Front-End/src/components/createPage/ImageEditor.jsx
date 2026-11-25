import { useEffect, useRef, useState } from "react"
import { canvasToBlob, drawEditedImage, IMAGE_FILTERS, WATERMARK_POSITIONS } from "../../utils/imageEditor/renderImage.js"

const MAX_EXPORT_PIXELS = 40_000_000
const FILTER_THUMBNAIL_STYLES = {
  original: "none", grayscale: "grayscale(1)", sepia: "sepia(0.8)", vintage: "sepia(.55) contrast(.9)",
  warm: "sepia(.3) saturate(1.2)", cool: "hue-rotate(18deg) saturate(.9)", bright: "brightness(1.2)",
  contrast: "contrast(1.6)", bw: "grayscale(1) contrast(1.8)",
}

function createInitialSettings() {
  return {
    filter: "original",
    intensity: 100,
    adjustments: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
    watermark: {
      enabled: false, type: "text", text: "", fontSize: 5, fontFamily: "Arial, sans-serif", color: "#ffffff",
      opacity: 80, position: "bottom-right", rotation: 0, logoSize: 18, logoFile: null,
    },
    footer: { position: "bottom" },
  }
}

const FONT_OPTIONS = [
  ["Arial, sans-serif", "Arial"], ["Georgia, serif", "Georgia"], ["'Times New Roman', serif", "Times New Roman"],
  ["Verdana, sans-serif", "Verdana"], ["'Trebuchet MS', sans-serif", "Trebuchet MS"], ["monospace", "Monospace"],
]

function ImageEditor({ source, imageName, initialTab = "watermark", busy = false, onApply, onClose }) {
  const canvasRef = useRef(null)
  const [settings, setSettings] = useState(createInitialSettings)
  const [imageState, setImageState] = useState({ image: null, error: "" })
  const [logoState, setLogoState] = useState({ image: null, url: "", error: "" })
  const [footerFile, setFooterFile] = useState(null)
  const [footerState, setFooterState] = useState({ file: null, image: null, url: "", error: "" })
  const [exportFormat, setExportFormat] = useState("image/png")
  const [exportError, setExportError] = useState("")
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState(initialTab)
  const loadedImage = imageState.source === source ? imageState.image : null
  const loadError = imageState.source === source ? imageState.error : ""
  const loadedFooter = footerState.file === footerFile ? footerState.image : null

  useEffect(() => {
    let active = true
    const isBlob = source instanceof Blob
    const sourceUrl = isBlob
      ? URL.createObjectURL(source)
      : typeof source === "string" ? source.trim() : ""
    if (!sourceUrl) return undefined

    const image = new Image()
    // CORS mode must be selected before src for remote images so Canvas may read/export pixels.
    // Blob/object URLs and data URLs are same-origin/local and do not need this attribute.
    if (/^https?:\/\//i.test(sourceUrl)) image.crossOrigin = "anonymous"
    image.onload = () => {
      if (!active) return
      if (!image.naturalWidth || !image.naturalHeight) {
        setImageState({ source, sourceUrl, image: null, error: "The image loaded without valid dimensions and cannot be edited." })
        return
      }
      setImageState({ source, sourceUrl, image, error: "" })
    }
    image.onerror = () => active && setImageState({ source, sourceUrl, image: null, error: "This image could not be loaded. Check that the URL is available and, for remote images, that its server allows cross-origin image access (CORS)." })
    image.src = sourceUrl
    return () => {
      active = false
      if (isBlob) URL.revokeObjectURL(sourceUrl)
    }
  }, [source])

  useEffect(() => {
    const file = settings.watermark.logoFile
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    let active = true
    const image = new Image()
    image.onload = () => active && setLogoState({ image, url, error: "" })
    image.onerror = () => active && setLogoState({ image: null, url, error: "The selected logo could not be opened." })
    image.src = url
    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [settings.watermark.logoFile])

  useEffect(() => {
    if (!footerFile) return undefined
    let active = true
    const url = URL.createObjectURL(footerFile)
    const image = new Image()
    image.onload = () => {
      if (!active) return
      if (!image.naturalWidth || !image.naturalHeight) {
        setFooterState({ file: footerFile, image: null, url, error: "The selected footer PNG has invalid image dimensions." })
        return
      }
      setFooterState({ file: footerFile, image, url, error: "" })
    }
    image.onerror = () => active && setFooterState({ file: footerFile, image: null, url, error: "The selected footer could not be opened as a PNG image." })
    image.src = url
    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [footerFile])

  useEffect(() => {
    if (!loadedImage || !canvasRef.current) return
    try {
      drawEditedImage(canvasRef.current, loadedImage, settings, logoState.image, 1400, null, loadedFooter)
    } catch (error) {
      const message = error.message || "Could not render the preview."
      const timeout = window.setTimeout(() => setExportError(message), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [loadedImage, logoState.image, loadedFooter, settings])

  useEffect(() => {
    const handleEscape = (event) => event.key === "Escape" && !busy && onClose()
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [busy, onClose])

  function updateWatermark(key, value) {
    setSettings((current) => ({ ...current, watermark: { ...current.watermark, [key]: value } }))
  }

  function updateAdjustment(key, value) {
    setSettings((current) => ({ ...current, adjustments: { ...current.adjustments, [key]: value } }))
  }

  async function handleFooterFile(file) {
    if (!file) return
    const fileNameIsPng = file.name.toLowerCase().endsWith(".png")
    let signature
    try {
      signature = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    } catch {
      setFooterState((current) => ({ ...current, error: "Could not read the selected footer file." }))
      return
    }
    const isPngSignature = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)
    if (!fileNameIsPng || (file.type && file.type !== "image/png") || !isPngSignature) {
      setFooterState((current) => ({ ...current, error: "Choose a valid PNG image for the footer." }))
      return
    }
    setFooterState({ file, image: null, url: "", error: "" })
    setFooterFile(file)
  }

  function removeFooter() {
    setFooterFile(null)
    setFooterState({ file: null, image: null, url: "", error: "" })
  }

  function resetEditor() {
    setSettings(createInitialSettings())
    setLogoState({ image: null, url: "", error: "" })
    setFooterFile(null)
    setFooterState({ file: null, image: null, url: "", error: "" })
    setExportError("")
  }

  async function exportImage() {
    if (!loadedImage || !canvasRef.current || busy || exporting) return
    setExportError("")
    const width = loadedImage.naturalWidth
    const height = loadedImage.naturalHeight
    if (width * height > MAX_EXPORT_PIXELS) {
      setExportError("This image is too large to export at full resolution in this browser. Choose a smaller image and try again.")
      return
    }
    setExporting(true)
    try {
      const exportCanvas = document.createElement("canvas")
      let blob
      try {
        drawEditedImage(exportCanvas, loadedImage, settings, logoState.image, 0, exportFormat === "image/jpeg" ? "#ffffff" : null, loadedFooter)
        blob = await canvasToBlob(exportCanvas, exportFormat)
      } finally {
        exportCanvas.width = 0
        exportCanvas.height = 0
      }
      const extension = exportFormat === "image/jpeg" ? "jpg" : "png"
      const baseName = String(imageName || "image").replace(/\.[^.]+$/, "") || "image"
      const file = new File([blob], `${baseName}-edited.${extension}`, { type: exportFormat, lastModified: Date.now() })
      await onApply(file)
    } catch (error) {
      setExportError(error.message || "Could not export this image. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="ie-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="ie-dialog" role="dialog" aria-modal="true" aria-labelledby="ie-title">
        <header className="ie-header">
          <div><h2 id="ie-title">Edit image</h2><p>Changes stay in this preview until you use the edited image.</p></div>
          <button type="button" className="ie-close" onClick={onClose} disabled={busy} aria-label="Close image editor">×</button>
        </header>

        <div className="ie-workspace">
          <div className="ie-preview-area">
            {loadError ? <p className="ie-error">{loadError}</p> : !loadedImage ? <p className="ie-muted">Loading image…</p> : null}
            <canvas ref={canvasRef} className="ie-preview-canvas" aria-label="Edited image preview" />
            {logoState.error && <p className="ie-error">{logoState.error}</p>}
          </div>

          <div className="ie-tools">
            <div className="ie-tabs" role="tablist" aria-label="Image editing tools">
              <button type="button" role="tab" aria-selected={tab === "watermark"} className={tab === "watermark" ? "active" : ""} onClick={() => setTab("watermark")}>Watermark</button>
              <button type="button" role="tab" aria-selected={tab === "footer"} className={tab === "footer" ? "active" : ""} onClick={() => setTab("footer")}>Footer</button>
              <button type="button" role="tab" aria-selected={tab === "filters"} className={tab === "filters" ? "active" : ""} onClick={() => setTab("filters")}>Filters</button>
            </div>

            {tab === "footer" ? (
              <div className="ie-controls">
                <label className="ie-footer-upload">{footerFile ? "Replace footer PNG" : "Upload Footer PNG"}<input type="file" accept="image/png,.png" onChange={(event) => { void handleFooterFile(event.target.files?.[0]); event.target.value = "" }} /></label>
                {footerState.error && <p className="ie-error" role="alert">{footerState.error}</p>}
                {loadedFooter && <div className="ie-footer-preview"><img src={footerState.url} alt="Footer preview" /><button type="button" className="ie-secondary" onClick={removeFooter}>Remove footer</button></div>}
                {footerFile && !loadedFooter && !footerState.error && <p className="ie-muted">Loading footer…</p>}
                <div className="ie-footer-positions" role="group" aria-label="Footer position">
                  {[["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]].map(([value, label]) => <button type="button" key={value} className={settings.footer.position === value ? "active" : ""} aria-pressed={settings.footer.position === value} disabled={!loadedFooter} onClick={() => setSettings((current) => ({ ...current, footer: { ...current.footer, position: value } }))}>{label}</button>)}
                </div>
                <p className="ie-muted">The footer keeps its aspect ratio and is centered over the image.</p>
              </div>
            ) : tab === "watermark" ? (
              <div className="ie-controls">
                <label className="ie-toggle"><input type="checkbox" checked={settings.watermark.enabled} onChange={(event) => updateWatermark("enabled", event.target.checked)} /> Enable watermark</label>
                <div className="ie-inline-options">
                  <label>Type<select value={settings.watermark.type} onChange={(event) => updateWatermark("type", event.target.value)}><option value="text">Text</option><option value="logo">Logo</option></select></label>
                  <label>Position<select value={settings.watermark.position} onChange={(event) => updateWatermark("position", event.target.value)}>{WATERMARK_POSITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </div>
                {settings.watermark.type === "text" ? <>
                  <label>Watermark text<input value={settings.watermark.text} maxLength={100} onChange={(event) => updateWatermark("text", event.target.value)} placeholder="Your brand or website" /></label>
                  <div className="ie-inline-options">
                    <label>Font<select value={settings.watermark.fontFamily} onChange={(event) => updateWatermark("fontFamily", event.target.value)}>{FONT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label>Text color<input type="color" value={settings.watermark.color} onChange={(event) => updateWatermark("color", event.target.value)} /></label>
                  </div>
                  <label>Text size ({settings.watermark.fontSize}% of image)<input type="range" min="1" max="16" value={settings.watermark.fontSize} onChange={(event) => updateWatermark("fontSize", event.target.value)} /></label>
                  <label>Rotation ({settings.watermark.rotation}°)<input type="range" min="-45" max="45" value={settings.watermark.rotation} onChange={(event) => updateWatermark("rotation", event.target.value)} /></label>
                </> : <>
                  <label>Logo image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setLogoState({ image: null, url: "", error: "" }); updateWatermark("logoFile", event.target.files?.[0] || null) }} /></label>
                  <label>Logo size ({settings.watermark.logoSize}% of image width)<input type="range" min="5" max="40" value={settings.watermark.logoSize} onChange={(event) => updateWatermark("logoSize", event.target.value)} /></label>
                </>}
                <label>Opacity ({settings.watermark.opacity}%)<input type="range" min="0" max="100" value={settings.watermark.opacity} onChange={(event) => updateWatermark("opacity", event.target.value)} /></label>
              </div>
            ) : (
              <div className="ie-controls">
                <div className="ie-filter-grid">
                  {IMAGE_FILTERS.map((filter) => (
                    <button type="button" key={filter.id} className={settings.filter === filter.id ? "ie-filter selected" : "ie-filter"} onClick={() => setSettings((current) => ({ ...current, filter: filter.id }))} aria-pressed={settings.filter === filter.id}>
                      <span className="ie-filter-sample" style={{ backgroundImage: `url("${imageState.sourceUrl || (typeof source === "string" ? source : "")}")`, filter: FILTER_THUMBNAIL_STYLES[filter.id] }} />{filter.label}
                    </button>
                  ))}
                </div>
                <label>Filter intensity ({settings.intensity}%)<input type="range" min="0" max="100" value={settings.intensity} disabled={settings.filter === "original"} onChange={(event) => setSettings((current) => ({ ...current, intensity: event.target.value }))} /></label>
                <label>Brightness ({settings.adjustments.brightness}%)<input type="range" min="0" max="200" value={settings.adjustments.brightness} onChange={(event) => updateAdjustment("brightness", event.target.value)} /></label>
                <label>Contrast ({settings.adjustments.contrast}%)<input type="range" min="0" max="200" value={settings.adjustments.contrast} onChange={(event) => updateAdjustment("contrast", event.target.value)} /></label>
                <label>Saturation ({settings.adjustments.saturation}%)<input type="range" min="0" max="200" value={settings.adjustments.saturation} onChange={(event) => updateAdjustment("saturation", event.target.value)} /></label>
                <label>Blur ({settings.adjustments.blur}px)<input type="range" min="0" max="10" step="0.5" value={settings.adjustments.blur} onChange={(event) => updateAdjustment("blur", event.target.value)} /></label>
              </div>
            )}
          </div>
        </div>

        <footer className="ie-footer">
          {exportError && <p className="ie-error" role="alert">{exportError}</p>}
          <div className="ie-footer-actions">
            <button type="button" className="ie-secondary" onClick={resetEditor} disabled={busy}>Reset edits</button>
            <label className="ie-format">Export as<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label>
            <button type="button" className="ie-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="ie-primary" onClick={exportImage} disabled={busy || exporting || !loadedImage}>{busy || exporting ? "Uploading edited image…" : "Use edited image"}</button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export default ImageEditor
