import BrandMemory from "../models/brandMemoryModel.js"
import User from "../models/userModel.js"

const FIELD_LIMITS = {
  brandName: 100,
  businessDescription: 300,
  productsServices: 250,
  targetAudience: 200,
  toneOfVoice: 20,
  favoriteHashtags: 100,
  keywords: 100,
  brandRules: 250,
}

const REQUIRED_FIELDS = ["brandName", "businessDescription"]
const TONES_OF_VOICE = ["", "Professional", "Friendly", "Casual", "Funny", "Inspirational", "Creative"]
const MEMORY_FIELDS = Object.keys(FIELD_LIMITS)
const MEMORY_ID_PATTERN = /^[a-f\d]{24}$/i

function cleanText(value) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
}

function validateMemory(body) {
  const errors = {}
  const data = {}

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { data, errors: { general: "Brand details must be sent as an object." } }
  }

  for (const field of MEMORY_FIELDS) {
    const value = body[field] === undefined || body[field] === null ? "" : body[field]

    if (typeof value !== "string") {
      errors[field] = "Must be text."
      continue
    }

    data[field] = cleanText(value)

    if (data[field].length > FIELD_LIMITS[field]) {
      errors[field] = `Must be ${FIELD_LIMITS[field]} characters or fewer.`
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) errors[field] = "This field is required."
  }

  if (data.toneOfVoice && !TONES_OF_VOICE.includes(data.toneOfVoice)) {
    errors.toneOfVoice = "Choose a supported brand tone."
  }

  const totalLength = MEMORY_FIELDS.reduce((total, field) => total + (data[field]?.length || 0), 0)
  if (totalLength > 1000) {
    errors.general = "Combined brand details must be 1,000 characters or fewer."
  }

  return { data, errors }
}

function publicMemory(memory) {
  const data = { id: String(memory._id) }
  for (const field of MEMORY_FIELDS) data[field] = memory[field]
  data.createdAt = memory.createdAt
  data.updatedAt = memory.updatedAt
  return data
}

function sendDatabaseError(error, res, fallbackMessage) {
  if (error.code === 11000) {
    const duplicateFields = Object.keys(error.keyPattern || {})
    if (duplicateFields.length === 1 && duplicateFields[0] === "user") {
      return res.status(409).json({
        message: "A legacy unique MongoDB index still limits each user to one Brand Memory. Run the Brand Memory migration, then retry.",
      })
    }

    return res.status(409).json({ message: "A conflicting Brand Memory already exists." })
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({ message: "Please check your brand details and try again." })
  }

  console.error(error)
  return res.status(500).json({ message: fallbackMessage })
}

function isValidMemoryId(id) {
  return typeof id === "string" && MEMORY_ID_PATTERN.test(id)
}

// GET /api/brand-memory
export const getBrandMemory = async (req, res) => {
  try {
    const [memories, activeMemory] = await Promise.all([
      BrandMemory.find({ user: req.user._id }).sort({ updatedAt: -1, _id: 1 }).lean(),
      req.user.activeBrandMemory
        ? BrandMemory.findOne({
          _id: req.user.activeBrandMemory,
          user: req.user._id,
        }).lean()
        : null,
    ])

    if (req.user.activeBrandMemory && !activeMemory) {
      await User.updateOne(
        { _id: req.user._id, activeBrandMemory: req.user.activeBrandMemory },
        { $set: { activeBrandMemory: null } }
      )
    }

    return res.status(200).json({
      memories: memories.map(publicMemory),
      activeMemory: activeMemory ? publicMemory(activeMemory) : null,
    })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not load Brand Memories.")
  }
}

// POST /api/brand-memory
export const createBrandMemory = async (req, res) => {
  const { data, errors } = validateMemory(req.body)
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Please fix the highlighted fields.", errors })
  }

  try {
    const memory = await BrandMemory.create({ ...data, user: req.user._id })
    return res.status(201).json({ memory: publicMemory(memory) })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not create Brand Memory.")
  }
}

// PUT /api/brand-memory/:id
export const updateBrandMemory = async (req, res) => {
  if (!isValidMemoryId(req.params.id)) {
    return res.status(400).json({ message: "Brand Memory ID is not valid." })
  }

  const { data, errors } = validateMemory(req.body)
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Please fix the highlighted fields.", errors })
  }

  try {
    const memory = await BrandMemory.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
    if (!memory) {
      return res.status(404).json({ message: "Brand Memory was not found." })
    }

    memory.set(data)
    await memory.save()
    return res.status(200).json({ memory: publicMemory(memory) })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not update Brand Memory.")
  }
}

// DELETE /api/brand-memory/:id
export const deleteBrandMemory = async (req, res) => {
  if (!isValidMemoryId(req.params.id)) {
    return res.status(400).json({ message: "Brand Memory ID is not valid." })
  }

  try {
    const memory = await BrandMemory.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    })
    if (!memory) {
      return res.status(404).json({ message: "Brand Memory was not found." })
    }

    await User.updateOne(
      { _id: req.user._id, activeBrandMemory: memory._id },
      { $set: { activeBrandMemory: null } }
    )
    return res.status(200).json({ message: "Brand Memory deleted successfully." })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not delete Brand Memory.")
  }
}

// PATCH /api/brand-memory/:id/activate
export const activateBrandMemory = async (req, res) => {
  if (!isValidMemoryId(req.params.id)) {
    return res.status(400).json({ message: "Brand Memory ID is not valid." })
  }

  try {
    const memory = await BrandMemory.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
    if (!memory) {
      return res.status(404).json({ message: "Brand Memory was not found." })
    }

    await User.updateOne(
      { _id: req.user._id },
      { $set: { activeBrandMemory: memory._id } }
    )

    const stillOwned = await BrandMemory.exists({
      _id: memory._id,
      user: req.user._id,
    })
    if (!stillOwned) {
      await User.updateOne(
        { _id: req.user._id, activeBrandMemory: memory._id },
        { $set: { activeBrandMemory: null } }
      )
      return res.status(404).json({ message: "Brand Memory was not found." })
    }

    return res.status(200).json({ activeMemory: publicMemory(memory) })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not activate Brand Memory.")
  }
}

// PATCH /api/brand-memory/deactivate
export const deactivateBrandMemory = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { activeBrandMemory: null } }
    )
    return res.status(200).json({ activeMemory: null })
  } catch (error) {
    return sendDatabaseError(error, res, "Could not turn off Brand Memory.")
  }
}
