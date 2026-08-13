const { app, BrowserWindow, ipcMain, Menu, dialog, shell, webContents } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { createWorker } = require('tesseract.js');

const packageJson = require('./package.json');
const appVersion = packageJson.version || '1.0.0';

// Windows 下大数据场景需要更大的 V8 堆内存，避免渲染进程崩溃
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-watchdog');
app.commandLine.appendSwitch('max-active-webgl-contexts', '16');
// 移除 renderer-process-limit=1，让 Chromium 按默认策略分配渲染进程，
// 避免 Windows 上单一渲染进程承载所有 webview 和页面导致内存瓶颈

let mainWindow;
let currentLang = 'zh';

function getDataDir() {
  if (app.isPackaged) {
    // 打包后：使用固定的 AppData 目录，确保持久化
    return path.join(app.getPath('userData'), '..', 'doris-data-export-helper');
  }
  // 开发环境：项目目录下的 data 文件夹
  return path.join(__dirname, 'data');
}

const dataDir = getDataDir();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const jsonCacheDir = path.join(dataDir, 'json_cache');
if (!fs.existsSync(jsonCacheDir)) {
  fs.mkdirSync(jsonCacheDir, { recursive: true });
}

const settingsPath = path.join(dataDir, 'settings.json');
let lastExportDir = '';
try {
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    if (settings.lastExportDir && fs.existsSync(settings.lastExportDir)) {
      lastExportDir = settings.lastExportDir;
    }
  }
} catch (_) {}

function saveLastExportDir(dir) {
  try {
    lastExportDir = dir;
    fs.writeFileSync(settingsPath, JSON.stringify({ lastExportDir: dir }, null, 2), 'utf-8');
  } catch (_) {}
}

function sanitizeFileName(name) {
  return (name || 'unknown').replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
}

