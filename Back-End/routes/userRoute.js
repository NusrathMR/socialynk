import express from "express"
import {
    registerUser,
    refreshSession,
    userLogout,
    userSignIn,
    getMe,
    updateMyTheme,
    updateMyProfile,
    uploadMyAvatar,
    deleteMyAvatar,
} from "../controller/userController.js"
import {protect} from "../middleware/authMiddleware.js"
import {requireTrustedOrigin} from "../config/corsConfig.js"
import uploadProfileAvatar from "../middleware/profileAvatarUpload.js"


const routes = express.Router()

routes.post("/signup", registerUser)
routes.post("/signin", requireTrustedOrigin, userSignIn)
routes.post("/refresh", requireTrustedOrigin, refreshSession)
routes.post("/logout", requireTrustedOrigin, userLogout)
routes.get("/me", protect, getMe)
routes.patch("/me/theme", protect, updateMyTheme)
routes.patch("/me", protect, updateMyProfile)
routes.post("/me/avatar", protect, uploadProfileAvatar, uploadMyAvatar)
routes.delete("/me/avatar", protect, deleteMyAvatar)

export default routes