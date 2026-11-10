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
        <label className="top-bar-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search anything..."
            value={searchValue}
            onChange={onSearchChange
              ? (event) => onSearchChange(event.target.value)
              : undefined}
          />
          {searchShortcut && <kbd>{searchShortcut}</kbd>}
        </label>
        <button type="button" className="top-bar-bell" aria-label="Notifications">
          🔔
        </button>

        <ProfileMenu direction="down" align="right" />
        
      </div>
    </header>
  );
}

export default TopBar;
