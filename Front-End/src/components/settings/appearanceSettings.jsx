import { useState } from "react"
import { useTheme } from "../ThemeContext/themeContext.js"
import "./appearanceSettings.css"

const themeOptions = [
  {
    value: "light",
    title: "Light",
    description: "A bright workspace with light cards and backgrounds.",
  },
  {
    value: "dark",
    title: "Dark",
    description: "A darker workspace that is easier on the eyes in low light.",
  },
]

export default function AppearanceSettings() {
  const { theme, saveTheme } = useTheme()
  const [savingTheme, setSavingTheme] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const chooseTheme = async (nextTheme) => {
    if (nextTheme === theme || savingTheme) return

    setSavingTheme(nextTheme)
    setMessage("")
    setErrorMessage("")

    try {
      await saveTheme(nextTheme)
      setMessage(`${nextTheme === "dark" ? "Dark" : "Light"} mode saved.`)
    } catch (error) {
      setErrorMessage(error.message || "Could not save your theme preference.")
    } finally {
      setSavingTheme("")
    }
  }

  return (
    <section className="settings-card appearance-settings">
      <div className="appearance-heading">
        <p className="settings-eyebrow">Settings</p>
        <h2>Appearance</h2>
        <p>Choose the theme for your Socialynk workspace.</p>
      </div>

      {message && <p className="appearance-message success" role="status">{message}</p>}
      {errorMessage && <p className="appearance-message error" role="alert">{errorMessage}</p>}

      <div className="appearance-options">
        {themeOptions.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`appearance-option ${theme === option.value ? "selected" : ""}`}
            onClick={() => chooseTheme(option.value)}
            disabled={Boolean(savingTheme)}
            aria-pressed={theme === option.value}
          >
            <span className={`appearance-preview ${option.value}`}>
              <span className="appearance-preview-sidebar" />
              <span className="appearance-preview-content">
                <span />
                <span />
              </span>
            </span>
            <span className="appearance-option-copy">
              <strong>{option.title}{theme === option.value ? " · Current" : ""}</strong>
              <span>{option.description}</span>
            </span>
            <span className="appearance-option-action">
              {savingTheme === option.value
                ? "Saving..."
                : theme === option.value
                  ? "Selected"
                  : "Use theme"}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
