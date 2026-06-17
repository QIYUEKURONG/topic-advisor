# 热点话题助手 (Topic Advisor)

AI 驱动的自媒体内容创作工具 — 一键抓取全网热点，AI 智能改写，多平台一键发布。

## 功能特性

### 多源热点抓取
- 覆盖 **15+ 主流新闻源**：新浪、网易、搜狐、腾讯、凤凰网、澎湃、百度热搜、36氪、B站、微博、小红书等
- **11 个话题方向**：AI、投资、娱乐、体育、数码、健康、汽车、教育、美食、房产、心理学
- 不选话题时自动抓取全类型综合热点
- 智能去重（URL + 标题模糊匹配）
- 敏感词过滤、内容评分排序

### AI 智能改写
- 支持 **7 种平台风格**：今日头条、微信公众号、小红书、知乎、抖音、微博、通用
- 多 AI 供应商支持：DeepSeek、OpenAI、Claude、Moonshot、通义千问
- 自动 Markdown 排版（加粗、引用、分段）
- 标题全新角度改写，非简单修改

### 内容管理
- 文章/视频分类筛选
- 话题评分排序
- 标题在线编辑
- 一键复制全文 + 图片（HTML 富文本格式，可直接粘贴到编辑器）
- 图片代理加载（绕过防盗链）

### 发布集成
- 今日头条草稿箱一键同步
- 导出到本地文件

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm** >= 8（推荐）或 npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/toutiao-topic-advisor.git
cd toutiao-topic-advisor

# 安装依赖
pnpm install
```

### 开发模式

```bash
pnpm dev
```

启动后：
- 后端 API：http://127.0.0.1:3721
- 前端开发服务器：http://localhost:5173（带热更新）

### 生产模式

```bash
# 构建前端 + 后端
pnpm build

# 启动服务
pnpm start
```

访问 http://127.0.0.1:3721 使用。

---

## 桌面应用

### 运行桌面版（开发）

```bash
pnpm electron:dev
```

### 构建安装包

```bash
# Mac (DMG)
pnpm dist:mac

# Windows (NSIS 安装包)
pnpm dist:win

# 同时构建 Mac + Windows
pnpm dist:all
```

构建产物在 `release/` 目录下。

---

## 使用指南

### 1. 配置 AI

进入 **设置** 页面，选择 AI 供应商并填入 API Key：

| 供应商 | 获取方式 |
|--------|---------|
| DeepSeek | https://platform.deepseek.com |
| OpenAI | https://platform.openai.com |
| Claude | https://console.anthropic.com |
| Moonshot | https://platform.moonshot.cn |
| 通义千问 | https://dashscope.console.aliyun.com |

### 2. 抓取内容

1. 在主页选择抓取数量（默认 20）
2. 可选：选择话题方向（AI、投资、娱乐等）
3. 点击"开始抓取"
4. 等待抓取完成，自动跳转到候选内容页

### 3. AI 改写

1. 在候选内容页，点击文章的"AI 改写"按钮
2. 选择目标平台风格（公众号、头条、小红书等）
3. 等待改写完成
4. 点击"查看重写内容"预览
5. 点击"复制全文+图片"一键复制到剪贴板

### 4. 发布

- **公众号/小红书**：复制内容后粘贴到对应编辑器
- **今日头条**：使用内置的头条号登录功能，一键同步到草稿箱

---

## 项目结构

```
toutiao-topic-advisor/
├── server/                 # 后端（Fastify + TypeScript）
│   ├── src/
│   │   ├── crawlers/       # 各新闻源爬虫适配器
│   │   ├── services/       # 核心服务（评分、过滤、改写、存储）
│   │   ├── routes/         # API 路由
│   │   ├── config/         # 配置管理
│   │   └── index.ts        # 入口
│   └── package.json
├── web/                    # 前端（React + Vite + Tailwind）
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── lib/            # API 客户端
│   │   └── App.tsx         # 路由配置
│   └── package.json
├── electron/               # Electron 桌面封装
│   └── main.cjs
├── package.json            # 根配置 + 构建脚本
└── README.md
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks` | 创建抓取任务 |
| GET | `/api/tasks` | 获取任务列表 |
| GET | `/api/tasks/:id` | 获取任务详情 |
| POST | `/api/tasks/:id/rewrite/:articleId` | AI 改写文章 |
| GET | `/api/tasks/:id/sse` | SSE 实时进度 |
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
| GET | `/api/image-proxy?url=` | 图片代理 |
| GET | `/api/platforms` | 获取平台列表 |

## 技术栈

- **后端**：Fastify, TypeScript, Cheerio, Undici, Puppeteer
- **前端**：React 19, Vite, Tailwind CSS, React Router, React Markdown
- **桌面**：Electron
- **AI**：DeepSeek / OpenAI / Claude / Moonshot / 通义千问 API

## License

MIT
