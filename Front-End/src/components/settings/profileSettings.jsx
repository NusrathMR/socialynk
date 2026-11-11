import { useEffect, useRef, useState } from "react"
import { deleteMyAvatar, updateMyProfile, uploadMyAvatar } from "../../api/api.js"
import { useAuth } from "../AuthContext/authContext.jsx"
import getInitials from "../../utils/getInitials.js"
import "./profileSettings.css"

function getProfileValues(user) {
  return {
    fullName: user?.fullName || user?.name || "",
    username: user?.username || "",
  }
}

export default function ProfileSettings() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState(() => getProfileValues(user))
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState("")
  const [avatarMessage, setAvatarMessage] = useState("")
  const [avatarImageError, setAvatarImageError] = useState(false)
  const fileInputRef = useRef(null)
  const previewUrlRef = useRef("")

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const clearSelectedFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = ""
    setPreviewUrl("")
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0]
    setAvatarError("")
    setAvatarMessage("")
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      clearSelectedFile()
      setAvatarError("Choose a JPG, PNG, or WebP image.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      clearSelectedFile()
      setAvatarError("Profile pictures must be 2 MB or smaller.")
      return
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const nextPreview = URL.createObjectURL(file)
    previewUrlRef.current = nextPreview
    setPreviewUrl(nextPreview)
    setSelectedFile(file)
    setAvatarImageError(false)
  }

  const handleAvatarUpload = async () => {
    if (!selectedFile || avatarBusy) return
    setAvatarBusy(true)
    setAvatarError("")
    setAvatarMessage("")
    try {
      const updatedUser = await uploadMyAvatar(selectedFile)
      updateUser(updatedUser)
      setAvatarImageError(false)
      clearSelectedFile()
      setAvatarMessage("Profile picture updated.")
    } catch (error) {
      if (error.updatedUser) {
        updateUser(error.updatedUser)
        setAvatarImageError(false)
        clearSelectedFile()
      }
      setAvatarError(error.message || "Could not upload profile picture.")
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarRemoval = async () => {
    if (!user?.profilePicture || avatarBusy) return
    setAvatarBusy(true)
    setAvatarError("")
    setAvatarMessage("")
    try {
      const updatedUser = await deleteMyAvatar()
      updateUser(updatedUser)
      setAvatarImageError(false)
      clearSelectedFile()
      setAvatarMessage("Profile picture removed.")
    } catch (error) {
      setAvatarError(error.message || "Could not remove profile picture.")
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: "" }))
    setMessage("")
    setErrorMessage("")
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    setMessage("")
    setErrorMessage("")

    try {
      const updatedUser = await updateMyProfile(form)
      updateUser(updatedUser)
      setForm(getProfileValues(updatedUser))
      setMessage("Profile details saved.")
    } catch (error) {
      setFieldErrors(error.fieldErrors || {})
      setErrorMessage(error.message || "Could not save your profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings-card profile-settings">
      <div className="profile-settings-heading">
        <div>
          <p className="settings-eyebrow">Settings</p>
          <h2>Profile</h2>
          <p>Update the name and username shown on your account.</p>
        </div>
      </div>

      <div className="profile-avatar-settings">
        <div className="profile-avatar-preview">
          {((previewUrl || user?.profilePicture) && !avatarImageError) ? (
            <img
              src={previewUrl || user.profilePicture}
              alt="Profile preview"
              onError={() => setAvatarImageError(true)}
            />
          ) : (
            <span>{getInitials(user?.name)}</span>
          )}
        </div>
        <div className="profile-avatar-controls">
          <strong>Profile picture</strong>
          <p>JPG, PNG, or WebP. Maximum file size: 2 MB.</p>
          <input
            ref={fileInputRef}
            className="profile-avatar-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelection}
          />
          <div className="profile-avatar-actions">
            <button
              type="button"
              className="profile-settings-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
            >
              {user?.profilePicture ? "Change photo" : "Upload photo"}
            </button>
            {selectedFile && (
              <>
                <button
                  type="button"
                  className="profile-settings-save"
                  onClick={handleAvatarUpload}
                  disabled={avatarBusy}
                >
                  {avatarBusy ? "Uploading..." : "Save photo"}
                </button>
                <button
                  type="button"
                  className="profile-settings-secondary"
                  onClick={clearSelectedFile}
                  disabled={avatarBusy}
                >
                  Cancel
                </button>
              </>
            )}
            {user?.profilePicture && !selectedFile && (
              <button
                type="button"
                className="profile-settings-secondary"
                onClick={handleAvatarRemoval}
                disabled={avatarBusy}
              >
                {avatarBusy ? "Removing..." : "Remove photo"}
              </button>
            )}
          </div>
          {avatarError && <p className="profile-settings-message error" role="alert">{avatarError}</p>}
          {avatarMessage && <p className="profile-settings-message success" role="status">{avatarMessage}</p>}
        </div>
      </div>

      {message && <p className="profile-settings-message success" role="status">{message}</p>}
      {errorMessage && <p className="profile-settings-message error" role="alert">{errorMessage}</p>}

      <form className="profile-settings-form" onSubmit={handleSubmit} noValidate>
        <label className="profile-settings-field">
          <span>Full name</span>
          <input
            type="text"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            minLength={2}
            maxLength={100}
            autoComplete="name"
            aria-invalid={Boolean(fieldErrors.fullName)}
          />
          {fieldErrors.fullName && <small>{fieldErrors.fullName}</small>}
        </label>

        <label className="profile-settings-field">
          <span>Username</span>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            minLength={3}
            maxLength={30}
            autoComplete="username"
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby="profile-username-help"
          />
          {fieldErrors.username && <small>{fieldErrors.username}</small>}
          <span className="profile-settings-help" id="profile-username-help">
            Optional. Use 3-30 letters, numbers, or underscores.
          </span>
        </label>

        <label className="profile-settings-field">
          <span>Email</span>
          <input type="email" value={user?.email || ""} readOnly />
          <span className="profile-settings-help">Email cannot be changed here.</span>
        </label>

        {fieldErrors.general && <p className="profile-settings-field-error">{fieldErrors.general}</p>}

        <div className="profile-settings-actions">
          <button type="submit" className="profile-settings-save" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  )
}
