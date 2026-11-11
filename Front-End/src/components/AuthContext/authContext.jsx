import { createContext, useContext, useState, useEffect, useRef } from "react"
import api, {
    clearAccessToken,
    restoreSession,
    setAccessToken,
} from "../../api/api.js"

const AuthContext = createContext()

function normalizeUser(userData) {
    if (!userData || typeof userData !== "object") return null

    return {
        ...userData,
        role: userData.role || "user",
        plan: userData.plan || "free",
        name: userData.name || userData.fullName || userData.fullname,
        email: userData.email || "",
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const authVersion = useRef(0)

    const login = (token, userData) => {
        const normalizedUser = normalizeUser(userData)
        authVersion.current += 1
        setAccessToken(token)
        setUser(normalizedUser)
    }

    const updateUser = (userData) => {
        setUser((currentUser) => currentUser
            ? normalizeUser({ ...currentUser, ...userData })
            : currentUser)
    }

    const logout = async () => {
        authVersion.current += 1
        clearAccessToken()
        setUser(null)
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        await api.post("/user/logout", {}, { skipAuthRefresh: true })
    }

    useEffect(() => {
        let isMounted = true
        const requestVersion = authVersion.current

        const handleSessionExpired = () => {
            authVersion.current += 1
            clearAccessToken()
            setUser(null)
        }

        window.addEventListener("auth:session-expired", handleSessionExpired)

        restoreSession()
            .then((userData) => {
                if (isMounted && authVersion.current === requestVersion) {
                    setUser(normalizeUser(userData))
                }
            })
            .catch((error) => {
                if (error.response?.status !== 401 && error.response?.status !== 403) {
                    console.error("Could not restore the login session:", error)
                }
                if (isMounted && authVersion.current === requestVersion) {
                    setUser(null)
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false)
                }
            })

        return () => {
            isMounted = false
            window.removeEventListener("auth:session-expired", handleSessionExpired)
        }
    }, [])

    useEffect(() => {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
    }, [])

    return (
        <AuthContext.Provider value={{ user, isLoading, login, updateUser, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    return useContext(AuthContext)
}
