import assert from "node:assert/strict"
import { createServer } from "node:http"
import test from "node:test"
import Post from "../models/postModel.js"
import { publishAndSave } from "../services/publisherServices.js"
import { syncPostToSandbox } from "../services/fakeSocialService.js"

const ENV_KEYS = ["FAKE_SOCIAL_ENABLED", "FAKE_SOCIAL_URL", "FAKE_SOCIAL_API_KEY"]

function setIntegrationEnv(t, url, enabled = "true") {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  process.env.FAKE_SOCIAL_ENABLED = enabled
  process.env.FAKE_SOCIAL_URL = url
  process.env.FAKE_SOCIAL_API_KEY = "test-only-key"
  t.after(() => {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  })
}

function mockPosts(t, posts) {
  const findById = Post.findById
  const postsById = new Map(posts.map((post) => [String(post._id), post]))
  Post.findById = async (id) => postsById.get(String(id)) || null
  t.after(() => {
    Post.findById = findById
  })
}

function mockPost(t, post) {
  mockPosts(t, [post])
}

async function createSandboxStub(t, initialStatus = 201, responseDelay = 0) {
  const requests = []
  let responseStatus = initialStatus
  let resolveResponse
  const responseFinished = new Promise((resolve) => {
    resolveResponse = resolve
  })
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    requests.push({
      method: request.method,
      url: request.url,
      apiKey: request.headers["x-api-key"],
      body: JSON.parse(Buffer.concat(chunks).toString()),
    })
    setTimeout(() => {
      response.writeHead(responseStatus, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ success: true, published: responseStatus !== 200 }))
      resolveResponse()
    }, responseDelay)
  })

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    responseFinished,
    setStatus(status) {
      responseStatus = status
    },
  }
}

function makePost(overrides = {}) {
  return {
    _id: "socialynk-post-123",
    status: "published",
    caption: "A published caption",
    hashtags: ["demo"],
    platforms: ["instagram"],
    platformResults: [{ platform: "instagram", status: "success" }],
    sandboxSyncResults: [{
      platform: "instagram",
      status: "pending",
      attempts: 0,
      syncedAt: null,
      error: "",
    }],
    async save() {
      return this
    },
    ...overrides,
  }
}

test("syncs only published posts and treats repeated syncs idempotently", async (t) => {
  const sandbox = await createSandboxStub(t)
  setIntegrationEnv(t, sandbox.url)
  const post = makePost()
  mockPost(t, post)

  const result = await syncPostToSandbox(post._id)
  assert.equal(result.status, "synced")
  assert.equal(post.status, "published")
  assert.equal(post.sandboxSyncResults[0].attempts, 1)
  assert.equal(sandbox.requests.length, 1)
  assert.equal(sandbox.requests[0].url, "/api/posts")
  assert.equal(sandbox.requests[0].apiKey, "test-only-key")
  assert.deepEqual(sandbox.requests[0].body, {
    platform: "instagram",
    text: "A published caption #demo",
    authorName: "Socialynk User",
    sourcePostId: post._id,
  })

  await syncPostToSandbox(post._id, { retryFailed: true })
  assert.equal(sandbox.requests.length, 1)
})

test("syncs successfully published Instagram, Facebook, and LinkedIn posts", async (t) => {
  const sandbox = await createSandboxStub(t)
  setIntegrationEnv(t, sandbox.url)
  const post = makePost({
    platformResults: ["instagram", "facebook", "linkedin"].map((platform) => ({
      platform,
      status: "success",
    })),
    sandboxSyncResults: [],
  })
  mockPost(t, post)

  const result = await syncPostToSandbox(post._id)

  assert.equal(result.status, "synced")
  assert.equal(post.status, "published")
  assert.deepEqual(
    sandbox.requests.map((request) => request.body.platform),
    ["instagram", "facebook", "linkedin"]
  )
  assert.ok(sandbox.requests.every((request) => request.apiKey === "test-only-key"))
})

test("retains published status after Sandbox failure and allows a sync-only retry", async (t) => {
  const sandbox = await createSandboxStub(t, 503)
  setIntegrationEnv(t, sandbox.url)
  const post = makePost()
  mockPost(t, post)

  const failed = await syncPostToSandbox(post._id)
  assert.equal(failed.status, "failed")
  assert.equal(post.status, "published")
  assert.equal(post.sandboxSyncResults[0].attempts, 1)

  sandbox.setStatus(201)
  const retried = await syncPostToSandbox(post._id, { retryFailed: true })
  assert.equal(retried.status, "synced")
  assert.equal(post.status, "published")
  assert.equal(post.sandboxSyncResults[0].attempts, 2)
  assert.equal(sandbox.requests.length, 2)
  assert.equal(sandbox.requests[1].body.sourcePostId, post._id)
})

test("does not call the Sandbox for drafts or when integration is disabled", async (t) => {
  const sandbox = await createSandboxStub(t)
  const draft = makePost({ status: "draft" })
  const published = makePost({
    _id: "disabled-post",
    status: "publishing",
    sandboxSyncResults: [],
    platformResults: [],
  })
  mockPosts(t, [draft, published])
  setIntegrationEnv(t, sandbox.url)

  assert.equal((await syncPostToSandbox(draft._id)).status, "not_published")
  assert.equal(sandbox.requests.length, 0)

  process.env.FAKE_SOCIAL_ENABLED = "false"
  await publishAndSave(published)
  assert.equal(published.status, "published")
  assert.equal(published.sandboxSyncStatus, "disabled")
  assert.equal(sandbox.requests.length, 0)
})

test("publishes asynchronously to the Sandbox only after the original publish succeeds", async (t) => {
  const sandbox = await createSandboxStub(t, 201, 300)
  setIntegrationEnv(t, sandbox.url)
  const post = makePost({
    status: "publishing",
    sandboxSyncResults: [],
    platformResults: [],
    async save() {
      return this
    },
  })
  mockPost(t, post)

  const start = Date.now()
  await publishAndSave(post)
  const elapsed = Date.now() - start

  assert.equal(post.status, "published")
  assert.equal(post.sandboxSyncStatus, "pending")
  assert.ok(elapsed < 750, `publish response waited ${elapsed} ms for Sandbox sync`)
  await sandbox.responseFinished
  for (let attempt = 0; attempt < 50 && post.sandboxSyncStatus !== "synced"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(post.sandboxSyncStatus, "synced")
  assert.equal(sandbox.requests.length, 1)
})

test("does not send an originally failed publish to the Sandbox", async (t) => {
  const sandbox = await createSandboxStub(t)
  setIntegrationEnv(t, sandbox.url)
  const post = makePost({
    status: "publishing",
    caption: "[fail]",
    sandboxSyncResults: [],
    platformResults: [],
    async save() {
      return this
    },
  })

  await publishAndSave(post)
  assert.equal(post.status, "failed")
  assert.equal(sandbox.requests.length, 0)
})
