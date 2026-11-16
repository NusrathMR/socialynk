import DOMPurify from "dompurify"

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "br", "strong", "b", "em", "i", "u", "s", "strike",
  "ul", "ol", "li", "a", "span", "mark",
]
const ALLOWED_TAG_SET = new Set(ALLOWED_TAGS.map((tag) => tag.toUpperCase()))
const DROPPED_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"])
const HIGHLIGHT_COLORS = ["#fff2a8", "#d8f3dc", "#cfe8ff", "#fce1e4"]
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function isSafeHttpUrl(value) {
  if (typeof value !== "string") return false

  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol)
      && Boolean(url.hostname)
      && !url.username
      && !url.password
  } catch {
    return false
  }
}

function normalizeTextColor(value) {
  if (!value) return ""
  const normalized = value.trim().toLowerCase()
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : ""
}

function normalizeHighlightColor(value) {
  if (!value) return ""
  const normalized = value.trim().toLowerCase().replace(/\s/g, "")
  const highlight = HIGHLIGHT_COLORS.find((color) => {
    const paletteColor = document.createElement("span")
    paletteColor.style.color = color
    const pastedColor = document.createElement("span")
    pastedColor.style.color = normalized
    return normalized === color || paletteColor.style.color === pastedColor.style.color
  })
  return highlight || ""
}

function getAllowedStyle(element) {
  const rules = []
  const align = element.style.textAlign

  if (
    ["P", "H1", "H2", "H3"].includes(element.tagName)
    && ["left", "center", "right", "justify"].includes(align)
  ) {
    rules.push(`text-align: ${align}`)
  }
  if (element.tagName === "SPAN") {
    const fontSize = element.style.fontSize
    const color = normalizeTextColor(element.style.color)
    if (/^(?:1[0-9]|2[0-9]|3[0-2])px$/.test(fontSize)) {
      rules.push(`font-size: ${fontSize}`)
    }
    if (color) rules.push(`color: ${color}`)
  }
  return rules
}

function cleanHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html || ""), "text/html")

  function clean(parent) {
    Array.from(parent.children).forEach((element) => {
      if (DROPPED_TAGS.has(element.tagName)) {
        element.remove()
        return
      }

      clean(element)
      if (!ALLOWED_TAG_SET.has(element.tagName)) {
        element.replaceWith(...element.childNodes)
        return
      }

      const style = ["SPAN", "P", "H1", "H2", "H3"].includes(element.tagName)
        ? getAllowedStyle(element)
        : []
      const href = element.tagName === "A" && isSafeHttpUrl(element.getAttribute("href"))
        ? new URL(element.getAttribute("href")).href
        : ""
      const highlightColor = element.tagName === "MARK"
        ? normalizeHighlightColor(element.getAttribute("data-color") || element.style.backgroundColor)
        : ""

      Array.from(element.attributes).forEach((attribute) => {
        element.removeAttribute(attribute.name)
      })
      if (style.length) element.setAttribute("style", style.join("; "))
      if (href) {
        element.setAttribute("href", href)
        element.setAttribute("rel", "noopener noreferrer nofollow")
        element.setAttribute("target", "_blank")
      } else if (element.tagName === "A") {
        element.replaceWith(...element.childNodes)
      }
      if (highlightColor) {
        element.setAttribute("data-color", highlightColor)
        element.setAttribute("style", `background-color: ${highlightColor}`)
      }
    })
  }

  clean(parsed.body)
  return parsed.body.innerHTML
}

export function sanitizeRichTextHtml(html) {
  return DOMPurify.sanitize(cleanHtml(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "rel", "target", "style", "data-color"],
  })
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function plainTextToHtml(value) {
  const text = String(value || "")
  if (!text) return ""
  return text
    .split(/\r\n?|\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")
}

export function htmlToPlainText(html) {
  const parsed = new DOMParser().parseFromString(sanitizeRichTextHtml(html), "text/html")
  const output = []
  const blockTags = new Set(["P", "H1", "H2", "H3", "LI"])

  function addLineBreak() {
    if (output.length && output[output.length - 1] !== "\n") output.push("\n")
  }

  function read(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      output.push(node.nodeValue)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return

    const isBlock = blockTags.has(node.tagName)
    if (isBlock) addLineBreak()
    if (node.tagName === "BR") output.push("\n")
    else Array.from(node.childNodes).forEach(read)
    if (isBlock) addLineBreak()
  }

  Array.from(parsed.body.childNodes).forEach(read)
  return output.join("").replace(/\n+$/, "")
}
