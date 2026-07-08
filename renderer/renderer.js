// ==================== 多语言字典 ====================
const I18N = {
  zh: {
    title: 'Doris 数据导出助手',
    brand: 'Doris 导出助手',
    labelUrl: '目标地址:',
    phUrl: '输入目标网站地址，如 http://xxx.com',
    btnGo: '前往',
    labelRemember: '记住账号',
    labelSelector: '表格选择器:',
    phSelector: 'CSS选择器（HTML模式）',
    btnAuto: '自动检测',
    btnPick: '元素选取',
    btnPicking: '选取中...',
    labelFilename: '文件名:',
    phFilename: '自定义文件名（不含扩展名）',
    btnExport: '导出 Excel',
    statusReady: '就绪',
    statusLoading: '正在加载...',
    statusLoaded: '页面加载完成',
    statusExtracting: '正在提取数据...',
    statusExporting: '正在导出...',
    msgPickTable: '请在页面中点击要导出的表格...',
    msgTableSelected: '已选择表格',
    msgNoTable: '未选择到表格，请重试',
    msgNeedSelector: '请先输入表格选择器或使用自动检测',
    msgExtractFail: '提取失败:',
    msgNoHeaders: '未能提取到表头，请检查选择器',
    msgAutoDetect: (total, rows, cols) => `检测到 ${total} 个表格，已选择最大的 (${rows}行 × ${cols}列)`,
    msgAutoFail: '自动检测失败:',
    msgEmptyTable: '页面中未检测到任何有数据的表格。请先进行数据查询后再导出',
    msgExportSuccess: '导出成功:',
    msgExportFail: '导出失败:',
    msgCredSaved: '账号已保存，下次访问自动填充',
    msgCredRemoved: '已清除该网站的保存账号',
    msgLoadFailed: '加载失败:',
    msgFilled: '已自动填充账号',
    msgFound: (row, col) => `提取到 ${row} 行 × ${col} 列，正在导出...`,
    msgSaveSettingsFail: '保存设置失败:',
    modalTitle: '选择要导出的数据',
    msgNoSources: '未检测到可导出的数据。请先在页面中执行查询后再试。',
    msgSelectSource: '点击选择要导出的数据源',
    msgJsonSource: '来自网络响应',
    msgHtmlSource: '来自页面表格',
    msgJsonCapture: '已捕获 {n} 个JSON响应',
    msgHtmlFound: '在页面中找到 {n} 个表格',
    msgFallback: '回退方案',
    msgCancel: '取消',
    msgConfirm: '导出所选',
    msgUsingJson: '使用网络JSON数据：{row} 行 × {col} 列',
    msgUsingHtml: '使用HTML表格数据：{row} 行 × {col} 列',
    msgJsonReady: '可从网络JSON导出：{n} 个可用',
    msgClickExport: '点击"导出 Excel"选择数据源',
    msgCredManagerTitle: '已保存的账号',
    msgCredManagerEmpty: '暂无保存的账号',
    msgCredManagerDelete: '删除',
    msgSavePromptTitle: '是否保存此网站的账号密码？',
    msgSavePromptSave: '保存',
    msgSavePromptCancel: '否',
    msgOpenFile: '打开文件',
    msgOpenFolder: '打开文件夹',
    msgCredDeleted: '已删除该网站的保存账号',
    msgCaptchaFilled: '已自动填充验证码',
  },
  en: {
    title: 'Doris Data Export Helper',
    brand: 'Doris Export Helper',
    labelUrl: 'Target URL:',
    phUrl: 'Enter target URL, e.g. http://xxx.com',
    btnGo: 'Go',
    labelRemember: 'Remember me',
    labelSelector: 'Selector:',
    phSelector: 'CSS selector (HTML mode)',
    btnAuto: 'Auto Detect',
    btnPick: 'Pick Element',
    btnPicking: 'Picking...',
    labelFilename: 'Filename:',
    phFilename: 'Custom filename (no extension)',
    btnExport: 'Export Excel',
    statusReady: 'Ready',
    statusLoading: 'Loading...',
    statusLoaded: 'Page loaded',
    statusExtracting: 'Extracting data...',
    statusExporting: 'Exporting...',
    msgPickTable: 'Click on a table in the page...',
    msgTableSelected: 'Table selected',
    msgNoTable: 'No table detected, please retry',
    msgNeedSelector: 'Enter a selector or use Auto Detect',
    msgExtractFail: 'Extract failed:',
    msgNoHeaders: 'No headers found, check selector',
    msgAutoDetect: (total, rows, cols) => `${total} tables found, largest selected (${rows} rows × ${cols} cols)`,
    msgAutoFail: 'Auto detect failed:',
    msgEmptyTable: 'No data tables found. Please run a query first or try "Auto Detect".',
    msgExportSuccess: 'Exported to:',
    msgExportFail: 'Export failed:',
    msgCredSaved: 'Credentials saved. Auto-fill next time.',
    msgCredRemoved: 'Saved credentials cleared',
    msgLoadFailed: 'Load failed:',
    msgFilled: 'Auto-filled saved credentials',
    msgFound: (row, col) => `${row} rows × ${col} cols extracted, exporting...`,
    msgSaveSettingsFail: 'Settings save failed:',
    modalTitle: 'Select data to export',
    msgNoSources: 'No exportable data found. Please run a query first.',
    msgSelectSource: 'Click to select a data source',
    msgJsonSource: 'From network response',
    msgHtmlSource: 'From page HTML table',
    msgJsonCapture: '{n} JSON responses captured',
    msgHtmlFound: '{n} tables found on page',
    msgFallback: 'Fallback',
    msgCancel: 'Cancel',
    msgConfirm: 'Export Selected',
    msgUsingJson: 'Using network JSON: {row} rows × {col} cols',
    msgUsingHtml: 'Using HTML table: {row} rows × {col} cols',
    msgJsonReady: '{n} JSON sources available',
    msgClickExport: 'Click "Export Excel" to select data source',
    msgCredManagerTitle: 'Saved Credentials',
    msgCredManagerEmpty: 'No saved credentials',
    msgCredManagerDelete: 'Delete',
    msgSavePromptTitle: 'Save password for this site?',
    msgSavePromptSave: 'Save',
    msgSavePromptCancel: 'No',
    msgOpenFile: 'Open File',
    msgOpenFolder: 'Open Folder',
    msgCredDeleted: 'Credential deleted',
    msgCaptchaFilled: 'Captcha auto-filled',
  },
};

let currentLang = 'zh';
function tr(key, ...args) {
  const dict = I18N[currentLang] || I18N.zh;
  const val = dict[key];
  if (typeof val === 'function') return val(...args);
  if (val !== undefined) return val;
  return key;
}

function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = tr(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', tr(key));
  });
  document.title = tr('title');
  if (btnPick && isPicking) btnPick.textContent = tr('btnPicking');
  // 更新 JSON 模式指示器文字
  const indicator = document.getElementById('jsonModeIndicator');
  if (indicator && indicator.style.display !== 'none') {
    indicator.textContent = currentLang === 'zh' ? 'JSON模式' : 'JSON Mode';
  }
}

// ==================== DOM 引用 ====================
const webview = document.getElementById('webview');
const urlInput = document.getElementById('urlInput');
const selectorInput = document.getElementById('selectorInput');
const filenameInput = document.getElementById('filenameInput');
const expireMinutesInput = document.getElementById('expireMinutesInput');
const rememberCheck = document.getElementById('rememberCheck');
const statusText = document.getElementById('statusText');
const btnGo = document.getElementById('btnGo');
const btnExport = document.getElementById('btnExport');
const btnAuto = document.getElementById('btnAuto');
const btnPick = document.getElementById('btnPick');
const sourceModal = document.getElementById('sourceModal');
const modalBody = document.getElementById('modalBody');
const modalTitle = document.getElementById('modalTitle');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnConfirmExport = document.getElementById('btnConfirmExport');
const sourceInfo = document.getElementById('sourceInfo');
const sourceTag = document.getElementById('sourceTag');
const sourceText = document.getElementById('sourceText');
const btnCredManager = document.getElementById('btnCredManager');
const credModal = document.getElementById('credModal');
const credModalTitle = document.getElementById('credModalTitle');
const credModalBody = document.getElementById('credModalBody');
const btnCloseCredModal = document.getElementById('btnCloseCredModal');
const savePrompt = document.getElementById('savePrompt');
const savePromptSite = document.getElementById('savePromptSite');
const btnSavePromptCancel = document.getElementById('btnSavePromptCancel');
const btnSavePromptSave = document.getElementById('btnSavePromptSave');

let isPicking = false;
let currentSiteKey = '';
let selectedSource = null;
let capturedSources = [];
let pendingCapturedCred = null;
let expireMinutes = 10;

function getExpireMs() {
  return expireMinutes * 60 * 1000;
}

async function syncExpireMsToWebview() {
  try {
    await webview.executeJavaScript(`window.__expireMs = ${getExpireMs()};`);
  } catch (_) {}
}

function getSiteKey(url) {
  try {
    const u = new URL(url);
    return u.hostname || url;
  } catch (_) {
    return url;
  }
}

function setStatus(msg, type) {
  statusText.textContent = msg;
  statusText.className = 'status';
  if (type) statusText.classList.add(type);
}

function setSourceInfo(tag, text, isHtml) {
  sourceTag.textContent = tag;
  sourceTag.className = 'tag' + (isHtml ? ' html' : '');
  sourceText.textContent = text;
  sourceInfo.classList.add('active');
}
function hideSourceInfo() {
  sourceInfo.classList.remove('active');
}

// ==================== 导航 + URL记忆 ====================
function navigate() {
  const url = urlInput.value.trim();
  if (!url) return;
  const finalUrl = /^https?:\/\//i.test(url) ? url : 'http://' + url;
  urlInput.value = finalUrl;
  currentSiteKey = getSiteKey(finalUrl);
  try { window.electronAPI.saveUserInput({ url: finalUrl }); } catch (_) {}
  setStatus(tr('statusLoading'));

  // 导航前清空所有捕获的JSON数据和缓存
  clearCapturedData();

  webview.loadURL(finalUrl);
  checkSavedCredentials();
  hideSourceInfo();
  selectedSource = null;
}

// ==================== 清空捕获数据 ====================
async function clearCapturedData() {
  try {
    // 清空主进程存储
    try {
      if (window.electronAPI && window.electronAPI.clearCapturedJson) {
        await window.electronAPI.clearCapturedJson();
      }
    } catch (e) {}
    // 清空 webview 中的捕获数据
    await webview.executeJavaScript(`
      window.__capturedJsonResponses = [];
      window.__exportDataCache = {};
      if (typeof window.__clearCapturedJson === 'function') {
        window.__clearCapturedJson();
      }
      console.log('[clearCapturedData] 已清空所有捕获数据');
    `);
    capturedSources = [];
    selectedSource = null;
    // 隐藏之前的来源信息
    hideSourceInfo();
    // 隐藏JSON模式指示器
    updateJsonModeIndicator(false);
  } catch (_) {
    console.log('[clearCapturedData] 清理失败');
  }
}
// 监听 webview 即将导航到新页面时
webview.addEventListener('will-navigate', (e) => {
  urlInput.value = e.url;
  const newKey = getSiteKey(e.url);
  if (newKey !== currentSiteKey) {
    currentSiteKey = newKey;
    checkSavedCredentials();
    try { window.electronAPI.saveUserInput({ url: e.url }); } catch (_) {}
  }
});

