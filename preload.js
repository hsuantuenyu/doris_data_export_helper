const { contextBridge, ipcRenderer } = require('electron');

const api = {
  exportExcel: (data) => ipcRenderer.invoke('export-excel', data),
  getLanguage: () => ipcRenderer.invoke('get-language'),
  getWebviewPreload: () => {
    try {
      const path = require('path');
      let preloadPath = path.join(__dirname, 'renderer', 'webview-preload.js');
      const fs = require('fs');
      if (fs.existsSync(preloadPath)) {
        return preloadPath;
      }
      const asarUnpacked = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'renderer', 'webview-preload.js');
      if (fs.existsSync(asarUnpacked)) {
        return asarUnpacked;
      }
      return preloadPath;
    } catch (_) {
      return '';
    }
  },
  onLanguageChanged: (callback) => {
    const handler = (_event, lang) => callback(lang);
    ipcRenderer.on('language-changed', handler);
    return () => ipcRenderer.removeListener('language-changed', handler);
  },
  onInitSettings: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on('init-settings', handler);
    return () => ipcRenderer.removeListener('init-settings', handler);
  },
  onMenuExport: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('menu-export', handler);
    return () => ipcRenderer.removeListener('menu-export', handler);
  },
  onExportProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('export-progress', handler);
    return () => ipcRenderer.removeListener('export-progress', handler);
  },
  getCredentials: (data) => ipcRenderer.invoke('get-credentials', data),
  saveCredentials: (data) => ipcRenderer.invoke('save-credentials', data),
  deleteCredentials: (data) => ipcRenderer.invoke('delete-credentials', data),
  listCredentials: () => ipcRenderer.invoke('list-credentials'),
  saveUserInput: (data) => ipcRenderer.invoke('save-user-input', data),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  ocrCaptcha: (base64Image) => ipcRenderer.invoke('ocr-captcha', base64Image),
  getCapturedJson: () => ipcRenderer.invoke('get-captured-json'),
  clearCapturedJson: () => ipcRenderer.invoke('clear-captured-json'),
  getJsonFileList: () => ipcRenderer.invoke('get-json-file-list'),
};

try {
  contextBridge.exposeInMainWorld('electronAPI', api);
} catch (_) {
  window.electronAPI = api;
}
