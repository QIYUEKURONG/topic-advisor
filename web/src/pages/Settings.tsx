import { useState, useEffect } from 'react';
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

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateSettings({
        aiProvider: settings.aiProvider,
        imageProvider: settings.imageProvider,
        rewritePrompt: settings.rewritePrompt,
        enableRewrite: settings.enableRewrite,
        dedupWindowHours: settings.dedupWindowHours,
        enableScoreFilter: settings.enableScoreFilter,
        sensitiveWords: settings.sensitiveWords,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
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
        <div className="animate-pulse text-4xl mb-4">⏳</div>
        加载设置中...
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

        <div className="p-3 bg-purple-50 rounded-lg text-xs text-purple-700">
          <strong>价格参考：</strong>
          即梦 Seedream 5.0 Lite 约 0.22 元/张 (50张免费) · 
          通义万相 wanx-v1 约 0.10 元/张 (50张免费) · 
          智谱 CogView-4 约 0.06 元/次
        </div>
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
      </div>
    </div>
  );
}
