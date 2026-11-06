import { useEffect, useRef, useState } from "react"
import {
  activateBrandMemory,
  createBrandMemory,
  deactivateBrandMemory,
  deleteBrandMemory,
  getBrandMemory,
  updateBrandMemory,
} from "../../api/api.js"
import Sidebar from "../sideBar/sidebar.jsx"
import TopBar from "../topBar/topBar.jsx"
import "./brandMemory.css"

const EMPTY_MEMORY = {
  brandName: "",
  businessDescription: "",
  productsServices: "",
  targetAudience: "",
  toneOfVoice: "",
  favoriteHashtags: "",
  keywords: "",
  brandRules: "",
}

const FIELD_LIMITS = {
  brandName: 100,
  businessDescription: 300,
  productsServices: 250,
  targetAudience: 200,
  toneOfVoice: 20,
  favoriteHashtags: 100,
  keywords: 100,
  brandRules: 250,
}

const MAX_TOTAL_LENGTH = 1000

function toFormValues(memory) {
  return Object.keys(EMPTY_MEMORY).reduce((values, field) => {
    values[field] = typeof memory?.[field] === "string" ? memory[field] : ""
    return values
  }, {})
}

function BrandMemoryPage() {
  const savingRef = useRef(false)
  const [form, setForm] = useState(EMPTY_MEMORY)
  const [memories, setMemories] = useState([])
  const [activeMemory, setActiveMemory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingMemoryId, setEditingMemoryId] = useState(null)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    getBrandMemory()
      .then((result) => {
        if (!active) return
        setMemories(result.memories)
        setActiveMemory(result.activeMemory)
        setLoadFailed(false)
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(error.message)
          setLoadFailed(true)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const characterCount = Object.values(form).reduce((total, value) => total + value.length, 0)

  const handleChange = (event) => {
    const { name, value } = event.target
    const otherCharacters = Object.entries(form).reduce(
      (total, [field, fieldValue]) => total + (field === name ? 0 : fieldValue.length),
      0
    )
    const fieldLimit = Math.min(FIELD_LIMITS[name], MAX_TOTAL_LENGTH - otherCharacters)

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value.slice(0, Math.max(0, fieldLimit)),
    }))
    setFieldErrors((currentErrors) => ({ ...currentErrors, [name]: "" }))
    setErrorMessage("")
    setMessage("")
  }

  const handleCreate = () => {
    setEditingMemoryId(null)
    setForm(EMPTY_MEMORY)
    setFieldErrors({})
    setErrorMessage("")
    setMessage("")
    setEditing(true)
  }

  const handleEdit = (selectedMemory) => {
    setEditingMemoryId(selectedMemory.id)
    setForm(toFormValues(selectedMemory))
    setFieldErrors({})
    setErrorMessage("")
    setMessage("")
    setEditing(true)
  }

  const handleCancel = () => {
    setForm(EMPTY_MEMORY)
    setFieldErrors({})
    setErrorMessage("")
    setMessage("")
    setEditing(false)
    setEditingMemoryId(null)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (savingRef.current) return

    savingRef.current = true
    setSaving(true)
    setErrorMessage("")
    setMessage("")
    setFieldErrors({})

    try {
      const savedMemory = editingMemoryId
        ? await updateBrandMemory(editingMemoryId, form)
        : await createBrandMemory(form)
      setMemories((currentMemories) => editingMemoryId
        ? currentMemories.map((item) => item.id === savedMemory.id ? savedMemory : item)
        : [savedMemory, ...currentMemories])
      setActiveMemory((currentActive) => currentActive?.id === savedMemory.id
        ? savedMemory
        : currentActive)
      setEditing(false)
      setEditingMemoryId(null)
      setMessage("Brand Memory saved successfully.")
    } catch (error) {
      setErrorMessage(error.message)
      setFieldErrors(error.fieldErrors || {})
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async (selectedMemory) => {
    if (!window.confirm(`Delete "${selectedMemory.brandName}"? This cannot be undone.`)) return

    setDeleting(true)
    setErrorMessage("")
    setMessage("")

    try {
      await deleteBrandMemory(selectedMemory.id)
      setMemories((currentMemories) => currentMemories.filter((item) => item.id !== selectedMemory.id))
      setActiveMemory((currentActive) => currentActive?.id === selectedMemory.id ? null : currentActive)
      setMessage(selectedMemory.id === activeMemory?.id
        ? "Brand Memory deleted. The active memory has been turned off."
        : "Brand Memory deleted.")
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleActivate = async (selectedMemory) => {
    setErrorMessage("")
    setMessage("")

    try {
      const updatedActiveMemory = await activateBrandMemory(selectedMemory.id)
      setActiveMemory(updatedActiveMemory)
      setMessage(`Using ${updatedActiveMemory.brandName} memory.`)
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const handleDeactivate = async () => {
    setErrorMessage("")
    setMessage("")

    try {
      await deactivateBrandMemory()
      setActiveMemory(null)
      setMessage("Brand Memory is off.")
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const renderFieldError = (field) => (
    fieldErrors[field] ? <small className="bm-field-error">{fieldErrors[field]}</small> : null
  )

  return (
    <div className="db-layout bm-layout">
      <Sidebar />
      <div className="bm-page">
        <TopBar
          title="Brand Memory"
          subtitle="Save your brand details once. Let Socialynk use them to create content that matches your brand."
        />

        <main className="bm-main">
          {message && <p className="bm-feedback bm-success" role="status">{message}</p>}
          {errorMessage && (
            <p className="bm-feedback bm-error" role="alert">
              {errorMessage}
              {fieldErrors.general && ` ${fieldErrors.general}`}
            </p>
          )}

          {loading ? (
            <div className="bm-card bm-loading" role="status">Loading Brand Memory...</div>
          ) : loadFailed ? (
            <section className="bm-card bm-empty">
              <h2>Could not load Brand Memories</h2>
              <p>Check your connection and try again.</p>
              <button type="button" className="bm-button bm-button-dark" onClick={() => {
                setLoading(true)
                setReloadKey((key) => key + 1)
              }}>
                Try again
              </button>
            </section>
          ) : editing ? (
            <section className="bm-card">
              <div className="bm-card-heading">
                <h2>{editingMemoryId ? "Edit Brand Memory" : "Create Brand Memory"}</h2>
                <p>Add the details you want Socialynk to remember about your brand.</p>
              </div>

              <form className="bm-form" onSubmit={handleSave}>
                <label className="bm-field">
                  <span>Brand Name <b>*</b></span>
                  <input
                    name="brandName"
                    value={form.brandName}
                    onChange={handleChange}
                    maxLength={FIELD_LIMITS.brandName}
                    required
                    aria-invalid={Boolean(fieldErrors.brandName)}
                  />
                  {renderFieldError("brandName")}
                </label>

                <label className="bm-field">
                  <span>Business Description <b>*</b></span>
                  <textarea
                    name="businessDescription"
                    value={form.businessDescription}
                    onChange={handleChange}
                    maxLength={FIELD_LIMITS.businessDescription}
                    rows="3"
                    required
                    aria-invalid={Boolean(fieldErrors.businessDescription)}
                  />
                  {renderFieldError("businessDescription")}
                </label>

                <label className="bm-field">
                  <span>Products and Services</span>
                  <textarea
                    name="productsServices"
                    value={form.productsServices}
                    onChange={handleChange}
                    maxLength={FIELD_LIMITS.productsServices}
                    rows="3"
                    aria-invalid={Boolean(fieldErrors.productsServices)}
                  />
                  {renderFieldError("productsServices")}
                </label>

                <label className="bm-field">
                  <span>Target Audience</span>
                  <textarea
                    name="targetAudience"
                    value={form.targetAudience}
                    onChange={handleChange}
                    maxLength={FIELD_LIMITS.targetAudience}
                    rows="3"
                    aria-invalid={Boolean(fieldErrors.targetAudience)}
                  />
                  {renderFieldError("targetAudience")}
                </label>

                <label className="bm-field">
                  <span>Brand Tone of Voice</span>
                  <select
                    name="toneOfVoice"
                    value={form.toneOfVoice}
                    onChange={handleChange}
                    aria-invalid={Boolean(fieldErrors.toneOfVoice)}
                  >
                    <option value="">Select a tone</option>
                    <option value="Professional">Professional</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Casual">Casual</option>
                    <option value="Funny">Funny</option>
                    <option value="Inspirational">Inspirational</option>
                    <option value="Creative">Creative</option>
                  </select>
                  {renderFieldError("toneOfVoice")}
                </label>

                <label className="bm-field">
                  <span>Favorite Hashtags</span>
                  <input
                    name="favoriteHashtags"
                    value={form.favoriteHashtags}
                    onChange={handleChange}
                    maxLength={FIELD_LIMITS.favoriteHashtags}
                    aria-invalid={Boolean(fieldErrors.favoriteHashtags)}
                  />
                  {renderFieldError("favoriteHashtags")}
                </label>

                <label className="bm-field">
                  <span>Keywords</span>
                  <input
                    name="keywords"
                    value={form.keywords}
                    onChange={handleChange}
                    maxLength={FIELD_LIMITS.keywords}
                    aria-invalid={Boolean(fieldErrors.keywords)}
                  />
                  {renderFieldError("keywords")}
                </label>

                <label className="bm-field">
                  <span>Brand Rules</span>
                  <textarea
                    name="brandRules"
                    value={form.brandRules}
                    onChange={handleChange}
                    maxLength={FIELD_LIMITS.brandRules}
                    rows="4"
                    aria-invalid={Boolean(fieldErrors.brandRules)}
                  />
                  {renderFieldError("brandRules")}
                  <small>For example: use a friendly tone and avoid complicated language.</small>
                </label>

                <div className="bm-form-footer">
                  <span className="bm-character-count">{characterCount} / {MAX_TOTAL_LENGTH} characters</span>
                  <div className="bm-actions">
                    <button type="button" className="bm-button bm-button-light" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="bm-button bm-button-dark" disabled={saving}>
                      {saving ? "Saving..." : "Save Brand Memory"}
                    </button>
                  </div>
                </div>
              </form>

              <p className="bm-privacy">
                Only save business or brand information here. Do not enter passwords, payment details, or sensitive personal information.
              </p>
            </section>
          ) : memories.length > 0 ? (
            <section className="bm-memory-section">
              <div className="bm-list-heading">
                <div>
                  <h2>Your Brand Memories</h2>
                  <p>Choose which brand context Socialynk should use when creating content.</p>
                </div>
                <button type="button" className="bm-button bm-button-dark" onClick={handleCreate}>
                  + Add New Memory
                </button>
              </div>

              <div className="bm-active-summary">
                <span>
                  {activeMemory
                    ? <>Using: <strong>{activeMemory.brandName}</strong></>
                    : "Memory is off"}
                </span>
                {activeMemory && (
                  <button type="button" className="bm-button bm-button-light" onClick={handleDeactivate}>
                    Turn Memory Off
                  </button>
                )}
              </div>

              <div className="bm-memory-grid">
                {memories.map((item) => (
                  <article className={item.id === activeMemory?.id ? "bm-memory-card active" : "bm-memory-card"} key={item.id}>
                    <div className="bm-memory-card-heading">
                      <div>
                        <h3>{item.brandName}</h3>
                        <p>{item.businessDescription}</p>
                      </div>
                      {item.id === activeMemory?.id && <span className="bm-active-chip">Active Memory</span>}
                    </div>
                    <dl className="bm-memory-details">
                      {[
                        ["Products and Services", item.productsServices],
                        ["Target Audience", item.targetAudience],
                        ["Brand Tone", item.toneOfVoice],
                      ].filter(([, value]) => value).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="bm-memory-actions">
                      {item.id !== activeMemory?.id && (
                        <button
                          type="button"
                          className="bm-button bm-button-dark"
                          onClick={() => handleActivate(item)}
                        >
                          Switch to This Memory
                        </button>
                      )}
                      <button type="button" className="bm-button bm-button-light" onClick={() => handleEdit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="bm-button bm-button-danger"
                        onClick={() => handleDelete(item)}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="bm-card bm-empty">
              <div className="bm-empty-mark" aria-hidden="true">✦</div>
              <h2>No Brand Memory Yet</h2>
              <p>Add your business details to help AI generate more personalized content.</p>
              <button type="button" className="bm-button bm-button-dark" onClick={handleCreate}>
                Create Brand Memory
              </button>
              <button type="button" className="bm-button bm-button-light" onClick={handleDeactivate}>
                Memory Off
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default BrandMemoryPage
