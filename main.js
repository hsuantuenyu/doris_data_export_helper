const { app, BrowserWindow, ipcMain, Menu, dialog, shell, webContents } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { createWorker } = require('tesseract.js');

const packageJson = require('./package.json');
const appVersion = packageJson.version || '1.0.0';

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-watchdog');
app.commandLine.appendSwitch('max-active-webgl-contexts', '16');
app.commandLine.appendSwitch('renderer-process-limit', '1');

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

function sanitizeFileName(name) {
  return (name || 'unknown').replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
}

function analyzeJsonStructure(data) {
  try {
    const DATA_KEYS = ['result', 'data', 'rows', 'records', 'list', 'items',
      'tableData', 'payload', 'content', 'listData', 'dataList',
      'queryResult', 'query_data', 'searchResult', 'RECORDS'];

    function findArray(obj, depth, currentPath) {
      if (depth > 5 || !obj || typeof obj !== 'object') return null;
      if (Array.isArray(obj) && obj.length > 0 && obj[0] && typeof obj[0] === 'object') {
        return { array: obj, path: currentPath };
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
    if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
      result = { array: data, path: '' };
    } else {
      result = findArray(data, 0, '');
    }

    if (result && result.array && result.array.length > 0) {
      const firstItem = result.array[0];
      return {
        headers: Object.keys(firstItem),
        rowCount: result.array.length,
        colCount: Object.keys(firstItem).length,
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
    const fileName = tabName + '_' + timestamp + '.json';
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
  jsonFileCacheList.push(info);
  if (jsonFileCacheList.length > 10) {
    const removed = jsonFileCacheList.splice(0, jsonFileCacheList.length - 10);
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
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
const MAX_MAIN_CAPTURES = 30;

function pushMainCapture(entry) {
  try {
    const now = Date.now();
    const existingIndex = mainCapturedResponses.findIndex(r => r.url === entry.url && (now - r.timestamp) < 5000);
    if (existingIndex !== -1) {
      mainCapturedResponses[existingIndex] = entry;
      return;
    }
    mainCapturedResponses.push(entry);
    if (mainCapturedResponses.length > MAX_MAIN_CAPTURES) {
      mainCapturedResponses.splice(0, mainCapturedResponses.length - MAX_MAIN_CAPTURES);
    }
  } catch (_) {}
}

function getMainCaptures() {
  return mainCapturedResponses;
}

function clearMainCaptures() {
  mainCapturedResponses = [];
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
    const fileName = tabName + '_' + timestamp + '.json';
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
    const fileName = tabName + '_' + timestamp + '.json';
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

    let defaultDir = __dirname;

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