import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PRODUCT_TYPES = ['physique', 'reactif'];
const isDev = !app.isPackaged;
const devServerURL = process.env.VITE_DEV_SERVER_URL;

const ensureDirectory = (targetPath) => {
  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.lstatSync(targetPath);
      if (!stats.isDirectory()) {
        fs.rmSync(targetPath, { force: true });
      }
    }
    fs.mkdirSync(targetPath, { recursive: true });
  } catch (error) {
    console.error(`Failed to prepare directory at ${targetPath}`, error);
  }
};

const userDataRoot = isDev
  ? path.join(__dirname, '..', 'data', 'user-data')
  : path.join(app.getPath('appData'), 'Stock Zen Maroc');

ensureDirectory(userDataRoot);
app.setPath('userData', userDataRoot);

const cacheRoot = path.join(
  app.getPath('temp'),
  isDev ? 'stock-zen-maroc-cache-dev' : 'stock-zen-maroc-cache',
);

ensureDirectory(cacheRoot);

const legacyCachePath = path.join(userDataRoot, 'Cache');
if (legacyCachePath !== cacheRoot && fs.existsSync(legacyCachePath)) {
  try {
    fs.rmSync(legacyCachePath, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to remove legacy cache directory', error);
  }
}

app.setPath('cache', cacheRoot);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const defaultAppData = {
  products: [],
  clients: [],
  sales: [],
  invoiceCounter: 0,
  productTypes: [...DEFAULT_PRODUCT_TYPES],
};

const setupStorageHandlers = () => {
  const dataRoot = app.getPath('userData');
  const dataFilePath = path.join(dataRoot, 'stock-data.json');

  const readDataFromDisk = () => {
    try {
      if (!fs.existsSync(dataFilePath)) {
        fs.mkdirSync(dataRoot, { recursive: true });
        fs.writeFileSync(dataFilePath, JSON.stringify(defaultAppData, null, 2), 'utf-8');
        return defaultAppData;
      }
      const raw = fs.readFileSync(dataFilePath, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      console.error('Failed to read data file, returning defaults', error);
      return defaultAppData;
    }
  };

  const writeDataToDisk = (data) => {
    try {
      fs.mkdirSync(dataRoot, { recursive: true });
      fs.writeFileSync(dataFilePath, JSON.stringify(data ?? defaultAppData, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to persist data file', error);
    }
  };

  ipcMain.on('storage:load', (event) => {
    event.returnValue = readDataFromDisk();
  });

  ipcMain.on('storage:save', (_event, data) => {
    writeDataToDisk(data);
  });
};

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith('about:blank#')) {
      return { action: 'allow' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && devServerURL) {
    await window.loadURL(devServerURL);
    // window.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
    await window.loadFile(indexHtml);
  }
};

app.whenReady().then(() => {
  setupStorageHandlers();

  createWindow().catch((error) => {
    console.error('Failed to create Electron window', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error('Failed to re-create Electron window', error);
        app.quit();
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
