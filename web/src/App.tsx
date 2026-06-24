import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import Stickers from './pages/Stickers';
import ShareGenerator from './pages/ShareGenerator';
import Settings from './pages/Settings';

const NAV_ITEMS = [
  { path: '/', label: '控制台', icon: '🎯' },
  { path: '/share', label: '分享生成', icon: '📢' },
  { path: '/stickers', label: '漫画贴图', icon: '🎨' },
  { path: '/settings', label: '设置', icon: '⚙️' },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">📰 选题参谋</h1>
          <p className="text-xs text-gray-400 mt-1">头条运营助手</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === item.path
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          v0.1.0 · localhost:3721
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks/:id" element={<Candidates />} />
          <Route path="/share" element={<ShareGenerator />} />
          <Route path="/stickers" element={<Stickers />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
