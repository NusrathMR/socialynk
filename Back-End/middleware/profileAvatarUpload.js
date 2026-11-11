import multer from "multer"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("Only JPG, PNG, and WebP images are allowed."))
    }
    callback(null, true)
  },
})

export default function uploadProfileAvatar(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next()

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Profile pictures must be 2 MB or smaller." })
    }

    return res.status(400).json({
      message: error.message || "Could not read the uploaded image.",
    })
  })
}
