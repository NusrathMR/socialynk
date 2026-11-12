import User from "../models/userModel.js"; 
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { createHash, randomBytes } from "node:crypto"
import RefreshToken from "../models/refreshTokenModel.js"
import cloudinary from "../config/cloudinary.js"
import {
    createVerificationToken,
    hashVerificationToken,
} from "../utils/emailVerification.js"
import { sendVerificationEmail } from "../services/emailService.js"

const REFRESH_COOKIE_NAME = "refreshToken"
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000
const ACCESS_TOKEN_LIFETIME = "15m"

function hashRefreshToken(token) {
    return createHash("sha256").update(token).digest("hex")
}

function createAccessToken(user) {
    return jwt.sign(
        {id: user._id},
        process.env.JWT_SECRET_TOKEN,
        {expiresIn: ACCESS_TOKEN_LIFETIME}
    )
}

function refreshCookieOptions(rememberMe, expiresAt) {
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/api/user",
    }

    if (rememberMe) {
        options.maxAge = Math.max(0, expiresAt.getTime() - Date.now())
    }

    return options
}

function getRefreshToken(req) {
    const cookie = req.headers.cookie
        ?.split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${REFRESH_COOKIE_NAME}=`))

    return cookie ? cookie.slice(REFRESH_COOKIE_NAME.length + 1) : null
}

function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/api/user",
    })
}

function getPublicUser(user) {
    const fullName = user.fullName || user.fullname

    return {
        id: user._id,
        name: fullName,
        fullName,
        username: user.username || "",
        email: user.email,
        role: user.role,
        plan: user.plan,
        theme: user.theme,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
    }
}

export const registerUser = async (req,res)=>{
    let createdUserId = null
    let normalizedEmail = ""

    try{
        const {email, password, confirmPassword, fullname } = req.body

        if (!email || !password || !confirmPassword || !fullname){
            return res.status(400).json({message:"All fields are required..."})
        }

        if (password.length<6){
            return res.status(400).json({message:"Password should have 6 characters..."})
        }

        if (password !== confirmPassword){
            return res.status(400).json({message:"Passwords don't match..."})
        }

        normalizedEmail = email.trim().toLowerCase()
        const userExist = await User.findOne({email: normalizedEmail})
        if(userExist){
            return res.status(400).json({
                message: userExist.isEmailVerified
                    ? "User already existed..."
                    : "This email is already registered but not verified. Please use Resend verification email.",
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const userData = new User({
            fullname: fullname,
            email: normalizedEmail,
            password: hashedPassword
        })

        const saveUser = await userData.save()
        createdUserId = saveUser._id
        const verificationToken = createVerificationToken()
        saveUser.emailVerificationToken = verificationToken.tokenHash
        saveUser.emailVerificationExpires = verificationToken.expiresAt
        await saveUser.save()

        let emailResult
        try {
            emailResult = await sendVerificationEmail(saveUser.email, verificationToken.rawToken)
        } catch (error) {
            console.error(
                "Verification email could not be sent:",
                error instanceof Error ? error.name : "UnexpectedError"
            )
            emailResult = { success: false }
        }

        if (!emailResult.success) {
            try {
                await User.deleteOne({ _id: createdUserId })
                createdUserId = null
            } catch (rollbackError) {
                console.error(
                    "Signup rollback failed:",
                    rollbackError instanceof Error ? rollbackError.name : "UnexpectedError"
                )
                return res.status(500).json({
                    message: "We couldn't send the verification email or remove the new account. Please contact support.",
                })
            }

            return res.status(500).json({
                message: "We couldn't send the verification email. Please check your email address and try again.",
            })
        }

        createdUserId = null
        return res.status(200).json({
            message: "User registered successfully. Please check your email to verify your account.",
        })
    } catch(error) {
        if (createdUserId) {
            try {
                await User.deleteOne({ _id: createdUserId })
            } catch (rollbackError) {
                console.error(
                    "Signup rollback failed:",
                    rollbackError instanceof Error ? rollbackError.name : "UnexpectedError"
                )
                return res.status(500).json({
                    message: "We couldn't complete signup or remove the new account. Please contact support.",
                })
            }
        }

        if (error.code === 11000 && normalizedEmail) {
            try {
                const existingUser = await User.findOne({ email: normalizedEmail })
                if (existingUser) {
                    return res.status(400).json({
                        message: existingUser.isEmailVerified
                            ? "User already existed..."
                            : "This email is already registered but not verified. Please use Resend verification email.",
                    })
                }
            } catch (lookupError) {
                console.error(
                    "Duplicate account lookup failed:",
                    lookupError instanceof Error ? lookupError.name : "UnexpectedError"
                )
            }
        }

        console.error("Signup failed:", error instanceof Error ? error.name : "UnexpectedError")
        return res.status(500).json({message: "Could not create your account. Please try again."})
    }
}

export const verifyEmail = async (req, res) => {
    const { token } = req.body || {}
    if (typeof token !== "string" || !token || token.length > 200) {
        return res.status(400).json({ message: "A verification token is required." })
    }

    try {
        const user = await User.findOne({
            emailVerificationToken: hashVerificationToken(token),
        }).select("+emailVerificationToken +emailVerificationExpires")

        if (!user) {
            return res.status(400).json({
                code: "EMAIL_VERIFICATION_INVALID",
                message: "This verification link is invalid or has already been used.",
            })
        }

        if (user.isEmailVerified) {
            return res.status(200).json({ message: "This email is already verified." })
        }

        if (!user.emailVerificationExpires || user.emailVerificationExpires <= new Date()) {
            return res.status(400).json({
                code: "EMAIL_VERIFICATION_EXPIRED",
                message: "This verification link has expired. Request a new one.",
            })
        }

        user.isEmailVerified = true
        user.emailVerificationToken = undefined
        user.emailVerificationExpires = undefined
        await user.save()

        return res.status(200).json({ message: "Email verified. You can now sign in." })
    } catch (error) {
        console.error("Email verification failed:", error instanceof Error ? error.name : "UnexpectedError")
        return res.status(500).json({ message: "Could not verify your email. Please try again." })
    }
}

export const resendVerificationEmail = async (req, res) => {
    const email = req.body?.email
    if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ message: "Enter the email address for your account." })
    }

    const message = "If an unverified account exists for that email, a verification link will be sent."

    try {
        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+emailVerificationToken +emailVerificationExpires")

        if (user && !user.isEmailVerified) {
            const previousToken = user.emailVerificationToken
            const previousExpiry = user.emailVerificationExpires
            const verificationToken = createVerificationToken()

            user.emailVerificationToken = verificationToken.tokenHash
            user.emailVerificationExpires = verificationToken.expiresAt
            await user.save()

            const emailResult = await sendVerificationEmail(user.email, verificationToken.rawToken)
            if (!emailResult.success) {
                user.emailVerificationToken = previousToken
                user.emailVerificationExpires = previousExpiry
                await user.save()
            }
        }

        return res.status(200).json({ message })
    } catch (error) {
        console.error("Verification resend failed:", error instanceof Error ? error.name : "UnexpectedError")
        return res.status(200).json({ message })
    }
}

// Authenticate users by JWT | SignIn page

export const userSignIn = async (req,res)=>{
    try{
        const {email,password,rememberMe} = req.body
        
        if(!email || !password){
            return res.status(400).json({message:"All fields are required..."})
        } 

        const findUser = await User.findOne({email}).select("+password")
        if (!findUser){
            return res.status(400).json({message:"Username or password is wrong..."})
        }
        
        const comparePassword = await bcrypt.compare(password, findUser.password)
        if (!comparePassword){
            return res.status(400).json({message:"Username or password is wrong..."})
        }

        if (!findUser.isActive){
            return res.status(403).json({message: "This account is deactivated..."})
        }

        findUser.lastLoginAt = new Date()
        await findUser.save()

        const accessToken = createAccessToken(findUser)
        const refreshToken = randomBytes(48).toString("base64url")
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS)
        const shouldRemember = rememberMe === true

        const existingRefreshToken = getRefreshToken(req)
        if (existingRefreshToken) {
            await RefreshToken.deleteOne({
                tokenHash: hashRefreshToken(existingRefreshToken),
            })
        }

        await RefreshToken.create({
            userId: findUser._id,
            tokenHash: hashRefreshToken(refreshToken),
            expiresAt,
            rememberMe: shouldRemember,
        })

        res.cookie(
            REFRESH_COOKIE_NAME,
            refreshToken,
            refreshCookieOptions(shouldRemember, expiresAt)
        )

        res.set("Cache-Control", "no-store")
        res.status(200).json({
            message:"User signed in successfully...",
            token:accessToken,
            user:getPublicUser(findUser),
        })
    }catch(error){
        res.status(500).json({error:"Internal server error..."})
        console.error(error)
    }
}

export const refreshSession = async (req, res) => {
    try {
        const refreshToken = getRefreshToken(req)
        if (!refreshToken) {
            clearRefreshCookie(res)
            return res.status(401).json({message: "Refresh session is missing or expired."})
        }

        const storedToken = await RefreshToken.findOne({
            tokenHash: hashRefreshToken(refreshToken),
        })

        if (!storedToken || storedToken.expiresAt <= new Date()) {
            if (storedToken) {
                await RefreshToken.deleteOne({ _id: storedToken._id })
            }
            clearRefreshCookie(res)
            return res.status(401).json({message: "Refresh session is missing or expired."})
        }

        const user = await User.findById(storedToken.userId)
        if (!user || !user.isActive) {
            await RefreshToken.deleteOne({ _id: storedToken._id })
            clearRefreshCookie(res)
            return res.status(401).json({message: "This account is not available."})
        }

        res.cookie(
            REFRESH_COOKIE_NAME,
            refreshToken,
            refreshCookieOptions(storedToken.rememberMe, storedToken.expiresAt)
        )

        res.set("Cache-Control", "no-store")
        return res.status(200).json({
            token: createAccessToken(user),
            user: getPublicUser(user),
        })
    } catch (error) {
        console.error("Refresh session error:", error)
        return res.status(500).json({message: "Could not restore the login session."})
    }
}

export const userLogout = async (req, res) => {
    try {
        const refreshToken = getRefreshToken(req)
        if (refreshToken) {
            await RefreshToken.deleteOne({
                tokenHash: hashRefreshToken(refreshToken),
            })
        }

        clearRefreshCookie(res)
        return res.status(200).json({message: "Signed out successfully."})
    } catch (error) {
        clearRefreshCookie(res)
        console.error("Logout error:", error)
        return res.status(500).json({message: "Could not invalidate the login session."})
    }
}

export const getMe = async (req, res) =>{
    res.status(200).json({
        user: getPublicUser(req.user),
    })
}

export const updateMyTheme = async (req, res) => {
    const { theme } = req.body || {}
    if (!["light", "dark"].includes(theme)) {
        return res.status(400).json({
            message: "Theme must be either light or dark.",
            errors: { theme: "Choose light or dark mode." },
        })
    }

    try {
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ message: "User not found." })
        }

        user.theme = theme
        await user.save()
        return res.status(200).json({ user: getPublicUser(user) })
    } catch (error) {
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message })
        }

        console.error("Theme update error:", error)
        return res.status(500).json({ message: "Could not save your theme preference." })
    }
}

export const updateMyProfile = async (req, res) => {
    const body = req.body
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ message: "Profile details must be sent as a JSON object." })
    }

    const allowedFields = ["fullName", "username"]
    const errors = {}
    for (const field of Object.keys(body)) {
        if (!allowedFields.includes(field)) {
            errors[field] = "This field cannot be changed here."
        }
    }

    const updates = {}
    if (Object.prototype.hasOwnProperty.call(body, "fullName")) {
        if (typeof body.fullName !== "string") {
            errors.fullName = "Full name must be text."
        } else {
            const fullName = body.fullName.trim()
            if (fullName.length < 2 || fullName.length > 100) {
                errors.fullName = "Full name must be between 2 and 100 characters."
            } else {
                updates.fullName = fullName
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, "username")) {
        if (typeof body.username !== "string") {
            errors.username = "Username must be text."
        } else {
            const username = body.username.trim().toLowerCase()
            if (username && !/^[a-z0-9_]{3,30}$/.test(username)) {
                errors.username = "Username must be 3-30 characters using letters, numbers, or underscores."
            } else {
                updates.username = username
            }
        }
    }

    if (Object.keys(body).length === 0) {
        errors.general = "Provide at least one profile field to update."
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: "Please correct the highlighted fields.", errors })
    }

    try {
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ message: "User not found." })
        }

        if (Object.prototype.hasOwnProperty.call(updates, "fullName")) {
            user.fullName = updates.fullName
            user.fullname = updates.fullName
        }

        if (Object.prototype.hasOwnProperty.call(updates, "username")) {
            user.username = updates.username || undefined
        }

        await user.save()
        return res.status(200).json({ user: getPublicUser(user) })
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.username) {
            return res.status(409).json({
                message: "That username is already in use.",
                errors: { username: "That username is already in use." },
            })
        }
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message })
        }

        console.error("Profile update error:", error)
        return res.status(500).json({ message: "Could not update profile details." })
    }
}

function uploadAvatarToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "socialynk/avatars",
                resource_type: "image",
                transformation: [{ width: 400, height: 400, crop: "fill", gravity: "auto" }],
            },
            (error, result) => {
                if (error) return reject(error)
                resolve(result)
            }
        )
        stream.end(buffer)
    })
}

async function removeAvatarFromCloudinary(publicId) {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" })
    if (!["ok", "not found"].includes(result.result)) {
        throw new Error("Cloudinary did not confirm profile picture removal.")
    }
}

export const uploadMyAvatar = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "Choose a JPG, PNG, or WebP image to upload." })
    }

    const { buffer, mimetype } = req.file
    const isJpeg = mimetype === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    const isPng = mimetype === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const isWebp = mimetype === "image/webp" &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    if (!isJpeg && !isPng && !isWebp) {
        return res.status(400).json({ message: "The uploaded file is not a valid JPG, PNG, or WebP image." })
    }

    let uploadedImage
    try {
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ message: "User not found." })
        }

        uploadedImage = await uploadAvatarToCloudinary(req.file.buffer)
        const previousPublicId = user.profilePicturePublicId
        user.profilePicture = uploadedImage.secure_url
        user.profilePicturePublicId = uploadedImage.public_id
        await user.save()

        if (previousPublicId) {
            try {
                await removeAvatarFromCloudinary(previousPublicId)
            } catch (cleanupError) {
                console.error("Could not remove the previous profile picture from Cloudinary:", cleanupError.message)
                return res.status(502).json({
                    message: "Profile picture updated, but the previous image could not be removed.",
                    user: getPublicUser(user),
                })
            }
        }

        return res.status(200).json({ user: getPublicUser(user) })
    } catch (error) {
        if (uploadedImage?.public_id) {
            try {
                await removeAvatarFromCloudinary(uploadedImage.public_id)
            } catch (cleanupError) {
                console.error("Could not clean up an incomplete profile picture upload:", cleanupError.message)
            }
        }
        console.error("Profile picture upload error:", error.message)
        return res.status(502).json({ message: "Could not upload the profile picture. Please try again." })
    }
}

export const deleteMyAvatar = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ message: "User not found." })
        }

        if (user.profilePicturePublicId) {
            await removeAvatarFromCloudinary(user.profilePicturePublicId)
        }

        user.profilePicture = ""
        user.profilePicturePublicId = ""
        await user.save()
        return res.status(200).json({ user: getPublicUser(user) })
    } catch (error) {
        console.error("Profile picture removal error:", error.message)
        return res.status(502).json({ message: "Could not remove the profile picture. Please try again." })
    }
}