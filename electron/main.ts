import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let lastLLMStatus: any = {
  backend: 'unknown',
  modelsLoaded: { classifier: false, generator: false },
  telemetry: { tokensGenerated: 0, generations: 0, classifications: 0, startedAt: Date.now() },
  updatedAt: Date.now(),
};

const getModelPaths = () => {
  const modelsDir = path.join(app.getPath('userData'), 'models');
  const wasmDir = path.join(process.resourcesPath, 'wasm');
  return { modelsDir, wasmDir };
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    const previewPort = process.env.PREVIEW_PORT || '1420';
    mainWindow.loadURL(`http://localhost:${previewPort}`);
    if (process.env.MOCK_HTTP !== '1') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC: model paths
ipcMain.on('get-model-paths-sync', (event) => {
  event.returnValue = getModelPaths();
});

ipcMain.handle('get-model-paths', async () => {
  return getModelPaths();
});

// IPC: llm status tracking
ipcMain.on('llm-status-update', (event, status) => {
  lastLLMStatus = { ...lastLLMStatus, ...status, updatedAt: Date.now() };
});

ipcMain.handle('llm-status', async () => {
  return lastLLMStatus;
});


