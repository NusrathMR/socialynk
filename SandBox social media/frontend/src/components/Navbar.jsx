import { useLocation, useNavigate } from 'react-router-dom';
import { House, RefreshCw, Search, Sparkles } from 'lucide-react';

export default function Navbar({ search, onSearchChange, onRefresh }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate('/')} aria-label="Sandbox Social home">
        <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
        <span className="brand-name">sandbox<span>social</span></span>
      </button>

      <label className="search-box">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search posts or people..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search posts or people"
        />
        <kbd>⌘ K</kbd>
      </label>

      <nav className="topbar-actions" aria-label="Main navigation">
        <button
          className={`icon-button home-action${location.pathname === '/' ? ' selected' : ''}`}
          onClick={() => navigate('/')}
          aria-label="Home"
          title="Home"
        >
          <House size={19} />
        </button>
        <button
          className="refresh-button"
          onClick={onRefresh}
          aria-label="Refresh feed"
          title="Refresh feed"
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </nav>
    </header>
  );
}
