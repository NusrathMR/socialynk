import express from "express"
import { protect } from "../middleware/authMiddleware.js"
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  streamNotifications,
} from "../controller/notificationController.js"

const route = express.Router()

route.use(protect)
route.get("/", getNotifications)
route.get("/stream", streamNotifications)
route.patch("/read-all", markAllNotificationsRead)
route.patch("/:id/read", markNotificationRead)

export default route
