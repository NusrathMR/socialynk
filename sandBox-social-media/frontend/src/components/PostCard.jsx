import { Clock3, ExternalLink } from 'lucide-react';
import { getPlatform } from './platforms.js';
import PlatformPostRenderer from './posts/PlatformPostRenderer.jsx';

export default function PostCard({ post }) {
  const platform = getPlatform(post.platform);
  const date = new Date(post.createdAt);
  const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  return <article className="post-card">
    <div className="post-preview-label" style={{ color: platform.color }}><span>{platform.id === 'twitter' ? 'X' : platform.label} preview (simulated)</span></div>
    <PlatformPostRenderer post={post} />
    <footer className="post-footer"><span className="post-date"><Clock3 size={14} />{dateLabel}</span>{post.sourcePostId && <span className="source-id" title={`Source post: ${post.sourcePostId}`}><ExternalLink size={13} /><span>Synced post</span></span>}</footer>
  </article>;
}
