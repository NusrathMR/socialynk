import express from "express"
import { protect } from "../middleware/authMiddleware.js"
import { searchWorkspace } from "../controller/searchController.js"

const route = express.Router()

route.use(protect)
route.get("/", searchWorkspace)

export default route
