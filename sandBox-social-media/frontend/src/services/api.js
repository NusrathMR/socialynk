import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
});

export async function fetchPosts({ platform, page = 1, limit = 12 } = {}) {
  const response = await api.get('/posts', {
    params: {
      ...(platform && platform !== 'all' ? { platform } : {}),
      page,
      limit,
    },
  });
  return response.data;
}

export default api;
