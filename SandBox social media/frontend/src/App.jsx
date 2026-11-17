import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Feed from './pages/Feed.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  function refreshFeed() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <div className="app-shell">
      <Navbar search={search} onSearchChange={setSearch} onRefresh={refreshFeed} />
      <div className="app-layout">
        <Sidebar />
        <main className="page-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/feed"
              element={<Feed search={search} refreshKey={refreshKey} />}
            />
            <Route
              path="/feed/:platform"
              element={<Feed search={search} refreshKey={refreshKey} />}
            />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
