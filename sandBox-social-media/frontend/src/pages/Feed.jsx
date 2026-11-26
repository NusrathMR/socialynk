import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import Loading from '../components/Loading.jsx';
import PlatformFilter from '../components/PlatformFilter.jsx';
import PostCard from '../components/PostCard.jsx';
import { getPlatform } from '../components/platforms.js';
import { fetchPosts } from '../services/api.js';

const PAGE_SIZE = 12;

export default function Feed({ search, refreshKey }) {
  const { platform } = useParams();
  const currentPlatform = platform || 'all';
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setPosts([]);
    setPage(1);
    fetchPosts({ platform: currentPlatform, page: 1, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setPosts(result.data);
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.response?.data?.message ||
            'Could not load posts. Check that the Sandbox Social API is running, then try again.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPlatform, refreshKey, retryKey]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    setError('');
    try {
      const result = await fetchPosts({ platform: currentPlatform, page: nextPage, limit: PAGE_SIZE });
      setPosts((previous) => [...previous, ...result.data]);
      setPagination(result.pagination);
      setPage(nextPage);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load more posts. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return posts;
    return posts.filter((post) =>
      `${post.authorName} ${post.text} ${post.platform}`.toLocaleLowerCase().includes(query),
    );
  }, [posts, search]);

  const title = currentPlatform === 'all' ? 'Your feed' : `${getPlatform(currentPlatform).label} feed`;

  return (
    <section className="feed-page">
      <div className="feed-heading">
        <div>
          <p className="page-kicker">SANDBOX SOCIAL</p>
          <h1>{title}</h1>
          <p className="feed-subtitle">A little more signal, a lot less switching tabs.</p>
        </div>
        <div className="post-count">
          <strong>{pagination.total}</strong>
          <span>{pagination.total === 1 ? 'post received' : 'posts received'}</span>
        </div>
      </div>

      <PlatformFilter />

      {error && (
        <div className="error-banner" role="alert">
          <TriangleAlert size={18} />
          <span>{error}</span>
          <button onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : filteredPosts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><Inbox size={25} /></span>
          <h2>{search ? 'No matching posts' : 'Nothing here yet'}</h2>
          <p>
            {search
              ? 'Try another search, or clear the search field to see all posts.'
              : 'Posts received by the Sandbox Social API will show up here.'}
          </p>
          {!search && (
            <button className="subtle-button" onClick={() => setRetryKey((key) => key + 1)}>
              <RefreshCw size={15} /> Check again
            </button>
          )}
        </div>
      ) : (
        <div className="post-list">
          {filteredPosts.map((post) => <PostCard key={post._id} post={post} />)}
        </div>
      )}

      {!loading && posts.length > 0 && filteredPosts.length > 0 && page < pagination.pages && (
        <div className="load-more-wrap">
          <button className="load-more-button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <><span className="button-spinner" /> Loading…</> : 'Load more posts'}
          </button>
        </div>
      )}
    </section>
  );
}
