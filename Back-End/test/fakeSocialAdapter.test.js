import assert from "node:assert/strict"
import test from "node:test"
import { createSandboxPayload, fakeSocialAdapter, mapSandboxPlatform } from "../services/fakeSocialAdapter.js"

const payload = {
  platform: "instagram",
  text: "A published caption",
  authorName: "Socialynk User",
  sourcePostId: "socialynk-post-123",
  media: [],
}

const options = {
  enabled: true,
  baseUrl: "http://localhost:5000/",
  apiKey: "test-only-key",
}

test("maps all Socialynk platforms to Sandbox platform names", () => {
  assert.deepEqual(
    ["instagram", "facebook", "linkedin", "x", "tiktok", "youtube"].map(mapSandboxPlatform),
    ["instagram", "facebook", "linkedin", "twitter", "tiktok", "youtube"]
  )
  assert.equal(mapSandboxPlatform("unknown"), null)
})

test("forwards original Cloudinary URLs and permits image-only posts", () => {
  const cloudinaryUrl = "https://res.cloudinary.com/example/image/upload/v123/socialynk/photo.jpg"
  const result = createSandboxPayload({
    _id: "post-with-image",
    caption: "",
    media: [{ url: cloudinaryUrl, width: 1600, height: 900, publicId: "kept-private" }],
  }, "instagram")

  assert.equal(result.error, undefined)
  assert.deepEqual(result.payload.media, [{
    url: cloudinaryUrl,
    type: "image",
    width: 1600,
    height: 900,
  }])
  assert.equal(result.payload.text, "")
})

test("drops invalid saved media URLs and requires text or valid media", () => {
  const result = createSandboxPayload({ _id: "textless", caption: "", media: [{ url: "javascript:alert(1)" }] }, "instagram")
  assert.equal(result.error, "Published post content is empty.")
})

test("sends the expected payload and treats a duplicate response as synced", async () => {
  let request
  const result = await fakeSocialAdapter(payload, {
    ...options,
    fetchImpl: async (url, init) => {
      request = { url, init }
      return new Response('{"success":true,"published":false}', { status: 200 })
    },
  })

  assert.equal(result.status, "synced")
  assert.equal(result.duplicate, true)
  assert.equal(request.url, "http://localhost:5000/api/posts")
  assert.equal(request.init.method, "POST")
  assert.equal(request.init.headers["Content-Type"], "application/json")
  assert.equal(request.init.headers["x-api-key"], options.apiKey)
  assert.deepEqual(JSON.parse(request.init.body), payload)
})

test("reports server errors without treating the request as successful", async () => {
  const result = await fakeSocialAdapter(payload, {
    ...options,
    fetchImpl: async () => new Response("unavailable", { status: 503 }),
  })

  assert.deepEqual(result, {
    status: "failed",
    error: "Sandbox API returned HTTP 503.",
    code: "http",
  })
})

test("logs request diagnostics and redacts credentials from Sandbox error responses", async () => {
  const originalInfo = console.info
  const originalWarn = console.warn
  const logs = []
  console.info = (...args) => logs.push(args.join(" "))
  console.warn = (...args) => logs.push(args.join(" "))

  try {
    const result = await fakeSocialAdapter(payload, {
      ...options,
      fetchImpl: async () => new Response(
        JSON.stringify({ message: "Rejected x-api-key: test-only-key" }),
        { status: 401 }
      ),
    })

    assert.equal(result.status, "failed")
    assert.equal(result.error, "Sandbox API returned HTTP 401.")
    const output = logs.join("\n")
    assert.match(output, /http:\/\/localhost:5000\/api\/posts/)
    assert.match(output, /"apiKeyConfigured":true/)
    assert.match(output, /"apiKeyHeaderAttached":true/)
    assert.match(output, /"status":401/)
    assert.match(output, /\[REDACTED\]/)
    assert.doesNotMatch(output, /test-only-key/)
  } finally {
    console.info = originalInfo
    console.warn = originalWarn
  }
})

test("distinguishes timeout and connection errors", async () => {
  const timedOut = await fakeSocialAdapter(payload, {
    ...options,
    fetchImpl: async () => {
      const error = new Error("timeout")
      error.name = "TimeoutError"
      throw error
    },
  })
  const disconnected = await fakeSocialAdapter(payload, {
    ...options,
    fetchImpl: async () => {
      throw new Error("socket error")
    },
  })

  assert.equal(timedOut.code, "timeout")
  assert.equal(disconnected.code, "network")
})

test("does not call the Sandbox when disabled or given invalid data", async () => {
  let requestCount = 0
  const fetchImpl = async () => {
    requestCount += 1
    return new Response(null, { status: 201 })
  }

  const disabled = await fakeSocialAdapter(payload, { ...options, enabled: false, fetchImpl })
  const invalid = await fakeSocialAdapter({ ...payload, text: "" }, { ...options, fetchImpl })

  assert.equal(disabled.status, "disabled")
  assert.equal(invalid.status, "failed")
  assert.equal(invalid.code, "validation")
  assert.equal(requestCount, 0)
})
