import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchWorkspace } from "../../api/api.js";
import "./topBar.css";
import ProfileMenu from "../profileMenu/profileMenu.jsx"

function TopBar({
  title,
  subtitle,
  titleIcon,
  searchShortcut,
  searchValue,
  onSearchChange,
}) {
  const navigate = useNavigate()
  const searchRef = useRef(null)
  const [internalValue, setInternalValue] = useState(searchValue || "")
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [submittedSearch, setSubmittedSearch] = useState({ query: "", serial: 0 })
  const value = typeof searchValue === "string" ? searchValue : internalValue

  useEffect(() => {
    const query = value.trim()
    if (!query) return undefined

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      if (controller.signal.aborted) return
      setIsLoading(true)
      try {
        const searchResults = await searchWorkspace(query, controller.signal)
        if (!controller.signal.aborted) setResults(searchResults)
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error.message || "Search is unavailable. Please try again.")
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, submittedSearch.query === query ? 0 : 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [value, submittedSearch.serial, submittedSearch.query])

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!searchRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsideClick)
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick)
  }, [])

  const groupedResults = results.reduce((groups, result) => {
    if (!groups[result.category]) groups[result.category] = []
    groups[result.category].push(result)
    return groups
  }, {})
  const flatResults = Object.values(groupedResults).flat()

  function updateSearch(nextValue) {
    setInternalValue(nextValue)
    setIsOpen(Boolean(nextValue.trim()))
    setActiveIndex(-1)
    setResults([])
    setIsLoading(Boolean(nextValue.trim()))
    setErrorMessage("")
    if (onSearchChange) onSearchChange(nextValue)
  }

  function submitSearch() {
    const query = value.trim()
    if (!query) return
    setIsOpen(true)
    setSubmittedSearch((current) => ({
      query,
      serial: current.serial + 1,
    }))
  }

  function selectResult(result) {
    updateSearch("")
    setIsOpen(false)
    navigate(result.navigation)
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      setIsOpen(false)
      setActiveIndex(-1)
    } else if (event.key === "ArrowDown" && flatResults.length) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index + 1) % flatResults.length)
    } else if (event.key === "ArrowUp" && flatResults.length) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => index <= 0 ? flatResults.length - 1 : index - 1)
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (isOpen && activeIndex >= 0 && flatResults[activeIndex]) {
        selectResult(flatResults[activeIndex])
      } else {
        submitSearch()
      }
    }
  }

  let resultIndex = 0

  return (
    <header className="top-bar">
      <div className="top-bar-heading">
        {titleIcon && <span className="top-bar-title-icon">{titleIcon}</span>}
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="top-bar-actions">
        <div className="top-bar-search-wrap" ref={searchRef}>
          <div className="top-bar-search">
            <button
              type="button"
              className="top-bar-search-submit"
              aria-label="Search"
              onClick={submitSearch}
            >
              ⌕
            </button>
            <input
              type="search"
              placeholder="Search anything..."
              value={value}
              onChange={(event) => updateSearch(event.target.value)}
              onFocus={() => {
                if (value.trim()) setIsOpen(true)
              }}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-label="Search your workspace"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls="top-bar-search-results"
              aria-activedescendant={activeIndex >= 0 ? `top-bar-search-option-${activeIndex}` : undefined}
            />
            {value && (
              <button
                type="button"
                className="top-bar-search-clear"
                aria-label="Clear search"
                onClick={() => updateSearch("")}
              >
                ×
              </button>
            )}
            {searchShortcut && <kbd>{searchShortcut}</kbd>}
          </div>

          {isOpen && value.trim() && (
            <div className="top-bar-search-results" id="top-bar-search-results" role="listbox" aria-label="Search results" aria-busy={isLoading}>
              {isLoading ? (
                <p className="top-bar-search-message" role="status">
                  <span className="top-bar-search-spinner" aria-hidden="true" />
                  Searching...
                </p>
              ) : errorMessage ? (
                <p className="top-bar-search-message top-bar-search-error" role="alert">{errorMessage}</p>
              ) : flatResults.length === 0 ? (
                <p className="top-bar-search-message" role="status">No results found.</p>
              ) : (
                Object.entries(groupedResults).map(([category, items]) => (
                  <section className="top-bar-search-group" key={category}>
                    <h2>{category}</h2>
                    {items.map((result) => {
                      const index = resultIndex
                      resultIndex += 1
                      return (
                        <button
                          type="button"
                          role="option"
                          id={`top-bar-search-option-${index}`}
                          aria-selected={activeIndex === index}
                          className="top-bar-search-result"
                          key={`${result.category}-${result.id}`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectResult(result)}
                        >
                          <strong>{result.title}</strong>
                          <span>{result.preview}</span>
                        </button>
                      )
                    })}
                  </section>
                ))
              )}
            </div>
          )}
        </div>
        <button type="button" className="top-bar-bell" aria-label="Notifications">
          🔔
        </button>

        <ProfileMenu direction="down" align="right" />
        
      </div>
    </header>
  );
}

export default TopBar;