btnGo.addEventListener('click', navigate);
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(); });

selectorInput.addEventListener('change', () => {
  try { window.electronAPI.saveUserInput({ selector: selectorInput.value.trim() }); } catch (_) {}
});
filenameInput.addEventListener('change', () => {
  try { window.electronAPI.saveUserInput({ filename: filenameInput.value.trim() }); } catch (_) {}
});

const btnFilenameClear = document.getElementById('btnFilenameClear');
function updateFilenameClearBtn() {
  if (btnFilenameClear) {
    btnFilenameClear.style.display = filenameInput.value.trim() ? 'flex' : 'none';
  }
}
filenameInput.addEventListener('input', updateFilenameClearBtn);
if (btnFilenameClear) {
  btnFilenameClear.addEventListener('click', () => {
    filenameInput.value = '';
    updateFilenameClearBtn();
    filenameInput.focus();
    try { window.electronAPI.saveUserInput({ filename: '' }); } catch (_) {}
  });
}
// 初始化时检查
updateFilenameClearBtn();

expireMinutesInput.addEventListener('change', () => {
  let val = parseInt(expireMinutesInput.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 120) val = 120;
  expireMinutesInput.value = val;
  expireMinutes = val;
  try { window.electronAPI.saveUserInput({ expireMinutes: val }); } catch (_) {}
  syncExpireMsToWebview();
});

rememberCheck.addEventListener('change', () => {
  if (!rememberCheck.checked && currentSiteKey) {
    try { window.electronAPI.deleteCredentials({ siteKey: currentSiteKey }); } catch (_) {}
    setStatus(tr('msgCredRemoved'), 'success');
  }
});

webview.addEventListener('did-finish-load', () => {
  setStatus(tr('statusLoaded'));
  // SPA 页面可能需要额外时间渲染输入框，延迟 1 秒再尝试自动填充
  setTimeout(() => tryAutoFill(), 1000);
  // 每次加载完成后注入JSON捕获脚本
  injectJsonCapture();
  // 也注入凭证捕获脚本
  injectCredentialCapture();
  // 尝试扫描当前页面（自动检测）
  quickScanPage();
});
webview.addEventListener('dom-ready', () => {
  injectJsonCapture();
  injectCredentialCapture();
});
webview.addEventListener('did-start-loading', () => {
  setStatus(tr('statusLoading'));
});
webview.addEventListener('did-fail-load', (e) => {
  if (e.errorCode !== -3) setStatus(tr('msgLoadFailed') + ' ' + e.errorDescription, 'error');
});
webview.addEventListener('will-navigate', (e) => {
  urlInput.value = e.url;
  const newKey = getSiteKey(e.url);
  if (newKey !== currentSiteKey) {
    currentSiteKey = newKey;
    checkSavedCredentials();
    try { window.electronAPI.saveUserInput({ url: e.url }); } catch (_) {}
    // 导航到新网站时清空旧数据
    clearCapturedData();
  }
});
// 监听webview控制台消息，用于诊断崩溃问题
webview.addEventListener('console-message', (e) => {
  console.log('[webview]', e.message);
});

// 监听 webview 渲染进程崩溃，大数据场景下常见
webview.addEventListener('crashed', (e) => {
  console.error('[webview] renderer process crashed:', e);
  // 检查主进程是否保留了数据，如果有则提示用户仍可导出
  let hasMainData = false;
  try {
    if (window.electronAPI && window.electronAPI.getCapturedJson) {
      window.electronAPI.getCapturedJson().then(result => {
        if (result && result.success && result.captures && result.captures.length > 0) {
          const totalRows = result.captures.reduce((sum, c) => sum + (c.rowCount || 0), 0);
          setStatus('页面渲染进程已崩溃（数据量过大导致内存耗尽），但主进程已保留 ' + result.captures.length + ' 个数据响应（共约 ' + totalRows + ' 行），您可以尝试点击"导出 Excel"直接导出，无需重新加载页面', 'error');
        } else {
          setStatus('页面渲染进程已崩溃（数据量过大导致内存耗尽），请缩小查询范围后点击"前往"重新加载', 'error');
        }
      }).catch(() => {
        setStatus('页面渲染进程已崩溃（数据量过大导致内存耗尽），请缩小查询范围后点击"前往"重新加载', 'error');
      });
      return;
    }
  } catch (_) {}
  setStatus('页面渲染进程已崩溃（数据量过大导致内存耗尽），请缩小查询范围后点击"前往"重新加载', 'error');
});
webview.addEventListener('gpu-crashed', (e) => {
  console.error('[webview] GPU process crashed:', e);
  setStatus('页面 GPU 渲染进程已崩溃，请重新加载', 'error');
});

// F12 打开 webview 开发者工具
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12') {
    e.preventDefault();
    try {
      if (webview.isDevToolsOpened()) {
        webview.closeDevTools();
      } else {
        webview.openDevTools();
      }
    } catch (_) {}
  }
});

// ==================== 凭证管理 ====================
async function checkSavedCredentials() {
  if (!currentSiteKey) return;
  try {
    const cred = await window.electronAPI.getCredentials({ siteKey: currentSiteKey });
    rememberCheck.checked = !!(cred && cred.username);
  } catch (_) { rememberCheck.checked = false; }
}

async function tryAutoFill(retry) {
  retry = retry || 0;
  if (!currentSiteKey) return;
  try {
    const cred = await window.electronAPI.getCredentials({ siteKey: currentSiteKey });
    if (!cred || !cred.username) return;

    // 第一步：填充用户名和密码（使用原始能工作的逻辑）
    const fillUserPassCode = `
      (function() {
        console.log('[autofill] looking for inputs, retry: ${retry}');
        const userInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="name"], input:not([type])');
        const passInputs = document.querySelectorAll('input[type="password"]');
        console.log('[autofill] found', userInputs.length, 'user inputs,', passInputs.length, 'pass inputs');
        const userField = Array.from(userInputs).find(i => i.offsetParent !== null && i.type !== 'hidden');
        const passField = Array.from(passInputs).find(i => i.offsetParent !== null);
        console.log('[autofill] userField:', !!userField, 'passField:', !!passField);

        function setNativeValue(element, value) {
          const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          valueSetter.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (userField) {
          userField.focus();
          setNativeValue(userField, ${JSON.stringify(cred.username)});
          userField.blur();
        }
        if (passField) {
          passField.focus();
          setNativeValue(passField, ${JSON.stringify(cred.password)});
          passField.blur();
        }

        return { userField: !!userField, passField: !!passField };
      })()
    `;
    const result = await webview.executeJavaScript(fillUserPassCode);
    if (result && result.userField) {
      setStatus(tr('msgFilled'), 'success');
    } else if (retry < 5) {
      setTimeout(() => tryAutoFill(retry + 1), 2000);
      return;
    }

    // 第二步：注入验证码输入框焦点监听器，当 .input-code 内的 input 获得焦点时自动填充验证码
    const injectCaptchaFocusCode = `
      (function() {
        if (window.__captchaFocusInstalled) return;
        window.__captchaFocusInstalled = true;

        function setNativeValue(element, value) {
          const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          valueSetter.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.addEventListener('focusin', function(e) {
          const target = e.target;
          // 检查是否获得焦点的元素在 .input-code 容器内
          const container = target.closest && target.closest('.input-code');
          if (!container) return;

          // 检查是否已有值，已有值则不覆盖
          if (target.value && target.value.trim()) return;

          // 辅助函数：从主 frame 或 iframe 读取验证码
          function getCaptchaCode() {
            if (window.__captchaCode) return window.__captchaCode;
            const iframes = document.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
              try {
                const win = iframes[i].contentWindow;
                if (win && win.__captchaCode) return win.__captchaCode;
              } catch(e) {}
            }
            return '';
          }

          function clearCaptchaCode() {
            window.__captchaCode = '';
            const iframes = document.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
              try {
                const win = iframes[i].contentWindow;
                if (win) win.__captchaCode = '';
              } catch(e) {}
            }
          }

          // 优先使用拦截到的验证码
          const code = getCaptchaCode();
          if (code) {
            try {
              target.focus();
              setNativeValue(target, code);
              target.blur();
              clearCaptchaCode();
              window.__captchaAutoFilled = true;
            } catch(e) {}
            return;
          }

          // 验证码尚未返回，轮询等待 API 响应（最多 6 秒）
          let attempts = 0;
          const timer = setInterval(function() {
            attempts++;
            const pendingCode = getCaptchaCode();
            if (pendingCode) {
              clearInterval(timer);
              try {
                target.focus();
                setNativeValue(target, pendingCode);
                target.blur();
                clearCaptchaCode();
                window.__captchaAutoFilled = true;
              } catch(e) {}
            } else if (attempts >= 30) {
              clearInterval(timer);
            }
          }, 200);
        }, true);
      })()
    `;
    await webview.executeJavaScript(injectCaptchaFocusCode);

  } catch (err) {
    console.log('[tryAutoFill] error:', err);
    if (retry < 5) setTimeout(() => tryAutoFill(retry + 1), 2000);
  }
}

// ==================== 验证码由 webview-preload.js 拦截 API 自动填充，无需 OCR ====================

async function injectCredentialCapture() {
  if (!currentSiteKey) return;
  const code = `
    (function() {
      if (window.__credCaptureInstalled) return;
      window.__credCaptureInstalled = true;

      // 页面加载时从 sessionStorage 恢复凭证（解决页面刷新/跳转后内存变量丢失问题）
      try {
        const stored = sessionStorage.getItem('__capturedCred_backup');
        if (stored) {
          window.__capturedCred = JSON.parse(stored);
          console.log('[credCapture] restored from sessionStorage:', window.__capturedCred.username);
        }
      } catch(e) {}

      function handleSubmit(e) {
        const form = e.target && e.target.tagName === 'FORM' ? e.target : (e.target ? e.target.closest('form') : null);
        // 优先从表单获取输入框；如果按钮不在表单内，从整个文档获取
        const scope = form || document.body;
        if (!scope) return;
        const inputs = scope.querySelectorAll('input');
        let username = '', password = '';
        inputs.forEach((inp) => {
          if (inp.type === 'password' && inp.value) { password = inp.value; }
          else if (inp.value && inp.type !== 'hidden' && inp.type !== 'submit' && inp.type !== 'button') {
            const attr = (inp.name || '') + ' ' + (inp.id || '') + ' ' + (inp.placeholder || '');
            if (/user|name|login|account|email|手机|电话|账号|用户名|登录名/i.test(attr)) {
              username = inp.value;
            }
          }
        });
        // 如果没有通过属性匹配到用户名，取第一个可见的 text/email 输入框
        if (!username) {
          const userInp = Array.from(inputs).find(inp =>
            inp.type !== 'hidden' && inp.type !== 'password' && inp.type !== 'submit' && inp.type !== 'button' && inp.value
          );
          if (userInp) username = userInp.value;
        }
        if (username) {
          window.__capturedCred = { username, password: password || '' };
          // 备份到 sessionStorage，防止页面刷新/跳转后丢失
          try {
            sessionStorage.setItem('__capturedCred_backup', JSON.stringify(window.__capturedCred));
          } catch(e) {}
          console.log('[credCapture] captured:', username);
        }
      }
      document.addEventListener('submit', handleSubmit, true);
      // 监听点击事件：支持 button、input、div[role=button]、a 等多种按钮形式
      document.addEventListener('click', function(e) {
        const btn = e.target && e.target.closest('button, input[type="submit"], input[type="button"], [role="button"], .btn, .ant-btn, .el-button, a');
        if (!btn) return;
        const t = (btn.type || '').toLowerCase();
        const btnText = (btn.value || btn.textContent || btn.innerText || '').trim();
        console.log('[credCapture] click detected on:', btn.tagName, 'text:', btnText);
        if (t === 'submit' || /login|sign.?in|log.?in|登录|登.*录|submit|确认|确.*认|next|下一步/i.test(btnText)) {
          console.log('[credCapture] login button matched');
          const form = btn.closest('form');
          if (form) {
            handleSubmit({ target: form });
          } else {
            // SPA 中按钮可能不在表单内，从整个文档获取
            handleSubmit({ target: document.body });
          }
        }
      }, true);
      // 监听 Enter 键提交
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'BUTTON')) {
            const form = active.closest('form');
            if (form) {
              handleSubmit({ target: form });
            } else {
              handleSubmit({ target: document.body });
            }
          }
        }
      }, true);
    })()
  `;
  try { await webview.executeJavaScript(code); } catch (e) { console.log('[injectCredentialCapture] error:', e); }
}

