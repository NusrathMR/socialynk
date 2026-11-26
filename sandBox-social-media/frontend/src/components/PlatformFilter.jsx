import { useNavigate, useParams } from 'react-router-dom';
import { platforms } from './platforms.js';

export default function PlatformFilter() {
  const navigate = useNavigate();
  const { platform } = useParams();
  const selected = platform || 'all';

  return (
    <div className="filter-tabs" role="tablist" aria-label="Filter posts by platform">
      {platforms.map((item) => {
        const active = selected === item.id;
        return (
          <button
            className={`filter-tab${active ? ' active' : ''}`}
            key={item.id}
            onClick={() => navigate(item.id === 'all' ? '/feed' : `/feed/${item.id}`)}
            role="tab"
            aria-selected={active}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
