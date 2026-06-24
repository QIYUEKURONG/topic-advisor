<p align="center">
  <h1 align="center">🔥 Topic Advisor</h1>
  <p align="center">
    <strong>AI-Powered Content Creation Tool</strong>
  </p>
  <p align="center">
    Crawl trending topics · AI rewriting · Multi-platform styling · AI comic sticker generator
  </p>
  <p align="center">
    <a href="#desktop-app">Download App</a> •
    <a href="#features">Features</a> •
    <a href="#usage-guide">Usage</a> •
    <a href="#development">Development</a> •
    <a href="#architecture">Architecture</a>
  </p>
</p>

---

## 💻 Desktop App

**No Node.js required** — download, install, and start creating content in seconds.

### Download & Install

Download the installer from the [Releases](https://github.com/QIYUEKURONG/topic-advisor/releases) page:

| Platform | File | Architecture |
|----------|------|-------------|
| macOS (Apple Silicon) | `Topic Advisor-x.x.x-arm64.dmg` | M1/M2/M3/M4 |
| macOS (Intel) | `Topic Advisor-x.x.x.dmg` | x86_64 |
| Windows | `Topic Advisor Setup x.x.x.exe` | x64 |

> **macOS**: Double-click the `.dmg` → Drag to Applications → Open from Launchpad
>
> **Windows**: Double-click the `.exe` installer → Follow the setup wizard

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
<tr>
<td width="50%">

### 🎨 AI Comic Sticker Workshop
Generate custom comic stickers with AI-powered illustrations and text overlays.

- **Flexible layouts**: 1-6 images per set, comparison or normal mode
- **11 art styles**: Warm, Cute, Pixel, Watercolor, Anime, and more
- **4 text layouts**: Bar, Floating, Card, Minimal
- **6 font colors** + 6 font styles, switchable without regenerating
- **Export options**: Individual download or combined grid/vertical/horizontal

</td>
<td width="50%">

### 🖼️ Image Generation
Connect to AI image generation APIs for automatic illustration creation.

- **Seedream** (Volcengine): High-quality Chinese-style illustrations
- **DashScope** (Alibaba): Wanx image generation
- **CogView** (Zhipu): CogView-4 model support
- **Server-side text compositing**: Sharp + SVG overlay, no AI text rendering
- **Raw + Final images**: View original AI art or text-composited version

</td>
</tr>
</table>

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

### Comic Sticker Workshop

1. Navigate to the **🎨 Stickers** tab
2. Enter a topic (e.g. "劝人去健身跑步") or pick a preset
3. Configure: image count (1-6), per-image mode (comparison/normal), art style, font, color, text layout
4. Click **Generate** — watch real-time SSE progress
5. After generation, switch font/color/layout instantly without re-generating AI images
6. Download individual images or export as a combined layout

### Step 4 — Publish

- **WeChat / Xiaohongshu**: Paste into their respective editors
- **Toutiao**: Use built-in login to sync directly to draft box

---

## 🛠️ Development

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

### Build Desktop App from Source

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
topic-advisor/
├── server/                 # Backend service
│   ├── src/
│   │   ├── crawlers/       # News source adapters (15+)
│   │   ├── services/       # Core services
│   │   │   ├── task-runner.ts        # Crawl pipeline orchestrator
│   │   │   ├── rewriter.ts           # AI rewriting engine
│   │   │   ├── sticker-generator.ts  # Comic sticker pipeline
│   │   │   ├── image-composer.ts     # Sharp + SVG text overlay
│   │   │   ├── scorer.ts             # Content scoring
│   │   │   └── filter.ts             # Content filtering
│   │   ├── routes/         # API routes
│   │   └── config/         # Configuration
│   └── package.json
├── web/                    # Frontend UI
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Crawl console
│   │   │   ├── Candidates.tsx   # Content management
│   │   │   ├── Stickers.tsx     # Comic sticker workshop
│   │   │   └── Settings.tsx     # AI configuration
│   │   └── lib/api.ts      # API client
│   └── package.json
├── electron/               # Desktop wrapper
│   └── main.cjs
├── scripts/                # Build scripts
│   └── bundle-server.mjs   # esbuild server bundler
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
| `GET` | `/api/stickers/generate` | SSE comic generation (with query params) |
| `GET` | `/api/stickers` | List generated comics |
| `GET` | `/api/stickers/:id` | Get comic details |
| `POST` | `/api/stickers/:id/recompose` | Re-render text overlay (font/color/layout) |
| `GET` | `/api/stickers/:id/export` | Export combined image |

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Vite, Tailwind CSS, React Router, React Markdown |
| Backend | Fastify, TypeScript, Cheerio, Undici, Sharp, Puppeteer |
| AI | DeepSeek / OpenAI / Claude / Moonshot / Qwen (text) + Seedream / DashScope / CogView (image) |
| Desktop | Electron, electron-builder, esbuild (single-file server bundle) |
| Build | pnpm workspaces, TypeScript, Vite |

---

## 📄 License

MIT