async function checkCapturedCredentials() {
  if (!currentSiteKey) {
    console.log('[checkCapturedCredentials] currentSiteKey is empty');
    return;
  }
  try {
    let captured = null;

    // 先尝试从内存读取
    const memCred = await webview.executeJavaScript(`(function() { return window.__capturedCred || null; })()`);
    if (memCred && memCred.username) {
      captured = memCred;
    } else {
      // 内存中没有，尝试从 sessionStorage 读取备份
      const storedCred = await webview.executeJavaScript(`
        (function() {
          try {
            const s = sessionStorage.getItem('__capturedCred_backup');
            return s ? JSON.parse(s) : null;
          } catch(e) { return null; }
        })()
      `);
      if (storedCred && storedCred.username) {
        captured = storedCred;
        console.log('[checkCapturedCredentials] restored from sessionStorage');
      }
    }

    console.log('[checkCapturedCredentials] captured:', captured);
    if (captured && captured.username) {
      // 检查是否已存在相同凭证
      const existing = await window.electronAPI.getCredentials({ siteKey: currentSiteKey });
      if (existing && existing.username === captured.username && existing.password === captured.password) {
        // 凭证相同，直接清除标记
        await webview.executeJavaScript(`
          delete window.__capturedCred;
          try { sessionStorage.removeItem('__capturedCred_backup'); } catch(e) {}
        `);
        return;
      }
      // 默认记住账号：直接保存，不再提示
      const saveResult = await window.electronAPI.saveCredentials({
        siteKey: currentSiteKey,
        username: captured.username,
        password: captured.password || '',
      });
      console.log('[checkCapturedCredentials] saveResult:', saveResult);
      rememberCheck.checked = true;
      setStatus(tr('msgCredSaved'), 'success');
      await webview.executeJavaScript(`
        delete window.__capturedCred;
        try { sessionStorage.removeItem('__capturedCred_backup'); } catch(e) {}
      `);
    }
  } catch (e) {
    console.log('[checkCapturedCredentials] error:', e);
  }
}

setInterval(checkCapturedCredentials, 2000);

// ==================== 保存提示条 ====================
function showSavePrompt(siteKey) {
  savePromptSite.textContent = siteKey;
  savePrompt.classList.add('active');
}

function hideSavePrompt() {
  savePrompt.classList.remove('active');
  pendingCapturedCred = null;
}

btnSavePromptSave.addEventListener('click', async () => {
  if (!pendingCapturedCred || !currentSiteKey) {
    hideSavePrompt();
    return;
  }
  try {
    await window.electronAPI.saveCredentials({
      siteKey: currentSiteKey,
      username: pendingCapturedCred.username,
      password: pendingCapturedCred.password || '',
    });
    rememberCheck.checked = true;
    setStatus(tr('msgCredSaved'), 'success');
    await webview.executeJavaScript(`
      delete window.__capturedCred;
      try { sessionStorage.removeItem('__capturedCred_backup'); } catch(e) {}
    `);
  } catch (_) {}
  hideSavePrompt();
});

btnSavePromptCancel.addEventListener('click', async () => {
  if (currentSiteKey) {
    try { await window.electronAPI.deleteCredentials({ siteKey: currentSiteKey }); } catch (_) {}
    rememberCheck.checked = false;
  }
  await webview.executeJavaScript(`
    delete window.__capturedCred;
    try { sessionStorage.removeItem('__capturedCred_backup'); } catch(e) {}
  `);
  hideSavePrompt();
});

// ==================== 凭证管理界面 ====================
btnCredManager.addEventListener('click', showCredManager);
btnCloseCredModal.addEventListener('click', () => credModal.classList.remove('active'));
credModal.addEventListener('click', (e) => { if (e.target === credModal) credModal.classList.remove('active'); });

async function showCredManager() {
  credModalTitle.textContent = tr('msgCredManagerTitle');
  credModalBody.innerHTML = '';
  try {
    const result = await window.electronAPI.listCredentials();
    if (!result || !result.success || !result.list || result.list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'modal-empty';
      empty.textContent = tr('msgCredManagerEmpty');
      credModalBody.appendChild(empty);
      credModal.classList.add('active');
      return;
    }
    result.list.forEach((cred) => {
      const item = document.createElement('div');
      item.className = 'cred-item';

      const info = document.createElement('div');
      info.className = 'cred-item-info';

      const site = document.createElement('div');
      site.className = 'cred-item-site';
      site.textContent = cred.siteKey;
      info.appendChild(site);

      const user = document.createElement('div');
      user.className = 'cred-item-user';
      user.textContent = '账号: ' + (cred.username || '-');
      info.appendChild(user);

      if (cred.updatedAt) {
        const date = document.createElement('div');
        date.className = 'cred-item-date';
        date.textContent = '保存于: ' + new Date(cred.updatedAt).toLocaleString();
        info.appendChild(date);
      }

      item.style.cursor = 'pointer';
      item.title = '点击使用该账号';
      item.addEventListener('click', () => {
        credModal.classList.remove('active');
        const url = 'https://' + cred.siteKey;
        urlInput.value = url;
        currentSiteKey = cred.siteKey;
        navigate();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'cred-item-delete';
      delBtn.textContent = tr('msgCredManagerDelete');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.electronAPI.deleteCredentials({ siteKey: cred.siteKey });
          item.remove();
          if (credModalBody.children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'modal-empty';
            empty.textContent = tr('msgCredManagerEmpty');
            credModalBody.appendChild(empty);
          }
          if (cred.siteKey === currentSiteKey) {
            rememberCheck.checked = false;
          }
          setStatus(tr('msgCredDeleted'), 'success');
        } catch (_) {}
      });

      item.appendChild(info);
      item.appendChild(delBtn);
      credModalBody.appendChild(item);
    });
  } catch (_) {
    const empty = document.createElement('div');
    empty.className = 'modal-empty';
    empty.textContent = tr('msgCredManagerEmpty');
    credModalBody.appendChild(empty);
  }
  credModal.classList.add('active');
}

