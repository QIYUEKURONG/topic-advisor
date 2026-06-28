import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import Stickers from './pages/Stickers';
import ShareGenerator from './pages/ShareGenerator';
import Settings from './pages/Settings';
import TrendAnalyzer from './pages/TrendAnalyzer';
import KnowledgeCards from './pages/KnowledgeCards';

const NAV_ITEMS = [
  { path: '/', label: '控制台', icon: '🎯' },
  { path: '/trends', label: '爆火趋势', icon: '🔥' },
  { path: '/cards', label: '知识卡片', icon: '📋' },
  { path: '/share', label: '分享生成', icon: '📢' },
  { path: '/stickers', label: '漫画贴图', icon: '🎨' },
  { path: '/settings', label: '设置', icon: '⚙️' },
];

const AGREEMENT_KEY = 'topic-advisor-agreement-accepted';

function AgreementModal({ onAccept }: { onAccept: () => void }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) {
      setScrolledToBottom(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-brand-50 to-orange-50">
          <h2 className="text-3xl font-bold text-gray-900">用户使用协议与免责声明</h2>
          <p className="text-lg text-gray-500 mt-1">使用本软件前，请仔细阅读以下条款</p>
        </div>

        <div
          className="px-8 py-5 max-h-[60vh] overflow-y-auto text-lg text-gray-600 leading-relaxed space-y-6"
          onScroll={handleScroll}
        >
          <div>
            <h4 className="font-semibold text-gray-800 mb-2 text-xl">一、软件用途</h4>
            <p>本软件（Topic Advisor / 选题参谋）为内容创作辅助工具，旨在帮助用户收集公开信息、辅助内容创作。本软件仅供个人学习、研究及合法的内容创作使用。</p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2 text-xl">二、内容抓取声明</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>本软件仅抓取各平台公开可访问的信息，不突破任何访问控制或技术保护措施。</li>
              <li>抓取的内容版权归原作者/原平台所有，用户不得将抓取的原始内容直接用于商业发布。</li>
              <li>用户使用 AI 改写功能生成的内容，用户应自行确保不侵犯他人知识产权。</li>
              <li>如相关平台对抓取行为有明确限制，用户应遵守该平台的使用条款。</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2 text-xl">三、AI 生成内容声明</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>本软件使用第三方 AI 服务（如 DeepSeek、OpenAI 等）进行内容生成，AI 生成的内容可能存在事实性错误。</li>
              <li>用户在发布 AI 生成或改写的内容前，应自行核实内容的准确性和合规性。</li>
              <li>AI 生成的图片、文本等内容的使用需遵守对应 AI 服务商的使用条款。</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2 text-xl">四、数据安全</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>本软件所有数据（包括 API Key、抓取内容、生成内容）均存储在用户本地设备，不会上传至任何第三方服务器。</li>
              <li>API Key 以明文形式存储在本地配置文件中，请妥善保管您的设备安全。</li>
              <li>用户调用第三方 AI 服务时产生的数据传输，受该 AI 服务商的隐私政策约束。</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2 text-xl">五、免责条款</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>本软件按"原样"提供，不提供任何明示或暗示的保证。</li>
              <li>因使用本软件产生的任何直接或间接损失（包括但不限于内容侵权纠纷、API 费用、数据丢失等），开发者不承担责任。</li>
              <li>用户应自行承担使用本软件进行内容创作和发布的全部法律责任。</li>
              <li>本软件不对第三方平台的可用性、稳定性或数据准确性做任何保证。</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2 text-xl">六、使用限制</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>禁止使用本软件生成、传播违反法律法规的内容。</li>
              <li>禁止使用本软件进行大规模、高频率的恶意爬取，干扰目标网站正常运行。</li>
              <li>禁止将本软件用于任何欺诈、虚假宣传或误导消费者的行为。</li>
              <li>用户不得对本软件进行反编译、逆向工程或未经授权的二次分发。</li>
            </ul>
          </div>

          <div className="pt-2 border-t border-gray-200 text-xs text-gray-400">
            <p>本协议最终解释权归软件开发者所有。如有争议，双方应友好协商解决。</p>
            <p className="mt-1">Topic Advisor v1.0.0 · 更新日期：2026 年 6 月</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          {!scrolledToBottom && (
            <p className="text-xs text-gray-400">请滚动阅读完整协议</p>
          )}
          {scrolledToBottom && <div />}
          <button
            onClick={onAccept}
            disabled={!scrolledToBottom}
            className="px-10 py-3 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-base shadow-sm"
          >
            我已阅读并同意
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const [agreed, setAgreed] = useState(() => {
    return localStorage.getItem(AGREEMENT_KEY) === 'true';
  });

  const handleAccept = () => {
    localStorage.setItem(AGREEMENT_KEY, 'true');
    setAgreed(true);
  };

  return (
    <>
      {!agreed && <AgreementModal onAccept={handleAccept} />}
      <div className="min-h-screen flex">
        <aside className="w-56 bg-gray-900 text-white flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h1 className="text-lg font-bold">📰 选题参谋</h1>
            <p className="text-xs text-gray-400 mt-1">AI 内容创作工具</p>
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
            v1.0.0
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks/:id" element={<Candidates />} />
            <Route path="/trends" element={<TrendAnalyzer />} />
            <Route path="/cards" element={<KnowledgeCards />} />
            <Route path="/share" element={<ShareGenerator />} />
            <Route path="/stickers" element={<Stickers />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
