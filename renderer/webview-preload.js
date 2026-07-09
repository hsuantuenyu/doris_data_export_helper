(function() {
  'use strict';

  let ipcRenderer = null;
  try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
  } catch (_) {}

  window.__captchaCode = '';
  window.__tabConfigMap = {};
  window.__tabResultMap = {};



  function isCaptchaUrl(url) {
    return typeof url === 'string' && /(?:^|\/)api\/code(?:[?#]|$)/i.test(url);
  }

  function extractCaptchaFromResponse(data) {
    try {
      if (data && typeof data === 'object' && data.result) {
        return String(data.result).trim();
      }
    } catch (_) {}
    return '';
  }

  window.__capturedJsonResponses = window.__capturedJsonResponses || [];
  window.__jsonCaptureInstalled = true;
  window.__getCapturedJson = function() { return window.__capturedJsonResponses || []; };
window.__clearCapturedJson = function() { window.__capturedJsonResponses = []; };
window.__clearCapturedJsonByTab = function(tabTitle) {
  try {
    if (!tabTitle || !window.__capturedJsonResponses) return;
    const lowerTitle = tabTitle.toLowerCase();
    for (let i = window.__capturedJsonResponses.length - 1; i >= 0; i--) {
      const pt = (window.__capturedJsonResponses[i].pageTitle || '').toLowerCase();
      if (pt === lowerTitle || pt.indexOf(lowerTitle) >= 0 || lowerTitle.indexOf(pt) >= 0) {
        window.__capturedJsonResponses[i].data = null;
        window.__capturedJsonResponses.splice(i, 1);
      }
    }
    if (window.__tabResultMap && window.__tabResultMap[tabTitle]) {
      delete window.__tabResultMap[tabTitle];
    }
  } catch (_) {}
};

  const BIG_RESPONSE_THRESHOLD = 5 * 1024 * 1024;
  const HUGE_RESPONSE_THRESHOLD = 20 * 1024 * 1024;
  const MAX_BIG_KEEP = 1;
  const MAX_SMALL_KEEP = 5;
  const BIG_ROW_THRESHOLD = 50000;
  const HUGE_ROW_THRESHOLD = 100000;
  const RENDER_ROW_LIMIT = 5000;

  function truncateDataForRender(data, limit) {
    if (!data || typeof data !== 'object') return;

    function shouldTruncateArray(arr) {
      if (!Array.isArray(arr) || arr.length <= limit) return false;
      if (arr.length === 0) return false;
      const first = arr[0];
      if (first && typeof first === 'object') return true;
      return false;
    }

    function truncateObj(obj, depth) {
      if (depth > 5 || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        if (shouldTruncateArray(obj)) {
          obj.length = limit;
        }
        return;
      }
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = obj[key];
        if (Array.isArray(val) && shouldTruncateArray(val)) {
          val.length = limit;
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          truncateObj(val, depth + 1);
        }
      }
    }

    truncateObj(data, 0);
  }

  function fastEstimateRowCount(data) {
    try {
      if (Array.isArray(data)) return data.length;
      if (data && typeof data === 'object') {
        const keys = ['data', 'result', 'rows', 'records', 'list'];
        for (let i = 0; i < keys.length; i++) {
          const v = data[keys[i]];
          if (Array.isArray(v)) return v.length;
          if (v && typeof v === 'object') {
            for (let j = 0; j < keys.length; j++) {
              const nv = v[keys[j]];
              if (Array.isArray(nv)) return nv.length;
            }
          }
        }
      }
    } catch (_) {}
    return 0;
  }

  function estimateRowCount(data) {
    try {
      const DATA_KEYS = ['result', 'data', 'rows', 'records', 'list', 'items',
        'tableData', 'payload', 'content', 'listData', 'dataList',
        'queryResult', 'query_data', 'searchResult', 'RECORDS'];
      if (Array.isArray(data)) return data.length;
      if (data && typeof data === 'object') {
        for (let i = 0; i < DATA_KEYS.length; i++) {
          const val = data[DATA_KEYS[i]];
          if (Array.isArray(val)) return val.length;
          if (val && typeof val === 'object') {
            for (let j = 0; j < DATA_KEYS.length; j++) {
              const nested = val[DATA_KEYS[j]];
              if (Array.isArray(nested)) return nested.length;
            }
          }
        }
        if (Array.isArray(data.columns) || Array.isArray(data.fields)) {
          const rowSrc = data.rows || data.data || data.result || data.records || data.values;
          if (Array.isArray(rowSrc)) return rowSrc.length;
        }
      }
    } catch (_) {}
    return 0;
  }

  function getActiveTabTitle() {
    try {
      var title = document.title || '';
      // 尝试从常见Tab组件获取当前激活Tab标签文本
      var selectors = [
        '.k-tab.k-active',
        '.k-tab.active',
        '.ant-tabs-tab-active',
        '.el-tabs__item.is-active',
        '.ivu-tabs-tab-active',
        '.nav-tabs li.active a',
        '.tab-content .tab-pane.active .panel-title',
        '[role="tab"][aria-selected="true"]',
        '.tabs .tab.active',
        '.tab-item.active',
        '.v-tab--active',
        '.router-link-active',
        '.active .tab-label',
        '.active .nav-label',
        '.cdc-tabs .tab-item.active',
        '.tabs-nav li.active a',
        '.tab-nav .active'
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) {
          var titleSpan = el.querySelector('span[title]');
          if (titleSpan) {
            var t = (titleSpan.getAttribute('title') || '').trim();
            if (t && t.length > 0 && t.length < 100) return t;
          }
          var text = (el.textContent || el.innerText || '').trim();
          if (text && text.length > 0 && text.length < 100) {
            return text;
          }
        }
      }
      // 尝试查找带关闭按钮的Tab（常见于编辑器多Tab场景）
      var closeBtns = document.querySelectorAll('.anticon-close, .el-icon-close, .ivu-icon-ios-close, .tab-close, .close-icon, [class*="close"]');
      for (var j = 0; j < closeBtns.length; j++) {
        var tabEl = closeBtns[j].closest('.ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, .tab-item, [role="tab"], .tab, .tabs-item');
        if (tabEl) {
          var tabText = (tabEl.textContent || tabEl.innerText || '').trim();
          if (tabText && tabText.length > 0 && tabText.length < 100) {
            // 如果这个Tab是激活状态，返回它的文本
            if (tabEl.classList.contains('active') || tabEl.classList.contains('ant-tabs-tab-active') || tabEl.getAttribute('aria-selected') === 'true') {
              return tabText;
            }
          }
        }
      }
      // 尝试从URL hash或路径提取
      var hash = window.location.hash;
      if (hash && hash.length > 1 && hash.length < 50) {
        return hash.substring(1);
      }
      return title;
    } catch(e) {
      return document.title || '';
    }
  }
  window.__getActiveTabTitle = getActiveTabTitle;

  function pushResponse(url, data, size, requestTabTitle, requestStartTime) {
    try {
      if (/getSearchDeatil/i.test(url || '')) {
        try {
          const tabName = data && data.result && data.result.name ? data.result.name : '';
          const sql = data && data.result && data.result.content && data.result.content.sql ? data.result.content.sql : '';
          const searchIdMatch = (url || '').match(/[?&]searchId=(\d+)/);
          if (tabName) {
            window.__tabConfigMap[tabName] = {
              searchId: searchIdMatch ? searchIdMatch[1] : '',
              sql: sql,
              timestamp: Date.now()
            };
          }
        } catch(_) {}
      }

      const rowCount = estimateRowCount(data);
      const isBig = (size || 0) > BIG_RESPONSE_THRESHOLD || rowCount > BIG_ROW_THRESHOLD;
      const isHuge = (size || 0) > HUGE_RESPONSE_THRESHOLD || rowCount > HUGE_ROW_THRESHOLD;
      const tabTitle = requestTabTitle || getActiveTabTitle();
      const entryTimestamp = requestStartTime || Date.now();

      if (tabTitle && window.__tabConfigMap[tabTitle] && rowCount > 0 && !/getSearchDeatil/i.test(url || '')) {
        window.__tabResultMap[tabTitle] = {
          url: url || 'unknown',
          timestamp: entryTimestamp,
          rowCount: rowCount,
          size: size || 0
        };
      }

      const entry = {
        url: url || 'unknown',
        timestamp: entryTimestamp,
        size: size || 0,
        data: data,
        rowCount: rowCount,
        isBig: isBig,
        isHuge: isHuge,
        pageTitle: tabTitle,
        requestStartTime: requestStartTime
      };

      if (ipcRenderer) {
        try {
          ipcRenderer.send('json-captured', entry);
        } catch (_) {}
      }

      // 内存优化：大数据已发送到主进程后，释放webv_view中的data以减少内存占用，防止崩溃
      if (ipcRenderer && (isBig || isHuge)) {
        entry.data = null;
      }

      window.__capturedJsonResponses.push(entry);

      const maxKeep = isBig ? MAX_BIG_KEEP : MAX_SMALL_KEEP;
      if (window.__capturedJsonResponses.length > maxKeep) {
        window.__capturedJsonResponses.splice(0, window.__capturedJsonResponses.length - maxKeep);
      }

      // 进一步内存优化：如果webv_view中累积的数据总大小超过阈值，清理所有旧数据的data字段
      var totalSize = 0;
      for (var j = 0; j < window.__capturedJsonResponses.length; j++) {
        totalSize += window.__capturedJsonResponses[j].size || 0;
      }
      if (totalSize > 50 * 1024 * 1024) { // 50MB
        for (var k = 0; k < window.__capturedJsonResponses.length; k++) {
          if (window.__capturedJsonResponses[k].data) {
            window.__capturedJsonResponses[k].data = null;
          }
        }
      }
    } catch(e) {}
  }

  function shouldCaptureUrl(url) {
    if (typeof url !== 'string') return false;
    if (/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|map)(\?|$)/i.test(url)) return false;
    return true;
  }

  function isJsonResponse(text) {
    if (!text || typeof text !== 'string') return false;
    const firstChar = text.trim().charAt(0);
    return firstChar === '{' || firstChar === '[';
  }

  function processBigResponseAsync(url, text, size, callback) {
    const startTime = Date.now();
    const CHUNK_SIZE = 5000;
    let remaining = text;
    let parsedParts = [];

    function parseChunk() {
      if (remaining.length === 0) {
        try {
          const data = JSON.parse(parsedParts.join(''));
          callback(data);
        } catch (err) {
          try {
            const data = JSON.parse(text);
            callback(data);
          } catch (_) {
            callback(null);
          }
        }
        return;
      }

      const chunk = remaining.substring(0, CHUNK_SIZE);
      remaining = remaining.substring(CHUNK_SIZE);
      parsedParts.push(chunk);

      if (Date.now() - startTime > 100) {
        setTimeout(parseChunk, 0);
      } else {
        parseChunk();
      }
    }

    try {
      const data = JSON.parse(text);
      callback(data);
    } catch (err) {
      setTimeout(parseChunk, 0);
    }
  }

  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    let requestUrl = '';
    let requestTabTitle = '';
    let requestStartTime = 0;

    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      requestTabTitle = getActiveTabTitle();
      requestStartTime = Date.now();
      return originalOpen.apply(xhr, [method, url, ...rest]);
    };

    xhr.addEventListener('load', function() {
      try {
        let data = null;
        let size = 0;

        if (xhr.responseType === 'json' && xhr.response && typeof xhr.response === 'object') {
          data = xhr.response;
          size = (xhr.responseText && xhr.responseText.length) || 0;
        }

        if (isCaptchaUrl(requestUrl)) {
          try {
            const captchaData = data || JSON.parse(xhr.responseText);
            const code = extractCaptchaFromResponse(captchaData);
            if (code) window.__captchaCode = code;
          } catch (_) {}
        }

        if (shouldCaptureUrl(requestUrl)) {
          if (!data) {
            const respText = xhr.responseText;
            if (!respText || respText.length <= 100 || respText.length > 50 * 1024 * 1024) return;
            if (!isJsonResponse(respText)) return;

            const respSize = respText.length;
            const isPotentiallyBig = respSize > BIG_RESPONSE_THRESHOLD;

            if (isPotentiallyBig) {
              processBigResponseAsync(requestUrl, respText, respSize, function(parsedData) {
                if (!parsedData) return;
                try {
                  const rowCount = estimateRowCount(parsedData);

                  if (rowCount > RENDER_ROW_LIMIT) {
                    try {
                      truncateDataForRender(parsedData, RENDER_ROW_LIMIT);
                    } catch (_) {}
                  }

                  pushResponse(requestUrl, parsedData, respSize, requestTabTitle, requestStartTime);
                } catch (_) {}
              });
              return;
            }

            try { data = JSON.parse(respText); size = respText.length; } catch (_) { return; }
          }

          if (data && typeof data === 'object') {
            const rowCount = estimateRowCount(data);
            const isBig = size > BIG_RESPONSE_THRESHOLD || rowCount > BIG_ROW_THRESHOLD;

            pushResponse(requestUrl, data, size, requestTabTitle, requestStartTime);

            if (rowCount > RENDER_ROW_LIMIT) {
              try {
                truncateDataForRender(data, RENDER_ROW_LIMIT);
                Object.defineProperty(xhr, 'response', {
                  get: function() { return data; },
                  configurable: true
                });
                try {
                  Object.defineProperty(xhr, 'responseText', {
                    get: function() { return JSON.stringify(data); },
                    configurable: true
                  });
                } catch (_) {}
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    });

    return xhr;
  };
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;

  let currentFetchUrl = '';
  const fetchRequestInfo = new WeakMap();
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : 'fetch');
    currentFetchUrl = urlStr;
    const requestTabTitle = getActiveTabTitle();
    const requestStartTime = Date.now();
    const response = await originalFetch.apply(this, args);
    fetchRequestInfo.set(response, { tabTitle: requestTabTitle, startTime: requestStartTime });

    if (isCaptchaUrl(urlStr) && response.clone) {
      try {
        const cloned = response.clone();
        cloned.text().then(function(text) {
          try {
            const data = JSON.parse(text);
            const code = extractCaptchaFromResponse(data);
            if (code) window.__captchaCode = code;
          } catch(_) {}
        }).catch(function(){});
      } catch(_) {}
    }

    return response;
  };

  const originalResponseJson = Response.prototype.json;
  Response.prototype.json = function() {
    const resp = this;
    const url = currentFetchUrl || (resp.url || '');
    const requestInfo = fetchRequestInfo.get(resp) || {};
    const requestTabTitle = requestInfo.tabTitle || '';
    const requestStartTime = requestInfo.startTime || Date.now();
    const origPromise = originalResponseJson.apply(this, arguments);
    return origPromise.then(function(data) {
      try {
        if (isCaptchaUrl(url)) {
          const code = extractCaptchaFromResponse(data);
          if (code) window.__captchaCode = code;
        }
        if (shouldCaptureUrl(url) && data && typeof data === 'object') {
          const cl = resp.headers && resp.headers.get ? resp.headers.get('content-length') : null;
          const size = cl ? (parseInt(cl, 10) || 0) : 0;
          if (size > 50 * 1024 * 1024) {
            return data;
          }
          const approxRows = fastEstimateRowCount(data);
          const isBig = size > BIG_RESPONSE_THRESHOLD || approxRows > BIG_ROW_THRESHOLD;

          pushResponse(url, data, size, requestTabTitle, requestStartTime);

          if (approxRows > RENDER_ROW_LIMIT) {
            try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
          }
        }
      } catch (_) {}
      return data;
    });
  };

  function isQueryButton(btn) {
    if (!btn) return false;
    const btnText = (btn.textContent || btn.innerText || btn.value || '').trim();
    if (!btnText) return false;
    return /运行|执行|查询|搜索|提交|查询数据|执行查询|运行查询|开始查询|run|execute|query|search|submit/i.test(btnText);
  }

  function clearOnQueryClick(e) {
    try {
      const btn = e.target && e.target.closest && e.target.closest('button, input[type="submit"], input[type="button"], [role="button"], .btn, .ant-btn, .el-button');
      if (!btn) return;
      if (isQueryButton(btn)) {
        const activeTab = getActiveTabTitle();
        // 清空当前 Tab 的结果映射
        if (activeTab && window.__tabResultMap[activeTab]) {
          delete window.__tabResultMap[activeTab];
        }
        setTimeout(function() {
          try {
            if (window.__capturedJsonResponses && window.__capturedJsonResponses.length > 0) {
              window.__capturedJsonResponses = [];
              window.__exportDataCache = {};
            }
            // 同时通知主进程清空捕获数据，避免旧数据干扰
            if (ipcRenderer) {
              try {
                ipcRenderer.invoke('clear-captured-json').catch(function(){});
              } catch (_) {}
            }
          } catch (_) {}
        }, 500);
      }
    } catch (_) {}
  }

  document.addEventListener('click', clearOnQueryClick, true);

  function installCaptchaIntercept(win) {
    if (!win || win.__captchaInterceptInstalled) return;
    win.__captchaInterceptInstalled = true;

    if (typeof win.__captchaCode === 'undefined') win.__captchaCode = '';

    function isCaptchaUrl(url) {
      return typeof url === 'string' && /(?:^|\/)api\/code(?:[?#]|$)/i.test(url);
    }

    function extractCaptchaFromResponse(data) {
      try {
        if (data && typeof data === 'object' && data.result) {
          return String(data.result).trim();
        }
      } catch (_) {}
      return '';
    }

    try {
      const OriginalXHR = win.XMLHttpRequest;
      if (OriginalXHR && !win.__captchaXHRInterceptInstalled) {
        win.__captchaXHRInterceptInstalled = true;
        win.XMLHttpRequest = function() {
          const xhr = new OriginalXHR();
          const originalOpen = xhr.open;
          let requestUrl = '';
          xhr.open = function(method, url, ...rest) {
            requestUrl = url;
            return originalOpen.apply(xhr, [method, url, ...rest]);
          };
          xhr.addEventListener('load', function() {
            try {
              if (isCaptchaUrl(requestUrl)) {
                const data = JSON.parse(xhr.responseText);
                const code = extractCaptchaFromResponse(data);
                if (code) win.__captchaCode = code;
              }
            } catch (_) {}
          });
          return xhr;
        };
        if (OriginalXHR.prototype) {
          Object.setPrototypeOf(win.XMLHttpRequest, OriginalXHR);
          win.XMLHttpRequest.prototype = OriginalXHR.prototype;
        }
      }
    } catch(e) {}

    try {
      const originalFetch = win.fetch;
      if (originalFetch && !win.__captchaFetchInterceptInstalled) {
        win.__captchaFetchInterceptInstalled = true;
        win.fetch = async function(...args) {
          const url = args[0];
          const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : 'fetch');
          const response = await originalFetch.apply(this, args);
          if (isCaptchaUrl(urlStr) && response.clone) {
            try {
              const cloned = response.clone();
              cloned.text().then(function(text) {
                try {
                  const data = JSON.parse(text);
                  const code = extractCaptchaFromResponse(data);
                  if (code) win.__captchaCode = code;
                } catch(_) {}
              }).catch(function(){});
            } catch(_) {}
          }
          return response;
        };
      }
    } catch(e) {}
  }

  function injectIframes() {
    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      try {
        const iframeWin = iframes[i].contentWindow;
        if (iframeWin) installCaptchaIntercept(iframeWin);
      } catch(e) {}
    }
  }

  setTimeout(injectIframes, 500);
  setTimeout(injectIframes, 1500);
  setTimeout(injectIframes, 3000);

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(function(mutations) {
      let hasNewIframe = false;
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          if (added[j].tagName === 'IFRAME') {
            hasNewIframe = true;
            added[j].addEventListener('load', function() {
              try {
                const iframeWin = added[j].contentWindow;
                if (iframeWin) installCaptchaIntercept(iframeWin);
              } catch(e) {}
            });
          }
        }
      }
      if (hasNewIframe) setTimeout(injectIframes, 500);
    });

    function startObserver() {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        setTimeout(startObserver, 100);
      }
    }
    startObserver();
  }

})();