// ==================== JSON响应捕获（核心功能） ====================
// 优先使用 webview 的 preload 脚本（在页面脚本加载前注入）
// injectJsonCapture 作为备用方案（通过 executeJavaScript 注入）
async function injectJsonCapture() {
  try {
    const installed = await webview.executeJavaScript(`window.__jsonCaptureInstalled || false`);
    if (installed) {
      console.log('[injectJsonCapture] JSON capture already installed via preload, skipping');
      // 即使已安装，也要同步过期时间设置
      await syncExpireMsToWebview();
      return;
    }
  } catch (_) {}

  await clearCapturedData();

  // 在webview页面中注入脚本，拦截所有 fetch 和 XHR 请求
  const captureCode = `
    (function() {
      if (window.__jsonCaptureInstalled) return;
      window.__jsonCaptureInstalled = true;
      if (!window.__capturedJsonResponses) window.__capturedJsonResponses = [];
      window.__expireMs = ${getExpireMs()};
	  
	  // ========== API 黑名单（模糊匹配） ==========
	        // 这些 API 的响应将不被捕获
	        const BLACKLIST_PATTERNS = [
	          /\\/i\\/md-query\\/ds\\/sourceList\\/simply/,
	          /\\/i\\/md-query\\/ds\\/sourceTypeList/,
	          /\\/i\\/dds\\/package\\/resourceList/,
	          /\\/i\\/dds\\/flow\\/getLevelList/,
	          /\\/i\\/dds\\/udf\\/getFunctions/,
	          /\\/i\\/dts-web\\/dict\\/getDtsTaskParam/,
	          /\\/i\\/dds\\/flow\\/getBatchTree/,
	          /\\/i\\/dds\\/template\\/getTaskTemplateTree/,
	          /\\/i\\/dds\\/tempSearch\\/getTempSearchTree/,
	          /\\/i\\/dds\\/recycle\\/getRecycleTree/,
	          /\\/i\\/md-query\\/query\\/db\\/list\\/min\\/granted/,
			  /\\/i\\/authprivilege\\/api\\/menus/,
			  /\\/i\\/project\\/api\\/projects\\/participantAll/
	        ];
	  
	        function isBlacklisted(url) {
	          if (!url) return false;
	          for (var i = 0; i < BLACKLIST_PATTERNS.length; i++) {
	            if (BLACKLIST_PATTERNS[i].test(url)) {
	              console.log('[jsonCapture] blocked blacklisted API:', url);
	              return true;
	            }
	          }
	          return false;
	        }

      function getActiveTabTitle() {
        try {
          var title = document.title || '';
          var selectors = [
            '.ant-tabs-tab-active', '.el-tabs__item.is-active', '.ivu-tabs-tab-active',
            '.nav-tabs li.active a', '.tab-content .tab-pane.active .panel-title',
            '[role="tab"][aria-selected="true"]', '.tabs .tab.active', '.tab-item.active',
            '.v-tab--active', '.router-link-active', '.active .tab-label', '.active .nav-label',
            '.cdc-tabs .tab-item.active', '.tabs-nav li.active a', '.tab-nav .active'
          ];
          for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) {
              var text = (el.textContent || el.innerText || '').trim();
              if (text && text.length > 0 && text.length < 100) return text;
            }
          }
          // 尝试查找带关闭按钮的Tab
          var closeBtns = document.querySelectorAll('.anticon-close, .el-icon-close, .ivu-icon-ios-close, .tab-close, .close-icon, [class*="close"]');
          for (var j = 0; j < closeBtns.length; j++) {
            var tabEl = closeBtns[j].closest('.ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, .tab-item, [role="tab"], .tab, .tabs-item');
            if (tabEl) {
              var tabText = (tabEl.textContent || tabEl.innerText || '').trim();
              if (tabText && tabText.length > 0 && tabText.length < 100) {
                if (tabEl.classList.contains('active') || tabEl.classList.contains('ant-tabs-tab-active') || tabEl.getAttribute('aria-selected') === 'true') {
                  return tabText;
                }
              }
            }
          }
          var hash = window.location.hash;
          if (hash && hash.length > 1 && hash.length < 50) return hash.substring(1);
          return title;
        } catch(e) { return document.title || ''; }
      }

      function pushResponse(url, data, size) {
        try {
          if (isBlacklisted(url)) return;

          var rowCount = 0;
          try {
            if (Array.isArray(data)) rowCount = data.length;
            else if (data && typeof data === 'object') {
              var keys = ['data','result','rows','records','list'];
              for (var k = 0; k < keys.length; k++) {
                var v = data[keys[k]];
                if (Array.isArray(v)) { rowCount = v.length; break; }
              }
            }
          } catch(e) {}
          var isBig = (size || 0) > 5 * 1024 * 1024 || rowCount > 50000;

          var existingIndex = window.__capturedJsonResponses.findIndex(
            r => r.url === url && r.timestamp > Date.now() - 5000
          );
          if (existingIndex !== -1) {
            window.__capturedJsonResponses[existingIndex].data = data;
            window.__capturedJsonResponses[existingIndex].timestamp = Date.now();
            window.__capturedJsonResponses[existingIndex].pageTitle = getActiveTabTitle();
            return;
          }

          window.__capturedJsonResponses.push({
            url: url || 'unknown',
            timestamp: Date.now(),
            size: size || 0,
            data: data,
            rowCount: rowCount,
            pageTitle: getActiveTabTitle()
          });
          if (window.__capturedJsonResponses.length > 50) {
            window.__capturedJsonResponses.splice(0, window.__capturedJsonResponses.length - 50);
          }

          // 内存优化：总大小超过50MB时，清理旧数据的data字段
          var totalSize = 0;
          for (var j = 0; j < window.__capturedJsonResponses.length; j++) {
            totalSize += window.__capturedJsonResponses[j].size || 0;
          }
          if (totalSize > 50 * 1024 * 1024) {
            for (var m = 0; m < window.__capturedJsonResponses.length; m++) {
              if (window.__capturedJsonResponses[m].data) {
                window.__capturedJsonResponses[m].data = null;
              }
            }
          }
        } catch(e) {}
      }

      // 拦截 fetch
      const originalFetch = window.fetch;
      if (originalFetch && typeof originalFetch === 'function') {
        window.fetch = function() {
          const args = Array.prototype.slice.call(arguments);
          const url = typeof args[0] === 'string' ? args[0]
                    : (args[0] && args[0].url ? args[0].url : 'fetch');
          return originalFetch.apply(this, args).then(function(response) {
            try {
              // 跳过非 JSON 类型和已知超大响应，避免不必要的 clone 与内存分配
              var contentType = response.headers && response.headers.get ? response.headers.get('content-type') : '';
              var contentLength = response.headers && response.headers.get ? response.headers.get('content-length') : '';
              var isJson = contentType && contentType.indexOf('application/json') !== -1;
              var length = contentLength ? parseInt(contentLength, 10) : 0;
              if (!isJson || (length > 0 && length > 20 * 1024 * 1024)) {
                return response;
              }
              var cloned = response.clone();
              cloned.text().then(function(text) {
                try {
                  if (text && text.length > 0 && text.length < 50 * 1024 * 1024) {
                    var firstChar = text.trim().charAt(0);
                    if (firstChar === '{' || firstChar === '[') {
                      var json = JSON.parse(text);
                      pushResponse(url, json, text.length);
                    }
                  }
                } catch(e) {}
              });
            } catch(e) {}
            return response;
          });
        };
      }

      // 拦截 XMLHttpRequest
      try {
        var OriginalXHR = window.XMLHttpRequest;
        if (OriginalXHR) {
          function PatchedXHR() {
            var xhr = new OriginalXHR();
            var capturedUrl = '';
            var origOpen = xhr.open;
            xhr.open = function(method, url) { capturedUrl = url || 'xhr'; return origOpen.apply(xhr, arguments); };
            xhr.addEventListener('load', function() {
              try {
                // 优先使用浏览器已解析的 response 对象，避免对 responseText 重复 JSON.parse
                var data = null;
                var size = 0;
                if (xhr.responseType === 'json' && xhr.response && typeof xhr.response === 'object') {
                  data = xhr.response;
                  size = (xhr.responseText && xhr.responseText.length) || 0;
                } else {
                  var respText = xhr.responseText;
                  if (!respText || respText.length <= 100 || respText.length >= 50 * 1024 * 1024) return;
                  var firstChar = respText.trim().charAt(0);
                  if (firstChar !== '{' && firstChar !== '[') return;
                  data = JSON.parse(respText);
                  size = respText.length;
                }
                if (data && typeof data === 'object') {
                  pushResponse(capturedUrl, data, size);
                }
              } catch(e) {}
            });
            return xhr;
          }
          Object.keys(OriginalXHR).forEach(function(key) { PatchedXHR[key] = OriginalXHR[key]; });
          window.XMLHttpRequest = PatchedXHR;
        }
      } catch(e) {}

      window.__getCapturedJson = function() { return window.__capturedJsonResponses || []; };
      window.__clearCapturedJson = function() { window.__capturedJsonResponses = []; };
    })()
  `;
  try {
    await webview.executeJavaScript(captureCode);
  } catch (_) {
  }
}

// ==================== JSON 分析（主窗口渲染进程本地执行，不经过 webview） ====================
function analyzeJsonLocal(json, url, size, timestamp) {
    if (!json || typeof json !== 'object') return [];
    const DATA_KEYS = ['result', 'data', 'tableData', 'listData', 'dataList', 'queryResult', 'RECORDS'];
    const candidates = [];
    const seen = new Set();
    const BIG_DATA_THRESHOLD = 50000;

    function extractTableFromArray(arr, path) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        let firstObj = null;
        for (let i = 0; i < arr.length && i < 10; i++) {
            const item = arr[i];
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                firstObj = item;
                break;
            }
        }
        if (firstObj) {
            const firstKeys = Object.keys(firstObj);
            if (firstKeys.length > 0 && firstKeys.length <= 50) {
                const key = firstKeys.join('|') + '_' + arr.length;
                if (!seen.has(key)) {
                    seen.add(key);
                    if (arr.length > BIG_DATA_THRESHOLD) {
                        return { headers: firstKeys, rows: null, rowCount: arr.length, originalArray: arr, path: path };
                    }
                    const rows = [];
                    for (let i = 0; i < arr.length; i++) {
                        const item = arr[i];
                        if (item && typeof item === 'object' && !Array.isArray(item)) {
                            const row = [];
                            for (let j = 0; j < firstKeys.length; j++) {
                                const v = item[firstKeys[j]];
                                if (v === null || v === undefined) row.push('');
                                else if (typeof v === 'object') row.push(JSON.stringify(v));
                                else row.push(v);
                            }
                            rows.push(row);
                        }
                    }
                    return { headers: firstKeys, rows: rows, rowCount: rows.length, path: path };
                }
            }
        }
        if (arr.length > 1 && Array.isArray(arr[0]) && Array.isArray(arr[1])) {
            const len0 = arr[0].length;
            const len1 = arr[1].length;
            if (len0 > 0 && len0 === len1 && len0 <= 50) {
                const headers = arr[0].map(v => String(v || ''));
                const key = '2d_' + headers.join('|') + '_' + arr.length;
                if (!seen.has(key)) {
                    seen.add(key);
                    if (arr.length > BIG_DATA_THRESHOLD) {
                        return { headers: headers, rows: null, rowCount: arr.length, originalArray: arr, path: path };
                    }
                    const rows = [];
                    for (let i = 1; i < arr.length; i++) {
                        const r = arr[i];
                        const row = [];
                        for (let j = 0; j < r.length; j++) {
                            const v = r[j];
                            if (v === null || v === undefined) row.push('');
                            else if (typeof v === 'object') row.push(JSON.stringify(v));
                            else row.push(v);
                        }
                        rows.push(row);
                    }
                    return { headers: headers, rows: rows, rowCount: rows.length, path: path };
                }
            }
        }
        return null;
    }

    if (Array.isArray(json.columns) && json.columns.length > 0) {
        const rowSrc = json.rows || json.data || json.result || json.values || json.records;
        if (Array.isArray(rowSrc) && rowSrc.length > 0) {
            const realHeaders = json.columns.map(c => (typeof c === 'string') ? c : (c.name || c.label || c.title || String(c)));
            if (rowSrc.length > BIG_DATA_THRESHOLD) {
                candidates.push({ headers: realHeaders, rows: null, rowCount: rowSrc.length, originalArray: rowSrc, path: 'root.columns' });
            } else {
                const rows = rowSrc.map(r => {
                    if (Array.isArray(r)) return r.map(v => (v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v)));
                    if (typeof r === 'object' && r !== null) {
                        return realHeaders.map(h => {
                            const v = r[h];
                            if (v === null || v === undefined) return '';
                            if (typeof v === 'object') return JSON.stringify(v);
                            return v;
                        });
                    }
                    return [r];
                });
                candidates.push({ headers: realHeaders, rows: rows, rowCount: rows.length, path: 'root.columns' });
            }
        }
    }
    if (Array.isArray(json.fields) && json.fields.length > 0) {
        const rowSrc = json.records || json.data || json.rows || json.result;
        if (Array.isArray(rowSrc) && rowSrc.length > 0) {
            const realHeaders = json.fields.map(c => (typeof c === 'string') ? c : (c.name || c.label || c.title || String(c)));
            if (rowSrc.length > BIG_DATA_THRESHOLD) {
                candidates.push({ headers: realHeaders, rows: null, rowCount: rowSrc.length, originalArray: rowSrc, path: 'root.fields' });
            } else {
                const rows = rowSrc.map(r => {
                    if (typeof r === 'object' && r !== null && !Array.isArray(r)) {
                        return realHeaders.map(h => {
                            const v = r[h];
                            if (v === null || v === undefined) return '';
                            if (typeof v === 'object') return JSON.stringify(v);
                            return v;
                        });
                    }
                    if (Array.isArray(r)) return r.map(v => (v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v)));
                    return [r];
                });
                candidates.push({ headers: realHeaders, rows: rows, rowCount: rows.length, path: 'root.fields' });
            }
        }
    }
    for (let i = 0; i < DATA_KEYS.length; i++) {
        const key = DATA_KEYS[i];
        const val = json[key];
        if (Array.isArray(val) && val.length > 0) {
            const extracted = extractTableFromArray(val, 'root.' + key);
            if (extracted && extracted.rowCount > 0) candidates.push(extracted);
        }
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            for (let j = 0; j < DATA_KEYS.length; j++) {
                const nested = val[DATA_KEYS[j]];
                if (Array.isArray(nested) && nested.length > 0) {
                    const extracted = extractTableFromArray(nested, 'root.' + key + '.' + DATA_KEYS[j]);
                    if (extracted && extracted.rowCount > 0) candidates.push(extracted);
                }
            }
        }
    }
    if (json.result && typeof json.result === 'object' && !Array.isArray(json.result)) {
        if (Array.isArray(json.result.data) && json.result.data.length > 0) {
            const extracted = extractTableFromArray(json.result.data, 'root.result.data');
            if (extracted && extracted.rowCount > 0) candidates.push(extracted);
        }
        for (let i = 0; i < DATA_KEYS.length; i++) {
            const nested = json.result[DATA_KEYS[i]];
            if (Array.isArray(nested) && nested.length > 0) {
                const extracted = extractTableFromArray(nested, 'root.result.' + DATA_KEYS[i]);
                if (extracted && extracted.rowCount > 0) candidates.push(extracted);
            }
        }
    }
    let scanCount = 0;
    const MAX_SCAN_NODES = 5000;
    function deepScan(obj, path, depth) {
        if (scanCount > MAX_SCAN_NODES) return;
        if (depth > 5 || !obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            const extracted = extractTableFromArray(obj, path);
            if (extracted && extracted.rowCount > 0) candidates.push(extracted);
            for (let i = 0; i < obj.length && scanCount <= MAX_SCAN_NODES; i++) {
                scanCount++;
                deepScan(obj[i], path + '[' + i + ']', depth + 1);
            }
        } else if (obj !== null) {
            const keys = Object.keys(obj);
            for (let i = 0; i < keys.length && scanCount <= MAX_SCAN_NODES; i++) {
                scanCount++;
                deepScan(obj[keys[i]], path + '.' + keys[i], depth + 1);
            }
        }
    }
    if (candidates.length === 0) {
        deepScan(json, 'root', 0);
    }
    return candidates;
}

