import express from "express"
import { getDashboardStats } from "../controller/dashboardController.js"
import { protect } from "../middleware/authMiddleware.js"

const route = express.Router()

route.use(protect)
route.get("/", getDashboardStats)

export default route
