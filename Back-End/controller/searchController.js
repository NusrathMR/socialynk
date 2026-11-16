import BrandMemory from "../models/brandMemoryModel.js"
import Media from "../models/mediaModel.js"
import Post from "../models/postModel.js"

const RESULT_LIMIT = 5
const MAX_QUERY_LENGTH = 100

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function postResult(post, category, navigation) {
  const caption = post.caption || ""
  return {
    category,
    id: String(post._id),
    title: caption ? caption.slice(0, 80) : "Untitled post",
    preview: caption || "No caption",
    navigation,
  }
}

function brandMemoryPreview(memory, query) {
  const searchableFields = [
    memory.brandName,
    memory.businessDescription,
    memory.productsServices,
    memory.targetAudience,
    memory.toneOfVoice,
    memory.favoriteHashtags,
    memory.keywords,
    memory.brandRules,
  ]
  const match = searchableFields.find((value) =>
    value && new RegExp(escapeRegex(query), "i").test(value)
  )

  return match || memory.businessDescription
}

export async function searchWorkspace(req, res) {
  if (typeof req.query.q !== "string") {
    return res.status(400).json({ message: "A search query is required." })
  }

  const query = req.query.q
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()

  if (!query) {
    return res.status(400).json({ message: "A search query is required." })
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      message: `Search queries must be ${MAX_QUERY_LENGTH} characters or fewer.`,
    })
  }

  const expression = new RegExp(escapeRegex(query), "i")
  const owner = req.user._id

  try {
    const [drafts, scheduledPosts, publishedPosts, otherPosts, memories, media] =
      await Promise.all([
        Post.find({
          owner,
          status: "draft",
          $or: [{ caption: expression }, { hashtags: expression }],
        })
          .select("caption")
          .sort({ updatedAt: -1 })
          .limit(RESULT_LIMIT)
          .lean(),
        Post.find({
          owner,
          status: "scheduled",
          $or: [{ caption: expression }, { hashtags: expression }],
        })
          .select("caption")
          .sort({ updatedAt: -1 })
          .limit(RESULT_LIMIT)
          .lean(),
        Post.find({
          owner,
          status: "published",
          $or: [{ caption: expression }, { hashtags: expression }],
        })
          .select("caption")
          .sort({ updatedAt: -1 })
          .limit(RESULT_LIMIT)
          .lean(),
        Post.find({
          owner,
          status: { $in: ["publishing", "failed"] },
          $or: [{ caption: expression }, { hashtags: expression }],
        })
          .select("caption")
          .sort({ updatedAt: -1 })
          .limit(RESULT_LIMIT)
          .lean(),
        BrandMemory.find({
          user: owner,
          $or: [
            { brandName: expression },
            { businessDescription: expression },
            { productsServices: expression },
            { targetAudience: expression },
            { toneOfVoice: expression },
            { favoriteHashtags: expression },
            { keywords: expression },
            { brandRules: expression },
          ],
        })
          .select("brandName businessDescription productsServices targetAudience toneOfVoice favoriteHashtags keywords brandRules")
          .sort({ updatedAt: -1 })
          .limit(RESULT_LIMIT)
          .lean(),
        Media.find({
          user: owner,
          $or: [{ originalName: expression }, { format: expression }],
        })
          .select("originalName format width height")
          .sort({ createdAt: -1 })
          .limit(RESULT_LIMIT)
          .lean(),
      ])

    const results = [
      ...drafts.map((post) =>
        postResult(post, "Drafts", `/createpage?draft=${post._id}`)
      ),
      ...scheduledPosts.map((post) =>
        postResult(post, "Scheduled Posts", "/publishpage")
      ),
      ...publishedPosts.map((post) =>
        postResult(post, "Published Posts", "/publishpage")
      ),
      ...otherPosts.map((post) =>
        postResult(post, "Posts", "/publishpage")
      ),
      ...memories.map((memory) => ({
        category: "Brand Memories",
        id: String(memory._id),
        title: memory.brandName,
        preview: brandMemoryPreview(memory, query),
        navigation: "/settings/brand-memory",
      })),
      ...media.map((item) => ({
        category: "Media",
        id: String(item._id),
        title: item.originalName || `Uploaded ${item.format || "image"}`,
        preview: [
          item.format?.toUpperCase(),
          item.width && item.height ? `${item.width} × ${item.height}` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Uploaded image",
        navigation: "/createpage",
      })),
    ]

    return res.status(200).json({ query, results })
  } catch (error) {
    console.error("Could not search the user's workspace:", error)
    return res.status(500).json({ message: "Could not complete the search." })
  }
}