// ==================== 扫描页面：收集所有可用数据源 ====================
// 1. 从已捕获的JSON响应中提取表格式数据
// 2. 从HTML <table> 中提取数据
// 返回：[{ id, type, source, headers, rows, rowCount, colCount, url, selector }]
async function scanAllSourcesFromWebview() {
  const scanCode = `
    (function() {
      // 清除旧的导出数据缓存
      if (window.__exportDataCache) {
        try { window.__exportDataCache = {}; } catch(e) {}
      }
      const sources = [];
      let nextId = 1;
      
      // 获取当前页面URL，用于过滤
      const currentPageUrl = window.location.href;

      // ---------- 分析JSON响应 ----------
      const DATA_KEYS = [
        'result', 'data', 'tableData','listData', 'dataList','queryResult', 'RECORDS'
      ];

      function analyzeJson(json, url, size, timestamp) {
        if (!json) return null;
        if (typeof json !== 'object') return null;

        const candidates = [];
        const seen = new Set();

        // 从数组中提取表格（每个元素都是对象，且键名一致）
        // 大数据优化：超过阈值时不创建完整 rows 数组，避免 V8 内存分配卡死
        const BIG_DATA_THRESHOLD = 50000;

        function extractTableFromArray(arr, path) {
          if (!Array.isArray(arr) || arr.length === 0) return null;

          // 情况 A: [ {key1: val1, key2: val2}, {...}, ... ]  —— 对象数组
          // 大数据优化：避免 arr.filter() 创建大数组，只检查前几个元素
          let firstObj = null;
          for (let i = 0; i < arr.length && i < 10; i++) {
            const item = arr[i];
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              firstObj = item;
              break;
            }
          }
          if (firstObj) {
            const firstKeys = Object.keys(firstObj);
            if (firstKeys.length > 0 && firstKeys.length <= 50) {
              const key = firstKeys.join('|') + '_' + arr.length;
              if (!seen.has(key)) {
                seen.add(key);
                if (arr.length > BIG_DATA_THRESHOLD) {
                  // 大数据模式：只存原始数组引用，不创建任何大数组
                  return { headers: firstKeys, rows: null, rowCount: arr.length, originalArray: arr, path: path };
                }
                // 小数据模式：安全地创建 rows
                const objItems = arr.filter(x => x && typeof x === 'object' && !Array.isArray(x));
                const rows = objItems.map(item => firstKeys.map(h => {
                  const v = item[h];
                  if (v === null || v === undefined) return '';
                  if (typeof v === 'object') return JSON.stringify(v);
                  return v;
                }));
                return { headers: firstKeys, rows: rows, rowCount: rows.length, path: path };
              }
            }
          }

          // 情况 B: [ [val1, val2], [val3, val4], ... ]  —— 二维数组（首行为表头）
          if (arr.length > 1 && Array.isArray(arr[0]) && Array.isArray(arr[1])) {
            const len0 = arr[0].length;
            const len1 = arr[1].length;
            if (len0 > 0 && len0 === len1 && len0 <= 50) {
              const headers = arr[0].map(v => String(v || ''));
              const key = '2d_' + headers.join('|') + '_' + arr.length;
              if (!seen.has(key)) {
                seen.add(key);
                if (arr.length > BIG_DATA_THRESHOLD) {
                  return { headers: headers, rows: null, rowCount: arr.length, originalArray: arr, path: path };
                }
                const rows = arr.slice(1).map(r => r.map(v =>
                  (v === null || v === undefined) ? ''
                  : (typeof v === 'object' ? JSON.stringify(v) : v)
                ));
                return { headers: headers, rows: rows, rowCount: rows.length, path: path };
              }
            }
          }

          return null;
        }

        // 情况 1: 直接包含 "columns" / "fields" 键
        if (Array.isArray(json.columns) && json.columns.length > 0) {
          const rowSrc = json.rows || json.data || json.result || json.values || json.records;
          if (Array.isArray(rowSrc) && rowSrc.length > 0) {
            const realHeaders = json.columns.map(c => (typeof c === 'string') ? c : (c.name || c.label || c.title || String(c)));
            if (rowSrc.length > BIG_DATA_THRESHOLD) {
              candidates.push({ headers: realHeaders, rows: null, rowCount: rowSrc.length, originalArray: rowSrc, path: 'root.columns' });
            } else {
              const rows = rowSrc.map(r => {
                if (Array.isArray(r)) return r.map(v => (v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v)));
                if (typeof r === 'object' && r !== null) {
                  return realHeaders.map(h => {
                    const v = r[h];
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object') return JSON.stringify(v);
                    return v;
                  });
                }
                return [r];
              });
              candidates.push({ headers: realHeaders, rows: rows, rowCount: rows.length, path: 'root.columns' });
            }
          }
        }
        if (Array.isArray(json.fields) && json.fields.length > 0) {
          const rowSrc = json.records || json.data || json.rows || json.result;
          if (Array.isArray(rowSrc) && rowSrc.length > 0) {
            const realHeaders = json.fields.map(c => (typeof c === 'string') ? c : (c.name || c.label || c.title || String(c)));
            if (rowSrc.length > BIG_DATA_THRESHOLD) {
              candidates.push({ headers: realHeaders, rows: null, rowCount: rowSrc.length, originalArray: rowSrc, path: 'root.fields' });
            } else {
              const rows = rowSrc.map(r => {
                if (typeof r === 'object' && r !== null && !Array.isArray(r)) {
                  return realHeaders.map(h => {
                    const v = r[h];
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object') return JSON.stringify(v);
                    return v;
                  });
                }
                if (Array.isArray(r)) return r.map(v => (v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v)));
                return [r];
              });
              candidates.push({ headers: realHeaders, rows: rows, rowCount: rows.length, path: 'root.fields' });
            }
          }
        }

        // 情况 2: 在常见数据容器键中查找数组
        for (let i = 0; i < DATA_KEYS.length; i++) {
          const key = DATA_KEYS[i];
          const val = json[key];
          if (Array.isArray(val) && val.length > 0) {
            const extracted = extractTableFromArray(val, 'root.' + key);
            if (extracted && extracted.rowCount > 0) {
              candidates.push(extracted);
            }
          }
          // 也支持嵌套：{ data: { list: [...] } }
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            for (let j = 0; j < DATA_KEYS.length; j++) {
              const nested = val[DATA_KEYS[j]];
              if (Array.isArray(nested) && nested.length > 0) {
                const extracted = extractTableFromArray(nested, 'root.' + key + '.' + DATA_KEYS[j]);
                if (extracted && extracted.rowCount > 0) {
                  candidates.push(extracted);
                }
              }
            }
          }
        }

        // 特殊处理：{ result: { data: [...] } } 常见 API 返回格式
        if (json.result && typeof json.result === 'object' && !Array.isArray(json.result)) {
          if (Array.isArray(json.result.data) && json.result.data.length > 0) {
            const extracted = extractTableFromArray(json.result.data, 'root.result.data');
            if (extracted && extracted.rowCount > 0) {
              candidates.push(extracted);
            }
          }
          // 也检查 result 下的其他常见数据键
          for (let i = 0; i < DATA_KEYS.length; i++) {
            const nested = json.result[DATA_KEYS[i]];
            if (Array.isArray(nested) && nested.length > 0) {
              const extracted = extractTableFromArray(nested, 'root.result.' + DATA_KEYS[i]);
              if (extracted && extracted.rowCount > 0) {
                candidates.push(extracted);
              }
            }
          }
        }

        // 情况 3: 递归深入查找任何数组形式（限制节点数避免假死）
        let scanCount = 0;
        const MAX_SCAN_NODES = 5000;
        function deepScan(obj, path, depth) {
          if (scanCount > MAX_SCAN_NODES) return;
          if (depth > 5 || !obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            const extracted = extractTableFromArray(obj, path);
            if (extracted && extracted.rowCount > 0) {
              candidates.push(extracted);
            }
            for (let i = 0; i < obj.length && scanCount <= MAX_SCAN_NODES; i++) {
              scanCount++;
              deepScan(obj[i], path + '[' + i + ']', depth + 1);
            }
          } else if (obj !== null) {
            const keys = Object.keys(obj);
            for (let i = 0; i < keys.length && scanCount <= MAX_SCAN_NODES; i++) {
              scanCount++;
              deepScan(obj[keys[i]], path + '.' + keys[i], depth + 1);
            }
          }
        }
        // 只在当前 JSON 不是上述已知结构时才做深层扫描
        if (candidates.length === 0) {
          deepScan(json, 'root', 0);
        }

        return candidates;
      }

      // 遍历所有已捕获的JSON响应
      const jsonResps = (typeof window.__getCapturedJson === 'function')
        ? window.__getCapturedJson()
        : (window.__capturedJsonResponses || []);
      
      // 只保留最近 expireMinutes 分钟内的响应
      const now = Date.now();
      const expireMs = window.__expireMs || (10 * 60 * 1000);
      const recentResponses = jsonResps.filter(r => (r.timestamp || 0) > now - expireMs);
      
      // 按URL去重：同一URL只保留最新的一个
      const urlMap = {};
        for (let i = 0; i < recentResponses.length; i++) {
        const resp = recentResponses[i];
        if (!resp || !resp.data) continue;
        const urlKey = resp.url || 'unknown';
        // 如果该URL还没有记录，或者当前记录更新，则替换
        if (!urlMap[urlKey] || (resp.timestamp || 0) > (urlMap[urlKey].timestamp || 0)) {
          urlMap[urlKey] = resp;
        }
      }
       // 转换回数组
      const uniqueResponses = Object.values(urlMap);
      for (let i = 0; i < uniqueResponses.length; i++) {
        const resp = uniqueResponses[i];
        if (!resp || !resp.data) continue;
        try {
          const results = analyzeJson(resp.data, resp.url, resp.size, resp.timestamp);
          if (results && results.length > 0) {
            for (let j = 0; j < results.length; j++) {
              const r = results[j];
              if (r && r.headers && r.headers.length > 0 && r.rowCount > 0 && r.rowCount <= 100000) {
                // 大数据模式处理...
                let cacheId = null;
                if (!r.rows && r.originalArray) {
                  window.__exportDataCache = window.__exportDataCache || {};
                  cacheId = 'json_' + nextId + '_' + Date.now();
                  window.__exportDataCache[cacheId] = {
                    headers: r.headers,
                    originalArray: r.originalArray,
                    rowCount: r.rowCount
                  };
                }
                sources.push({
                  id: 'json_' + nextId++,
                  type: 'json',
                  source: resp.url,
                  headers: r.headers,
                  rows: r.rows || [],
                  rowCount: r.rowCount,
                  colCount: r.headers.length,
                  timestamp: resp.timestamp,
                  cacheId: cacheId,
                  pageTitle: resp.pageTitle || ''
                });
              }
            }
          }
        } catch(e) {}
      }

      // 按行数降序排列
      sources.sort((a, b) => b.rowCount - a.rowCount);
      
      // 限制返回的数据源数量，避免过多
      return sources.slice(0, 10);
    })()
  `;
  try {
    const result = await webview.executeJavaScript(scanCode);
    const sources = Array.isArray(result) ? result : [];
    return sources;
  } catch (_) {
    return [];
  }
}

