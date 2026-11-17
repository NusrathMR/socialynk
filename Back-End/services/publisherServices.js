import Post from "../models/postModel.js"
import { prepareSandboxSync, syncPostToSandbox } from "./fakeSocialService.js"

// How long the fake publishing "takes"
const SIMULATED_DELAY_MS = 500

// A helper that waits for a number of milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------- The simulated adapter ----------
// A real adapter (for Facebook, Instagram...) will replace this later.
const simulatedAdapter = async (post, platform) => {
  await sleep(SIMULATED_DELAY_MS)

  const caption = (post.caption || "").toLowerCase()

  // TEST TRIGGERS: write [fail] or [fail:instagram] in a caption to force a failure
  if (caption.includes("[fail]") || caption.includes(`[fail:${platform}]`)) {
    throw new Error(`Simulated failure on ${platform}`)
  }

  console.log(`[publisher] (simulated) published post ${post._id} to ${platform}`)

  // A real adapter would return the id the platform gave to the new post
  return { externalId: `sim_${platform}_${Date.now()}` }
}

// ---------- One adapter per platform ----------
// To connect a real platform later, change only that platform's line.
const adapters = {
  instagram: simulatedAdapter,
  facebook: simulatedAdapter,
  linkedin: simulatedAdapter,
  tiktok: simulatedAdapter,
  x: simulatedAdapter,
  youtube: simulatedAdapter,
  fakeSocialAdapter: (post) => syncPostToSandbox(post._id),
}

// ---------- Publish to ONE platform (never throws) ----------
export const publishToPlatform = async (post, platform) => {
  const adapter = adapters[platform]

  if (!adapter) {
    return { platform, status: "failed", error: "Unsupported platform" }
  }

  try {
    await adapter(post, platform)
    return { platform, status: "success", error: "" }
  } catch (error) {
    return { platform, status: "failed", error: error.message }
  }
}

// ---------- Publish to MANY platforms ----------
// "platforms" is optional: by default it uses all channels on the post.
// Passing a smaller list lets us retry only the channels that failed.
export const publishPost = async (post, platforms = post.platforms) => {
  if (!platforms || platforms.length === 0) {
    return { results: [], outcome: "failed" }
  }

  // Start all channels at the same time and wait for all of them
  const results = await Promise.all(
    platforms.map((platform) => publishToPlatform(post, platform))
  )

  const successCount = results.filter((r) => r.status === "success").length

  let outcome = "partial"
  if (successCount === results.length) outcome = "published"
  else if (successCount === 0) outcome = "failed"

  return { results, outcome }
}

// ---------- Publish a post and save the outcome ----------
// The post must already be claimed (status "publishing").
// Used by the publish-now endpoint now, and by the scheduler later.
export const publishAndSave = async (post) => {
  try {
    // Channels that already succeeded in an earlier try are kept, not sent again
    const kept = post.platformResults
      .filter((r) => r.status === "success" && post.platforms.includes(r.platform))
      .map((r) => ({ platform: r.platform, status: "success", error: "" }))

    const alreadyDone = kept.map((r) => r.platform)
    const toSend = post.platforms.filter((p) => !alreadyDone.includes(p))

    // Send only the channels that still need it
    const newResults = toSend.length > 0 ? (await publishPost(post, toSend)).results : []

    const all = [...kept, ...newResults]
    const failed = all.filter((r) => r.status === "failed")

    post.platformResults = all

    if (all.length > 0 && failed.length === 0) {
      post.status = "published"
      post.publishedAt = new Date()
      post.publishError = ""
    } else {
      post.status = "failed"
      post.publishError = failed.map((r) => `${r.platform}: ${r.error}`).join("; ")
    }

    if (post.status === "published") {
      prepareSandboxSync(post)
    }

    await post.save()
  } catch (error) {
    // Something unexpected: do not leave the post stuck in "publishing"
    console.error("[publisher] unexpected error:", error)
    await Post.updateOne(
      { _id: post._id },
      { status: "failed", publishError: "Unexpected error while publishing..." }
    )
    post.status = "failed"
    post.publishError = "Unexpected error while publishing..."
    return post
  }

  if (post.status === "published") {
    void adapters.fakeSocialAdapter(post).catch((error) => {
      console.error(
        `[publisher] Sandbox sync task failed for post ${post._id}: ${error?.name || "Unexpected error"}`
      )
    })
  }

  return post
}