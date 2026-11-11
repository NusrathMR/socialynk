import { useEffect, useState } from "react"
import { updateMyTheme } from "../../api/api.js"
import { useAuth } from "../AuthContext/authContext.jsx"
import { ThemeContext } from "./themeContext.js"

function getStoredTheme() {
  try {
    return localStorage.getItem("socialynk-theme") === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
}

export function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth()
  const [cachedTheme, setCachedTheme] = useState(getStoredTheme)
  const [previewTheme, setPreviewTheme] = useState(null)
  const theme = previewTheme || (
    user?.theme === "dark" || user?.theme === "light" ? user.theme : cachedTheme
  )

  useEffect(() => {
    applyTheme(theme)
    if (!previewTheme) {
      try {
        localStorage.setItem("socialynk-theme", theme)
      } catch {
        // The theme still works for this page if browser storage is unavailable.
      }
    }
  }, [theme, previewTheme])

  const saveTheme = async (nextTheme) => {
    if (!["light", "dark"].includes(nextTheme)) {
      throw new Error("Choose light or dark mode.")
    }

    setPreviewTheme(nextTheme)
    try {
      const updatedUser = await updateMyTheme(nextTheme)
      updateUser(updatedUser)
      setCachedTheme(nextTheme)
      setPreviewTheme(null)
      try {
        localStorage.setItem("socialynk-theme", nextTheme)
      } catch {
        // The server preference has been saved even if browser storage is unavailable.
      }
      return updatedUser.theme
    } catch (error) {
      setPreviewTheme(null)
      throw error
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, saveTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
