import express from "express"
import { protect } from "../middleware/authMiddleware.js"
import { adminOnly } from "../middleware/adminOnly.js"
import {
  getUsers,
  getUserById,
  updateUser,
  updateUserRole,
  updateUserStatus,
} from "../controller/adminUserController.js"

const route = express.Router()

// Every route in this file needs a logged-in ADMIN
route.use(protect, adminOnly)

route.get("/", getUsers)
route.get("/:id", getUserById)
route.patch("/:id", updateUser)
route.patch("/:id/role", updateUserRole)
route.patch("/:id/status", updateUserStatus)

export default route