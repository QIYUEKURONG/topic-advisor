<p align="center">
  <h1 align="center">🔥 Topic Advisor</h1>
  <p align="center">
    <strong>AI-Powered Content Creation Tool</strong>
  </p>
  <p align="center">
    Crawl trending topics · AI rewriting · Multi-platform styling · Rich-text copy with images
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> •
    <a href="#features">Features</a> •
    <a href="#desktop-app">Desktop App</a> •
    <a href="#architecture">Architecture</a>
  </p>
</p>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📡 Multi-Source Crawling
Aggregate trending content from **15+ news sources** in a single click.

- Sina · NetEase · Sohu · Tencent · iFeng
- ThePaper · Baidu Hot · 36Kr · IT Home
- Bilibili · Weibo · Xiaohongshu
- QbitAI · Jiqizhixin (AI-focused sources)

</td>
<td width="50%">

### 🤖 AI-Powered Rewriting
Connect to leading AI models to automatically rewrite content, ready to publish.

- **7 platform styles**: WeChat / Xiaohongshu / Zhihu / Douyin / Weibo / Toutiao / Generic
- **Markdown formatting**: Bold, quotes, structured paragraphs
- Completely new titles from fresh angles
- Supports DeepSeek / OpenAI / Claude / Moonshot / Qwen

</td>
</tr>
<tr>
<td width="50%">

### 🏷️ 11 Topic Categories
Focus on your niche — each category comes with dedicated search sources and keyword sets.

`AI` `Investment` `Entertainment` `Sports` `Tech` `Health` `Automotive` `Education` `Food` `Real Estate` `Psychology`

> No topic selected = comprehensive trending content across all categories

</td>
<td width="50%">

### 📋 One-Click Copy & Publish
Copy preserves formatting and images — paste directly into any editor.

- **Rich-text copy**: Title + body + images in HTML format
- **Image proxy**: Server-side forwarding bypasses hotlink protection
- **Platform integration**: One-click sync to draft boxes
- **Local export**: Batch export to files

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18 |
| pnpm | >= 8 (recommended) |

### Install & Run

```bash
# 1. Clone the repository
git clone https://github.com/QIYUEKURONG/topic-advisor.git
cd topic-advisor

# 2. Install dependencies
pnpm install

# 3. Start in development mode
pnpm dev
```

Open your browser:

| Service | URL |
|---------|-----|
| Frontend (dev) | http://localhost:5173 |
| Backend API | http://127.0.0.1:3721 |

### Production

```bash
pnpm build    # Build frontend & backend
pnpm start    # Start server (visit http://127.0.0.1:3721)
```

---

## 💻 Desktop App

Package as a standalone Mac / Windows application:

```bash
# Mac (.dmg)
pnpm dist:mac

# Windows (.exe installer)
pnpm dist:win

# Build for both platforms
pnpm dist:all
```

> Output goes to the `release/` directory

---

## 📖 Usage Guide

### Step 1 — Configure AI

Go to **⚙️ Settings** and select your AI provider with API key.

| Provider | URL | Best For |
|----------|-----|----------|
| DeepSeek | platform.deepseek.com | Best value, excellent Chinese |
| OpenAI | platform.openai.com | GPT-4o, strong all-around |
| Claude | console.anthropic.com | High quality long-form writing |
| Moonshot | platform.moonshot.cn | Fast access from China |
| Qwen | dashscope.console.aliyun.com | Alibaba Cloud ecosystem |

### Step 2 — Crawl Content

1. Set the number of articles to crawl
2. Optionally select a topic category
3. Click **Start Crawl**
4. Watch real-time progress via SSE

### Step 3 — AI Rewrite

1. Click the **🤖 AI Rewrite** button on any article
2. Choose a target platform style
3. Preview the rewritten content (rendered Markdown)
4. Click **Copy All + Images** for one-click clipboard

### Step 4 — Publish

- **WeChat / Xiaohongshu**: Paste into their respective editors
- **Toutiao**: Use built-in login to sync directly to draft box

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron Shell                  │
│  ┌───────────────────┐  ┌─────────────────────┐  │
│  │   React Frontend  │  │   Fastify Backend   │  │
│  │                   │  │                     │  │
│  │  • Vite + HMR     │  │  • 15+ Crawlers     │  │
│  │  • Tailwind CSS   │◄─┤  • AI Rewriter      │  │
│  │  • React Router   │  │  • Image Proxy      │  │
│  │  • React Markdown │  │  • SSE Streaming    │  │
│  │                   │  │  • Task Pipeline    │  │
│  └───────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Project Structure

```
toutiao-topic-advisor/
├── server/                 # Backend service
│   ├── src/
│   │   ├── crawlers/       # News source adapters (15+)
│   │   ├── services/       # Core services
│   │   │   ├── task-runner.ts   # Crawl pipeline orchestrator
│   │   │   ├── rewriter.ts      # AI rewriting engine
│   │   │   ├── scorer.ts        # Content scoring
│   │   │   └── filter.ts        # Content filtering
│   │   ├── routes/         # API routes
│   │   └── config/         # Configuration
│   └── package.json
├── web/                    # Frontend UI
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Crawl console
│   │   │   ├── Candidates.tsx   # Content management
│   │   │   └── Settings.tsx     # AI configuration
│   │   └── lib/api.ts      # API client
│   └── package.json
├── electron/               # Desktop wrapper
│   └── main.cjs
├── package.json            # Root config + build scripts
└── README.md
```

### API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tasks` | Create a crawl task |
| `GET` | `/api/tasks` | List all tasks |
| `GET` | `/api/tasks/:id` | Get task details + candidates |
| `GET` | `/api/tasks/:id/sse` | SSE real-time progress |
| `POST` | `/api/tasks/:id/rewrite/:articleId` | AI rewrite an article |
| `GET` | `/api/settings` | Get app settings |
| `PUT` | `/api/settings` | Update app settings |
| `GET` | `/api/image-proxy?url=` | Image proxy (bypass hotlinking) |
| `GET` | `/api/platforms` | List available rewrite platforms |

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Vite, Tailwind CSS, React Router, React Markdown |
| Backend | Fastify, TypeScript, Cheerio, Undici, Puppeteer |
| AI | DeepSeek / OpenAI / Claude / Moonshot / Qwen API |
| Desktop | Electron, electron-builder |
| Build | pnpm workspaces, TypeScript, Vite |

---

## 📄 License

MIT
