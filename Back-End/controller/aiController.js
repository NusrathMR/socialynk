// The service function has the same name as my controller, so I rename it here
import { generateCaption as generateCaptionFromGemini } from "../services/geminiService.js";
import BrandMemory from "../models/brandMemoryModel.js"

const BRAND_CONTEXT_FIELDS = [
  ["brandName", "Brand name"],
  ["businessDescription", "Business description"],
  ["productsServices", "Products and services"],
  ["targetAudience", "Target audience"],
  ["toneOfVoice", "Tone of voice"],
  ["favoriteHashtags", "Favorite hashtags"],
  ["keywords", "Keywords"],
  ["brandRules", "Brand rules"],
]

function createBrandContext(memory) {
  if (!memory) return null

  return BRAND_CONTEXT_FIELDS.reduce((context, [field, label]) => {
    if (memory[field]) context[label] = memory[field]
    return context
  }, {})
}

export const generateCaption = async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ message: "Prompt is required" });
    }
    if (prompt.length > 2000) {
      return res.status(400).json({ message: "Prompt must be 2000 characters or fewer" });
    }

    const activeMemory = req.user.activeBrandMemory
      ? await BrandMemory.findOne({
        _id: req.user.activeBrandMemory,
        user: req.user._id,
      }).lean()
      : null
    const brandContext = createBrandContext(activeMemory)
    const caption = await generateCaptionFromGemini({
      prompt: prompt.trim(),
      brandContext,
    });

    res.status(200).json({ caption });

  } catch (error) {
    console.error("AI error:", error?.status, error?.message);

    if (error.status === 400) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    if (error.status === 503 || error.status === 429) {
      return res.status(503).json({
        message: "The AI is very busy right now. Please try again in a moment.",
      });
    }

    return res.status(500).json({ message: "AI request failed. Please try again." });
  }
};