import Post from "../models/postModel.js"

export const getDashboardStats = async (req, res) => {
  try {
    const totalPublishedPosts = await Post.countDocuments({
      owner: req.user._id,
      status: "published",
    })

    res.status(200).json({ totalPublishedPosts })
  } catch (error) {
    console.error("Could not load dashboard stats", error)
    res.status(500).json({ message: "Could not load dashboard stats." })
  }
}
