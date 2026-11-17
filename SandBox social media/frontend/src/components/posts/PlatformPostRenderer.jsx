import InstagramPost from './InstagramPost.jsx';
import FacebookPost from './FacebookPost.jsx';
import TwitterPost from './TwitterPost.jsx';
import LinkedInPost from './LinkedInPost.jsx';
import YouTubePost from './YouTubePost.jsx';
import TikTokPost from './TikTokPost.jsx';
const templates = { instagram: InstagramPost, facebook: FacebookPost, twitter: TwitterPost, linkedin: LinkedInPost, youtube: YouTubePost, tiktok: TikTokPost };
export default function PlatformPostRenderer({ post }) { const Template = templates[String(post.platform || '').toLowerCase()] || FacebookPost; return <Template post={post} />; }
