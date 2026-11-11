import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { getAdminUserById, updateAdminUser, updateAdminUserStatus } from "../../../api/api.js"
import { useAuth } from "../../AuthContext/authContext.jsx"
import getInitials from "../../../utils/getInitials.js"
import "./userDetails.css"

const EMPTY_ACTIVITY = {
  total: 0,
  drafts: 0,
  scheduled: 0,
  sent: 0,
  failed: 0,
  recentPosts: [],
}

function formatDate(value) {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not available"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not available"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback
}

export default function UserDetails() {
  const { id } = useParams()
  const { user: currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [activity, setActivity] = useState(EMPTY_ACTIVITY)
  const [loadedId, setLoadedId] = useState("")
  const [loadError, setLoadError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    let active = true

    getAdminUserById(id)
      .then((data) => {
        if (active) {
          setUser(data.user)
          setActivity({ ...EMPTY_ACTIVITY, ...data.activity })
          setImageError(false)
          setLoadError("")
          setLoadedId(id)
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(getErrorMessage(error, "Unable to load user details."))
          setLoadedId(id)
        }
      })

    return () => {
      active = false
    }
  }, [id, reloadKey])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timeout)
  }, [notice])

  const isSelf = Boolean(
    user &&
    ((currentUser?._id && String(currentUser._id) === String(user._id)) ||
      (currentUser?.email && currentUser.email.toLowerCase() === user.email.toLowerCase()))
  )

  const beginEditing = () => {
    setForm({
      fullname: user.fullname || "",
      email: user.email || "",
      profilePicture: user.profilePicture || "",
      role: user.role,
      plan: user.plan,
      isEmailVerified: user.isEmailVerified,
    })
    setFieldErrors({})
    setNotice(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setForm(null)
    setFieldErrors({})
  }

  const changeField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: name === "isEmailVerified" ? value === "true" : value,
    }))
    setFieldErrors((current) => ({ ...current, [name]: "" }))
  }

  const saveDetails = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    setNotice(null)

    try {
      await updateAdminUser(id, form)
      setEditing(false)
      setForm(null)
      setNotice({ type: "success", message: "User details were saved." })
      setReloadKey((value) => value + 1)
    } catch (error) {
      setFieldErrors(error.fieldErrors || {})
      setNotice({ type: "error", message: getErrorMessage(error, "Unable to save user details.") })
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async () => {
    const nextActive = !user.isActive
    const action = nextActive ? "Activate" : "Deactivate"
    const explanation = nextActive
      ? "This will allow the user to log in and use the API again."
      : "This will prevent the user from logging in or using protected API features."
    if (!window.confirm(`${action} ${user.fullname || user.email}?\n\n${explanation}`)) return

    setStatusBusy(true)
    setNotice(null)
    try {
      await updateAdminUserStatus(id, nextActive)
      setNotice({
        type: "success",
        message: `User account ${nextActive ? "activated" : "deactivated"}.`,
      })
      setReloadKey((value) => value + 1)
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "Unable to update user status.") })
    } finally {
      setStatusBusy(false)
    }
  }

  const renderFieldError = (name) =>
    fieldErrors[name] ? <span className="ud-field-error">{fieldErrors[name]}</span> : null

  if (loadedId !== id) {
    return <div className="ud-page" role="status">Loading user details...</div>
  }

  if (loadError || !user) {
    return (
      <div className="ud-page">
        <Link className="ud-back-link" to="/admin/users">← Back to Manage Users</Link>
        <div className="ud-message ud-message-error" role="alert">
          <span>{loadError || "User details are unavailable."}</span>
          <button type="button" className="ud-button ud-button-dark" onClick={() => setReloadKey((value) => value + 1)}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const displayName = user.fullname?.trim() || user.email.split("@")[0]
  const avatarInitials = getInitials(displayName)

  return (
    <div className="ud-page">
      {notice && (
        <div className={`ud-message ud-message-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          {notice.message}
        </div>
      )}

      <Link className="ud-back-link" to="/admin/users">← Back to Manage Users</Link>

      <section className="ud-card ud-user-header">
        <div className="ud-avatar">
          {user.profilePicture && !imageError ? (
            <img src={user.profilePicture} alt="" onError={() => setImageError(true)} />
          ) : (
            <span>{avatarInitials}</span>
          )}
        </div>
        <div className="ud-header-copy">
          <p className="ud-eyebrow">User account</p>
          <h1>{displayName}</h1>
          <p className="ud-email">{user.email}</p>
          <div className="ud-badges">
            <span className="ud-badge">{user.role}</span>
            <span className="ud-badge">{user.plan}</span>
            <span className={`ud-badge ${user.isActive ? "is-active" : "is-inactive"}`}>
              {user.isActive ? "Active" : "Inactive"}
            </span>
            <span className={`ud-badge ${user.isEmailVerified ? "is-active" : "is-unverified"}`}>
              {user.isEmailVerified ? "Email verified" : "Email unverified"}
            </span>
          </div>
        </div>
      </section>

      <section className="ud-card">
        <div className="ud-card-heading">
          <div>
            <p className="ud-eyebrow">Account information</p>
            <h2>Details</h2>
          </div>
          {!editing && (
            <button type="button" className="ud-button ud-button-dark" onClick={beginEditing}>
              Edit details
            </button>
          )}
        </div>

        {editing ? (
          <form className="ud-form" onSubmit={saveDetails} noValidate>
            <label className="ud-form-field">
              <span>Name</span>
              <input name="fullname" value={form.fullname} onChange={changeField} maxLength={100} />
              {renderFieldError("fullname")}
            </label>
            <label className="ud-form-field">
              <span>Email</span>
              <input name="email" type="email" value={form.email} onChange={changeField} maxLength={254} />
              {renderFieldError("email")}
            </label>
            <label className="ud-form-field">
              <span>Profile picture URL</span>
              <input name="profilePicture" type="url" value={form.profilePicture} onChange={changeField} maxLength={2048} />
              {renderFieldError("profilePicture")}
            </label>
            <label className="ud-form-field">
              <span>Role</span>
              <select name="role" value={form.role} onChange={changeField}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {renderFieldError("role")}
            </label>
            <label className="ud-form-field">
              <span>Plan</span>
              <select name="plan" value={form.plan} onChange={changeField}>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
              {renderFieldError("plan")}
            </label>
            <label className="ud-form-field">
              <span>Email verification</span>
              <select name="isEmailVerified" value={String(form.isEmailVerified)} onChange={changeField}>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
              {renderFieldError("isEmailVerified")}
            </label>
            {fieldErrors.general && <p className="ud-field-error ud-form-wide">{fieldErrors.general}</p>}
            <div className="ud-form-actions ud-form-wide">
              <button type="submit" className="ud-button ud-button-dark" disabled={saving}>
                {saving ? "Saving..." : "Save details"}
              </button>
              <button type="button" className="ud-button ud-button-light" onClick={cancelEditing} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="ud-details-grid">
            <div><dt>Name</dt><dd>{user.fullname || "Not provided"}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Role</dt><dd>{user.role}</dd></div>
            <div><dt>Plan</dt><dd>{user.plan}</dd></div>
            <div><dt>Email verified</dt><dd>{user.isEmailVerified ? "Yes" : "No"}</dd></div>
            <div><dt>Joined</dt><dd>{formatDate(user.createdAt)}</dd></div>
            <div><dt>Last login</dt><dd>{formatDateTime(user.lastLoginAt)}</dd></div>
          </dl>
        )}
      </section>

      <section className="ud-card">
        <div className="ud-card-heading">
          <div>
            <p className="ud-eyebrow">Posts created by this user</p>
            <h2>Activity</h2>
          </div>
        </div>
        <div className="ud-stats-grid">
          <div><span>Total posts</span><strong>{activity.total}</strong></div>
          <div><span>Drafts</span><strong>{activity.drafts}</strong></div>
          <div><span>Scheduled</span><strong>{activity.scheduled}</strong></div>
          <div><span>Sent</span><strong>{activity.sent}</strong></div>
          <div><span>Failed</span><strong>{activity.failed}</strong></div>
        </div>
        <div className="ud-recent-posts">
          <h3>Recent posts</h3>
          {activity.recentPosts.length === 0 ? (
            <p className="ud-empty">No posts found for this user.</p>
          ) : (
            <ul>
              {activity.recentPosts.map((post) => (
                <li key={post.id}>
                  <p>{post.caption || "No caption"}</p>
                  <div>
                    <span className="ud-post-status">{post.status}</span>
                    <time>{formatDateTime(post.date)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="ud-card ud-danger-zone">
        <div>
          <p className="ud-eyebrow">Account access</p>
          <h2>Danger zone</h2>
          <p>
            {user.isActive
              ? "Deactivating prevents this user from logging in or using protected API features."
              : "Activating allows this user to log in and use protected API features again."}
          </p>
          {isSelf && <span className="ud-self-note">You cannot change your own account status.</span>}
        </div>
        <button
          type="button"
          className={`ud-button ${user.isActive ? "ud-button-danger" : "ud-button-dark"}`}
          onClick={changeStatus}
          disabled={isSelf || statusBusy}
        >
          {statusBusy ? "Updating..." : user.isActive ? "Deactivate user" : "Activate user"}
        </button>
      </section>
    </div>
  )
}
