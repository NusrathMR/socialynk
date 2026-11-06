import mongoose from "mongoose"

const TONES_OF_VOICE = [
  "",
  "Professional",
  "Friendly",
  "Casual",
  "Funny",
  "Inspirational",
  "Creative",
]

const brandMemorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    brandName: { type: String, required: true, trim: true, maxlength: 100 },
    businessDescription: { type: String, required: true, trim: true, maxlength: 300 },
    productsServices: { type: String, default: "", trim: true, maxlength: 250 },
    targetAudience: { type: String, default: "", trim: true, maxlength: 200 },
    toneOfVoice: { type: String, default: "", enum: TONES_OF_VOICE, maxlength: 20 },
    favoriteHashtags: { type: String, default: "", trim: true, maxlength: 100 },
    keywords: { type: String, default: "", trim: true, maxlength: 100 },
    brandRules: { type: String, default: "", trim: true, maxlength: 250 },
  },
  { timestamps: true }
)

export default mongoose.model("BrandMemory", brandMemorySchema)
