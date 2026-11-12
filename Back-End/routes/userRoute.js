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
    verifyEmail,
    resendVerificationEmail,
} from "../controller/userController.js"
import { sendTestEmail } from "../controller/emailTestController.js"
import {protect} from "../middleware/authMiddleware.js"
import {requireTrustedOrigin} from "../config/corsConfig.js"
import uploadProfileAvatar from "../middleware/profileAvatarUpload.js"


const routes = express.Router()

routes.post("/signup", registerUser)
routes.post("/test-email", requireTrustedOrigin, sendTestEmail)
routes.post("/verify-email", requireTrustedOrigin, verifyEmail)
routes.post("/resend-verification", requireTrustedOrigin, resendVerificationEmail)
routes.post("/signin", requireTrustedOrigin, userSignIn)
routes.post("/refresh", requireTrustedOrigin, refreshSession)
routes.post("/logout", requireTrustedOrigin, userLogout)
routes.get("/me", protect, getMe)
routes.patch("/me/theme", protect, updateMyTheme)
routes.patch("/me", protect, updateMyProfile)
routes.post("/me/avatar", protect, uploadProfileAvatar, uploadMyAvatar)
routes.delete("/me/avatar", protect, deleteMyAvatar)

export default routes