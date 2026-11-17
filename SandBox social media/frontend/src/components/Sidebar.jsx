import { useNavigate, useParams } from 'react-router-dom';
import { House } from 'lucide-react';
import { getPlatform, platforms } from './platforms.js';

export default function Sidebar() {
  const navigate = useNavigate();
  const { platform } = useParams();
  const selected = platform || 'all';

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <p className="sidebar-heading">MENU</p>
        <button
          className={`sidebar-link${selected === 'all' ? ' active' : ''}`}
          onClick={() => navigate('/feed')}
        >
          <House size={18} />
          <span>Home</span>
        </button>
      </div>
      <div className="sidebar-section platform-menu">
        <p className="sidebar-heading">PLATFORMS</p>
        {platforms.filter((item) => item.id !== 'all').map((item) => {
          const Icon = getPlatform(item.id).Icon;
          return (
            <button
              className={`sidebar-link${selected === item.id ? ' active' : ''}`}
              key={item.id}
              onClick={() => navigate(`/feed/${item.id}`)}
            >
              <span className="platform-icon" style={{ color: item.color }}>
                {Icon ? <Icon size={18} strokeWidth={2} /> : <span className="x-brand">𝕏</span>}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="sidebar-note">
        <span className="note-dot" />
        <div>
          <strong>Sandbox mode</strong>
          <p>Posts are simulated, not published to social networks.</p>
        </div>
      </div>
    </aside>
  );
}
