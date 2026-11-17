import Post from "../models/postModel.js"
import { createSandboxPayload, fakeSocialAdapter } from "./fakeSocialAdapter.js"

const syncsInFlight = new Map()

const isIntegrationEnabled = () =>
  String(process.env.FAKE_SOCIAL_ENABLED || "").toLowerCase() === "true"

export function prepareSandboxSync(post) {
  const enabled = isIntegrationEnabled()
  const platforms = [...new Set(
    (post.platformResults || [])
      .filter((result) => result.status === "success")
      .map((result) => result.platform)
  )]

  post.sandboxSyncResults = platforms.map((platform) => ({
    platform,
    status: enabled ? "pending" : "disabled",
    attempts: 0,
    syncedAt: null,
    error: "",
  }))
  post.sandboxSyncStatus = enabled ? "pending" : "disabled"
  post.sandboxSyncedAt = null
  post.sandboxSyncError = ""
}

function updateAggregateStatus(post) {
  const results = post.sandboxSyncResults || []
  const failed = results.filter((result) => result.status === "failed")
  const hasPending = results.some((result) => result.status === "pending")

  if (results.length > 0 && results.every((result) => result.status === "synced")) {
    post.sandboxSyncStatus = "synced"
    post.sandboxSyncedAt = results.reduce(
      (latest, result) => result.syncedAt > latest ? result.syncedAt : latest,
      results[0].syncedAt
    )
    post.sandboxSyncError = ""
  } else if (hasPending) {
    post.sandboxSyncStatus = "pending"
    post.sandboxSyncedAt = null
    post.sandboxSyncError = failed
      .map((result) => `${result.platform}: ${result.error}`)
      .join("; ").slice(0, 1000)
  } else if (failed.length > 0) {
    post.sandboxSyncStatus = "failed"
    post.sandboxSyncedAt = null
    post.sandboxSyncError = failed
      .map((result) => `${result.platform}: ${result.error}`)
      .join("; ").slice(0, 1000)
  } else {
    post.sandboxSyncStatus = "disabled"
    post.sandboxSyncedAt = null
    post.sandboxSyncError = ""
  }
}

async function performSync(postId, retryFailed) {
  const post = await Post.findById(postId)
  if (!post) return { status: "not_found", post: null }
  if (post.status !== "published") return { status: "not_published", post }
  if (!isIntegrationEnabled()) return { status: "disabled", post }

  const publishedPlatforms = [...new Set(
    (post.platformResults || [])
      .filter((result) => result.status === "success")
      .map((result) => result.platform)
  )]
  if (publishedPlatforms.length === 0) {
    post.sandboxSyncStatus = "failed"
    post.sandboxSyncError = "No successfully published platforms are available to sync."
    await post.save()
    return { status: "failed", post }
  }

  const previousResults = new Map(
    (post.sandboxSyncResults || []).map((result) => [result.platform, result])
  )
  post.sandboxSyncResults = publishedPlatforms.map((platform) => (
    previousResults.get(platform) || {
      platform,
      status: "pending",
      attempts: 0,
      syncedAt: null,
      error: "",
    }
  ))

  const toSync = post.sandboxSyncResults.filter((result) => (
    result.status === "pending"
    || (retryFailed && ["failed", "disabled"].includes(result.status))
  ))
  updateAggregateStatus(post)
  await post.save()

  for (const result of toSync) {
    const { payload, error: payloadError } = createSandboxPayload(post, result.platform)
    result.attempts += 1
    result.status = "pending"
    result.error = ""
    await post.save()

    let response
    if (payloadError) {
      response = { status: "failed", error: payloadError }
    } else {
      try {
        response = await fakeSocialAdapter(payload)
      } catch {
        response = { status: "failed", error: "Unexpected error while sending the Sandbox request." }
      }
    }

    result.status = response.status === "synced"
      ? "synced"
      : response.status === "disabled"
        ? "disabled"
        : "failed"
    result.syncedAt = result.status === "synced" ? new Date() : null
    result.error = response.error || ""
    updateAggregateStatus(post)
    await post.save()

    if (result.status === "failed") {
      console.error(
        `[sandbox-sync] failed for Socialynk post ${post._id} on ${result.platform}: ${result.error}`
      )
    }
  }

  return { status: post.sandboxSyncStatus, post }
}

export function syncPostToSandbox(postId, { retryFailed = false } = {}) {
  const key = String(postId)
  const activeSync = syncsInFlight.get(key)
  if (activeSync) return activeSync

  const sync = performSync(key, retryFailed).finally(() => {
    syncsInFlight.delete(key)
  })
  syncsInFlight.set(key, sync)
  return sync
}
