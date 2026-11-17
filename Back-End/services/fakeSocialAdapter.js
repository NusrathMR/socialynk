const PLATFORM_MAP = Object.freeze({
  instagram: "instagram",
  facebook: "facebook",
  linkedin: "linkedin",
  x: "twitter",
  tiktok: "tiktok",
  youtube: "youtube",
})

const SANDBOX_PLATFORMS = new Set(Object.values(PLATFORM_MAP))

function sanitizeResponseDetails(responseText, apiKey) {
  const sanitize = (value) => {
    let text = String(value).replace(/[\r\n\t]/g, " ").slice(0, 300)
    if (apiKey) text = text.split(apiKey).join("[REDACTED]")
    return text
      .replace(
        /(x-api-key|api[_ -]?key|authorization)\s*[:=]\s*["']?[^,\s"' }]+/gi,
        "$1=[REDACTED]"
      )
      .replace(/\bbearer\s+[^,\s"' }]+/gi, "Bearer [REDACTED]")
  }

  try {
    const body = JSON.parse(responseText)
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const details = {}
      for (const field of ["message", "error", "code"]) {
        if (typeof body[field] === "string" || typeof body[field] === "number") {
          details[field] = sanitize(body[field])
        }
      }
      return Object.keys(details).length ? details : { message: "No safe error details available." }
    }
  } catch {
    // Keep unstructured response bodies out of logs.
  }

  return { message: "Non-JSON error response." }
}

export function mapSandboxPlatform(platform) {
  return Object.hasOwn(PLATFORM_MAP, platform) ? PLATFORM_MAP[platform] : null
}

export function createSandboxPayload(post, platform) {
  const mappedPlatform = mapSandboxPlatform(platform)
  const sourcePostId = post?._id == null ? "" : String(post._id).trim()
  const caption = typeof post?.caption === "string" ? post.caption.trim() : ""
  const captionHashtags = new Set(
    (caption.match(/#[\p{L}\p{N}_]+/gu) || []).map((tag) => tag.toLowerCase())
  )
  const hashtags = Array.isArray(post?.hashtags)
    ? post.hashtags
      .filter((tag) => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.startsWith("#") ? tag : `#${tag}`)
      .filter((tag) => !captionHashtags.has(tag.toLowerCase()))
    : []
  const text = [caption, ...hashtags].filter(Boolean).join(" ").trim()

  if (!mappedPlatform) return { error: "Unsupported Socialynk platform." }
  if (!sourcePostId) return { error: "Published post ID is missing." }
  if (!text) return { error: "Published post content is empty." }

  return {
    payload: {
      platform: mappedPlatform,
      text,
      authorName: "Socialynk User",
      sourcePostId,
    },
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Post payload is missing."
  if (!SANDBOX_PLATFORMS.has(payload.platform)) return "Unsupported Sandbox platform."
  if (typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 10000) {
    return "Post text must be a non-empty string of at most 10000 characters."
  }
  if (typeof payload.authorName !== "string" || !payload.authorName.trim() || payload.authorName.length > 200) {
    return "Author name must be a non-empty string of at most 200 characters."
  }
  if (typeof payload.sourcePostId !== "string" || !payload.sourcePostId.trim() || payload.sourcePostId.length > 256) {
    return "Source post ID must be a non-empty string of at most 256 characters."
  }
  return ""
}

export async function fakeSocialAdapter(payload, options = {}) {
  const enabled = options.enabled
    ?? String(process.env.FAKE_SOCIAL_ENABLED || "").toLowerCase() === "true"
  if (!enabled) return { status: "disabled", error: "" }

  const payloadError = validatePayload(payload)
  if (payloadError) return { status: "failed", error: payloadError, code: "validation" }

  const baseUrl = options.baseUrl ?? process.env.FAKE_SOCIAL_URL
  const apiKey = options.apiKey ?? process.env.FAKE_SOCIAL_API_KEY
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 5000

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return { status: "failed", error: "Sandbox API URL is not configured.", code: "configuration" }
  }
  if (typeof fetchImpl !== "function") {
    return { status: "failed", error: "HTTP client is unavailable.", code: "configuration" }
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { status: "failed", error: "Sandbox request timeout is invalid.", code: "configuration" }
  }

  let endpoint
  try {
    const url = new URL(baseUrl)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return { status: "failed", error: "Sandbox API URL is invalid.", code: "configuration" }
    }
    endpoint = new URL("/api/posts", url).href
  } catch {
    return { status: "failed", error: "Sandbox API URL is invalid.", code: "configuration" }
  }

  const apiKeyConfigured = typeof apiKey === "string" && apiKey.trim().length > 0
  console.info("[sandbox-sync] request", JSON.stringify({
    url: endpoint,
    apiKeyConfigured,
    apiKeyHeaderAttached: apiKeyConfigured,
  }))
  if (!apiKeyConfigured) {
    return { status: "failed", error: "Sandbox API key is not configured.", code: "configuration" }
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })

    console.info("[sandbox-sync] response", JSON.stringify({
      url: endpoint,
      status: response.status,
    }))

    if (response.ok) {
      return {
        status: "synced",
        error: "",
        duplicate: response.status === 200,
      }
    }

    let responseText = ""
    try {
      responseText = await response.text()
    } catch {
      // The response status remains useful even if its body cannot be read.
    }
    console.warn("[sandbox-sync] rejected response", JSON.stringify({
      url: endpoint,
      status: response.status,
      response: sanitizeResponseDetails(responseText, apiKey),
    }))

    return {
      status: "failed",
      error: `Sandbox API returned HTTP ${response.status}.`,
      code: "http",
    }
  } catch (error) {
    console.info("[sandbox-sync] response", JSON.stringify({
      url: endpoint,
      status: null,
    }))
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return {
        status: "failed",
        error: `Sandbox request timed out after ${timeoutMs} ms.`,
        code: "timeout",
      }
    }
    return {
      status: "failed",
      error: "Could not connect to the Sandbox API.",
      code: "network",
    }
  }
}
