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

  const BIG_RESPONSE_THRESHOLD = 2 * 1024 * 1024;
  const HUGE_RESPONSE_THRESHOLD = 4 * 1024 * 1024;
  const MAX_BIG_KEEP = 1;
  const MAX_SMALL_KEEP = 5;
  const BIG_ROW_THRESHOLD = 10000;
  const HUGE_ROW_THRESHOLD = 15000;
  const RENDER_ROW_LIMIT = 5000;
  const WEBVIEW_DATA_KEEP_LIMIT = 2000;
  // 超过此行数的数据通过主进程保存到文件，webview 不保留 data 引用
  const FILE_CACHE_ROW_THRESHOLD = 5000;

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
      // ========== 第一优先级：K-Tab 组件精确提取 ==========
      // CDC 平台实际 DOM: <div class="k-tab k-active"><a><span class="f-tab-content">
      //   <i class="ksfont tab-icon ksicon-undefined"></i>
      //   <span title="prov_association_detail">prov_association_detail</span>
      //   <i class="deleteTabs-icon ksicon-guanbi ksfont"></i></span></a></div>
      var kTabActive = document.querySelector('.k-tab.k-active, .k-tabs-item.k-active');
      if (kTabActive) {
        console.log('[getActiveTabTitle] 找到 .k-tab.k-active 元素');
        // 在激活的 Tab 内查找带 title 属性的 span
        var kTabSpan = kTabActive.querySelector('span[title]');
        if (kTabSpan) {
          var kTabName = (kTabSpan.getAttribute('title') || '').trim();
          if (kTabName && kTabName.length > 0 && kTabName.length < 100) {
            console.log('[getActiveTabTitle] K-Tab span[title]提取: ' + kTabName);
            return kTabName;
          }
        }
        // 回退：直接取文本，过滤掉图标类名
        var kTabText = (kTabActive.textContent || '').trim();
        if (kTabText) {
          kTabText = kTabText.replace(/ksicon-\S+/g, '').replace(/\s+/g, ' ').trim();
          if (kTabText && kTabText.length > 0 && kTabText.length < 100 && !kTabText.startsWith('/')) {
            console.log('[getActiveTabTitle] K-Tab文本回退: ' + kTabText);
            return kTabText;
          }
        }
      }

      // ========== 第二优先级：遍历所有 .k-tab 找激活的 ==========
      var allKTabs = document.querySelectorAll('.k-tab, .k-tabs-item');
      console.log('[getActiveTabTitle] 共有 .k-tab 元素数量: ' + allKTabs.length);
      for (var idx = 0; idx < allKTabs.length; idx++) {
        var tab = allKTabs[idx];
        var isActive = tab.classList.contains('k-active') || tab.classList.contains('active');
        var hasActiveChild = tab.querySelector('.k-active, .active');
        if (isActive || hasActiveChild) {
          var spanWithTitle2 = tab.querySelector('span[title]');
          if (spanWithTitle2) {
            var activeName = (spanWithTitle2.getAttribute('title') || '').trim();
            if (activeName && activeName.length > 0 && activeName.length < 100) {
              console.log('[getActiveTabTitle] 遍历找到激活Tab[' + idx + ']: ' + activeName);
              return activeName;
            }
          }
        }
      }

      // ========== 第三优先级：通过关闭按钮定位 K-Tab ==========
      var closeBtn = document.querySelector('.k-tab.k-active .deleteTabs-icon, .k-tabs-item.k-active .deleteTabs-icon');
      if (closeBtn) {
        var tabEl = closeBtn.closest('.k-tab, .k-tabs-item');
        if (tabEl) {
          var spanWithTitle = tabEl.querySelector('span[title]');
          if (spanWithTitle) {
            var name = (spanWithTitle.getAttribute('title') || '').trim();
            if (name && name.length > 0 && name.length < 100) {
              console.log('[getActiveTabTitle] 关闭按钮路径提取: ' + name);
              return name;
            }
          }
        }
      }

      // ========== 第三优先级：通用 Tab 组件选择器 ==========
      var selectors = [
        '.flow-tabs-item.k-active',
        '.flow-tabs-item.active',
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
            if (t && t.length > 0 && t.length < 100 && !t.startsWith('/')) {
              console.log('[getActiveTabTitle] 通用选择器[' + i + ']: ' + selectors[i] + ' -> ' + t);
              return t;
            }
          }
          var text = (el.textContent || el.innerText || '').trim();
          if (text && text.length > 0 && text.length < 100 && !text.startsWith('/')) {
            console.log('[getActiveTabTitle] 通用选择器[' + i + ']文本: ' + selectors[i] + ' -> ' + text);
            return text;
          }
        }
      }

      // ========== 第四优先级：通过关闭按钮查找 ==========
      var closeBtns = document.querySelectorAll('.deleteTabs-icon, .anticon-close, .el-icon-close, [class*="guanbi"]');
      for (var j = 0; j < closeBtns.length; j++) {
        var tabEl2 = closeBtns[j].closest('.ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, .tab-item, [role="tab"], .tab, .tabs-item, .flow-tabs-item, .k-tab, .k-tabs-item');
        if (tabEl2) {
          var titleSpan3 = tabEl2.querySelector('span[title]');
          var tabText = '';
          if (titleSpan3) {
            tabText = (titleSpan3.getAttribute('title') || '').trim();
          }
          if (!tabText) {
            tabText = (tabEl2.textContent || '').trim();
            tabText = tabText.replace(/ksicon-\S+/g, '').trim();
          }
          if (tabText && tabText.length > 0 && tabText.length < 100 && !tabText.startsWith('/')) {
            if (tabEl2.classList.contains('active') ||
                tabEl2.classList.contains('k-active') ||
                tabEl2.classList.contains('ant-tabs-tab-active') ||
                tabEl2.getAttribute('aria-selected') === 'true') {
              console.log('[getActiveTabTitle] 关闭按钮路径2: ' + tabText);
              return tabText;
            }
          }
        }
      }

      // ========== 最后回退 ==========
      var hash = window.location.hash;
      if (hash && hash.length > 1 && hash.length < 50) {
        console.log('[getActiveTabTitle] hash回退: ' + hash.substring(1));
        return hash.substring(1);
      }
      console.log('[getActiveTabTitle] document.title回退: ' + (document.title || ''));
      return document.title || '';
    } catch(e) {
      return document.title || '';
    }
  }
  window.__getActiveTabTitle = getActiveTabTitle;

  // 提取 URL 的去重 key：对 cacheData 轮询请求，去掉 timer 参数后比较
  function getUrlDedupKey(url) {
    if (typeof url !== 'string') return url;
    // 对于 ds-standard-query 的 running/cacheData 端点，基于查询ID去重
    // 同一查询的不同阶段端点（running/cacheData）视为同一个，只保留最新/最多数据的
    var m = url.match(/\/(?:i\/)?ds-standard-query\/(?:running|cacheData)\/(\d+\/\d+)/i);
    if (m && m[1]) {
      return 'ds-query:' + m[1];
    }
    // 对其他轮询 URL，去掉 timer 参数
    if (/\/(cacheData|running)\//i.test(url)) {
      try {
        var q = url.indexOf('?');
        if (q === -1) return url;
        var base = url.substring(0, q);
        var qs = url.substring(q + 1);
        var pairs = qs.split('&');
        var kept = [];
        for (var i = 0; i < pairs.length; i++) {
          if (pairs[i].indexOf('timer=') !== 0) {
            kept.push(pairs[i]);
          }
        }
        return base + '?' + kept.sort().join('&');
      } catch(_) {}
    }
    return url;
  }

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
      // 大数据需要保存到文件缓存（不仅是 isHuge，isBig 且超过 FILE_CACHE_ROW_THRESHOLD 也需要）
      const needFileCache = isHuge || (isBig && rowCount > FILE_CACHE_ROW_THRESHOLD);
      const tabTitle = requestTabTitle || getActiveTabTitle();
      // 如果 tabTitle 看起来像 URL 路径（以 / 开头），重新尝试获取
      let finalTabTitle = tabTitle;
      if (finalTabTitle && finalTabTitle.startsWith('/')) {
        const retryTab = getActiveTabTitle();
        if (retryTab && !retryTab.startsWith('/')) {
          console.log('[pushResponse] tabTitle从URL路径修正为: ' + retryTab);
          finalTabTitle = retryTab;
        } else {
          console.log('[pushResponse] tabTitle仍为URL路径: ' + finalTabTitle + '，标记为待修正');
        }
      }
      const entryTimestamp = requestStartTime || Date.now();

      // 记录 JSON 响应捕获日志，明确显示对应的 K-Tab
      if (rowCount > 0) {
        const timeStr = new Date(entryTimestamp).toLocaleTimeString();
        console.log('%c[JSON捕获] K-Tab: ' + (finalTabTitle || '(未知)') +
          ' | 行数: ' + rowCount + ' | 大小: ' + ((size || 0) / 1024).toFixed(1) + 'KB | 时间: ' + timeStr,
          'color: #fff; background: #4caf50; padding: 2px 6px; border-radius: 3px;');
      }

      // 当新数据到达当前 Tab 时，先清理该 Tab 的旧数据
      // 这是比 clearOnQueryClick 更可靠的清理方式，因为不依赖按钮点击事件检测
      // 只清理比当前数据更旧的条目，防止旧轮询结果覆盖新数据
      if (finalTabTitle && rowCount > 0) {
        try {
          const lowerTitle = finalTabTitle.toLowerCase();
          const now = entryTimestamp;
          for (let i = window.__capturedJsonResponses.length - 1; i >= 0; i--) {
            const r = window.__capturedJsonResponses[i];
            const pt = (r.pageTitle || '').toLowerCase();
            if (pt === lowerTitle || pt.indexOf(lowerTitle) >= 0 || lowerTitle.indexOf(pt) >= 0) {
              if ((r.timestamp || 0) < now) {
                if (r.data) r.data = null;
                window.__capturedJsonResponses.splice(i, 1);
              }
            }
          }
          if (ipcRenderer) {
            try {
              ipcRenderer.send('clear-tab-json', finalTabTitle);
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (finalTabTitle && window.__tabConfigMap[finalTabTitle] && rowCount > 0 && !/getSearchDeatil/i.test(url || '')) {
        window.__tabResultMap[finalTabTitle] = {
          url: url || 'unknown',
          timestamp: entryTimestamp,
          rowCount: rowCount,
          size: size || 0
        };
      }

      // 超大数据直接保存到文件，webview 中不保留 data 引用
      if (needFileCache && ipcRenderer) {
        try {
          const entryForFile = {
            url: url || 'unknown',
            timestamp: entryTimestamp,
            size: size || 0,
            data: data,
            rowCount: rowCount,
            pageTitle: finalTabTitle
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
                pageTitle: finalTabTitle,
                isFileCached: true,
                filePath: r.info.filePath,
                requestStartTime: requestStartTime
              };
              // 基于 URL dedup key 去重：相同 key 的轮询请求，替换旧数据
              const dedupKey = getUrlDedupKey(url);
              const existingIdx = window.__capturedJsonResponses.findIndex(function(r) {
                return getUrlDedupKey(r.url) === dedupKey;
              });
              if (existingIdx !== -1) {
                window.__capturedJsonResponses[existingIdx] = lightEntry;
              } else {
                window.__capturedJsonResponses.push(lightEntry);
              }
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
        pageTitle: finalTabTitle,
        requestStartTime: requestStartTime
      };

      if (ipcRenderer) {
        try {
          ipcRenderer.send('json-captured', entry);
        } catch (_) {}
      }
      // 超过 WEBVIEW_DATA_KEEP_LIMIT 行的数据全部置空，避免 webview 内存累积
      if (rowCount > WEBVIEW_DATA_KEEP_LIMIT) {
        entry.data = null;
      }

      // 基于 URL dedup key 去重：相同 key 的视为同一查询，优先保留数据量更大的
      const dedupKey = getUrlDedupKey(url);
      const existingIdx = window.__capturedJsonResponses.findIndex(function(r) {
        return getUrlDedupKey(r.url) === dedupKey;
      });
      if (existingIdx !== -1) {
        var oldEntry = window.__capturedJsonResponses[existingIdx];
        var oldRowCount = (oldEntry && oldEntry.rowCount) ? oldEntry.rowCount : 0;
        var newRowCount = rowCount || 0;
        var newHasMoreData = newRowCount > oldRowCount;
        var oldNoData = !oldEntry || (!oldEntry.data && (!oldEntry.rowCount || oldEntry.rowCount === 0));
        // 数据量更大的优先，或新数据有数据而旧的没有，则替换
        if (newHasMoreData || oldNoData) {
          window.__capturedJsonResponses[existingIdx] = entry;
        }
      } else {
        window.__capturedJsonResponses.push(entry);
      }

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

  // 需要隐藏（不捕获）的 API 列表
  var IGNORE_API_PATTERNS = [
    /\/i\/md-query\/ds\/sourceList\/simply/i,
    /\/i\/md-query\/ds\/sourceTypeList/i,
    /\/i\/dds\/package\/resourceList/i,
    /\/i\/dds\/flow\/getLevelList/i,
    /\/i\/dds\/udf\/getFunctions/i,
    /\/i\/dts-web\/dict\/getDtsTaskParam/i,
    /\/i\/dds\/flow\/getBatchTree/i,
    /\/i\/dds\/template\/getTaskTemplateTree/i,
    /\/i\/dds\/tempSearch\/getTempSearchTree/i,
    /\/i\/dds\/recycle\/getRecycleTree/i,
    /\/i\/md-query\/query\/db\/list\/min\/granted/i
  ];

  function shouldCaptureUrl(url) {
    if (typeof url !== 'string') return false;
    if (/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|map)(\?|$)/i.test(url)) return false;
    for (var i = 0; i < IGNORE_API_PATTERNS.length; i++) {
      if (IGNORE_API_PATTERNS[i].test(url)) return false;
    }
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
    let requestStartTime = 0;

    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      requestStartTime = Date.now();
      return originalOpen.apply(xhr, [method, url, ...rest]);
    };

    xhr.addEventListener('load', function() {
      try {
        // 关键：在响应返回时重新获取 tab 名（此时 DOM 已完全渲染）
        const responseTabTitle = getActiveTabTitle();
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

                  pushResponse(requestUrl, parsedData, respSize, responseTabTitle, requestStartTime);
                } catch (_) {}
              });
              return;
            }

            try { data = JSON.parse(respText); size = respText.length; } catch (_) { return; }
          }

          if (data && typeof data === 'object') {
            const rowCount = estimateRowCount(data);
            const isBig = size > BIG_RESPONSE_THRESHOLD || rowCount > BIG_ROW_THRESHOLD;

            pushResponse(requestUrl, data, size, responseTabTitle, requestStartTime);

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
    const requestStartTime = Date.now();
    const response = await originalFetch.apply(this, args);
    // 关键：在响应返回时重新获取 tab 名（此时 DOM 已完全渲染）
    const responseTabTitle = getActiveTabTitle();
    fetchRequestInfo.set(response, { tabTitle: responseTabTitle, startTime: requestStartTime, url: urlStr });

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
          // 在此时重新获取 tab 名（响应返回时 DOM 已渲染）
          const currentTabTitle = getActiveTabTitle();
          if (ipcRenderer) {
            ipcRenderer.send('re-fetch-and-save', {
              url: url,
              method: 'GET',
              pageTitle: currentTabTitle || requestTabTitle,
              timestamp: requestStartTime
            });
          }
          return {
            __isFileProxy: true,
            __url: url,
            __tabTitle: currentTabTitle || requestTabTitle,
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
          // 在此时重新获取 tab 名（响应返回时 DOM 已渲染）
          const currentTabTitle = getActiveTabTitle();

          if (isHuge) {
            setTimeout(function() {
              try {
                pushResponse(url, data, size, currentTabTitle || requestTabTitle, requestStartTime);
              } catch (_) {}
            }, 50);
          } else if (isBig) {
            setTimeout(function() {
              try {
                pushResponse(url, data, size, currentTabTitle || requestTabTitle, requestStartTime);
              } catch (_) {}
              try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
            }, 0);
          } else {
            pushResponse(url, data, size, currentTabTitle || requestTabTitle, requestStartTime);
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

  // 覆盖 Response.prototype.text，捕获使用 fetch + .text() 获取 JSON 数据的请求
  const originalResponseText = Response.prototype.text;
  Response.prototype.text = function() {
    const resp = this;
    const url = currentFetchUrl || (resp.url || '');
    const requestInfo = fetchRequestInfo.get(resp) || {};
    const requestTabTitle = requestInfo.tabTitle || '';
    const requestStartTime = requestInfo.startTime || Date.now();

    const origPromise = originalResponseText.apply(this, arguments);

    if (shouldCaptureUrl(url)) {
      return origPromise.then(function(text) {
        if (text && text.length > 100 && text.length <= 50 * 1024 * 1024) {
          const firstChar = text.trim().charAt(0);
          if (firstChar === '{' || firstChar === '[') {
            try {
              const data = JSON.parse(text);
              if (data && typeof data === 'object') {
                const size = text.length;
                const rowCount = estimateRowCount(data);
                const isBig = size > BIG_RESPONSE_THRESHOLD || rowCount > BIG_ROW_THRESHOLD;
                const isHuge = size > HUGE_RESPONSE_THRESHOLD || rowCount > HUGE_ROW_THRESHOLD;
                // 在此时重新获取 tab 名（响应返回时 DOM 已渲染）
                const currentTabTitle = getActiveTabTitle();

                if (isHuge) {
                  setTimeout(function() {
                    try {
                      pushResponse(url, data, size, currentTabTitle || requestTabTitle, requestStartTime);
                    } catch (_) {}
                  }, 50);
                } else if (isBig) {
                  setTimeout(function() {
                    try {
                      pushResponse(url, data, size, currentTabTitle || requestTabTitle, requestStartTime);
                    } catch (_) {}
                    try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
                  }, 0);
                } else {
                  pushResponse(url, data, size, currentTabTitle || requestTabTitle, requestStartTime);
                  if (rowCount > RENDER_ROW_LIMIT) {
                    try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
                  }
                }
              }
            } catch (_) {}
          }
        }
        return text;
      });
    }

    return origPromise;
  };

  function isQueryButton(btn) {
    if (!btn) return false;
    const btnText = (btn.textContent || btn.innerText || btn.value || '').trim();
    if (!btnText) return false;
    return /运行|执行|查询|搜索|提交|查询数据|执行查询|运行查询|开始查询|run|execute|query|search|submit/i.test(btnText);
  }

  function clearOnQueryClick(e) {
    try {
      const btn = e.target && e.target.closest && e.target.closest('button, input[type="submit"], input[type="button"], [role="button"], .btn, .ant-btn, .el-button, .k-btn, .ksfont');
      if (!btn) return;
      if (isQueryButton(btn)) {
        const activeTab = getActiveTabTitle();
        // 明确记录点击了哪个 K-Tab 的运行按钮，便于调试和追踪
        const btnText = (btn.textContent || btn.innerText || '').trim();
        const clickTime = new Date().toLocaleTimeString();
        console.log('%c[运行按钮点击] K-Tab: ' + activeTab + ' | 按钮: ' + btnText + ' | 时间: ' + clickTime,
          'color: #fff; background: #0091ea; padding: 2px 6px; border-radius: 3px;');
        // 同时存储到 window 供后续查询
        try {
          if (!window.__queryButtonClickHistory) window.__queryButtonClickHistory = [];
          window.__queryButtonClickHistory.push({
            tabTitle: activeTab || '',
            buttonText: btnText,
            timestamp: Date.now(),
            clickTime: clickTime
          });
          // 保留最近 50 次记录
          if (window.__queryButtonClickHistory.length > 50) {
            window.__queryButtonClickHistory.shift();
          }
        } catch (_) {}
        // 彻底清理当前 Tab 的所有旧数据（包括 webview 和主进程）
        if (activeTab) {
          if (typeof window.__clearCapturedJsonByTab === 'function') {
            window.__clearCapturedJsonByTab(activeTab);
          }
          if (ipcRenderer) {
            try {
              ipcRenderer.send('clear-tab-json', activeTab);
            } catch (_) {}
          }
        }
        // 清理所有超过5分钟的过期数据，防止内存累积
        try {
          var now = Date.now();
          var expireMs = window.__expireMs || 10 * 60 * 1000;
          if (window.__capturedJsonResponses) {
            for (var ci = window.__capturedJsonResponses.length - 1; ci >= 0; ci--) {
              var cr = window.__capturedJsonResponses[ci];
              if (cr && (now - (cr.timestamp || 0)) > Math.min(expireMs, 5 * 60 * 1000)) {
                if (cr.data) cr.data = null;
                window.__capturedJsonResponses.splice(ci, 1);
              }
            }
          }
          if (window.__exportDataCache) {
            window.__exportDataCache = {};
          }
        } catch (_) {}
        // 尝试触发 GC
        setTimeout(function() {
          if (window.gc && typeof window.gc === 'function') {
            try { window.gc(); } catch (_) {}
          }
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
      // 匹配常见的关闭按钮（包括 CDC 平台的 deleteTabs-icon / guanbi / 各种图标）
      const closeBtn = target.closest('.anticon-close, .el-icon-close, .ivu-icon-ios-close, .tab-close, .close-icon, .deleteTabs-icon, [class*="close"], [class*="guanbi"], [class*="Close"], svg[class*="close"], i[class*="close"], span[class*="close"], [class*="icon-close"]');
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