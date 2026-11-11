import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api, { updateAdminUserStatus } from "../../api/api.js"
import { useAuth } from "../AuthContext/authContext.jsx"
import "./adminPage.css"

const rowsPerPage = 10

function formatDate(value) {
  if (!value) return "Never"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?"
}

function getErrorMessage(error, fallback) {
  const responseMessage = error?.response?.data?.message
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage
  }
  return error?.message || fallback
}

export default function ManageUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [busyId, setBusyId] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().slice(0, 100))
    }, 350)

    return () => clearTimeout(timeout)
  }, [searchTerm])

  useEffect(() => {
    const controller = new AbortController()
    const params = { page, limit: rowsPerPage }

    if (debouncedSearch) params.search = debouncedSearch
    if (roleFilter !== "all") params.role = roleFilter
    if (planFilter !== "all") params.plan = planFilter
    if (statusFilter !== "all") params.status = statusFilter

    const loadUsers = async () => {
      try {
        const response = await api.get("/admin/users", {
          params,
          signal: controller.signal,
        })
        const data = response.data

        if (!Array.isArray(data.users)) {
          throw new Error("The server returned an invalid user list.")
        }

        setUsers(data.users)
        setTotal(data.total)
        setTotalUsers(data.totalUsers)
        setTotalPages(Math.max(1, data.totalPages))

        if (data.page !== page) setPage(data.page)
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error, "Unable to load users."))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    const requestTimeout = setTimeout(() => {
      if (controller.signal.aborted) return
      setRefreshing(true)
      setLoadError("")
      loadUsers()
    }, 0)

    return () => {
      clearTimeout(requestTimeout)
      controller.abort()
    }
  }, [debouncedSearch, roleFilter, planFilter, statusFilter, page, reloadKey])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(timeout)
  }, [notice])

  const currentUserId = user?._id || user?.email

  const changeUserRole = async (userId, nextRole) => {
    const target = users.find((person) => person._id === userId)
    const isSelf = target && (target.email === user?.email || target._id === user?._id)

    if (!target || isSelf || busyId) return
    if (!window.confirm(`Change ${target.name}'s role to ${nextRole}?`)) return

    setBusyId(userId)
    try {
      const response = await api.patch(`/admin/users/${encodeURIComponent(userId)}/role`, {
        role: nextRole,
      })
      const updatedUser = response.data.user

      if (!updatedUser?._id) {
        throw new Error("The server did not return the updated user.")
      }

      setUsers((current) =>
        current.map((person) => person._id === userId ? updatedUser : person),
      )
      setNotice({ type: "success", message: `${target.name}'s role was updated.` })
      setReloadKey((value) => value + 1)
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Unable to update this user's role."),
      })
    } finally {
      setBusyId("")
    }
  }

  const toggleUserState = async (userId) => {
    const target = users.find((person) => person._id === userId)
    const isSelf = target && (target.email === user?.email || target._id === user?._id)

    if (!target || isSelf || busyId) return
    const actionText = target.isActive ? "deactivate" : "activate"
    const confirmation = target.isActive ? "Deactivate" : "Activate"
    if (!window.confirm(`${confirmation} ${target.name}?`)) return

    setBusyId(userId)
    try {
      const updatedUser = await updateAdminUserStatus(userId, !target.isActive)

      if (!updatedUser?._id) {
        throw new Error("The server did not return the updated user.")
      }

      setUsers((current) =>
        current.map((person) => person._id === userId ? updatedUser : person),
      )
      setNotice({ type: "success", message: `User ${actionText}d.` })
      setReloadKey((value) => value + 1)
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, `Unable to ${actionText} this user.`),
      })
    } finally {
      setBusyId("")
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setRoleFilter("all")
    setPlanFilter("all")
    setStatusFilter("all")
    setPage(1)
  }

  const changeSearch = (value) => {
    setSearchTerm(value)
    setPage(1)
  }

  const changeRoleFilter = (value) => {
    setRoleFilter(value)
    setPage(1)
  }

  const changePlanFilter = (value) => {
    setPlanFilter(value)
    setPage(1)
  }

  const changeStatusFilter = (value) => {
    setStatusFilter(value)
    setPage(1)
  }

  return (
    <div className="ad-page">
      {notice && (
        <div className={`ad-message-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          {notice.message}
        </div>
      )}

      {loadError && (
        <div className="ad-load-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="ad-btn ad-btn-light"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={refreshing}
          >
            Try again
          </button>
        </div>
      )}

      <div className="ad-toolbar">
        <label className="ad-search-field">
          <span>Search by email</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Search email"
            maxLength={100}
          />
        </label>

        <label className="ad-filter-field">
          <span>Role</span>
          <select value={roleFilter} onChange={(event) => changeRoleFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <label className="ad-filter-field">
          <span>Plan</span>
          <select value={planFilter} onChange={(event) => changePlanFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
        </label>

        <label className="ad-filter-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => changeStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <button type="button" className="ad-btn ad-btn-light" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      <div className="ad-results-header" aria-live="polite">
        <span>
          Showing {users.length} of {total} matching users ({totalUsers} total)
          {refreshing && " · Refreshing..."}
        </span>
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Email</th>
              <th>Last login</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="ad-empty-row">Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="8" className="ad-empty-row">
                  {loadError ? "Users could not be loaded." : "No users found."}
                </td>
              </tr>
            ) : (
              users.map((person) => {
                const isSelf = person.email === user?.email || person._id === currentUserId
                const isActive = person.isActive
                const isBusy = busyId === person._id

                return (
                  <tr key={person._id}>
                    <td>
                      <div className="ad-user-cell">
                        <div className="ad-avatar">{getInitials(person.name)}</div>
                        <div>
                          <div className="ad-user-name-row">
                            <strong>{person.name}</strong>
                            {isSelf && <span className="ad-you-tag">You</span>}
                          </div>
                          <span className="ad-user-email">{person.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <select
                        className="ad-role-select"
                        value={person.role}
                        onChange={(event) => changeUserRole(person._id, event.target.value)}
                        disabled={isSelf || Boolean(busyId)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    <td>
                      <span className="ad-badge ad-badge-plan">{person.plan}</span>
                    </td>

                    <td>
                      <span className={isActive ? "ad-badge ad-badge-status active" : "ad-badge ad-badge-status inactive"}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <span className={person.isEmailVerified ? "ad-badge ad-badge-verified" : "ad-badge ad-badge-unverified"}>
                        {person.isEmailVerified ? "Verified" : "Unverified"}
                      </span>
                    </td>

                    <td>{formatDate(person.lastLoginAt)}</td>
                    <td>{formatDate(person.createdAt)}</td>

                    <td>
                      <div className="ad-row-actions">
                        <Link
                          className="ad-action-button ad-view-action"
                          to={`/admin/users/${encodeURIComponent(person._id)}`}
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          className="ad-action-button"
                          onClick={() => toggleUserState(person._id)}
                          disabled={isSelf || Boolean(busyId)}
                        >
                          {isBusy ? "Saving..." : isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="ad-pagination">
        <button
          type="button"
          className="ad-btn ad-btn-light"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={page <= 1 || refreshing}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          type="button"
          className="ad-btn ad-btn-light"
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          disabled={page >= totalPages || refreshing}
        >
          Next
        </button>
      </div>
    </div>
  )
}