// 优先从主进程获取已捕获的 JSON 数据，避免 webview 渲染进程因大数据崩溃
async function scanAllSources() {
  let captures = [];
  try {
    if (window.electronAPI && window.electronAPI.getCapturedJson) {
      const result = await window.electronAPI.getCapturedJson();
      if (result && result.success && result.captures) {
        captures = result.captures;
      }
    }
  } catch (e) {
    console.log('[scanAllSources] get captured from main failed:', e);
  }

  // 回退：主进程没有数据时，使用 webview 本地扫描
  if (!captures || captures.length === 0) {
    return await scanAllSourcesFromWebview();
  }

  const sources = [];
  let nextId = 1;
  const now = Date.now();
  const expireMs = getExpireMs();

  // 过滤过期数据
  const recentCaptures = captures.filter(r => (r.timestamp || 0) > now - expireMs);

  // 按 URL 去重：保留最新的
  const urlMap = {};
  const captureIndexMap = {};
  for (let i = 0; i < captures.length; i++) {
    const resp = captures[i];
    if (!resp || !resp.data) continue;
    const urlKey = resp.url || 'unknown';
    if (!urlMap[urlKey] || (resp.timestamp || 0) > (urlMap[urlKey].timestamp || 0)) {
      urlMap[urlKey] = resp;
      captureIndexMap[urlKey] = i;
    }
  }
  const uniqueResponses = Object.values(urlMap);

  for (const resp of uniqueResponses) {
    if (!resp || !resp.data) continue;
    try {
      const results = analyzeJsonLocal(resp.data, resp.url, resp.size, resp.timestamp);
      if (results && results.length > 0) {
        for (const r of results) {
          if (r && r.headers && r.headers.length > 0 && r.rowCount > 0 && r.rowCount <= 100000) {
            const mainCaptureIndex = captureIndexMap[resp.url];
            sources.push({
              id: 'json_' + nextId++,
              type: 'json',
              source: resp.url,
              headers: r.headers,
              rows: r.rows || [],
              rowCount: r.rowCount,
              colCount: r.headers.length,
              timestamp: resp.timestamp,
              mainCaptureIndex: typeof mainCaptureIndex === 'number' ? mainCaptureIndex : undefined,
              path: r.path,
              pageTitle: resp.pageTitle || ''
            });
          }
        }
      }
    } catch (e) {}
  }

  sources.sort((a, b) => b.rowCount - a.rowCount);
  return sources.slice(0, 10);
}

// ==================== 快速扫描（轻量级，不阻塞主线程） ====================
async function quickScanPage() {
  try {
    // 优先从主进程获取已捕获数据，避免 webview 内存压力
    let captures = [];
    try {
      if (window.electronAPI && window.electronAPI.getCapturedJson) {
        const result = await window.electronAPI.getCapturedJson();
        if (result && result.success && result.captures) {
          captures = result.captures;
        }
      }
    } catch (e) {}

    let lightInfo = null;
    if (captures && captures.length > 0) {
      const now = Date.now();
      const expireMs = getExpireMs();
      const recentResps = captures.filter(r => (r.timestamp || 0) > now - expireMs);
      let jsonCount = 0;
      let maxRows = 0;
      let hasBig = false;
      for (let i = 0; i < recentResps.length; i++) {
        const r = recentResps[i];
        if (r && r.data) {
          jsonCount++;
          const rc = r.rowCount || 0;
          if (rc > maxRows) maxRows = rc;
          if (r.isBig || rc > 50000) hasBig = true;
        }
      }
      lightInfo = { jsonCount, maxRows, hasBig };
    }

    // 回退：主进程没有数据时，从 webview 本地读取
    if (!lightInfo) {
      lightInfo = await webview.executeJavaScript(`
        (function() {
          const resps = window.__capturedJsonResponses || [];
          const now = Date.now();
          const expireMs = window.__expireMs || (10 * 60 * 1000);
          const recentResps = resps.filter(r => (r.timestamp || 0) > now - expireMs);
          let jsonCount = 0;
          let maxRows = 0;
          let hasBig = false;
          for (let i = 0; i < recentResps.length; i++) {
            const r = recentResps[i];
            if (r && r.data) {
              jsonCount++;
              const rc = r.rowCount || 0;
              if (rc > maxRows) maxRows = rc;
              if (r.isBig || rc > 50000) hasBig = true;
            }
          }
          return { jsonCount, maxRows, hasBig };
        })()
      `);
    }

    if (lightInfo && lightInfo.jsonCount > 0) {
      let msg = tr('msgJsonCapture').replace('{n}', lightInfo.jsonCount);
      if (lightInfo.maxRows > 0) {
        msg += ' (最大 ' + lightInfo.maxRows + ' 行)';
      }
      msg += '. ' + tr('msgClickExport');
      setStatus(msg);
      updateJsonModeIndicator(true);
    } else {
      updateJsonModeIndicator(false);
    }
  } catch (_) {}
}

function updateJsonModeIndicator(hasJson) {
  const indicator = document.getElementById('jsonModeIndicator');
  const selectorGroup = document.getElementById('selectorGroup');
  if (!indicator) return;

  if (hasJson) {
    indicator.style.display = 'inline';
    indicator.textContent = currentLang === 'zh' ? 'JSON模式' : 'JSON Mode';
    // JSON 模式下淡化选择器
    if (selectorGroup) selectorGroup.style.opacity = '0.5';
  } else {
    indicator.style.display = 'none';
    if (selectorGroup) selectorGroup.style.opacity = '1';
  }
}

// ==================== 自动检测按钮 ====================
btnAuto.addEventListener('click', autoDetect);

async function autoDetect() {
  setStatus(tr('statusExtracting'));
  const sources = await scanAllSources();
  if (sources.length === 0) {
    setStatus(tr('msgEmptyTable'), 'error');
    return;
  }
  // 过滤 JSON 数据：保留最近 10 分钟内的响应，按基础 URL 分组每组保留最新 3 个（支持分页）
  const jsonSources = sources.filter(s => s.type === 'json');
  const htmlSources = sources.filter(s => s.type === 'html');
  const now = Date.now();
  const recentJsonSources = jsonSources.filter(s => (s.timestamp || 0) > now - 10 * 60 * 1000);

  // 按基础 URL（去掉查询参数）分组
  const grouped = {};
  recentJsonSources.forEach(s => {
    try {
      const urlObj = new URL(s.source || '');
      const baseUrl = urlObj.origin + urlObj.pathname;
      if (!grouped[baseUrl]) grouped[baseUrl] = [];
      grouped[baseUrl].push(s);
    } catch (_) {
      const baseUrl = s.source || '';
      if (!grouped[baseUrl]) grouped[baseUrl] = [];
      grouped[baseUrl].push(s);
    }
  });

  // 每组按 timestamp 降序，保留前 3 个（分页数据）
  const filteredJson = [];
  Object.values(grouped).forEach(group => {
    group.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    filteredJson.push(...group.slice(0, 3));
  });

  let filteredSources = [...filteredJson, ...htmlSources];
  // 选择行最多的数据源
  filteredSources.sort((a, b) => b.rowCount - a.rowCount);
  const best = filteredSources[0];
  selectedSource = best;

  if (best.type === 'html') {
    selectorInput.value = best.selector || '';
    try { window.electronAPI.saveUserInput({ selector: best.selector || '' }); } catch (_) {}
  }

  setSourceInfo(best.type === 'json' ? 'JSON' : 'HTML',
    (best.type === 'json' ? tr('msgUsingJson') : tr('msgUsingHtml'))
      .replace('{row}', best.rowCount).replace('{col}', best.colCount),
    best.type === 'html');

  setStatus(tr('msgAutoDetect', sources.length, best.rowCount, best.colCount), 'success');
}

// ==================== 元素选取模式（HTML表格） ====================
btnPick.addEventListener('click', () => {
  isPicking = !isPicking;
  if (isPicking) {
    btnPick.textContent = tr('btnPicking');
    btnPick.classList.add('active');
    setStatus(tr('msgPickTable'));
    enableElementPicker();
  } else {
    disableElementPicker();
  }
});

async function enableElementPicker() {
  const code = `
    (function() {
      if (window.__pickerActive2) return;
      window.__pickerActive2 = true;
      const style = document.createElement('style');
      style.id = '__picker_style2';
      style.textContent = '.__picker-hover2 { outline: 2px solid #ff6d01 !important; outline-offset: -2px; cursor: crosshair !important; }';
      document.head.appendChild(style);
      let hoveredEl = null;
      document.addEventListener('mouseover', function(e) {
        if (hoveredEl === e.target) return;
        if (hoveredEl) hoveredEl.classList.remove('__picker-hover2');
        hoveredEl = e.target;
        hoveredEl.classList.add('__picker-hover2');
        e.stopPropagation();
      }, true);
      document.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        // 向上查找最近的<table>或容器
        let el = e.target;
        let container = null;
        while (el && el.parentElement) {
          if (el.tagName === 'TABLE' || (el.classList && (el.classList.contains('k-table') || el.classList.contains('table-main') || /table/i.test(el.className || '')))) {
            container = el;
            break;
          }
          el = el.parentElement;
        }
        if (!container) {
          // 退而求其次：点击位置附近的<table>
          const allTables = document.querySelectorAll('table');
          for (let i = 0; i < allTables.length; i++) {
            const rect = allTables[i].getBoundingClientRect();
            if (Math.abs(rect.left - e.clientX) < 500 && Math.abs(rect.top - e.clientY) < 300) {
              container = allTables[i];
              break;
            }
          }
        }
        if (container) {
          let selector = '';
          if (container.id) selector = '#' + container.id;
          else if (container.className && typeof container.className === 'string') {
            const cls = String(container.className).trim().split(/\\s+/).filter(c => c && !c.startsWith('__picker')).slice(0, 2).join('.');
            if (cls) selector = (container.tagName === 'TABLE' ? 'table.' : '.') + cls;
          }
          if (!selector) selector = container.tagName.toLowerCase();
          window.__pickedSelector2 = selector;
        } else {
          window.__pickedSelector2 = null;
        }
        window.__pickerDone2 = true;
      }, true);
    })()
  `;
  try { await webview.executeJavaScript(code); } catch (_) {}
}

