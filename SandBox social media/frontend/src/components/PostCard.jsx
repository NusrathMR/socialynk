import { Clock3, ExternalLink } from 'lucide-react';
import { getPlatform } from './platforms.js';

export default function PostCard({ post }) {
  const platform = getPlatform(post.platform);
  const Icon = platform.Icon;
  const date = new Date(post.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);

  return (
    <article className="post-card">
      <div className="post-header">
        <div className="post-platform-mark" style={{ color: platform.color, backgroundColor: `${platform.color}12` }}>
          {Icon ? <Icon size={19} strokeWidth={2.1} /> : <span className="x-brand">𝕏</span>}
        </div>
        <div className="post-meta">
          <span className="post-platform-name">{platform.label}</span>
          <span className="post-author">{post.authorName}</span>
        </div>
        <span className="post-badge" style={{ color: platform.color, backgroundColor: `${platform.color}12` }}>
          {platform.id === 'twitter' ? 'X' : platform.label}
        </span>
      </div>
      <p className="post-text">{post.text}</p>
      <footer className="post-footer">
        <span className="post-date"><Clock3 size={14} />{dateLabel}</span>
        {post.sourcePostId && (
          <span className="source-id" title={`Source post: ${post.sourcePostId}`}>
            <ExternalLink size={13} />
            <span>Synced post</span>
          </span>
        )}
      </footer>
    </article>
  );
}
