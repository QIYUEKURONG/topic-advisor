const { app, BrowserWindow, shell, dialog } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 3721;
let serverProcess = null;
let mainWindow = null;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    const logDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'logs')
      : path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), line + '\n');
  } catch {}
}

function getServerPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', 'server', 'bundle', 'index.mjs');
  }
  return path.join(process.resourcesPath, 'server', 'bundle', 'index.mjs');
}

function getResourcesRoot() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..');
  }
  return process.resourcesPath;
}

function getDataDir() {
  if (app.isPackaged) {
    const dir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  return path.join(__dirname, '..', 'server', 'data');
}

function startServer() {
  const serverEntry = getServerPath();
  const resourcesRoot = getResourcesRoot();
  const dataDir = getDataDir();
  log(`Starting server: ${serverEntry}`);
  log(`Resources root: ${resourcesRoot}`);
  log(`Data dir: ${dataDir}`);
  log(`Server file exists: ${fs.existsSync(serverEntry)}`);

  const nodeModulesPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'node_modules')
    : path.join(__dirname, '..', 'server', 'node_modules');

  serverProcess = fork(serverEntry, [], {
    cwd: resourcesRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1',
      TOPIC_ADVISOR_RESOURCES: resourcesRoot,
      TOPIC_ADVISOR_DATA: dataDir,
      NODE_PATH: nodeModulesPath,
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });

  serverProcess.stdout.on('data', (data) => {
    log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    log(`[Server Error] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    log(`Server exited with code ${code}`);
    serverProcess = null;
  });

  serverProcess.on('error', (err) => {
    log(`Server process error: ${err.message}`);
  });
}

function waitForServer(maxAttempts = 40) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      log(`Waiting for server... attempt ${attempts}/${maxAttempts}`);
      const req = http.get(`http://127.0.0.1:${PORT}/api/tasks`, (res) => {
        res.resume();
        log('Server is ready!');
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Server failed to start after ${maxAttempts} attempts`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts < maxAttempts) setTimeout(check, 500);
      });
    };
    check();
  });
}

const LOADING_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #111827;
    color: #e5e7eb;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    flex-direction: column;
    gap: 24px;
  }
  .title { font-size: 28px; font-weight: 700; }
  .spinner {
    width: 40px; height: 40px;
    border: 3px solid #374151;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hint { font-size: 14px; color: #6b7280; }
</style>
</head>
<body>
  <div class="title">📰 选题参谋</div>
  <div class="spinner"></div>
  <div class="hint">正在启动服务，请稍候...</div>
</body>
</html>`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Topic Advisor - 选题参谋',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  log('App ready, creating window with loading screen...');
  createWindow();

  log('Starting server...');
  startServer();

  try {
    await waitForServer();
    log('Loading main UI...');
    if (mainWindow) {
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    }
  } catch (err) {
    log(`Failed to start server: ${err.message}`);
    dialog.showErrorBox(
      '启动失败',
      `后端服务启动失败，请重试。\n\n错误信息: ${err.message}\n\n日志位置: ${path.join(app.getPath('userData'), 'logs', 'app.log')}`,
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    log('Killing server process...');
    serverProcess.kill();
    serverProcess = null;
  }
});
