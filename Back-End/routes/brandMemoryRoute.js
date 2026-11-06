import express from "express"
import { protect } from "../middleware/authMiddleware.js"
import {
  activateBrandMemory,
  createBrandMemory,
  deactivateBrandMemory,
  deleteBrandMemory,
  getBrandMemory,
  updateBrandMemory,
} from "../controller/brandMemoryController.js"

const route = express.Router()

route.use(protect)

route.get("/", getBrandMemory)
route.post("/", createBrandMemory)
route.patch("/deactivate", deactivateBrandMemory)
route.patch("/:id/activate", activateBrandMemory)
route.put("/:id", updateBrandMemory)
route.delete("/:id", deleteBrandMemory)

export default route
