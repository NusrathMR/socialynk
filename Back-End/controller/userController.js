import User from "../models/userModel.js"; 
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { createHash, randomBytes } from "node:crypto"
import RefreshToken from "../models/refreshTokenModel.js"

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
    return {
        id: user._id,
        name: user.fullname,
        email: user.email,
        role: user.role,
        plan: user.plan,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
    }
}

export const registerUser = async (req,res)=>{
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

        const userExist = await User.findOne({email})
        if(userExist){
            return res.status(400).json({message:"User already existed..."})
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const userData = new User({
            fullname: fullname,
            email: email,
            password: hashedPassword
        })

        const saveUser = await userData.save()
        res.status(200).json({message: "User registered successfully...",})

    }catch(error){
        res.status(500).json({error: "Internal server error..."})
        console.error(error)
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
        user:{
            id:req.user._id,
            name:req.user.fullname,
            email:req.user.email,
            role: req.user.role,
            plan:req.user.plan,
            profilePicture:req.user.profilePicture,
            isEmailVerified: req.user.isEmailVerified,
            lastLoginAt: req.user.lastLoginAt,
            createdAt: req.user.createdAt,
        }
    })
}