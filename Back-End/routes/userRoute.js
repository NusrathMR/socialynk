import express from "express"
import {
    registerUser,
    refreshSession,
    userLogout,
    userSignIn,
} from "../controller/userController.js"
import {protect} from "../middleware/authMiddleware.js"
import { getMe } from "../controller/userController.js"
import {requireTrustedOrigin} from "../config/corsConfig.js"


const routes = express.Router()

routes.post("/signup", registerUser)
routes.post("/signin", requireTrustedOrigin, userSignIn)
routes.post("/refresh", requireTrustedOrigin, refreshSession)
routes.post("/logout", requireTrustedOrigin, userLogout)
routes.get("/me", protect, getMe)

export default routes