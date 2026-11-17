import cron from "node-cron"
import Post from "../models/postModel.js"
import { createNotification } from "./notificationService.js"
import { publishAndSave } from "./publisherServices.js"

const MAX_ATTEMPTS = 3                    // total tries per post
const RETRY_DELAY_MS = 2 * 60 * 1000      // wait 2 minutes before a retry
const STUCK_AFTER_MS = 5 * 60 * 1000      // a post "publishing" for over 5 minutes is stuck
const BATCH_LIMIT = 10                    // at most 10 posts per check
const PLATFORM_NAMES = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
}

let isRunning = false                     // stops two checks from overlapping

// ---------- 1. Rescue posts stuck in "publishing" ----------
const recoverStuckPosts = async () => {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS)

  const result = await Post.updateMany(
    { status: "publishing", updatedAt: { $lt: cutoff } },
    {
      $set: {
        status: "failed",
        publishError: "Publishing was interrupted. Please try again...",
      },
    }
  )

  if (result.modifiedCount > 0) {
    console.log(`[scheduler] recovered ${result.modifiedCount} stuck post(s)`)
  }
}

const failureMessage = (platformName, error) => {
  const reason = String(error || "").toLowerCase()

  if (/token|expired|permission|credential|auth/.test(reason)) {
    return `Your ${platformName} connection may have expired or lacks permission. Reconnect it and try again.`
  }
  if (/disconnect|not connected|account/.test(reason)) {
    return `Your ${platformName} account may be disconnected. Reconnect it and try again.`
  }
  if (/media|format|image|video/.test(reason)) {
    return `The media in your scheduled ${platformName} post may not be supported. Review it and try again.`
  }
  if (/network|timeout|temporar/.test(reason)) {
    return `Your scheduled ${platformName} post could not be published because of a temporary connection issue. Please try again.`
  }
  return `Your scheduled ${platformName} post could not be published. Review the post and account settings, then try again.`
}

const notifyPublicationResults = async (post) => {
  for (const result of post.platformResults || []) {
    const platformName = PLATFORM_NAMES[result.platform] || result.platform
    const succeeded = result.status === "success"
    const type = succeeded ? "SUCCESS" : "ERROR"

    try {
      await createNotification({
        userId: post.owner,
        title: succeeded ? "Post Published Successfully!" : "Post Publishing Failed",
        message: succeeded
          ? `Your scheduled ${platformName} post was published successfully.`
          : failureMessage(platformName, result.error),
        type,
        postId: post._id,
        platform: result.platform,
        eventKey: `post:${post._id}:platform:${result.platform}:${type.toLowerCase()}`,
      })
    } catch (error) {
      console.error(
        `[scheduler] could not save ${type.toLowerCase()} notification for post ${post._id} on ${platformName}:`,
        error
      )
    }
  }
}

// ---------- 2. Publish every post that is due ----------
const processDuePosts = async () => {
  for (let i = 0; i < BATCH_LIMIT; i++) {
    // Claim ONE due post. Only one process can win a given post.
    const post = await Post.findOneAndUpdate(
      { status: "scheduled", scheduledAt: { $lte: new Date() } },
      {
        $set: { status: "publishing", publishError: "" },
        $inc: { publishAttempts: 1 },
      },
      { sort: { scheduledAt: 1 }, returnDocument: "after" }     // oldest first, return the updated post
    )

    if (!post) break                               // nothing left to do

    console.log(`[scheduler] publishing post ${post._id} (try ${post.publishAttempts} of ${MAX_ATTEMPTS})`)

    await publishAndSave(post)                     // sets "published" or "failed"
    await notifyPublicationResults(post)

    if (post.status === "failed" && post.publishAttempts < MAX_ATTEMPTS) {
      // Put it back in the queue for a later retry
      await Post.updateOne(
        { _id: post._id },
        {
          $set: {
            status: "scheduled",
            scheduledAt: new Date(Date.now() + RETRY_DELAY_MS),
          },
        }
      )
      console.log(`[scheduler] post ${post._id} failed, will retry in ${RETRY_DELAY_MS / 60000} minute(s)`)
    } else {
      console.log(`[scheduler] post ${post._id} finished as "${post.status}"`)
    }
  }
}

// ---------- 3. One full check ----------
export const runSchedulerTick = async () => {
  if (isRunning) return                            // the previous check is still working
  isRunning = true

  try {
    await recoverStuckPosts()
    await processDuePosts()
  } catch (error) {
    console.error("[scheduler] error:", error)
  } finally {
    isRunning = false                              // always allow the next check
  }
}

// ---------- 4. Start the timer ----------
export const startScheduler = () => {
  cron.schedule("* * * * *", runSchedulerTick)     // every minute
  setTimeout(runSchedulerTick, 5000)               // and once, 5 seconds after startup
  console.log("[scheduler] started: checking for due posts every minute")
}