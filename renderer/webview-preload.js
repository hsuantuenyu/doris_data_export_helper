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
    if (window.__tabConfigMap && window.__tabConfigMap[tabTitle]) {
      delete window.__tabConfigMap[tabTitle];
    }
  } catch (_) {}
};

  const BIG_RESPONSE_THRESHOLD = 1 * 1024 * 1024;
  const HUGE_RESPONSE_THRESHOLD = 2 * 1024 * 1024;
  const MAX_BIG_KEEP = 1;
  const MAX_SMALL_KEEP = 5;
  const BIG_ROW_THRESHOLD = 10000;
  const HUGE_ROW_THRESHOLD = 15000;
  const RENDER_ROW_LIMIT = 5000;
  const WEBVIEW_DATA_KEEP_LIMIT = 2000;

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
        '.flow-tabs-item.k-active',
        '.flow-tabs-item.active',
        '.k-tab.k-active',
        '.k-tab.active',
        '.k-tabs-item.k-active',
        '.k-tabs-item.active',
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
        var tabEl = closeBtns[j].closest('.ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, .tab-item, [role="tab"], .tab, .tabs-item, .flow-tabs-item, .k-tab, .k-tabs-item');
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

      if (isHuge && ipcRenderer) {
        try {
          const entryForFile = {
            url: url || 'unknown',
            timestamp: entryTimestamp,
            size: size || 0,
            data: data,
            rowCount: rowCount,
            pageTitle: tabTitle
          };
          ipcRenderer.invoke('save-json-file', entryForFile).then(function(r) {
            if (r && r.success && r.info) {
              const lightEntry = {
                url: url || 'unknown',
                timestamp: entryTimestamp,
                size: size || 0,
                data: null,
                rowCount: rowCount,
                isBig: true,
                isHuge: true,
                pageTitle: tabTitle,
                isFileCached: true,
                filePath: r.info.filePath,
                requestStartTime: requestStartTime
              };
              window.__capturedJsonResponses.push(lightEntry);
              if (window.__capturedJsonResponses.length > MAX_BIG_KEEP) {
                window.__capturedJsonResponses.splice(0, window.__capturedJsonResponses.length - MAX_BIG_KEEP);
              }
              entryForFile.data = null;
            }
          }).catch(function() {});
          return;
        } catch (_) {}
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

      // 发送到主进程后，webview 中只保留小数据的完整对象（用于快速预览）
      // 超过 WEBVIEW_DATA_KEEP_LIMIT 行的数据全部置空，避免 webview 内存累积
      if (rowCount > WEBVIEW_DATA_KEEP_LIMIT) {
        entry.data = null;
      }

      window.__capturedJsonResponses.push(entry);

      const maxKeep = isBig ? MAX_BIG_KEEP : MAX_SMALL_KEEP;
      if (window.__capturedJsonResponses.length > maxKeep) {
        const removed = window.__capturedJsonResponses.splice(0, window.__capturedJsonResponses.length - maxKeep);
        for (let ri = 0; ri < removed.length; ri++) {
          if (removed[ri] && removed[ri].data) {
            removed[ri].data = null;
          }
        }
      }

      var totalSize = 0;
      for (var j = 0; j < window.__capturedJsonResponses.length; j++) {
        totalSize += window.__capturedJsonResponses[j].size || 0;
      }
      if (totalSize > 20 * 1024 * 1024) {
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
    if (/\/ds-standard-query\/cacheData\//i.test(url)) return false;
    return true;
  }

  function isJsonResponse(text) {
    if (!text || typeof text !== 'string') return false;
    const firstChar = text.trim().charAt(0);
    return firstChar === '{' || firstChar === '[';
  }

  function processBigResponseAsync(url, text, size, callback) {
    setTimeout(function() {
      try {
        const data = JSON.parse(text);
        callback(data);
      } catch (_) {
        callback(null);
      }
    }, 10);
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
    fetchRequestInfo.set(response, { tabTitle: requestTabTitle, startTime: requestStartTime, url: urlStr });

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

    // 大数据预检：通过 Content-Length 提前判断，超过阈值时通知主进程直接重新请求并保存，webview 不读取任何响应内容
    try {
      if (shouldCaptureUrl(urlStr)) {
        const cl = response.headers && response.headers.get ? response.headers.get('content-length') : null;
        const size = cl ? (parseInt(cl, 10) || 0) : 0;
        if (size > HUGE_RESPONSE_THRESHOLD) {
          fetchRequestInfo.get(response).preServedAsFile = true;
          if (ipcRenderer) {
            ipcRenderer.send('re-fetch-and-save', {
              url: urlStr,
              method: 'GET',
              pageTitle: requestTabTitle,
              timestamp: requestStartTime
            });
          }
        }
      }
    } catch (_) {}

    return response;
  };

  const originalResponseJson = Response.prototype.json;
  Response.prototype.json = function() {
    const resp = this;
    const url = currentFetchUrl || (resp.url || '');
    const requestInfo = fetchRequestInfo.get(resp) || {};
    const requestTabTitle = requestInfo.tabTitle || '';
    const requestStartTime = requestInfo.startTime || Date.now();

    // 如果已经在 fetch 阶段处理为文件缓存，阻断原始 .json() 解析以避免 webview 内存耗尽
    if (requestInfo.preServedAsFile) {
      const cl = resp.headers && resp.headers.get ? resp.headers.get('content-length') : null;
      const size = cl ? (parseInt(cl, 10) || 0) : 0;
      return Promise.resolve({
        __isFileProxy: true,
        __url: url,
        __tabTitle: requestTabTitle,
        __size: size,
        __timestamp: requestStartTime,
        status: 'success',
        message: 'success',
        result: {
          data: [],
          total: 0,
          columns: [],
          __fileProxyEmpty: true
        }
      });
    }

    // 对于需要捕获的 URL，不使用内置 .json() 解析（避免大数据解析时内存崩溃），
    // 而是先读取文本判断大小，再手动解析和截断
    if (shouldCaptureUrl(url) || isCaptchaUrl(url)) {
      return resp.text().then(function(text) {
        const size = text ? text.length : 0;

        // 验证码URL直接解析
        if (isCaptchaUrl(url)) {
          try {
            const data = JSON.parse(text);
            const code = extractCaptchaFromResponse(data);
            if (code) window.__captchaCode = code;
            return data;
          } catch (_) {
            return {};
          }
        }

        // 大数据（超过阈值）：直接丢弃文本，不解析，通知主进程重新请求保存为文件
        if (size > HUGE_RESPONSE_THRESHOLD) {
          if (ipcRenderer) {
            ipcRenderer.send('re-fetch-and-save', {
              url: url,
              method: 'GET',
              pageTitle: requestTabTitle,
              timestamp: requestStartTime
            });
          }
          return {
            __isFileProxy: true,
            __url: url,
            __tabTitle: requestTabTitle,
            __size: size,
            __timestamp: requestStartTime,
            status: 'success',
            message: 'success',
            result: {
              data: [],
              total: 0,
              columns: [],
              __fileProxyEmpty: true
            }
          };
        }

        // 小数据：手动解析，截断后返回
        try {
          const data = JSON.parse(text);
          const approxRows = fastEstimateRowCount(data);
          const isBig = size > BIG_RESPONSE_THRESHOLD || approxRows > BIG_ROW_THRESHOLD;
          const isHuge = size > HUGE_RESPONSE_THRESHOLD || approxRows > HUGE_ROW_THRESHOLD;

          if (isHuge) {
            setTimeout(function() {
              try {
                pushResponse(url, data, size, requestTabTitle, requestStartTime);
              } catch (_) {}
            }, 50);
          } else if (isBig) {
            setTimeout(function() {
              try {
                pushResponse(url, data, size, requestTabTitle, requestStartTime);
              } catch (_) {}
              try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
            }, 0);
          } else {
            pushResponse(url, data, size, requestTabTitle, requestStartTime);
            if (approxRows > RENDER_ROW_LIMIT) {
              try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
            }
          }
          return data;
        } catch (_) {
          return {};
        }
      });
    }

    // 其他 URL 使用原始 .json()
    const origPromise = originalResponseJson.apply(this, arguments);
    return origPromise.then(function(data) {
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
        // 立即释放 webview 中所有大数据的 data 引用，避免内存累积
        // 但保留元数据和文件缓存引用，不清空主进程数据（避免新查询结果丢失）
        try {
          if (window.__capturedJsonResponses) {
            for (let i = 0; i < window.__capturedJsonResponses.length; i++) {
              const r = window.__capturedJsonResponses[i];
              if (r && r.data) {
                r.data = null;
              }
            }
          }
          if (window.__exportDataCache) {
            window.__exportDataCache = {};
          }
        } catch (_) {}
        setTimeout(function() {
          try {
            // 释放所有 data 引用，但保留完整元数据（包括 filePath 等），不替换数组
            if (window.__capturedJsonResponses && window.__capturedJsonResponses.length > 0) {
              for (let i = 0; i < window.__capturedJsonResponses.length; i++) {
                const r = window.__capturedJsonResponses[i];
                if (r && r.data) {
                  r.data = null;
                }
              }
            }
            // 尝试触发 GC
            if (window.gc && typeof window.gc === 'function') {
              try { window.gc(); } catch (_) {}
            }
          } catch (_) {}
        }, 100);
      }
    } catch (_) {}
  }

  document.addEventListener('click', clearOnQueryClick, true);

  // 监听 Tab 关闭按钮点击，及时释放对应 Tab 的数据内存
  function handleTabCloseClick(e) {
    try {
      const target = e.target;
      if (!target || !target.closest) return;
      // 匹配常见的关闭按钮（包括 CDC 平台的 deleteTabs-icon / guanbi）
      const closeBtn = target.closest('.anticon-close, .el-icon-close, .ivu-icon-ios-close, .tab-close, .close-icon, .deleteTabs-icon, [class*="close"], [class*="guanbi"]');
      if (!closeBtn) return;
      // 找到所属的 Tab 元素
      const tabEl = closeBtn.closest('.ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, .tab-item, [role="tab"], .tab, .tabs-item, .flow-tabs-item, .k-tab, .k-tabs-item');
      if (!tabEl) return;
      // 获取 Tab 标题
      let tabTitle = '';
      const titleSpan = tabEl.querySelector('span[title]');
      if (titleSpan) {
        tabTitle = (titleSpan.getAttribute('title') || '').trim();
      }
      if (!tabTitle) {
        tabTitle = (tabEl.textContent || tabEl.innerText || '').trim();
      }
      if (tabTitle && tabTitle.length > 0 && tabTitle.length < 100) {
        // 清理 webview 中该 Tab 的数据
        if (typeof window.__clearCapturedJsonByTab === 'function') {
          window.__clearCapturedJsonByTab(tabTitle);
        }
        // 通知主进程也清理该 Tab 的数据
        if (ipcRenderer) {
          try {
            ipcRenderer.send('clear-tab-json', tabTitle);
          } catch (_) {}
        }
        // 尝试触发 GC（如果可用）
        if (window.gc && typeof window.gc === 'function') {
          try { window.gc(); } catch (_) {}
        }
      }
    } catch (_) {}
  }
  document.addEventListener('click', handleTabCloseClick, true);

  // 监听右键菜单关闭 Tab 操作（关闭当前/其他/全部/右侧/左侧）
  function handleContextMenuClose(e) {
    try {
      const target = e.target;
      if (!target) return;
      const text = (target.textContent || target.innerText || '').trim();
      if (!text) return;

      // 获取当前所有 Tab 标题
      function getAllTabTitles() {
        const titles = [];
        const selectors = [
          '.flow-tabs-item',
          '.k-tab',
          '.k-tabs-item',
          '.ant-tabs-tab',
          '.el-tabs__item',
          '.ivu-tabs-tab',
          '.tab-item',
          '[role="tab"]',
          '.tab',
          '.tabs-item'
        ];
        for (let s = 0; s < selectors.length; s++) {
          const tabs = document.querySelectorAll(selectors[s]);
          if (tabs && tabs.length > 0) {
            for (let t = 0; t < tabs.length; t++) {
              const el = tabs[t];
              let title = '';
              const ts = el.querySelector('span[title]');
              if (ts) title = (ts.getAttribute('title') || '').trim();
              if (!title) title = (el.textContent || el.innerText || '').trim();
              if (title && title.length > 0 && title.length < 100) {
                titles.push(title);
              }
            }
            if (titles.length > 0) break;
          }
        }
        return titles;
      }

      // 获取当前激活 Tab 标题
      function getActiveTitle() {
        return getActiveTabTitle();
      }

      if (text === '关闭当前' || text === 'Close Current') {
        const activeTitle = getActiveTitle();
        if (activeTitle) {
          if (typeof window.__clearCapturedJsonByTab === 'function') {
            window.__clearCapturedJsonByTab(activeTitle);
          }
          if (ipcRenderer) {
            try { ipcRenderer.send('clear-tab-json', activeTitle); } catch (_) {}
          }
        }
      } else if (text === '关闭其他' || text === 'Close Others') {
        const activeTitle = getActiveTitle();
        const allTitles = getAllTabTitles();
        for (let i = 0; i < allTitles.length; i++) {
          if (allTitles[i] !== activeTitle) {
            if (typeof window.__clearCapturedJsonByTab === 'function') {
              window.__clearCapturedJsonByTab(allTitles[i]);
            }
            if (ipcRenderer) {
              try { ipcRenderer.send('clear-tab-json', allTitles[i]); } catch (_) {}
            }
          }
        }
      } else if (text === '关闭全部' || text === 'Close All') {
        const allTitles = getAllTabTitles();
        for (let i = 0; i < allTitles.length; i++) {
          if (typeof window.__clearCapturedJsonByTab === 'function') {
            window.__clearCapturedJsonByTab(allTitles[i]);
          }
          if (ipcRenderer) {
            try { ipcRenderer.send('clear-tab-json', allTitles[i]); } catch (_) {}
          }
        }
        // 同时清空所有数据
        try {
          if (window.__capturedJsonResponses) {
            for (let j = 0; j < window.__capturedJsonResponses.length; j++) {
              if (window.__capturedJsonResponses[j]) window.__capturedJsonResponses[j].data = null;
            }
            window.__capturedJsonResponses = [];
          }
          if (window.__tabResultMap) window.__tabResultMap = {};
          if (window.__tabConfigMap) window.__tabConfigMap = {};
        } catch (_) {}
        if (ipcRenderer) {
          try { ipcRenderer.invoke('clear-captured-json').catch(function(){}); } catch (_) {}
        }
      } else if (text === '关闭右侧' || text === 'Close Right') {
        const allTitles = getAllTabTitles();
        const activeTitle = getActiveTitle();
        let foundActive = false;
        for (let i = 0; i < allTitles.length; i++) {
          if (allTitles[i] === activeTitle) {
            foundActive = true;
            continue;
          }
          if (foundActive) {
            if (typeof window.__clearCapturedJsonByTab === 'function') {
              window.__clearCapturedJsonByTab(allTitles[i]);
            }
            if (ipcRenderer) {
              try { ipcRenderer.send('clear-tab-json', allTitles[i]); } catch (_) {}
            }
          }
        }
      } else if (text === '关闭左侧' || text === 'Close Left') {
        const allTitles = getAllTabTitles();
        const activeTitle = getActiveTitle();
        for (let i = 0; i < allTitles.length; i++) {
          if (allTitles[i] === activeTitle) break;
          if (typeof window.__clearCapturedJsonByTab === 'function') {
            window.__clearCapturedJsonByTab(allTitles[i]);
          }
          if (ipcRenderer) {
            try { ipcRenderer.send('clear-tab-json', allTitles[i]); } catch (_) {}
          }
        }
      } else {
        return; // 不是关闭菜单项
      }
      // 尝试触发 GC
      if (window.gc && typeof window.gc === 'function') {
        try { window.gc(); } catch (_) {}
      }
    } catch (_) {}
  }
  document.addEventListener('click', handleContextMenuClose, true);

  // 定期清理过期数据，释放内存
  setInterval(function() {
    try {
      if (!window.__capturedJsonResponses || window.__capturedJsonResponses.length === 0) return;
      const now = Date.now();
      const expireMs = window.__expireMs || (10 * 60 * 1000);
      let removed = 0;
      for (let i = window.__capturedJsonResponses.length - 1; i >= 0; i--) {
        const r = window.__capturedJsonResponses[i];
        if (!r || (r.timestamp || 0) <= now - expireMs) {
          if (r && r.data) r.data = null;
          window.__capturedJsonResponses.splice(i, 1);
          removed++;
        }
      }
      // 如果数据条目仍然很多，强制释放大数据的 data 引用
      if (window.__capturedJsonResponses.length > 3) {
        let totalSize = 0;
        for (let j = 0; j < window.__capturedJsonResponses.length; j++) {
          totalSize += window.__capturedJsonResponses[j].size || 0;
        }
        // 总大小超过 10MB 时，释放所有 data 引用（主进程和文件缓存中已有备份）
        if (totalSize > 10 * 1024 * 1024) {
          for (let k = 0; k < window.__capturedJsonResponses.length; k++) {
            if (window.__capturedJsonResponses[k].data) {
              window.__capturedJsonResponses[k].data = null;
            }
          }
        }
      }
      if (removed > 0 && window.gc && typeof window.gc === 'function') {
        try { window.gc(); } catch (_) {}
      }
    } catch (_) {}
  }, 30 * 1000);

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