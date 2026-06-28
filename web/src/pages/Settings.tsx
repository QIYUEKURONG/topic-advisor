import { useState, useEffect, useRef, useCallback } from 'react';
import {
  api,
  type AppSettings,
  type AIProvider,
  type AIProviderConfig,
  type ImageProvider,
  type ImageProviderConfig,
  AI_PROVIDER_OPTIONS,
  IMAGE_PROVIDER_OPTIONS,
} from '../lib/api';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showImageKey, setShowImageKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        if (!s.aiProvider) {
          s.aiProvider = {
            provider: 'deepseek',
            apiKey: s.deepseekApiKey || '',
            baseUrl: s.deepseekBaseUrl || 'https://api.deepseek.com',
            model: 'deepseek-chat',
          };
        }
        if (!s.imageProvider) {
          s.imageProvider = {
            provider: 'dashscope',
            apiKey: '',
            baseUrl: 'https://dashscope.aliyuncs.com',
            model: 'wan2.7-image',
          };
        }
        setSettings(s);
        setTimeout(() => { initialLoadDone.current = true; }, 100);
      })
      .catch((e) => setError(e.message));
  }, []);

  const handleProviderChange = (provider: AIProvider) => {
    if (!settings) return;
    const option = AI_PROVIDER_OPTIONS.find((o) => o.id === provider)!;
    setSettings({
      ...settings,
      aiProvider: {
        provider,
        apiKey: settings.aiProvider.apiKey,
        baseUrl: option.baseUrl || settings.aiProvider.baseUrl,
        model: option.model || settings.aiProvider.model,
      },
    });
  };

  const updateAIField = <K extends keyof AIProviderConfig>(key: K, value: AIProviderConfig[K]) => {
    if (!settings) return;
    setSettings({
      ...settings,
      aiProvider: { ...settings.aiProvider, [key]: value },
    });
  };

  const handleImageProviderChange = (provider: ImageProvider) => {
    if (!settings) return;
    const option = IMAGE_PROVIDER_OPTIONS.find((o) => o.id === provider)!;
    setSettings({
      ...settings,
      imageProvider: {
        provider,
        apiKey: settings.imageProvider?.apiKey || '',
        baseUrl: option.baseUrl || settings.imageProvider?.baseUrl || '',
        model: option.model || settings.imageProvider?.model || '',
      },
    });
  };

  const updateImageField = <K extends keyof ImageProviderConfig>(key: K, value: ImageProviderConfig[K]) => {
    if (!settings) return;
    setSettings({
      ...settings,
      imageProvider: { ...(settings.imageProvider || { provider: 'dashscope', apiKey: '', baseUrl: '', model: '' }), [key]: value },
    });
  };

  const initialLoadDone = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async (s: AppSettings) => {
    try {
      await api.updateSettings({
        aiProvider: s.aiProvider,
        imageProvider: s.imageProvider,
        rewritePrompt: s.rewritePrompt,
        enableRewrite: s.enableRewrite,
        dedupWindowHours: s.dedupWindowHours,
        enableScoreFilter: s.enableScoreFilter,
        sensitiveWords: s.sensitiveWords,
        githubToken: s.githubToken,
        hideAiWatermark: s.hideAiWatermark,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!settings || !initialLoadDone.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => doSave(settings), 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [settings, doSave]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await doSave(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings?.aiProvider.apiKey) {
      setTestError('请先填入 API Key');
      return;
    }
    setTestStatus('testing');
    setTestError(null);
    try {
      await api.updateSettings({ aiProvider: settings.aiProvider });
      const res = await fetch('/api/tasks/test-rewrite', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || res.statusText);
      }
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 5000);
    } catch (e: any) {
      setTestStatus('failed');
      setTestError(e.message);
    }
  };

  if (!settings) {
    return (
      <div className="p-8 text-center text-gray-400">
        {error ? (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <div className="text-red-500 mb-4">加载设置失败: {error}</div>
            <button
              onClick={() => { setError(null); api.getSettings().then(s => setSettings(s)).catch(e => setError(e.message)); }}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600"
            >
              重试
            </button>
          </>
        ) : (
          <>
            <div className="animate-pulse text-4xl mb-4">⏳</div>
            加载设置中...
          </>
        )}
      </div>
    );
  }

  const selectedProvider = AI_PROVIDER_OPTIONS.find((o) => o.id === settings.aiProvider.provider);
  const isCustom = settings.aiProvider.provider === 'custom';

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">设置</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {saved && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
          <span>✓</span> 设置已保存
        </div>
      )}

      {/* AI Provider Section */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="text-lg font-semibold">AI 改写配置</h3>
            <p className="text-sm text-gray-500">选择 AI 模型供应商，配置 API Key 用于内容改写</p>
          </div>
        </div>

        {/* Provider selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">模型供应商</label>
          <div className="grid grid-cols-3 gap-2">
            {AI_PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleProviderChange(opt.id)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  settings.aiProvider.provider === opt.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
            {settings.aiProvider.apiKey && (
              <span className="ml-2 text-xs text-green-600 font-normal">✓ 已配置</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.aiProvider.apiKey}
              onChange={(e) => updateAIField('apiKey', e.target.value)}
              placeholder={`输入你的 ${selectedProvider?.label || ''} API Key`}
              className="w-full px-4 py-2.5 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm font-mono"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            你的 API Key 仅存储在本地服务器，不会上传到任何第三方
          </p>
        </div>

        {/* Base URL */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Base URL
            {!isCustom && <span className="text-xs text-gray-400 ml-1">(已自动填充)</span>}
          </label>
          <input
            type="text"
            value={settings.aiProvider.baseUrl}
            onChange={(e) => updateAIField('baseUrl', e.target.value)}
            placeholder="https://api.example.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm font-mono"
          />
          {!isCustom && (
            <p className="text-xs text-gray-400 mt-1">
              如需使用代理或自建服务，可修改此地址
            </p>
          )}
        </div>

        {/* Model name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            模型名称
            {!isCustom && <span className="text-xs text-gray-400 ml-1">(默认推荐)</span>}
          </label>
          <input
            type="text"
            value={settings.aiProvider.model}
            onChange={(e) => updateAIField('model', e.target.value)}
            placeholder="model-name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm font-mono"
          />
        </div>

        {/* Test connection */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing' || !settings.aiProvider.apiKey}
            className="px-4 py-2 text-sm font-medium bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'testing' ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                测试中...
              </span>
            ) : (
              '测试连接'
            )}
          </button>
          {testStatus === 'success' && (
            <span className="text-sm text-green-600 font-medium">✓ 连接成功</span>
          )}
          {testStatus === 'failed' && (
            <span className="text-sm text-red-600">✗ {testError || '连接失败'}</span>
          )}
          {!settings.aiProvider.apiKey && (
            <span className="text-xs text-gray-400">请先填入 API Key</span>
          )}
        </div>
      </section>

      {/* Image Provider Section */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🎨</span>
          <div>
            <h3 className="text-lg font-semibold">图片生成配置</h3>
            <p className="text-sm text-gray-500">用于漫画贴图功能的图片生成 API</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">图片供应商</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {IMAGE_PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleImageProviderChange(opt.id)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  settings.imageProvider?.provider === opt.id
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
            {settings.imageProvider?.apiKey && (
              <span className="ml-2 text-xs text-green-600 font-normal">&#10003; 已配置</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showImageKey ? 'text' : 'password'}
              value={settings.imageProvider?.apiKey || ''}
              onChange={(e) => updateImageField('apiKey', e.target.value)}
              placeholder={`输入你的 ${IMAGE_PROVIDER_OPTIONS.find(o => o.id === settings.imageProvider?.provider)?.label || ''} API Key`}
              className="w-full px-4 py-2.5 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm font-mono"
            />
            <button
              onClick={() => setShowImageKey(!showImageKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              {showImageKey ? '隐藏' : '显示'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {settings.imageProvider?.provider === 'seedream'
              ? '前往 火山引擎控制台 → API Key 管理 获取 ARK API Key'
              : settings.imageProvider?.provider === 'dashscope'
                ? '前往 阿里云百炼控制台 获取 DashScope API Key'
                : settings.imageProvider?.provider === 'cogview'
                  ? '前往 智谱AI开放平台 获取 API Key'
                  : '输入自定义 API Key'}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
          <input
            type="text"
            value={settings.imageProvider?.baseUrl || ''}
            onChange={(e) => updateImageField('baseUrl', e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm font-mono"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
          <input
            type="text"
            value={settings.imageProvider?.model || ''}
            onChange={(e) => updateImageField('model', e.target.value)}
            placeholder="model-name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm font-mono"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-4">
          <div>
            <span className="text-sm font-medium text-gray-700">隐藏 AI 水印</span>
            <p className="text-xs text-gray-500">关闭生成图片上的「AI生成」标识（部分供应商可能不支持）</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, hideAiWatermark: !settings.hideAiWatermark })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.hideAiWatermark !== false ? 'bg-violet-500' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.hideAiWatermark !== false ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="p-3 bg-purple-50 rounded-lg text-xs text-purple-700 mt-3">
          <strong>价格参考：</strong>
          即梦 Seedream 5.0 Lite 约 0.22 元/张 (50张免费) · 
          通义万相 wanx-v1 约 0.10 元/张 (50张免费) · 
          智谱 CogView-4 约 0.06 元/次
        </div>
      </section>

      {/* GitHub Token */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🐙</span>
          <div>
            <h3 className="text-lg font-semibold">GitHub Token</h3>
            <p className="text-sm text-gray-500">用于分享生成器抓取 GitHub 项目信息（可选，不配则有频率限制）</p>
          </div>
        </div>
        <input
          type="password"
          value={settings.githubToken || ''}
          onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
          placeholder="ghp_xxxxxxxxxxxx"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">
          前往 github.com/settings/tokens 创建 Personal Access Token（不需要任何权限，默认 public repo 即可）
        </p>
      </section>

      {/* Rewrite Prompt Section */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📝</span>
          <div>
            <h3 className="text-lg font-semibold">改写提示词</h3>
            <p className="text-sm text-gray-500">自定义 AI 改写时的系统提示</p>
          </div>
        </div>

        <textarea
          value={settings.rewritePrompt}
          onChange={(e) => setSettings({ ...settings, rewritePrompt: e.target.value })}
          rows={5}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm resize-y"
          placeholder="输入改写提示词..."
        />
      </section>

      {/* Crawl settings */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚙️</span>
          <div>
            <h3 className="text-lg font-semibold">爬取设置</h3>
            <p className="text-sm text-gray-500">去重窗口、评分过滤等</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">去重窗口 (小时)</label>
            <input
              type="number"
              min={0}
              max={168}
              value={settings.dedupWindowHours}
              onChange={(e) => setSettings({ ...settings, dedupWindowHours: Number(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">对比最近 N 小时内的历史去重，设 0 则不去重</p>
          </div>

          <div className="flex flex-col gap-3 justify-center">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableScoreFilter}
                onChange={(e) => setSettings({ ...settings, enableScoreFilter: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">启用评分过滤</span>
                <p className="text-xs text-gray-400">仅保留评分达标的内容</p>
              </div>
            </label>

            <button
              onClick={async () => {
                if (!confirm('确定要清除所有去重记录吗？清除后下次爬取将不会跳过已抓取过的内容。')) return;
                setClearingHistory(true);
                setClearResult(null);
                try {
                  const res = await fetch('/api/tasks/history', { method: 'DELETE' });
                  const data = await res.json();
                  setClearResult(`已清除 ${data.deleted} 条记录`);
                  setTimeout(() => setClearResult(null), 5000);
                } catch (e: any) {
                  setClearResult(`清除失败: ${e.message}`);
                } finally {
                  setClearingHistory(false);
                }
              }}
              disabled={clearingHistory}
              className="px-3 py-2 text-sm border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-colors disabled:opacity-50"
            >
              {clearingHistory ? '清除中...' : '清除去重记录'}
            </button>
            {clearResult && (
              <span className="text-xs text-green-600">{clearResult}</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            敏感词过滤
            <span className="text-xs text-gray-400 ml-1">（含有这些词的文章会被过滤）</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2 min-h-[36px] p-2 border border-gray-200 rounded-lg bg-gray-50">
            {(settings.sensitiveWords || []).map((word, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-sm text-gray-700">
                {word}
                <button
                  onClick={() => {
                    const next = [...settings.sensitiveWords];
                    next.splice(i, 1);
                    setSettings({ ...settings, sensitiveWords: next });
                  }}
                  className="text-gray-400 hover:text-red-500 text-xs ml-0.5"
                >
                  ✕
                </button>
              </span>
            ))}
            {(!settings.sensitiveWords || settings.sensitiveWords.length === 0) && (
              <span className="text-xs text-gray-400 py-1">无敏感词，所有内容都会保留</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              id="new-sensitive-word"
              placeholder="输入敏感词后按回车添加"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  const word = input.value.trim();
                  if (word && !(settings.sensitiveWords || []).includes(word)) {
                    setSettings({ ...settings, sensitiveWords: [...(settings.sensitiveWords || []), word] });
                    input.value = '';
                  }
                }
              }}
            />
            <button
              onClick={() => setSettings({ ...settings, sensitiveWords: [] })}
              className="px-3 py-2 text-xs text-gray-500 hover:text-red-500 border border-gray-300 rounded-lg hover:border-red-300 transition-colors"
            >
              清空全部
            </button>
          </div>
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
        <span className="text-xs text-gray-400 ml-3">修改后自动保存</span>
      </div>

      {/* Legal */}
      <section className="mt-10 bg-gray-50 rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📜</span>
          <div>
            <h3 className="text-lg font-semibold">使用协议与免责声明</h3>
            <p className="text-sm text-gray-500">使用本软件即表示您已阅读并同意以下条款</p>
          </div>
        </div>

        <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
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
      </section>
    </div>
  );
}
