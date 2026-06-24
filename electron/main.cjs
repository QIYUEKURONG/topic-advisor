const { app, BrowserWindow, shell } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3721;
let serverProcess = null;
let mainWindow = null;

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

function startServer() {
  const serverEntry = getServerPath();
  const resourcesRoot = getResourcesRoot();
  console.log('Starting server:', serverEntry, 'resources:', resourcesRoot);

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
      NODE_PATH: nodeModulesPath,
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });

  serverProcess.stdout.on('data', (data) => {
    console.log('[Server]', data.toString().trim());
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('[Server Error]', data.toString().trim());
  });

  serverProcess.on('exit', (code) => {
    console.log('Server exited with code', code);
    serverProcess = null;
  });
}

function waitForServer(maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${PORT}/api/tasks`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Server failed to start'));
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Topic Advisor',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

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
  startServer();
  try {
    await waitForServer();
  } catch (err) {
    console.error('Failed to start server:', err);
    app.quit();
    return;
  }
  createWindow();
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
    serverProcess.kill();
    serverProcess = null;
  }
});
