import { useState } from 'react';
import { Play } from 'lucide-react';

function getMedia(post) {
  const candidates = [
    ...(Array.isArray(post.media) ? post.media : post.media ? [post.media] : []),
    ...(Array.isArray(post.images) ? post.images : post.images ? [post.images] : []),
    post.imageUrl,
    post.mediaUrl,
  ];
  const unique = new Map();
  candidates.forEach((entry) => {
    const item = typeof entry === 'string' ? { url: entry } : entry;
    const url = item?.url || item?.imageUrl || item?.mediaUrl || item?.src;
    if (typeof url === 'string' && /^https?:\/\//i.test(url) && !unique.has(url)) unique.set(url, { ...item, url });
  });
  if (!unique.size && post.thumbnailUrl && /^https?:\/\//i.test(post.thumbnailUrl)) {
    unique.set(post.thumbnailUrl, { url: post.thumbnailUrl, type: post.mediaType || 'image' });
  }
  return [...unique.values()];
}

function MediaItem({ item, className = '', fit = 'cover', showPlay = false }) {
  const [failed, setFailed] = useState(false);
  const isVideo = /video/i.test(item.type || item.mediaType || '');
  if (failed) return <div className={`media-fallback ${className}`} role="img" aria-label="Media could not be loaded">Media unavailable. Check that the URL is publicly accessible.</div>;
  return (
    <div className={`media-item ${className}`}>
      {isVideo ? (
        <video src={item.url} poster={item.thumbnailUrl} controls preload="metadata" aria-label={item.alt || 'Post video'} />
      ) : (
        <img src={item.url} alt={item.alt || ''} loading="lazy" style={{ objectFit: fit }} onError={() => setFailed(true)} />
      )}
      {showPlay && !isVideo && <span className="media-play"><Play fill="currentColor" size={24} /></span>}
    </div>
  );
}

export default function MediaRenderer({ post, fit = 'contain', vertical = false }) {
  const media = getMedia(post);
  if (!media.length) return null;
  const visible = media.slice(0, 4);
  const type = media[0].type || media[0].mediaType || post.mediaType || '';
  const video = /video/i.test(type);
  return (
    <div className={`media-grid media-count-${visible.length}${vertical ? ' media-vertical' : ''}${video ? ' media-video' : ''}`}>
      {visible.map((item, index) => <MediaItem key={`${item.url}-${index}`} item={item} fit={fit} showPlay={video} />)}
      {media.length > 4 && <span className="media-overflow">+{media.length - 4}</span>}
    </div>
  );
}
