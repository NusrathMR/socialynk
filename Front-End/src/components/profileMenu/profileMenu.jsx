import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Settings, LayoutGrid, CircleDollarSign, LogOut, Zap } from "lucide-react"
import { useAuth } from "../AuthContext/authContext.jsx"
import "./profileMenu.css"


function getInitials(email) {
  if (!email) return "?"
  return email.split("@")[0].slice(0, 2).toUpperCase()
}

function ProfileMenu({ direction = "down", align = "right", size = 44, avatarInitials }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleEscape = (e) => {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  const goTo = (path) => {
    setOpen(false)
    navigate(path)
  }

  const handleLogout = async () => {
    setOpen(false)
    try {
      await logout()
    } catch (error) {
      console.error("Could not invalidate the server login session:", error)
    }
    navigate("/login", { replace: true })
  }

  const planName = user?.plan
    ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1)
    : "Free"

  return (
    <div className="profile-menu" ref={menuRef}>

      {/* The avatar button */}
      <button
        type="button"
        className="pm-avatar"
        style={{ width: size, height: size }}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        {user?.profilePicture ? (
          <img src={user.profilePicture} alt="Profile" />
        ) : avatarInitials ? (
          <span className="db-avatar-light">{avatarInitials}</span>
        ) : (
          getInitials(user?.email)
        )}
      </button>

      {open && (
        <div className={`pm-popup pm-${direction} pm-${align}`} role="menu">

          <div className="pm-header">
            <p className="pm-email">{user?.email}</p>
            <p className="pm-plan">{planName} plan</p>
          </div>

          {/* Hide the upgrade button when the user is already on the top plan */}
          {user?.plan !== "business" && (
            <button type="button" className="pm-upgrade" onClick={() => goTo("/pricing")}>
              <Zap size={18} />
              <span>Upgrade Plan</span>
            </button>
          )}

          <div className="pm-divider"></div>

          <button type="button" className="pm-item" role="menuitem" onClick={() => goTo("/settings")}>
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <button type="button" className="pm-item" role="menuitem" onClick={() => goTo("/channels")}>
            <LayoutGrid size={18} />
            <span>Channels</span>
          </button>

          <button type="button" className="pm-item" role="menuitem" onClick={() => goTo("/pricing")}>
            <CircleDollarSign size={18} />
            <span>Pricing</span>
          </button>

          <div className="pm-divider"></div>

          <button type="button" className="pm-item" role="menuitem" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Log out</span>
          </button>

        </div>
      )}
    </div>
  )
}

export default ProfileMenu