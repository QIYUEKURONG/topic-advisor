# Topic Advisor 安装部署指南

> 适用版本：v1.0.0+
>
> 最后更新：2026 年 6 月

---

## 目录

1. [产品概览](#1-产品概览)
2. [系统要求](#2-系统要求)
3. [桌面版安装（推荐）](#3-桌面版安装推荐)
4. [源码部署](#4-源码部署)
5. [生产环境部署](#5-生产环境部署)
6. [首次配置](#6-首次配置)
7. [AI 服务商注册指引](#7-ai-服务商注册指引)
8. [功能模块与所需配置](#8-功能模块与所需配置)
9. [数据存储说明](#9-数据存储说明)
10. [常见问题](#10-常见问题)
11. [故障排除](#11-故障排除)

---

## 1. 产品概览

Topic Advisor 是一款 AI 驱动的内容创作工具，核心功能包括：

| 功能 | 说明 |
|------|------|
| **热点抓取** | 一键抓取 30+ 新闻源的热点内容（新浪、网易、搜狐、腾讯、澎湃、36氪、B站、微博、小红书、知乎等） |
| **AI 改写** | 接入主流 AI 模型，一键改写文章，支持微信/小红书/知乎/抖音/微博/头条等 7 种平台风格 |
| **爆火趋势分析** | 抓取指定平台文章，分析热度趋势，给出写作方向建议和爆火潜力评估 |
| **知识卡片生成** | 输入主题自动生成小红书风格的知识图卡（PNG 图片） |
| **漫画贴图** | AI 生成漫画插图 + 文字排版，支持 11 种画风和多种布局 |
| **分享生成器** | 输入 GitHub 仓库或文章链接，自动生成带插图的分享文章 |
| **副业指南** | 聚合知乎、小红书、V2EX、公众号等平台的副业/赚钱类高质量内容 |

---

## 2. 系统要求

### 桌面版（最终用户）

| 项目 | 要求 |
|------|------|
| **操作系统** | macOS 11+ (Apple Silicon 或 Intel) / Windows 10+ (64位) |
| **内存** | 4 GB 以上（推荐 8 GB） |
| **硬盘** | 至少 500 MB 可用空间（含 Chromium 内核） |
| **网络** | 稳定的互联网连接 |
| **其他依赖** | 无需安装任何额外软件 |

### 源码部署 / 开发

| 项目 | 要求 |
|------|------|
| **Node.js** | **≥ 22.12**（Puppeteer 25 要求；推荐使用 LTS 版本） |
| **pnpm** | ≥ 8 |
| **操作系统** | macOS / Windows / Linux |
| **内存** | 4 GB 以上 |
| **硬盘** | 至少 1 GB（含 Puppeteer 下载的 Chromium 约 300 MB） |
| **中文字体** | macOS 自带即可；Windows 需安装中文语言包；Linux 需安装 CJK 字体（见下方说明） |

### Linux 额外依赖

```bash
# Ubuntu / Debian — 安装 CJK 字体
sudo apt install fonts-noto-cjk fonts-wqy-zenhei

# CentOS / RHEL
sudo yum install google-noto-sans-cjk-fonts wqy-zenhei-fonts

# Puppeteer / Chromium 系统依赖（如报错再安装）
sudo apt install libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1
```

---

## 3. 桌面版安装（推荐）

适合不熟悉编程的用户，开箱即用。

### 3.1 下载安装包

| 平台 | 文件名 | 适用机型 |
|------|--------|----------|
| macOS (Apple Silicon) | `Topic Advisor-x.x.x-arm64.dmg` | M1 / M2 / M3 / M4 芯片的 Mac |
| macOS (Intel) | `Topic Advisor-x.x.x.dmg` | 2020 年前的 Intel Mac |
| Windows | `Topic Advisor Setup x.x.x.exe` | Windows 10/11 64位 |

> 不确定自己的 Mac 是哪种芯片？点击左上角  → "关于本机"，查看"芯片"一栏。

### 3.2 安装步骤

**macOS：**
1. 双击 `.dmg` 文件
2. 将 Topic Advisor 图标拖入"应用程序"文件夹
3. 首次打开时，如果提示"无法验证开发者"：
   - 打开"系统设置" → "隐私与安全性"
   - 在底部找到"已阻止 Topic Advisor"，点击"仍要打开"
4. 应用启动后，会自动打开内置浏览器窗口

**Windows：**
1. 双击 `.exe` 安装包
2. 按照安装向导完成安装
3. 在桌面或开始菜单找到 Topic Advisor 并打开

### 3.3 首次使用

安装完成后，进入应用 → 点击左侧 **⚙️ 设置** → 配置 AI 服务商的 API Key（详见[第 6 节](#6-首次配置)）。

---

## 4. 源码部署

适合开发者、需要自定义或部署到服务器的用户。

### 4.1 安装 Node.js

推荐使用 nvm 管理 Node 版本：

```bash
# macOS / Linux — 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# 安装 Node.js（推荐 v22）
nvm install 22
nvm use 22

# 验证版本
node -v   # 应显示 v22.x.x
```

Windows 用户可从 https://nodejs.org 下载 LTS 安装包。

### 4.2 安装 pnpm

```bash
# 使用 npm 全局安装 pnpm
npm install -g pnpm

# 验证
pnpm -v   # 应显示 8.x 或 9.x
```

### 4.3 安装项目依赖

```bash
# 进入项目目录
cd topic-advisor

# 安装所有依赖（包含 Puppeteer Chromium 下载，可能需要几分钟）
pnpm install
```

> **注意**：`pnpm install` 会自动下载 Puppeteer 所需的 Chromium 浏览器内核（约 150-300 MB），请确保网络通畅。在中国大陆可能需要设置镜像：
> ```bash
> export PUPPETEER_DOWNLOAD_BASE_URL=https://cdn.npmmirror.com/binaries/chrome-for-testing
> pnpm install
> ```

### 4.4 开发模式启动

```bash
pnpm dev
```

同时启动前端（Vite 开发服务器）和后端（Fastify API 服务器）：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | http://localhost:5173 | 带热更新的开发页面 |
| 后端 API | http://127.0.0.1:3721 | API 接口 |

在浏览器中打开 http://localhost:5173 即可使用。

### 4.5 自行构建桌面版

```bash
# 构建 macOS 安装包（.dmg）
pnpm dist:mac

# 构建 Windows 安装包（.exe）
pnpm dist:win

# 同时构建两个平台
pnpm dist:all
```

构建产物输出到 `release/` 目录。

---

## 5. 生产环境部署

如果要将 Topic Advisor 部署为长期运行的服务器（而非桌面应用）：

### 5.1 构建

```bash
pnpm build
```

这会：
- 编译前端 → `web/dist/`（静态文件）
- 编译后端 TypeScript → `server/dist/`

### 5.2 启动

```bash
# 设置生产环境
export NODE_ENV=production

# 启动服务
pnpm start
```

服务运行在 http://127.0.0.1:3721，后端会自动托管前端静态文件。

### 5.3 使用 PM2 进程管理（推荐）

```bash
# 全局安装 PM2
npm install -g pm2

# 启动服务
cd topic-advisor/server
pm2 start dist/index.js --name topic-advisor

# 查看状态
pm2 status

# 设置开机自启
pm2 startup
pm2 save
```

### 5.4 使用 Nginx 反向代理（可选）

如果需要通过域名或 80/443 端口访问：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3721;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # SSE 支持（重要！）
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

> **重要**：必须关闭 `proxy_buffering`，否则 SSE（Server-Sent Events）实时进度推送无法正常工作。

### 5.5 环境变量

| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 设为 `production` 启用生产路径 | 未设置（开发模式） |
| `TOPIC_ADVISOR_DATA` | 自定义数据存储目录 | 开发: `server/data/`；生产: `~/.topic-advisor/` |
| `TOPIC_ADVISOR_RESOURCES` | 前端静态文件根目录（仅 Electron 使用） | 项目根目录 |

---

## 6. 首次配置

应用启动后，点击侧边栏 **⚙️ 设置** 进入配置页面。

### 6.1 文本 AI 配置（必须）

用于文章改写、漫画脚本、分享文章生成、知识卡片、趋势分析等所有 AI 功能。

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **AI 服务商** | 选择你的 API 服务商 | DeepSeek |
| **API Key** | 服务商提供的密钥 | `sk-xxxxxxxxxxxxxxxx` |
| **API 地址** | 服务商的 API 端点（通常自动填充） | `https://api.deepseek.com` |
| **模型** | 使用的模型名称（通常自动填充） | `deepseek-chat` |

### 6.2 图像 AI 配置（部分功能需要）

用于漫画贴图和分享文章的 AI 插图生成。

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **图像服务商** | 选择图像生成 API | Seedream (即梦) |
| **API Key** | 服务商提供的密钥 | `xxxxxxxxxxxxxxxx` |
| **API 地址** | 服务商的 API 端点 | `https://ark.cn-beijing.volces.com` |
| **模型** | 使用的模型 ID | `doubao-seedream-5-0-lite-260128` |

### 6.3 GitHub Token（可选）

用于分享生成器抓取 GitHub 仓库信息。没有 Token 也能使用，但访问频率受限。

获取地址：https://github.com/settings/tokens → Generate new token (classic) → 勾选 `public_repo`

### 6.4 其他可调参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 最大抓取数 | 200 | 单次抓取的最大文章数 |
| 请求间隔 | 1200ms | 爬虫请求间隔，防止被封 |
| 话题模式 | 标准 | loose(宽松) / standard(标准) / strict(严格) |
| 启用评分过滤 | 是 | 自动过滤低质量文章 |
| 启用自动改写 | 否 | 抓取完成后自动 AI 改写 |
| 去重时间窗口 | 24小时 | 自动过滤重复文章的时间窗口 |

---

## 7. AI 服务商注册指引

### 7.1 文本 AI（任选一个）

| 服务商 | 注册地址 | 价格参考 | 优势 |
|--------|----------|----------|------|
| **DeepSeek** | https://platform.deepseek.com | ¥1/百万 token（极低） | 性价比最高，中文能力强 |
| **OpenAI** | https://platform.openai.com | $5/百万 token | GPT-4o，综合能力强 |
| **Claude** | https://console.anthropic.com | $3/百万 token | 长文写作质量高 |
| **Moonshot** | https://platform.moonshot.cn | ¥12/百万 token | 国内服务稳定，注册简单 |
| **Qwen** | https://dashscope.console.aliyun.com | ¥2/百万 token | 阿里云生态 |

**推荐**：国内用户优先选择 **DeepSeek**（性价比最高）或 **Moonshot**（注册最快）。

### 7.2 图像 AI（任选一个）

| 服务商 | 注册地址 | 价格参考 | 说明 |
|--------|----------|----------|------|
| **Seedream / 即梦** | https://console.volcengine.com | ¥0.04/张 | 火山引擎/豆包，中式风格好 |
| **DashScope / 万相** | https://dashscope.console.aliyun.com | ¥0.04/张 | 阿里云通义万相 |
| **CogView** | https://open.bigmodel.cn | ¥0.05/张 | 智谱 CogView-4 |

**注册流程（以 DeepSeek 为例）：**
1. 访问 https://platform.deepseek.com
2. 手机号注册并登录
3. 进入"API Keys"页面
4. 点击"创建 API Key"
5. 复制生成的密钥
6. 在 Topic Advisor 设置页面粘贴

---

## 8. 功能模块与所需配置

| 功能 | 文本 AI Key | 图像 AI Key | GitHub Token | 其他 |
|------|:-----------:|:-----------:|:------------:|------|
| 热点抓取 | - | - | - | 仅需网络 |
| AI 改写 | ✅ 必须 | - | - | |
| 爆火趋势分析 | ✅ 必须（爆火分析） | - | - | |
| 知识卡片 | ✅ 必须 | - | - | 需 Puppeteer（已内置） |
| 漫画贴图 | ✅ 必须（脚本） | ✅ 必须（图片） | - | |
| 分享生成器 | ✅ 必须 | 可选（插图） | 可选（GitHub） | |
| 头条发布 | - | - | - | 需手动登录头条号 |

---

## 9. 数据存储说明

Topic Advisor **不使用数据库**，所有数据以 JSON 文件和图片形式存储在本地。

### 存储路径

| 模式 | 数据目录 |
|------|----------|
| 开发模式 | `server/data/` |
| 桌面版 / 生产模式 | `~/.topic-advisor/`（macOS: `/Users/你的用户名/.topic-advisor/`） |
| 自定义 | 设置环境变量 `TOPIC_ADVISOR_DATA` |

### 目录结构

```
数据目录/
├── config.json           # 配置文件（含 API Key，明文存储）
├── tasks/                # 抓取任务记录
│   └── {任务ID}.json
├── stickers/             # 漫画贴图
│   └── {贴图ID}/
│       ├── script.json   # 漫画脚本
│       ├── raw-1.png     # AI 原始图
│       └── final-1.png   # 合成后成品图
├── shares/               # 分享文章
│   └── {文章ID}/
│       ├── article.json
│       └── share.json
├── trends/               # 趋势分析快照
│   └── {快照ID}.json
├── cards/                # 知识卡片
│   └── {卡片ID}/
│       ├── card-meta.json
│       └── card.png
└── images/               # 头条发布用的图片缓存
```

### 导出目录

| 模式 | 导出路径 |
|------|----------|
| 开发模式 | `./output` |
| 生产模式 | `~/Documents/TopicAdvisor` |

### 数据备份

如需备份数据，直接复制整个数据目录即可。

> **安全提醒**：`config.json` 中包含 API Key 等敏感信息，请妥善保管，不要上传到公开位置。

---

## 10. 常见问题

### Q1: 启动后浏览器页面空白？
**A**: 确认访问的地址正确。开发模式下使用 http://localhost:5173，生产模式下使用 http://127.0.0.1:3721。

### Q2: 抓取不到内容？
**A**: 
- 检查网络连接是否正常
- 部分新闻源可能有临时限制，属于正常现象
- 尝试增大"请求间隔"设置（建议 1200ms 以上）
- 国外服务器访问国内新闻源可能较慢

### Q3: AI 改写报错？
**A**: 
- 确认已在设置中正确填写 API Key
- 确认 API Key 余额充足
- 检查 API 地址是否正确
- Claude 的 API 格式与其他服务商不同，确认选择了正确的服务商

### Q4: 漫画贴图生成失败？
**A**: 需要同时配置文本 AI（生成脚本）和图像 AI（生成图片），缺一不可。

### Q5: 知识卡片中文字显示异常？
**A**: 
- macOS 通常无问题
- Windows 需安装中文语言包（设置 → 时间和语言 → 语言）
- Linux 需安装 CJK 字体：`sudo apt install fonts-noto-cjk`

### Q6: 公众号文章链接打不开？
**A**: 微信公众号通过搜狗搜索爬取的链接具有时效性。系统已设置只抓取最近一周的文章，但部分链接仍可能失效，这是微信平台的限制。

### Q7: 漫画图片上有"AI生成"水印？
**A**: 取决于图像 AI 服务商。Seedream 已配置关闭水印参数，但部分服务商可能强制添加。可尝试切换图像服务商。

### Q8: `pnpm install` 下载 Chromium 很慢或失败？
**A**: 设置国内镜像后重试：
```bash
export PUPPETEER_DOWNLOAD_BASE_URL=https://cdn.npmmirror.com/binaries/chrome-for-testing
pnpm install
```

---

## 11. 故障排除

### 端口冲突

如果 3721 端口已被占用：

```bash
# 查看占用端口的进程
lsof -i :3721    # macOS / Linux
netstat -ano | findstr 3721  # Windows

# 结束占用进程
kill -9 <PID>    # macOS / Linux
taskkill /PID <PID> /F  # Windows
```

### 清除数据重新开始

```bash
# macOS / Linux（生产模式）
rm -rf ~/.topic-advisor

# Windows（生产模式）
rmdir /s /q %USERPROFILE%\.topic-advisor

# 开发模式
rm -rf server/data
```

### 查看运行日志

开发模式下，日志直接输出到终端。生产模式下可通过 PM2 查看：

```bash
pm2 logs topic-advisor
```

### Puppeteer 在 Linux 上报错

```bash
# 安装 Chromium 运行时依赖
sudo apt install -y \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2 \
  libxshmfence1 libxrandr2

# 如果仍然报错，尝试使用系统 Chromium
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

## 附录：完整 API 端点列表

| 方法 | 路径 | 功能 |
|------|------|------|
| `POST` | `/api/tasks` | 创建抓取任务 |
| `GET` | `/api/tasks` | 任务列表 |
| `GET` | `/api/tasks/:id` | 任务详情 |
| `GET` | `/api/tasks/:id/sse` | 抓取进度推送（SSE） |
| `POST` | `/api/tasks/:id/rewrite/:articleId` | AI 改写文章 |
| `GET/PUT` | `/api/settings` | 获取/更新设置 |
| `GET` | `/api/image-proxy?url=` | 图片代理 |
| `GET` | `/api/platforms` | 改写平台列表 |
| `GET` | `/api/stickers/generate` | 生成漫画贴图（SSE） |
| `GET` | `/api/stickers` | 贴图列表 |
| `GET` | `/api/stickers/:id` | 贴图详情 |
| `POST` | `/api/stickers/:id/recompose` | 重新排版贴图 |
| `GET` | `/api/stickers/:id/export` | 导出拼图 |
| `GET` | `/api/shares/generate` | 生成分享文章（SSE） |
| `GET` | `/api/shares` | 分享列表 |
| `GET` | `/api/shares/:id` | 分享详情 |
| `POST` | `/api/shares/:id/export` | 导出分享文章 |
| `GET` | `/api/shares/github-trending` | GitHub Trending |
| `GET` | `/api/trends/platforms` | 趋势平台列表 |
| `GET` | `/api/trends/directions` | 趋势方向列表 |
| `POST` | `/api/trends/crawl` | 执行趋势抓取（SSE） |
| `GET` | `/api/trends/latest` | 最新趋势快照 |
| `GET` | `/api/trends/snapshots` | 趋势快照列表 |
| `POST` | `/api/trends/analyze` | 爆火潜力分析 |
| `GET` | `/api/cards/styles` | 卡片风格列表 |
| `GET` | `/api/cards/layouts` | 卡片布局列表 |
| `POST` | `/api/cards/generate` | 生成知识卡片（SSE） |
| `GET` | `/api/cards` | 卡片列表 |
| `GET` | `/api/cards/:id` | 卡片详情 |
| `GET` | `/api/cards/:id/image` | 卡片图片 |

---

*Topic Advisor — AI 驱动的内容创作全流程工具*