async function disableElementPicker() {
  const code = `
    (function() {
      window.__pickerActive2 = false;
      const s = document.getElementById('__picker_style2');
      if (s) s.remove();
      const h = document.querySelector('.__picker-hover2');
      if (h) h.classList.remove('__picker-hover2');
    })()
  `;
  try { await webview.executeJavaScript(code); } catch (_) {}
  btnPick.textContent = tr('btnPick');
  btnPick.classList.remove('active');
}

async function checkPickerResult2() {
  if (!isPicking) return;
  const code = `(function() { return { done: window.__pickerDone2, selector: window.__pickedSelector2 }; })()`;
  try {
    const result = await webview.executeJavaScript(code);
    if (result && result.done) {
      isPicking = false;
      await disableElementPicker();
      if (result.selector) {
        selectorInput.value = result.selector;
        try { window.electronAPI.saveUserInput({ selector: result.selector }); } catch (_) {}
        setStatus(tr('msgTableSelected') + ': ' + result.selector, 'success');
        // 扫描这个选择器
        scanSelectedHtml();
      } else {
        setStatus(tr('msgNoTable'), 'error');
      }
      await webview.executeJavaScript(`delete window.__pickerDone2; delete window.__pickedSelector2;`);
    }
  } catch (_) {}
}

setInterval(checkPickerResult2, 500);

async function scanSelectedHtml() {
  const sources = await scanAllSources();
  const htmlSources = sources.filter(s => s.type === 'html');
  if (htmlSources.length > 0) {
    const best = htmlSources.sort((a, b) => b.rowCount - a.rowCount)[0];
    selectedSource = best;
    setSourceInfo('HTML',
      tr('msgUsingHtml').replace('{row}', best.rowCount).replace('{col}', best.colCount),
      true);
  }
}

// ==================== 导出 Excel - 主流程 ====================
btnExport.addEventListener('click', showExportModal);

async function showExportModal() {
  setStatus(tr('statusExtracting'));

  // 1. 扫描所有数据源
  capturedSources = await scanAllSources();

  // 诊断：如果未找到 JSON 数据源，检查 webview 中的捕获状态并尝试回退提取
  if (!capturedSources.some(s => s.type === 'json')) {
    try {
      const diag = await webview.executeJavaScript(`(function(){
        const resps = window.__capturedJsonResponses || [];
        return {
          hasCaptureInstalled: !!window.__jsonCaptureInstalled,
          respCount: resps.length,
          urls: resps.slice(0, 5).map(r => r.url),
          rowCounts: resps.slice(0, 5).map(r => r.rowCount || 0)
        };
      })()`);
      console.log('JSON capture diag:', diag);
      if (diag && diag.respCount > 0) {
        setStatus('已捕获 ' + diag.respCount + ' 个JSON响应，尝试回退提取...', 'error');
        const fallbackSources = await scanAllSources();
        if (fallbackSources.length > 0) {
          capturedSources = fallbackSources;
        }
      }
    } catch (_) {}
  }

  // 2. 过滤 JSON 数据：保留最近 expireMinutes 分钟内的响应，按基础 URL 分组每组保留最新 3 个（支持分页）
  const jsonSources = capturedSources.filter(s => s.type === 'json');
  const htmlSources = capturedSources.filter(s => s.type === 'html');
  const now = Date.now();
  const recentJsonSources = jsonSources.filter(s => (s.timestamp || 0) > now - getExpireMs());

  // 按基础 URL（去掉查询参数）分组
  const grouped = {};
  recentJsonSources.forEach(s => {
    try {
      const urlObj = new URL(s.source || '');
      const baseUrl = urlObj.origin + urlObj.pathname;
      if (!grouped[baseUrl]) grouped[baseUrl] = [];
      grouped[baseUrl].push(s);
    } catch (_) {
      const baseUrl = s.source || '';
      if (!grouped[baseUrl]) grouped[baseUrl] = [];
      grouped[baseUrl].push(s);
    }
  });

  // 每组按 timestamp 降序，保留前 3 个（分页数据）
  const filteredJson = [];
  Object.values(grouped).forEach(group => {
    group.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    filteredJson.push(...group.slice(0, 3));
  });

  capturedSources = [...filteredJson, ...htmlSources];
  capturedSources.sort((a, b) => b.rowCount - a.rowCount);

  // 获取当前活动Tab页标题，用于标记和排序
  let currentTabTitle = '';
  try {
    currentTabTitle = await webview.executeJavaScript(`
      (function() {
        var selectors = [
          '.ant-tabs-tab-active', '.el-tabs__item.is-active', '.ivu-tabs-tab-active',
          '.nav-tabs li.active a', '.tab-content .tab-pane.active .panel-title',
          '[role="tab"][aria-selected="true"]', '.tabs .tab.active', '.tab-item.active',
          '.v-tab--active', '.router-link-active', '.active .tab-label', '.active .nav-label',
          '.cdc-tabs .tab-item.active', '.tabs-nav li.active a', '.tab-nav .active'
        ];
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el) {
            var text = (el.textContent || el.innerText || '').trim();
            if (text && text.length > 0 && text.length < 100) return text;
          }
        }
        // 尝试查找带关闭按钮的Tab
        var closeBtns = document.querySelectorAll('.anticon-close, .el-icon-close, .ivu-icon-ios-close, .tab-close, .close-icon, [class*="close"]');
        for (var j = 0; j < closeBtns.length; j++) {
          var tabEl = closeBtns[j].closest('.ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, .tab-item, [role="tab"], .tab, .tabs-item');
          if (tabEl) {
            var tabText = (tabEl.textContent || tabEl.innerText || '').trim();
            if (tabText && tabText.length > 0 && tabText.length < 100) {
              if (tabEl.classList.contains('active') || tabEl.classList.contains('ant-tabs-tab-active') || tabEl.getAttribute('aria-selected') === 'true') {
                return tabText;
              }
            }
          }
        }
        var hash = window.location.hash;
        if (hash && hash.length > 1 && hash.length < 50) return hash.substring(1);
        return document.title || '';
      })()
    `) || '';
  } catch (_) {}

  // 标记每个数据源是否匹配当前Tab页，并按匹配度排序
  if (currentTabTitle) {
    capturedSources.forEach(s => {
      s.isCurrentTab = false;
      if (s.pageTitle) {
        const a = s.pageTitle.trim().toLowerCase();
        const b = currentTabTitle.trim().toLowerCase();
        if (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0) {
          s.isCurrentTab = true;
        }
      }
    });
    // 排序：当前Tab页的排最前，然后按行数降序
    capturedSources.sort((a, b) => {
      if (a.isCurrentTab && !b.isCurrentTab) return -1;
      if (!a.isCurrentTab && b.isCurrentTab) return 1;
      return b.rowCount - a.rowCount;
    });
  }

  // 如果获取到了当前Tab页标题，只使用属于当前Tab页的数据
  let filteredSources = capturedSources;
  if (currentTabTitle) {
    const currentTabSources = capturedSources.filter(s => s.isCurrentTab);
    if (currentTabSources.length > 0) {
      filteredSources = currentTabSources;
    } else {
      // 当前Tab页没有数据，提示用户
      setStatus(tr('msgEmptyTable'), 'error');
      return;
    }
  }

  // 2. 如果只有1个数据源，直接导出
  if (filteredSources.length === 1) {
    const only = filteredSources[0];
    selectedSource = only;
    await doExport(only);
    return;
  }

  // 3. 如果没有数据源，使用 selectorInput 中的CSS选择器尝试
  if (filteredSources.length === 0) {
    const manualSel = selectorInput.value.trim();
    if (manualSel) {
      const data = await extractTableDataBySelector(manualSel);
      if (data && data.headers && data.headers.length > 0 && data.rows && data.rows.length > 0) {
        const manualSource = {
          id: 'manual_1',
          type: 'html',
          source: manualSel,
          headers: data.headers,
          rows: data.rows,
          rowCount: data.rows.length,
          colCount: data.headers.length
        };
        selectedSource = manualSource;
        await doExport(manualSource);
        return;
      }
    }
    setStatus(tr('msgEmptyTable'), 'error');
    return;
  }

  // 4. 有多个数据源，显示选择弹窗
  renderModal(filteredSources);
  sourceModal.classList.add('active');
}

async function extractTableDataBySelector(selector) {
  const code = `
    (function() {
      const root = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if (!root) return null;
      const headers = [];
      const rows = [];
      if (root.tagName === 'TABLE') {
        const thead = root.querySelector('thead');
        if (thead) {
          const trs = thead.querySelectorAll('tr');
          if (trs.length > 0) {
            trs[trs.length - 1].querySelectorAll('th').forEach(th => {
              const t = (th.textContent || '').trim(); if (t) headers.push(t);
            });
          }
          if (headers.length === 0) {
            thead.querySelectorAll(':scope > th').forEach(th => {
              const t = (th.textContent || '').trim(); if (t) headers.push(t);
            });
          }
        }
        if (headers.length === 0) {
          const firstRow = root.querySelector('tr');
          if (firstRow) {
            firstRow.querySelectorAll('th,td').forEach(cell => {
              const t = (cell.textContent || '').trim();
              if (t) headers.push(t);
            });
          }
        }
        const tbody = root.querySelector('tbody') || root;
        tbody.querySelectorAll('tr').forEach(tr => {
          const cells = tr.querySelectorAll('td');
          if (cells.length === 0) return;
          const row = [];
          cells.forEach(td => row.push((td.textContent || '').trim()));
          if (row.some(c => c !== '')) rows.push(row);
        });
      } else {
        // 容器：查找内部table
        const tables = root.querySelectorAll('table');
        tables.forEach(table => {
          const thead = table.querySelector('thead');
          if (thead && headers.length === 0) {
            const trs = thead.querySelectorAll('tr');
            if (trs.length > 0) {
              trs[trs.length - 1].querySelectorAll('th').forEach(th => {
                const t = (th.textContent || '').trim(); if (t) headers.push(t);
              });
            }
            if (headers.length === 0) {
              thead.querySelectorAll(':scope > th').forEach(th => {
                const t = (th.textContent || '').trim(); if (t) headers.push(t);
              });
            }
          }
          const tbody = table.querySelector('tbody') || table;
          tbody.querySelectorAll('tr').forEach(tr => {
            const cells = tr.querySelectorAll('td');
            if (cells.length === 0) return;
            const row = [];
            cells.forEach(td => row.push((td.textContent || '').trim()));
            if (row.some(c => c !== '')) rows.push(row);
          });
        });
      }
      if (headers.length > 1 && headers[0].length <= 2) {
        const firstColEmpty = rows.every(r => !r[0] || r[0].trim() === '');
        if (firstColEmpty) { headers.shift(); rows.forEach(r => r.shift()); }
      }
      return { headers, rows, rowCount: rows.length, colCount: headers.length };
    })()
  `;
  try {
    const result = await webview.executeJavaScript(code);
    return result;
  } catch (_) { return null; }
}

