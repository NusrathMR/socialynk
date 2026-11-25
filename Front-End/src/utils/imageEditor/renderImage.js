export const IMAGE_FILTERS = [
  { id: "original", label: "Original" },
  { id: "grayscale", label: "Grayscale" },
  { id: "sepia", label: "Sepia" },
  { id: "vintage", label: "Vintage" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "bright", label: "Bright" },
  { id: "contrast", label: "High Contrast" },
  { id: "bw", label: "Black & White" },
]

export const WATERMARK_POSITIONS = [
  ["top-left", "Top left"], ["top-center", "Top center"], ["top-right", "Top right"],
  ["center-left", "Middle left"], ["center", "Center"], ["center-right", "Middle right"],
  ["bottom-left", "Bottom left"], ["bottom-center", "Bottom center"], ["bottom-right", "Bottom right"],
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function applyPreset(data, preset, intensity) {
  const amount = clamp(intensity, 0, 100) / 100
  if (preset === "original" || amount === 0) return
  const pixels = data.data
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    let nextRed = red
    let nextGreen = green
    let nextBlue = blue
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue

    if (preset === "grayscale") nextRed = nextGreen = nextBlue = luminance
    if (preset === "sepia" || preset === "vintage") {
      nextRed = 0.393 * red + 0.769 * green + 0.189 * blue
      nextGreen = 0.349 * red + 0.686 * green + 0.168 * blue
      nextBlue = 0.272 * red + 0.534 * green + 0.131 * blue
      if (preset === "vintage") {
        nextRed = nextRed * 0.88 + 20
        nextGreen = nextGreen * 0.88 + 14
        nextBlue = nextBlue * 0.88 + 8
      }
    }
    if (preset === "warm") { nextRed = red + 36; nextBlue = blue - 24 }
    if (preset === "cool") { nextRed = red - 22; nextBlue = blue + 34 }
    if (preset === "bright") { nextRed = red + 48; nextGreen = green + 48; nextBlue = blue + 48 }
    if (preset === "contrast") {
      nextRed = (red - 128) * 1.65 + 128
      nextGreen = (green - 128) * 1.65 + 128
      nextBlue = (blue - 128) * 1.65 + 128
    }
    if (preset === "bw") {
      nextRed = nextGreen = nextBlue = luminance >= 128 ? 255 : 0
    }

    pixels[index] = clamp(red + (nextRed - red) * amount, 0, 255)
    pixels[index + 1] = clamp(green + (nextGreen - green) * amount, 0, 255)
    pixels[index + 2] = clamp(blue + (nextBlue - blue) * amount, 0, 255)
  }
}

function watermarkAnchor(position, width, height, padding) {
  const horizontal = position.split("-").at(-1)
  const vertical = position.startsWith("top") ? "top" : position.startsWith("bottom") ? "bottom" : "middle"
  return {
    x: horizontal === "left" ? padding : horizontal === "right" ? width - padding : width / 2,
    y: vertical === "top" ? padding : vertical === "bottom" ? height - padding : height / 2,
    align: horizontal === "left" ? "left" : horizontal === "right" ? "right" : "center",
    baseline: vertical === "top" ? "top" : vertical === "bottom" ? "bottom" : "middle",
  }
}

function drawWatermark(ctx, width, height, settings, logoImage) {
  const watermark = settings.watermark
  if (!watermark.enabled) return
  const padding = Math.max(12, Math.min(width, height) * 0.04)
  const anchor = watermarkAnchor(watermark.position, width, height, padding)
  const rotation = (Number(watermark.rotation) || 0) * Math.PI / 180
  ctx.save()
  ctx.translate(anchor.x, anchor.y)
  ctx.rotate(rotation)
  ctx.globalAlpha = clamp(Number(watermark.opacity), 0, 100) / 100

  if (watermark.type === "logo" && logoImage) {
    const maxWidth = width * clamp(Number(watermark.logoSize) || 18, 5, 40) / 100
    const maxHeight = height * 0.35
    const scale = Math.min(1, maxWidth / logoImage.naturalWidth, maxHeight / logoImage.naturalHeight)
    const logoWidth = logoImage.naturalWidth * scale
    const logoHeight = logoImage.naturalHeight * scale
    const x = anchor.align === "left" ? 0 : anchor.align === "right" ? -logoWidth : -logoWidth / 2
    const y = anchor.baseline === "top" ? 0 : anchor.baseline === "bottom" ? -logoHeight : -logoHeight / 2
    ctx.drawImage(logoImage, x, y, logoWidth, logoHeight)
  } else if (watermark.text.trim()) {
    const fontSize = Math.max(12, Math.min(width, height) * clamp(Number(watermark.fontSize) || 5, 1, 16) / 100)
    ctx.font = `600 ${fontSize}px ${watermark.fontFamily || "Arial, sans-serif"}`
    ctx.textAlign = anchor.align
    ctx.textBaseline = anchor.baseline
    ctx.lineJoin = "round"
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)"
    ctx.lineWidth = Math.max(2, fontSize * 0.1)
    ctx.shadowColor = "rgba(0, 0, 0, 0.28)"
    ctx.shadowBlur = fontSize * 0.12
    ctx.strokeText(watermark.text, 0, 0)
    ctx.fillStyle = watermark.color
    ctx.fillText(watermark.text, 0, 0)
  }
  ctx.restore()
}

function drawFooter(ctx, width, height, footerImage, position) {
  if (!footerImage?.naturalWidth || !footerImage?.naturalHeight) return
  const margin = Math.min(Math.max(12, Math.min(width, height) * 0.04), Math.min(width, height) * 0.08)
  const maxWidth = Math.max(1, width - margin * 2)
  const maxHeight = Math.max(1, height * 0.22)
  const scale = Math.min(maxWidth / footerImage.naturalWidth, maxHeight / footerImage.naturalHeight)
  const footerWidth = footerImage.naturalWidth * scale
  const footerHeight = footerImage.naturalHeight * scale
  const x = (width - footerWidth) / 2
  const y = position === "top"
    ? margin
    : position === "middle"
      ? (height - footerHeight) / 2
      : height - margin - footerHeight

  ctx.save()
  ctx.globalAlpha = 1
  ctx.filter = "none"
  ctx.drawImage(footerImage, x, y, footerWidth, footerHeight)
  ctx.restore()
}

export function drawEditedImage(canvas, sourceImage, settings, logoImage = null, maxDimension = 0, background = null, footerImage = null) {
  const naturalWidth = sourceImage.naturalWidth || sourceImage.width
  const naturalHeight = sourceImage.naturalHeight || sourceImage.height
  const scale = maxDimension ? Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight)) : 1
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("This browser could not open an image editing canvas.")
  ctx.clearRect(0, 0, width, height)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.save()
  const brightness = Number(settings.adjustments.brightness)
  const contrast = Number(settings.adjustments.contrast)
  const saturation = Number(settings.adjustments.saturation)
  const blur = Number(settings.adjustments.blur) * scale
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`
  ctx.drawImage(sourceImage, 0, 0, width, height)
  ctx.restore()

  if (settings.filter !== "original" && Number(settings.intensity) > 0) {
    const pixels = ctx.getImageData(0, 0, width, height)
    applyPreset(pixels, settings.filter, settings.intensity)
    ctx.putImageData(pixels, 0, 0)
  }
  drawWatermark(ctx, width, height, settings, logoImage)
  drawFooter(ctx, width, height, footerImage, settings.footer?.position || "bottom")
  return { width, height }
}

export function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("The edited image could not be exported. Try another format."))
    }, type, type === "image/jpeg" ? 0.92 : undefined)
  })
}
