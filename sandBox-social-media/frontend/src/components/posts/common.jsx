import { useState } from 'react';
import { MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Repeat2, Eye, ThumbsUp } from 'lucide-react';
import MediaRenderer from './MediaRenderer.jsx';

export function Avatar({ post, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const label = post.displayName || post.authorName || 'Creator';
  return <span className="preview-avatar" style={{ width: size, height: size }}>{post.profileImageUrl && !failed ? <img src={post.profileImageUrl} alt="" onError={() => setFailed(true)} /> : label.slice(0, 1).toUpperCase()}</span>;
}

export function Header({ post, subtitle, verified = false }) {
  return <header className="preview-header"><Avatar post={post} /><div className="preview-author"><strong>{post.displayName || post.authorName || 'Creator'}{verified && post.verified && <span className="verified-mark" aria-label="Verified">verified</span>}</strong>{subtitle && <span>{subtitle}</span>}</div><MoreHorizontal size={21} aria-label="More options" /></header>;
}

export function Actions({ items = ['Like', 'Comment', 'Share'], tone = '' }) {
  const icons = { Like: Heart, Comment: MessageCircle, Share: Send, Save: Bookmark, Repost: Repeat2, Views: Eye };
  return <div className={`preview-actions ${tone}`}>{items.map((label) => { const Icon = icons[label] || ThumbsUp; return <span key={label}><Icon size={17} />{label}</span>; })}</div>;
}

export function Caption({ post }) { return post.text ? <p className="preview-caption">{post.text}</p> : null; }
export function Timestamp({ post }) { const d = new Date(post.createdAt); return <span className="preview-timestamp">{Number.isNaN(d.getTime()) ? 'Published' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>; }
export function PreviewFrame({ platform, children }) { return <article className={`platform-preview preview-${platform}`}>{children}</article>; }
export { MediaRenderer };