function analyzeJsonStructure(data) {
  try {
    const DATA_KEYS = ['result', 'data', 'rows', 'records', 'list', 'items',
      'tableData', 'payload', 'content', 'listData', 'dataList',
      'queryResult', 'query_data', 'searchResult', 'RECORDS'];

    function isValidObject(item) {
      return item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length > 0;
    }

    function findArray(obj, depth, currentPath) {
      if (depth > 5 || !obj || typeof obj !== 'object') return null;
      if (Array.isArray(obj) && obj.length > 0) {
        // 跳过 null/undefined 元素，找到第一个有效对象
        const firstValid = obj.find(isValidObject);
        if (firstValid) {
          return { array: obj, path: currentPath, firstItem: firstValid };
        }
        // 如果数组元素是基本类型或空对象，继续递归检查元素内部
        for (let i = 0; i < Math.min(obj.length, 3); i++) {
          const found = findArray(obj[i], depth + 1, currentPath + (currentPath ? '.' : '') + i);
          if (found) return found;
        }
      }
      for (let i = 0; i < DATA_KEYS.length; i++) {
        const val = obj[DATA_KEYS[i]];
        if (Array.isArray(val) && val.length > 0) {
          const found = findArray(val, depth + 1, currentPath + (currentPath ? '.' : '') + DATA_KEYS[i]);
          if (found) return found;
        }
        if (val && typeof val === 'object') {
          const found = findArray(val, depth + 1, currentPath + (currentPath ? '.' : '') + DATA_KEYS[i]);
          if (found) return found;
        }
      }
      return null;
    }

    let result = null;
    if (Array.isArray(data) && data.length > 0) {
      const firstValid = data.find(isValidObject);
      if (firstValid) {
        result = { array: data, path: '', firstItem: firstValid };
      } else {
        result = findArray(data, 0, '');
      }
    } else {
      result = findArray(data, 0, '');
    }

    if (result && result.array && result.array.length > 0 && result.firstItem) {
      return {
        headers: Object.keys(result.firstItem),
        rowCount: result.array.length,
        colCount: Object.keys(result.firstItem).length,
        path: result.path
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function saveJsonToFile(entry) {
  try {
    const tabName = sanitizeFileName(entry.pageTitle || 'tab');
    const timestamp = entry.timestamp || Date.now();
    const fileName = tabName + '.json';
    const filePath = path.join(jsonCacheDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(entry.data), 'utf-8');
    const analysis = analyzeJsonStructure(entry.data);
    return {
      filePath, fileName,
      tabName: entry.pageTitle || '',
      url: entry.url,
      timestamp, size: entry.size,
      rowCount: entry.rowCount,
      headers: analysis ? analysis.headers : [],
      colCount: analysis ? analysis.colCount : 0,
      path: analysis ? analysis.path : ''
    };
  } catch (e) {
    console.error('[saveJsonToFile] error:', e.message);
    return null;
  }
}

let jsonFileCacheList = [];

function pushJsonFileCache(info) {
  if (!info) return;
  // 同 Tab 名的文件直接替换（文件名固定为 tabName.json）
  const existingIndex = jsonFileCacheList.findIndex(f => f && f.fileName === info.fileName);
  if (existingIndex !== -1) {
    jsonFileCacheList[existingIndex] = info;
    return;
  }
  jsonFileCacheList.push(info);
  if (jsonFileCacheList.length > 20) {
    const removed = jsonFileCacheList.splice(0, jsonFileCacheList.length - 20);
    for (let i = 0; i < removed.length; i++) {
      try {
        if (removed[i] && removed[i].filePath && fs.existsSync(removed[i].filePath)) {
          fs.unlinkSync(removed[i].filePath);
        }
      } catch (_) {}
    }
  }
}

function getJsonFileCacheList() {
  return jsonFileCacheList.filter(f => f && f.filePath && fs.existsSync(f.filePath));
}

function clearJsonFileCache() {
  try {
    for (let i = 0; i < jsonFileCacheList.length; i++) {
      try {
        if (jsonFileCacheList[i] && jsonFileCacheList[i].filePath && fs.existsSync(jsonFileCacheList[i].filePath)) {
          fs.unlinkSync(jsonFileCacheList[i].filePath);
        }
      } catch (_) {}
    }
    jsonFileCacheList = [];
  } catch (_) {}
}

// 开发环境覆盖 userData，打包环境使用默认
if (!app.isPackaged) {
  app.setPath('userData', dataDir);
}

const i18n = {
  zh: {
    menuLang: '语言', menuLangZh: '中文', menuLangEn: '英文',
    menuFile: '文件', menuExport: '导出 Excel', menuReload: '刷新', menuQuit: '退出',
    menuEdit: '编辑', menuUndo: '撤销', menuRedo: '重做', menuCut: '剪切', menuCopy: '复制', menuPaste: '粘贴',
    menuView: '视图', menuToggleDevTools: '开发者工具', menuFullScreen: '全屏',
    menuHelp: '帮助', menuAbout: '关于',
    aboutTitle: '关于', aboutContent: 'Doris 数据导出助手\n\n将网站中的查询结果导出为 Excel 文件。',
    defaultFileName: '查询结果',
  },
  en: {
    menuLang: 'Language', menuLangZh: 'Chinese', menuLangEn: 'English',
    menuFile: 'File', menuExport: 'Export Excel', menuReload: 'Reload', menuQuit: 'Quit',
    menuEdit: 'Edit', menuUndo: 'Undo', menuRedo: 'Redo', menuCut: 'Cut', menuCopy: 'Copy', menuPaste: 'Paste',
    menuView: 'View', menuToggleDevTools: 'Developer Tools', menuFullScreen: 'Full Screen',
    menuHelp: 'Help', menuAbout: 'About',
    aboutTitle: 'About', aboutContent: 'Doris Data Export Helper\n\nExport query results from websites to Excel files.',
    defaultFileName: 'result',
  }
};

function tr(key) { return (i18n[currentLang] && i18n[currentLang][key]) || key; }

function buildMenu() {
  const template = [
    {
      label: tr('menuFile'), submenu: [
        { label: tr('menuExport'), click: () => { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('menu-export'); } },
        { type: 'separator' },
        { label: tr('menuReload'), accelerator: 'F5', click: () => { if (mainWindow) mainWindow.reload(); } },
        { label: tr('menuQuit'), accelerator: 'Ctrl+Q', click: () => { app.quit(); } }
      ]
    },
    {
      label: tr('menuEdit'), submenu: [
        { label: tr('menuUndo'), role: 'undo' }, { label: tr('menuRedo'), role: 'redo' },
        { type: 'separator' },
        { label: tr('menuCut'), role: 'cut' }, { label: tr('menuCopy'), role: 'copy' }, { label: tr('menuPaste'), role: 'paste' }
      ]
    },
    {
      label: tr('menuView'), submenu: [
        { label: tr('menuToggleDevTools'), accelerator: 'F12', click: () => { if (mainWindow && mainWindow.webContents) mainWindow.webContents.toggleDevTools(); } },
        { label: tr('menuFullScreen'), accelerator: 'F11', click: () => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); } }
      ]
    },
    {
      label: tr('menuLang'), submenu: [
        { label: tr('menuLangZh'), type: 'radio', checked: currentLang === 'zh', click: () => { currentLang = 'zh'; buildMenu(); if (mainWindow) mainWindow.webContents.send('language-changed', currentLang); } },
        { label: tr('menuLangEn'), type: 'radio', checked: currentLang === 'en', click: () => { currentLang = 'en'; buildMenu(); if (mainWindow) mainWindow.webContents.send('language-changed', currentLang); } }
      ]
    },
    {
      label: tr('menuHelp'), submenu: [
        { label: tr('menuAbout'), click: () => { dialog.showMessageBox(mainWindow, { type: 'info', title: tr('aboutTitle'), message: 'Doris 数据导出助手', detail: `版本：v${appVersion}\n\n将网站中的查询结果导出为 Excel 文件。`, buttons: ['确定'] }); } }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getSettingsPath() {
  return path.join(dataDir, 'settings.json');
}
function loadSettings() {
  try { const p = getSettingsPath(); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) {}
  return {};
}
function saveSettings(s) {
  try {
    const p = getSettingsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf-8');
  } catch (_) {}
}

const settings = loadSettings();
currentLang = settings.language || 'zh';

function getCredentialsPath() {
  return path.join(dataDir, 'credentials.json');
}
function loadCredentials() {
  try { const p = getCredentialsPath(); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) {}
  return {};
}
function saveAllCredentials(data) {
  try {
    const p = getCredentialsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch (_) {}
}

let credentials = loadCredentials();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      // 降低后台节流，减少大数据场景下的内存波动
      backgroundThrottling: false
    }
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('did-finish-load', () => {
    const s = loadSettings();
    mainWindow.webContents.send('init-settings', {
      language: currentLang,
      lastUrl: s.lastUrl || '',
      lastSelector: s.lastSelector || '',
      lastFilename: s.lastFilename || '',
      expireMinutes: s.expireMinutes || 10,
    });
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

let mainCapturedResponses = [];
const MAX_MAIN_CAPTURES = 10;

// 提取 URL 的去重 key：同一查询的 running/cacheData 端点视为同一个
function getUrlDedupKey(url) {
  if (typeof url !== 'string') return url;
  // 对于 ds-standard-query 的 running/cacheData 端点，基于查询ID去重
  const m = url.match(/\/ds-standard-query\/(?:running|cacheData)\/(\d+\/\d+)/i);
  if (m && m[1]) {
    return 'ds-query:' + m[1];
  }
  // 对其他轮询 URL，去掉 timer 参数
  if (/\/(cacheData|running)\//i.test(url)) {
    try {
      const q = url.indexOf('?');
      if (q === -1) return url;
      const base = url.substring(0, q);
      const qs = url.substring(q + 1);
      const pairs = qs.split('&');
      const kept = [];
      for (let i = 0; i < pairs.length; i++) {
        if (!pairs[i].startsWith('timer=')) {
          kept.push(pairs[i]);
        }
      }
      return base + '?' + kept.sort().join('&');
    } catch(_) {}
  }
  return url;
}

function pushMainCapture(entry) {
  try {
    const now = Date.now();
    const dedupKey = getUrlDedupKey(entry.url);
    const existingIndex = mainCapturedResponses.findIndex(r => {
      return getUrlDedupKey(r.url) === dedupKey && (now - r.timestamp) < 300000; // 5分钟内相同key的去重
    });
    if (existingIndex !== -1) {
      const oldEntry = mainCapturedResponses[existingIndex];
      const oldRowCount = oldEntry.rowCount || 0;
      const newRowCount = entry.rowCount || 0;
      // 数据量更大的优先，或新数据有数据而旧的没有，则替换
      const newHasMoreData = newRowCount > oldRowCount;
      const oldNoData = !oldEntry.data && (!oldEntry.headers || oldEntry.headers.length === 0);
      const newHasData = entry.data || (entry.headers && entry.headers.length > 0);
      if (newHasMoreData || (newHasData && oldNoData)) {
        mainCapturedResponses[existingIndex] = entry;
      }
      return;
    }
    // 大数据（>2MB 或标记为 isHuge/isBig）立即释放 data 引用，保存到文件
    if (entry.data && (entry.isHuge || entry.isBig || (entry.size || 0) > 4 * 1024 * 1024)) {
      // 释放前先保存到文件缓存（如果没有 jsonFilePath）
      if (!entry.jsonFilePath) {
        try {
          const savedInfo = saveJsonToFile(entry);
          if (savedInfo) {
            entry.jsonFilePath = savedInfo.filePath;
            pushJsonFileCache(savedInfo);
          }
        } catch (_) {}
      }
      entry.data = null;
    }
    mainCapturedResponses.push(entry);
    if (mainCapturedResponses.length > MAX_MAIN_CAPTURES) {
      const removed = mainCapturedResponses.splice(0, mainCapturedResponses.length - MAX_MAIN_CAPTURES);
      for (let i = 0; i < removed.length; i++) {
        if (removed[i] && removed[i].data) {
          removed[i].data = null;
        }
      }
    }
    // 如果总数据量超过 50MB，释放所有条目的 data 引用
    let totalSize = 0;
    for (let i = 0; i < mainCapturedResponses.length; i++) {
      totalSize += mainCapturedResponses[i].size || 0;
    }
    if (totalSize > 50 * 1024 * 1024) {
      for (let i = 0; i < mainCapturedResponses.length; i++) {
        if (mainCapturedResponses[i] && mainCapturedResponses[i].data) {
          mainCapturedResponses[i].data = null;
        }
      }
    }
  } catch (_) {}
}

function getMainCaptures() {
  // 返回轻量数据，避免 IPC 传输大数据对象导致渲染进程内存崩溃
  return mainCapturedResponses.map((r, index) => {
    const light = {
      url: r.url,
      timestamp: r.timestamp,
      size: r.size,
      rowCount: r.rowCount,
      isBig: r.isBig,
      isHuge: r.isHuge,
      pageTitle: r.pageTitle,
      headers: r.headers || [],
      colCount: r.colCount || 0,
      path: r.path || '',
      jsonFilePath: r.jsonFilePath || '',  // 传递文件缓存路径，供导出时使用
      _mainIndex: index  // 保留主进程数组中的原始索引，确保导出时能正确定位
    };
    // 只有小数据（<=5000行）才传递完整 data 到渲染进程
    if (r.data && r.rowCount && r.rowCount <= 5000) {
      light.data = r.data;
    }
    return light;
  });
}

function clearMainCaptures() {
  mainCapturedResponses = [];
}

function clearMainCapturesByTab(tabTitle) {
  if (!tabTitle) return 0;
  const lowerTitle = String(tabTitle).toLowerCase();
  let removed = 0;
  for (let i = mainCapturedResponses.length - 1; i >= 0; i--) {
    const r = mainCapturedResponses[i];
    const pt = (r && r.pageTitle) ? String(r.pageTitle).toLowerCase() : '';
    if (pt === lowerTitle || pt.indexOf(lowerTitle) >= 0 || lowerTitle.indexOf(pt) >= 0) {
      if (r && r.data) r.data = null;
      mainCapturedResponses.splice(i, 1);
      removed++;
    }
  }
  // 清理对应的 json 缓存文件
  const tabName = sanitizeFileName(tabTitle);
  const cacheFilePath = path.join(jsonCacheDir, tabName + '.json');
  try {
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }
  } catch (_) {}
  // 从缓存列表中移除
  const fileIdx = jsonFileCacheList.findIndex(f => f && f.fileName === tabName + '.json');
  if (fileIdx !== -1) jsonFileCacheList.splice(fileIdx, 1);
  return removed;
}

// 根据 path 从 JSON 对象中提取数组
function getArrayByPath(data, path) {
  if (!path || path === 'root') return data;
  const parts = path.split('.');
  let current = data;
  for (let i = 1; i < parts.length; i++) {
    if (current && typeof current === 'object') {
      current = current[parts[i]];
    } else {
      return null;
    }
  }
  return current;
}

// ========== IPC handlers ==========
ipcMain.handle('get-language', () => currentLang);

ipcMain.handle('save-user-input', (_event, data) => {
  try {
    const s = loadSettings();
    if (data && typeof data.url !== 'undefined') s.lastUrl = data.url;
    if (data && typeof data.selector !== 'undefined') s.lastSelector = data.selector;
    if (data && typeof data.filename !== 'undefined') s.lastFilename = data.filename;
    if (data && data.language) s.language = data.language;
    if (data && typeof data.expireMinutes !== 'undefined') s.expireMinutes = data.expireMinutes;
    saveSettings(s);
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
});

// 凭证 IPC — 兼容 siteKey 和 key
ipcMain.handle('save-credentials', (_event, data) => {
  const key = (data && (data.siteKey || data.key)) || '';
  if (!key) return { success: false };
  try {
    credentials[key] = { username: data.username || '', password: data.password || '', updatedAt: new Date().toISOString() };
    saveAllCredentials(credentials);
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
});

ipcMain.handle('get-credentials', (_event, data) => {
  const key = (data && (data.siteKey || data.key)) || '';
  if (!key) return { success: false, username: '', password: '' };
  const c = credentials[key];
  return { success: !!c, username: c ? c.username : '', password: c ? c.password : '' };
});

ipcMain.handle('delete-credentials', (_event, data) => {
  const key = (data && (data.siteKey || data.key)) || '';
  if (!key) return { success: false };
  delete credentials[key];
  saveAllCredentials(credentials);
  return { success: true };
});

ipcMain.handle('list-credentials', () => {
  try {
    const list = Object.entries(credentials).map(([siteKey, cred]) => ({
      siteKey,
      username: cred.username || '',
      updatedAt: cred.updatedAt || ''
    }));
    return { success: true, list };
  }
  catch (e) { return { success: false, message: e.message, list: [] }; }
});

// webview preload 通过 IPC 发送捕获的 JSON 到主进程
ipcMain.on('json-captured', (_event, entry) => {
  if (entry && entry.data && typeof entry.data === 'object') {
    // 预先分析数据结构并缓存元数据，避免后续 IPC 传输大数据导致渲染进程崩溃
    try {
      const analysis = analyzeJsonStructure(entry.data);
      if (analysis) {
        entry.headers = analysis.headers;
        entry.colCount = analysis.colCount;
        entry.path = analysis.path;
      }
    } catch (_) {}
    pushMainCapture(entry);
  }
});

// renderer 获取已捕获的 JSON 列表
ipcMain.handle('get-captured-json', () => {
  return { success: true, captures: getMainCaptures() };
});

// renderer 清空捕获
ipcMain.handle('clear-captured-json', () => {
  clearMainCaptures();
  clearJsonFileCache();
  return { success: true };
});

// webview 关闭 Tab 时，清理对应 Tab 的数据
ipcMain.on('clear-tab-json', (_event, tabTitle) => {
  clearMainCapturesByTab(tabTitle);
});

// webview 发送大数据到主进程保存为文件（避免 webview 内存溢出）
ipcMain.handle('save-json-file', (_event, entry) => {
  try {
    if (!entry || !entry.data || typeof entry.data !== 'object') {
      return { success: false, message: 'invalid data' };
    }
    const info = saveJsonToFile(entry);
    if (info) {
      pushJsonFileCache(info);
      entry.data = null;
      return { success: true, info };
    }
    return { success: false, message: 'save failed' };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// webview 直接发送 JSON 文本到主进程（避免 IPC 结构化克隆的内存开销）
ipcMain.handle('save-json-text', (_event, payload) => {
  try {
    if (!payload || !payload.text) {
      return { success: false, message: 'invalid payload' };
    }
    const tabName = sanitizeFileName(payload.pageTitle || 'tab');
    const timestamp = payload.timestamp || Date.now();
    const fileName = tabName + '.json';
    const filePath = path.join(jsonCacheDir, fileName);
    fs.writeFileSync(filePath, payload.text, 'utf-8');
    const data = JSON.parse(payload.text);
    const analysis = analyzeJsonStructure(data);
    const info = {
      filePath, fileName,
      tabName: payload.pageTitle || '',
      url: payload.url || '',
      timestamp, size: payload.size || 0,
      rowCount: analysis ? analysis.rowCount : 0,
      headers: analysis ? analysis.headers : [],
      colCount: analysis ? analysis.colCount : 0,
      path: analysis ? analysis.path : ''
    };
    pushJsonFileCache(info);
    return { success: true, info };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// 监听 webview 发送的 JSON 文本（大数预存为文件）
ipcMain.on('json-captured-text', (_event, payload) => {
  try {
    if (!payload || !payload.text) return;
    const tabName = sanitizeFileName(payload.pageTitle || 'tab');
    const timestamp = payload.timestamp || Date.now();
    const fileName = tabName + '.json';
    const filePath = path.join(jsonCacheDir, fileName);
    fs.writeFileSync(filePath, payload.text, 'utf-8');
    let analysis = null;
    try {
      const data = JSON.parse(payload.text);
      analysis = analyzeJsonStructure(data);
    } catch (e) {}
    const info = {
      filePath, fileName,
      tabName: payload.pageTitle || '',
      url: payload.url || '',
      timestamp, size: payload.size || 0,
      rowCount: analysis ? analysis.rowCount : 0,
      headers: analysis ? analysis.headers : [],
      colCount: analysis ? analysis.colCount : 0,
      path: analysis ? analysis.path : ''
    };
    pushJsonFileCache(info);
  } catch (e) {}
});

// 监听 webview 请求主进程重新获取大数据并保存（webview 不读取响应以避免内存溢出）
ipcMain.on('re-fetch-and-save', (_event, payload) => {
  try {
    if (!payload || !payload.url) return;
    const url = payload.url;
    const tabName = sanitizeFileName(payload.pageTitle || 'tab');
    const timestamp = payload.timestamp || Date.now();
    const fileName = tabName + '.json';
    const filePath = path.join(jsonCacheDir, fileName);

    const http = url.startsWith('https') ? require('https') : require('http');
    const urlObj = new URL(url);

    if (!mainWindow || !mainWindow.webContents) return;

    mainWindow.webContents.session.cookies.get({ url: urlObj.origin }, (error, cookies) => {
      if (error) {
        console.error('[re-fetch-and-save] get cookies error:', error);
        return;
      }

      const cookieHeader = cookies.map(c => c.name + '=' + c.value).join('; ');
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (url.startsWith('https') ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: payload.method || 'GET',
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        rejectUnauthorized: false
      };

      const req = http.request(options, (res) => {
        // 使用流式写入，避免大响应字符串累积导致主进程内存暴涨
        const fileStream = fs.createWriteStream(filePath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          try {
            const stats = fs.statSync(filePath);
            let analysis = null;
            try {
              // 大文件分析：读取后立即解析并释放引用
              const rawData = fs.readFileSync(filePath, 'utf-8');
              const data = JSON.parse(rawData);
              analysis = analyzeJsonStructure(data);
              // 立即释放大对象引用，让 GC 回收
            } catch (e) {}
            const info = {
              filePath, fileName,
              tabName: payload.pageTitle || '',
              url: url,
              timestamp, size: stats.size,
              rowCount: analysis ? analysis.rowCount : 0,
              headers: analysis ? analysis.headers : [],
              colCount: analysis ? analysis.colCount : 0,
              path: analysis ? analysis.path : ''
            };
            pushJsonFileCache(info);
            pushMainCapture({
              url: url,
              timestamp: timestamp,
              size: stats.size,
              rowCount: analysis ? analysis.rowCount : 0,
              isBig: true,
              isHuge: true,
              pageTitle: payload.pageTitle || '',
              headers: analysis ? analysis.headers : [],
              colCount: analysis ? analysis.colCount : 0,
              path: analysis ? analysis.path : '',
              jsonFilePath: filePath
            });
            // 主动触发 GC（如果可用）
            if (global.gc) {
              try { global.gc(); } catch (_) {}
            }
          } catch (e) {
            console.error('[re-fetch-and-save] save error:', e);
          }
        });
        fileStream.on('error', (err) => {
          console.error('[re-fetch-and-save] file stream error:', err);
        });
      });

      req.on('error', (e) => {
        console.error('[re-fetch-and-save] request error:', e);
      });

      req.end();
    });
  } catch (e) {
    console.error('[re-fetch-and-save] error:', e);
  }
});

// 获取文件缓存列表
ipcMain.handle('get-json-file-list', () => {
  return { success: true, files: getJsonFileCacheList() };
});

// 打开文件/文件夹
ipcMain.handle('open-path', (_event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }
    return { success: false, message: currentLang === 'zh' ? '文件不存在' : 'File not found' };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('open-folder', (_event, folderPath) => {
  try {
    const target = folderPath || dataDir;
    if (fs.existsSync(target)) {
      // Windows 上使用 explorer 打开文件夹更可靠
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        exec('explorer "' + target + '"');
      } else {
        shell.openPath(target);
      }
      return { success: true };
    }
    return { success: false, message: currentLang === 'zh' ? '文件夹不存在' : 'Folder not found' };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// 导出 Excel — 主进程直接从 webview 分批获取数据，避免渲染进程 IPC 阻塞导致假死
ipcMain.handle('export-excel', async (_event, { sourceInfo, defaultFileName }) => {
  try {
    if (!sourceInfo || !sourceInfo.headers || !sourceInfo.headers.length) {
      return { success: false, message: currentLang === 'zh' ? '没有可导出的数据' : 'No data to export' };
    }

    // 1. 生成文件名
    let fname = defaultFileName || (tr('defaultFileName') + '_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
    if (!fname.toLowerCase().endsWith('.xlsx')) fname += '.xlsx';
    fname = fname.replace(/[\\/:*?"<>|]/g, '_');

    // 默认目录：优先使用上次导出目录，其次是用户下载目录，最后回退到桌面/主目录
    let defaultDir = lastExportDir;
    if (!defaultDir) {
      try {
        defaultDir = app.getPath('downloads');
      } catch (_) {
        try {
          defaultDir = app.getPath('desktop');
        } catch (_) {
          try {
            defaultDir = app.getPath('home');
          } catch (_) {
            defaultDir = __dirname;
          }
        }
      }
    }

    const dialogResult = await dialog.showSaveDialog(mainWindow, {
      title: currentLang === 'zh' ? '保存 Excel 文件' : 'Save Excel File',
      defaultPath: path.join(defaultDir, fname),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { success: false, message: currentLang === 'zh' ? '用户取消了保存' : 'User canceled save' };
    }

    // 2. 构建 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(currentLang === 'zh' ? '查询结果' : 'Result');

    // 表头样式
    const hRow = ws.addRow(sourceInfo.headers);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    hRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // 3. 获取 webview 的 webContents（用于直接获取大数据）
    let wc = null;
    if (sourceInfo.webviewId) {
      try {
        wc = webContents.fromId(sourceInfo.webviewId);
      } catch (_) {}
    }

    const rowCount = sourceInfo.rowCount || 0;

    // 4. 写入数据行
    if (sourceInfo.rows && sourceInfo.rows.length > 0) {
      for (const row of sourceInfo.rows) {
        ws.addRow(row);
      }
    } else if (sourceInfo.jsonFilePath && fs.existsSync(sourceInfo.jsonFilePath)) {
      // 文件缓存模式：从JSON文件读取数据导出，避免内存占用
      const fileData = JSON.parse(fs.readFileSync(sourceInfo.jsonFilePath, 'utf-8'));
      const arr = getArrayByPath(fileData, sourceInfo.path);
      if (Array.isArray(arr)) {
        const BATCH_SIZE = 5000;
        const headers = sourceInfo.headers;
        const totalRows = arr.length;
        let processed = 0;
        for (let i = 0; i < arr.length; i += BATCH_SIZE) {
          const end = Math.min(i + BATCH_SIZE, arr.length);
          for (let idx = i; idx < end; idx++) {
            const item = arr[idx];
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              const row = [];
              for (let h = 0; h < headers.length; h++) {
                const v = item[headers[h]];
                if (v === null || v === undefined) row.push('');
                else if (typeof v === 'object') row.push(JSON.stringify(v));
                else row.push(v);
              }
              ws.addRow(row);
            } else if (Array.isArray(item)) {
              const row = [];
              for (let h = 0; h < item.length; h++) {
                const v = item[h];
                if (v === null || v === undefined) row.push('');
                else if (typeof v === 'object') row.push(JSON.stringify(v));
                else row.push(v);
              }
              ws.addRow(row);
            } else {
              ws.addRow([item]);
            }
          }
          processed += (end - i);
          if (mainWindow) {
            mainWindow.webContents.send('export-progress', { processed, total: totalRows });
          }
        }
      } else {
        return { success: false, message: currentLang === 'zh' ? '文件数据中未找到对应数组，请重新查询' : 'Array not found in file data, please re-query' };
      }
    } else if (typeof sourceInfo.mainCaptureIndex === 'number' && mainCapturedResponses[sourceInfo.mainCaptureIndex]) {
      const capture = mainCapturedResponses[sourceInfo.mainCaptureIndex];
      // 如果 data 已释放，但有 jsonFilePath 或 sourceInfo.jsonFilePath，从文件读取
      const captureFilePath = sourceInfo.jsonFilePath || capture.jsonFilePath || '';
      if (!capture.data) {
        if (captureFilePath && fs.existsSync(captureFilePath)) {
          // 回退到文件缓存路径
          const fileData = JSON.parse(fs.readFileSync(captureFilePath, 'utf-8'));
          const arr = getArrayByPath(fileData, sourceInfo.path);
          if (Array.isArray(arr)) {
            const BATCH_SIZE = 5000;
            const headers = sourceInfo.headers;
            const totalRows = arr.length;
            let processed = 0;
            for (let i = 0; i < arr.length; i += BATCH_SIZE) {
              const end = Math.min(i + BATCH_SIZE, arr.length);
              for (let idx = i; idx < end; idx++) {
                const item = arr[idx];
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                  const row = [];
                  for (let h = 0; h < headers.length; h++) {
                    const v = item[headers[h]];
                    if (v === null || v === undefined) row.push('');
                    else if (typeof v === 'object') row.push(JSON.stringify(v));
                    else row.push(v);
                  }
                  ws.addRow(row);
                } else if (Array.isArray(item)) {
                  const row = [];
                  for (let h = 0; h < item.length; h++) {
                    const v = item[h];
                    if (v === null || v === undefined) row.push('');
                    else if (typeof v === 'object') row.push(JSON.stringify(v));
                    else row.push(v);
                  }
                  ws.addRow(row);
                } else {
                  ws.addRow([item]);
                }
              }
              processed += (end - i);
              if (mainWindow) {
                mainWindow.webContents.send('export-progress', { processed, total: totalRows });
              }
            }
          } else {
            return { success: false, message: currentLang === 'zh' ? '文件数据中未找到对应数组，请重新查询' : 'Array not found in file data, please re-query' };
          }
        } else {
          return { success: false, message: currentLang === 'zh' ? '数据已从内存释放，请重新查询后再导出' : 'Data released from memory, please re-query before exporting' };
        }
      } else {
        // capture.data 存在，从内存读取
        const arr = getArrayByPath(capture.data, sourceInfo.path);
        if (Array.isArray(arr)) {
          const BATCH_SIZE = 5000;
          const headers = sourceInfo.headers;
          const totalRows = arr.length;
          let processed = 0;
          for (let i = 0; i < arr.length; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE, arr.length);
            for (let idx = i; idx < end; idx++) {
              const item = arr[idx];
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                const row = [];
                for (let h = 0; h < headers.length; h++) {
                  const v = item[headers[h]];
                  if (v === null || v === undefined) row.push('');
                  else if (typeof v === 'object') row.push(JSON.stringify(v));
                  else row.push(v);
                }
                ws.addRow(row);
              } else if (Array.isArray(item)) {
                const row = [];
                for (let h = 0; h < item.length; h++) {
                  const v = item[h];
                  if (v === null || v === undefined) row.push('');
                  else if (typeof v === 'object') row.push(JSON.stringify(v));
                  else row.push(v);
                }
                ws.addRow(row);
              } else {
                ws.addRow([item]);
              }
            }
            processed += (end - i);
            if (mainWindow) {
              mainWindow.webContents.send('export-progress', { processed, total: totalRows });
            }
          }
        } else {
          return { success: false, message: currentLang === 'zh' ? '主进程数据中未找到对应数组，请重新查询' : 'Array not found in main process data, please re-query' };
        }
      }
    } else if (wc && sourceInfo.cacheId) {
      // 大数据模式：主进程直接从 webview 分批获取，避免渲染进程阻塞
      const BATCH_SIZE = 5000;
      try {
        for (let i = 0; i < rowCount; i += BATCH_SIZE) {
          const end = Math.min(i + BATCH_SIZE, rowCount);
          const rows = await wc.executeJavaScript(`
            (function() {
              const c = window.__exportDataCache && window.__exportDataCache['${sourceInfo.cacheId}'];
              if (!c) return [];
              // 小数据模式：已缓存完整 rows
              if (c.rows && c.rows.length > 0) {
                return c.rows.slice(${i}, ${end});
              }
              // 大数据模式：从原始数组引用动态提取
              if (c.originalArray) {
                const arr = c.originalArray;
                const headers = c.headers;
                const result = [];
                const start = ${i};
                const endIdx = Math.min(${end}, arr.length);
                for (let idx = start; idx < endIdx; idx++) {
                  const item = arr[idx];
                  if (item && typeof item === 'object' && !Array.isArray(item)) {
                    const row = [];
                    for (let h = 0; h < headers.length; h++) {
                      const v = item[headers[h]];
                      if (v === null || v === undefined) row.push('');
                      else if (typeof v === 'object') row.push(JSON.stringify(v));
                      else row.push(v);
                    }
                    result.push(row);
                  } else if (Array.isArray(item)) {
                    const row = [];
                    for (let h = 0; h < item.length; h++) {
                      const v = item[h];
                      if (v === null || v === undefined) row.push('');
                      else if (typeof v === 'object') row.push(JSON.stringify(v));
                      else row.push(v);
                    }
                    result.push(row);
                  } else {
                    result.push([item]);
                  }
                }
                return result;
              }
              return [];
            })()
          `);
          for (const row of rows) {
            ws.addRow(row);
          }
        }
      } catch (webviewErr) {
        return { success: false, message: currentLang === 'zh' ? '页面数据已失效，请重新查询后再导出' : 'Page data expired, please re-query before exporting' };
      }
    } else {
      return { success: false, message: currentLang === 'zh' ? '无法获取数据，请重试' : 'Cannot get data, please retry' };
    }

    // 5. 调整列宽
    for (let i = 1; i <= sourceInfo.headers.length; i++) {
      let maxLen = String(sourceInfo.headers[i - 1] || '').length;
      ws.getColumn(i).width = Math.min(Math.max(maxLen + 2, 10), 50);
    }

    // 6. 保存文件
    let targetPath = path.resolve(dialogResult.filePath);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    let finalPath = targetPath;
    let warning = null;
    try {
      await workbook.xlsx.writeFile(targetPath);
    } catch (writeErr) {
      const fbDir = dataDir;
      finalPath = path.join(fbDir, fname);
      try {
        const buffer = await workbook.xlsx.writeBuffer();
        await fs.promises.writeFile(finalPath, buffer);
        warning = currentLang === 'zh'
          ? `所选位置无权限，已自动保存到: ${finalPath}`
          : `No permission for selected path. Auto-saved to: ${finalPath}`;
      } catch (fallbackErr) {
        return { success: false, message: currentLang === 'zh' ? '文件保存失败: ' + fallbackErr.message : 'File save failed: ' + fallbackErr.message };
      }
    }

    // 7. 验证
    if (!fs.existsSync(finalPath)) {
      return { success: false, message: currentLang === 'zh' ? '文件保存后验证失败，文件不存在' : 'File verification failed after save' };
    }
    const stats = fs.statSync(finalPath);
    if (stats.size === 0) {
      return { success: false, message: currentLang === 'zh' ? '文件保存后验证失败，文件大小为0' : 'File verification failed, file size is 0' };
    }

    if (wc && sourceInfo.cacheId) {
      try {
        wc.executeJavaScript(`
          (function() {
            if (window.__exportDataCache && window.__exportDataCache['${sourceInfo.cacheId}']) {
              delete window.__exportDataCache['${sourceInfo.cacheId}'];
            }
          })()
        `);
      } catch (_) {}
    }

    saveLastExportDir(path.dirname(finalPath));
    return { success: true, filePath: finalPath, warning };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
});

// OCR 识别验证码
ipcMain.handle('ocr-captcha', async (_event, base64Image) => {
  let worker = null;
  try {
    worker = await createWorker('eng', 1, {
      logger: () => {}, // 静默日志
      errorHandler: () => {}
    });
    // 限制识别字符为字母数字，提高验证码识别率
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    });
    const ret = await worker.recognize(base64Image);
    await worker.terminate();
    const text = ret.data.text.trim().replace(/\s/g, '').replace(/[^a-zA-Z0-9]/g, '');
    return { success: true, text };
  } catch (e) {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
    return { success: false, message: e.message || String(e) };
  }
});

app.on('ready', () => { buildMenu(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) { buildMenu(); createWindow(); } });

// 定期清理过期数据，避免主进程内存无限增长
setInterval(() => {
  try {
    const now = Date.now();
    // 1. 清理主进程内存中过期的捕获（30分钟过期）
    let removedCaptures = 0;
    for (let i = mainCapturedResponses.length - 1; i >= 0; i--) {
      const r = mainCapturedResponses[i];
      if (!r || (r.timestamp || 0) <= now - 30 * 60 * 1000) {
        if (r && r.data) r.data = null;
        mainCapturedResponses.splice(i, 1);
        removedCaptures++;
      }
    }
    // 2. 当总数据量超过 30MB 时，释放剩余条目的 data 引用（保留元数据）
    let totalSize = 0;
    for (let i = 0; i < mainCapturedResponses.length; i++) {
      totalSize += mainCapturedResponses[i].size || 0;
    }
    if (totalSize > 30 * 1024 * 1024) {
      for (let i = 0; i < mainCapturedResponses.length; i++) {
        if (mainCapturedResponses[i] && mainCapturedResponses[i].data) {
          mainCapturedResponses[i].data = null;
        }
      }
    }
    // 3. 清理过期的文件缓存（60分钟过期）
    let removedFiles = 0;
    for (let i = jsonFileCacheList.length - 1; i >= 0; i--) {
      const f = jsonFileCacheList[i];
      if (!f || (f.timestamp || 0) <= now - 60 * 60 * 1000) {
        try {
          if (f && f.filePath && fs.existsSync(f.filePath)) {
            fs.unlinkSync(f.filePath);
          }
        } catch (_) {}
        jsonFileCacheList.splice(i, 1);
        removedFiles++;
      }
    }
    if (removedCaptures > 0 || removedFiles > 0) {
      console.log('[cleanup] removed', removedCaptures, 'captures,', removedFiles, 'files');
    }
  } catch (_) {}
}, 60 * 1000); // 每分钟检查一次