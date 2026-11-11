import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import "./PasswordInput.css"

export default function PasswordInput({ className = "", ...inputProps }) {
  const [showPassword, setShowPassword] = useState(false)
  const Icon = showPassword ? EyeOff : Eye

  return (
    <div className="password-input-wrap">
      <input
        {...inputProps}
        type={showPassword ? "text" : "password"}
        className={`password-input ${className}`.trim()}
      />
      <button
        type="button"
        className="password-toggle-btn"
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setShowPassword((isVisible) => !isVisible)}
      >
        <Icon size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