function renderModal(sources) {
  modalTitle.textContent = tr('modalTitle');
  btnCancelModal.textContent = tr('msgCancel');
  btnConfirmExport.textContent = tr('msgConfirm');
  btnConfirmExport.disabled = true;
  selectedSource = null;

  modalBody.innerHTML = '';
  if (!sources || sources.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'modal-empty';
    empty.textContent = tr('msgNoSources');
    modalBody.appendChild(empty);
    return;
  }

  sources.forEach((src) => {
    const item = document.createElement('div');
    item.className = 'modal-item';
    item.dataset.sourceId = src.id;

    const header = document.createElement('div');
    header.className = 'modal-item-header';

    const tag = document.createElement('span');
    tag.className = 'modal-item-tag ' + (src.type === 'json' ? 'json' : 'html');
    tag.textContent = src.type === 'json' ? 'JSON' : 'HTML';
    header.appendChild(tag);

    const title = document.createElement('span');
    title.className = 'modal-item-title';
    title.textContent = `${src.rowCount} 行 × ${src.colCount} 列`;
    header.appendChild(title);
    item.appendChild(header);

    // Tab页名称（如果存在）
    if (src.pageTitle && src.pageTitle.trim()) {
      const pageTitle = document.createElement('div');
      pageTitle.className = 'modal-item-pagetitle';
      let prefix = '';
      if (src.isCurrentTab) {
        prefix = '✓ 当前Tab: ';
        pageTitle.classList.add('current-tab');
      }
      pageTitle.textContent = prefix + src.pageTitle;
      item.appendChild(pageTitle);
    }

    // 来源信息：URL + 时间 + 大小
    const info = document.createElement('div');
    info.className = 'modal-item-info';
    let infoText = src.type === 'json'
      ? tr('msgJsonSource') + ': ' + shortenUrl(src.source)
      : tr('msgHtmlSource') + ': ' + src.source;
    // 添加时间信息
    if (src.timestamp) {
      const date = new Date(src.timestamp);
      const timeStr = date.getHours().toString().padStart(2, '0') + ':' +
                      date.getMinutes().toString().padStart(2, '0') + ':' +
                      date.getSeconds().toString().padStart(2, '0');
      infoText += ' | ' + timeStr;
    }
    // 添加大小信息
    if (src.size) {
      const sizeMB = (src.size / 1024 / 1024).toFixed(1);
      infoText += ' | ' + sizeMB + 'MB';
    }
    info.textContent = infoText;
    item.appendChild(info);

    // URL关键参数（帮助区分相同API的不同查询）
    if (src.type === 'json' && src.source) {
      const keyParams = extractUrlKeyParams(src.source);
      if (keyParams) {
        const paramsDiv = document.createElement('div');
        paramsDiv.className = 'modal-item-params';
        paramsDiv.textContent = keyParams;
        item.appendChild(paramsDiv);
      }
    }

    const cols = document.createElement('div');
    cols.className = 'modal-item-columns';
    cols.textContent = '列: ' + src.headers.slice(0, 10).join(', ') + (src.headers.length > 10 ? ' ...' : '');
    item.appendChild(cols);

    item.addEventListener('click', () => {
      modalBody.querySelectorAll('.modal-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedSource = src;
      btnConfirmExport.disabled = false;
    });
    modalBody.appendChild(item);
  });

  // 自动选择第一个
  if (modalBody.firstChild) {
    modalBody.firstChild.classList.add('selected');
    selectedSource = sources[0];
    btnConfirmExport.disabled = false;
  }
}

function shortenUrl(url) {
  if (!url) return '';
  if (url.length > 80) return url.substring(0, 40) + '...' + url.substring(url.length - 35);
  return url;
}

// 从URL中提取关键参数，帮助用户区分相同API的不同查询
function extractUrlKeyParams(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    const keyNames = ['ey', 'id', 'taskId', 'queryId', 'sqlId', 'name', 'table', 'type', 'mode', 'action'];
    const parts = [];
    for (const name of keyNames) {
      const val = params.get(name);
      if (val && val.length < 30) {
        parts.push(name + '=' + val);
      }
    }
    // 也检查路径最后一段
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.length < 20 && !/^\d+$/.test(lastPart)) {
      parts.unshift(lastPart);
    }
    if (parts.length > 0) {
      return '参数: ' + parts.join(', ');
    }
    return null;
  } catch (_) {
    return null;
  }
}

btnCancelModal.addEventListener('click', () => {
  sourceModal.classList.remove('active');
  setStatus(tr('statusReady'));
});

sourceModal.addEventListener('click', (e) => {
  if (e.target === sourceModal) {
    sourceModal.classList.remove('active');
    setStatus(tr('statusReady'));
  }
});

btnConfirmExport.addEventListener('click', async () => {
  if (!selectedSource) return;
  sourceModal.classList.remove('active');
  await doExport(selectedSource);
});

async function doExport(source) {
  setStatus(tr('statusExporting') + ' (' + source.rowCount + ' ' + (currentLang === 'zh' ? '行' : 'rows') + ')...');

  // 生成文件名
  let defaultFileName = 'doris_export_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const customName = filenameInput.value.trim();
  if (customName) {
    defaultFileName = customName.replace(/[\\/:*?"<>|]/g, '_');
    // 如果用户输入了扩展名，自动删除
    defaultFileName = defaultFileName.replace(/\.(xlsx?|csv|txt|docx?|json|xml)$/i, '');
  }
  defaultFileName += '.xlsx';

  if (!window.electronAPI || !window.electronAPI.exportExcel) {
    setStatus(tr('msgExportFail') + ' ' + (currentLang === 'zh' ? 'IPC 未初始化，请重启应用' : 'IPC not ready, please restart the app'), 'error');
    return;
  }

  // 延迟一帧让 UI 更新，避免假死感
  await new Promise(r => setTimeout(r, 50));

  try {
    // 准备 sourceInfo：优先使用主进程存储的数据，避免 webview 崩溃后无法导出
    const sourceInfo = {
      type: source.type,
      cacheId: source.cacheId,
      selector: source.selector,
      rowCount: source.rowCount,
      headers: source.headers
    };
    // 如果数据源来自主进程捕获，传递索引和路径，导出时直接从主进程获取
    if (typeof source.mainCaptureIndex === 'number') {
      sourceInfo.mainCaptureIndex = source.mainCaptureIndex;
      sourceInfo.path = source.path;
    }

    // 获取 webviewId 供主进程直接访问
    try {
      sourceInfo.webviewId = webview.getWebContentsId();
    } catch (_) {}

    // 小数据或手动模式：如果 source 已有 rows（如手动选择器回退路径），直接传递
    if (source.rows && source.rows.length > 0) {
      sourceInfo.rows = source.rows;
    }

    const result = await window.electronAPI.exportExcel({
      sourceInfo,
      defaultFileName
    });

    if (result && result.success) {
      let msg = tr('msgExportSuccess') + ' ' + result.filePath;
      if (result.warning) msg = result.warning;
      // 使用 DOM API 创建打开文件/文件夹按钮（避免 innerHTML onclick 不可靠）
      statusText.textContent = msg;
      statusText.className = 'status success';
      const actionsSpan = document.createElement('span');
      actionsSpan.className = 'export-actions';
      const openFileBtn = document.createElement('button');
      openFileBtn.textContent = tr('msgOpenFile');
      openFileBtn.addEventListener('click', () => window.openExportedFile(result.filePath));
      actionsSpan.appendChild(openFileBtn);
      const openFolderBtn = document.createElement('button');
      openFolderBtn.textContent = tr('msgOpenFolder');
      openFolderBtn.addEventListener('click', () => window.openExportedFolder(result.filePath));
      actionsSpan.appendChild(openFolderBtn);
      statusText.appendChild(actionsSpan);
      setSourceInfo(source.type === 'json' ? 'JSON' : 'HTML',
        (source.type === 'json' ? tr('msgUsingJson') : tr('msgUsingHtml'))
          .replace('{row}', source.rowCount).replace('{col}', source.colCount),
        source.type === 'html');
    } else {
      setStatus(tr('msgExportFail') + ' ' + (result ? (result.message || '') : ''), 'error');
    }
  } catch (e) {
    setStatus(tr('msgExportFail') + ' ' + (e.message || e), 'error');
  }
}

// 菜单项快捷键触发导出
if (window.electronAPI && window.electronAPI.onMenuExport) {
  window.electronAPI.onMenuExport(() => showExportModal());
}

// 打开导出的文件/文件夹（供内联 onclick 使用）
window.openExportedFile = async (filePath) => {
  try { await window.electronAPI.openPath(filePath); } catch (_) {}
};
window.openExportedFolder = async (filePath) => {
  try {
    // 兼容 Windows 反斜杠和正斜杠
    const normalized = filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const folder = lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized;
    await window.electronAPI.openFolder(folder);
  } catch (_) {}
};

// ==================== 初始化 ====================
function setupWebviewPreload() {
  // 优先使用 main.js 通过 preload 暴露的绝对路径
  if (window.electronAPI && typeof window.electronAPI.getWebviewPreload === 'function') {
    try {
      const preloadPath = window.electronAPI.getWebviewPreload();
      if (preloadPath) {
        webview.setAttribute('preload', preloadPath);
        return;
      }
    } catch (_) {}
  }
  // 回退：从 renderer 页面的 URL 计算 webview-preload.js 的绝对路径
  const href = document.location.href;
  if (href && href.startsWith('file://')) {
    const baseDir = href.replace(/\/[^\/]*$/, '/');
    const preloadUrl = baseDir + 'webview-preload.js';
    if (webview.getAttribute('preload') !== preloadUrl) {
      webview.setAttribute('preload', preloadUrl);
    }
  }
}

async function init() {
  // 1. 设置 webview 的 preload 为绝对路径（在任何导航之前）
  setupWebviewPreload();

  // 2. 初始化设置与语言
  if (window.electronAPI && window.electronAPI.onInitSettings) {
    window.electronAPI.onInitSettings((settings) => {
      currentLang = settings.language || 'zh';
      applyLanguage(currentLang);
      if (settings.lastUrl) {
        urlInput.value = settings.lastUrl;
        currentSiteKey = getSiteKey(settings.lastUrl);
        checkSavedCredentials();
      }
      if (settings.lastSelector) selectorInput.value = settings.lastSelector;
      if (settings.expireMinutes && settings.expireMinutes > 0) {
        expireMinutes = settings.expireMinutes;
        expireMinutesInput.value = expireMinutes;
        syncExpireMsToWebview();
      }
      // 文件名默认不记录
      setStatus(tr('statusReady'));
    });
  }
  if (window.electronAPI && window.electronAPI.onLanguageChanged) {
    window.electronAPI.onLanguageChanged((lang) => applyLanguage(lang));
  }
  setTimeout(async () => {
    if (window.electronAPI && window.electronAPI.getLanguage) {
      try {
        const lang = await window.electronAPI.getLanguage();
        applyLanguage(lang || 'zh');
      } catch (_) { applyLanguage('zh'); }
    } else {
      applyLanguage('zh');
    }
  }, 3000);
}
init();
