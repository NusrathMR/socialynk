import {
  AtSign,
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  Youtube,
} from 'lucide-react';

export const platforms = [
  { id: 'all', label: 'All posts', color: '#475569' },
  { id: 'instagram', label: 'Instagram', color: '#d94682', Icon: Instagram },
  { id: 'facebook', label: 'Facebook', color: '#1877f2', Icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', Icon: Linkedin },
  { id: 'twitter', label: 'Twitter/X', color: '#111827', Icon: null },
  { id: 'tiktok', label: 'TikTok', color: '#121212', Icon: Music2 },
  { id: 'youtube', label: 'YouTube', color: '#ff0033', Icon: Youtube },
];

export function getPlatform(platformId) {
  return platforms.find((platform) => platform.id === platformId) || {
    id: platformId,
    label: platformId,
    color: '#64748b',
    Icon: AtSign,
  };
}
