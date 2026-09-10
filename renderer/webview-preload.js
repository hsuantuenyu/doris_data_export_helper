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

  // === 关键：在页面 JS 执行前，通过 <script> 标签将验证码拦截器注入到主世界 ===
  // contextIsolation=yes 时，preload 对 window 的修改只在隔离世界生效，
  // 但 <script> 标签注入的代码运行在主世界，能真正拦截页面的 XHR/fetch 请求。
  try {
    var mainWorldScript = `
      (function() {
        if (window.__mwCaptchaInstalled) return;
        window.__mwCaptchaInstalled = true;
        window.__mwCaptchaCode = '';

        function findCaptchaInput() {
          var inp = document.querySelector('input[placeholder*="请输入验证码"]');
          if (!inp) {
            var inputs = document.querySelectorAll('input[type="text"], input:not([type])');
            for (var i = 0; i < inputs.length; i++) {
              var ph = (inputs[i].getAttribute('placeholder') || '').toLowerCase();
              if (ph.indexOf('请输入验证码') >= 0 || ph.indexOf('验证码') >= 0 || ph.indexOf('captcha') >= 0 || ph.indexOf('verify') >= 0) {
                inp = inputs[i];
                break;
              }
            }
          }
          return inp;
        }

        function fillCaptchaNow() {
          var code = window.__mwCaptchaCode;
          if (!code) return false;
          var inp = findCaptchaInput();
          if (!inp) return false;
          try {
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(inp, code);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          } catch(e) { return false; }
        }

        function installNotificationConfirmHandler() {
          if (window.__mwNotifConfirmInstalled) return;
          window.__mwNotifConfirmInstalled = true;
          document.addEventListener('click', function(e) {
            var target = e.target;
            if (!target) return;
            var btn = target.closest ? target.closest('button, .btn, .ant-btn, .el-button, [role="button"]') : null;
            if (!btn) return;
            var text = (btn.textContent || btn.innerText || '').trim();
            if (/^确认$|^确定$|^知道了$|^关闭$|^好的$/i.test(text)) {
              setTimeout(function() {
                if (fillCaptchaNow()) {
                  // 验证码已填充
                } else {
                  var tries = 0;
                  var timer = setInterval(function() {
                    tries++;
                    if (fillCaptchaNow() || tries >= 10) clearInterval(timer);
                  }, 500);
                }
              }, 300);
            }
          }, true);
        }

        function setCaptchaCode(code, rawText, source) {
          if (!code) return;
          window.__mwCaptchaCode = code;
          console.log('★★★ [mw-captcha] ★★★ 验证码结果值 = "' + code + '" (来源: ' + (source || 'unknown') + ') ★★★');
          installNotificationConfirmHandler();
        }

        // ===== 拦截 XHR: 同时替换 prototype 和构造函数（双保险） =====
        var OrigXHR = window.XMLHttpRequest;
        var origOpen = OrigXHR.prototype.open;
        var origSend = OrigXHR.prototype.send;
        var urlMap = new WeakMap();

        // 1) 替换 prototype.open/send
        OrigXHR.prototype.open = function(method, url) {
          try {
            urlMap.set(this, url);
          } catch(_) {}
          return origOpen.apply(this, arguments);
        };

        OrigXHR.prototype.send = function() {
          var url = urlMap.get(this) || '';
          if (typeof url === 'string' && url.indexOf('/api/code') >= 0) {
            var xhr = this;
            xhr.addEventListener('load', function() {
              try {
                var text = xhr.responseText;
                if (text) {
                  var data = JSON.parse(text);
                  if (data && data.result) {
                    setCaptchaCode(String(data.result).trim(), text, 'XHR');
                  }
                }
              } catch(e) {}
            });
          }
          return origSend.apply(this, arguments);
        };

        // 2) 替换 window.XMLHttpRequest 构造函数（防止页面绕过 prototype）
        var WrappedXHR = function() {
          var xhr = new OrigXHR();
          var wOpen = xhr.open;
          var wSend = xhr.send;
          var wUrl = '';
          xhr.open = function(method, url) {
            wUrl = url;
            return wOpen.apply(xhr, arguments);
          };
          xhr.send = function() {
            try {
              if (typeof wUrl === 'string' && wUrl.indexOf('/api/code') >= 0) {
                xhr.addEventListener('load', function() {
                  try {
                    var text = xhr.responseText;
                    if (text) {
                      var data = JSON.parse(text);
                      if (data && data.result) {
                        setCaptchaCode(String(data.result).trim(), text, 'XHR-ctor');
                      }
                    }
                  } catch(e) {}
                });
              }
            } catch(_) {}
            return wSend.apply(xhr, arguments);
          };
          return xhr;
        };
        WrappedXHR.prototype = OrigXHR.prototype;
        WrappedXHR.UNSENT = 0;
        WrappedXHR.OPENED = 1;
        WrappedXHR.HEADERS_RECEIVED = 2;
        WrappedXHR.LOADING = 3;
        WrappedXHR.DONE = 4;
        try {
          Object.defineProperty(window, 'XMLHttpRequest', {
            value: WrappedXHR,
            writable: true,
            configurable: true
          });
        } catch(e) {}

        // ===== 拦截 fetch =====
        var origFetch = window.fetch;
        window.fetch = function() {
          var url = arguments[0];
          var urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : '');
          var p = origFetch.apply(this, arguments);
          if (typeof urlStr === 'string' && urlStr.indexOf('/api/code') >= 0) {
            p.then(function(resp) {
              var cloned = resp.clone();
              cloned.text().then(function(text) {
                try {
                  var data = JSON.parse(text);
                  if (data && data.result) {
                    setCaptchaCode(String(data.result).trim(), text, 'fetch');
                  }
                } catch(e) {}
              }).catch(function() {});
            }).catch(function() {});
          }
          return p;
        };
      })();
    `;
    // 注入 <script> 到主世界。preload 执行时文档可能还未开始解析，
    // documentElement 可能不存在，使用轮询等待其出现后立即注入。
    function injectMainWorldScript() {
      try {
        var target = document.documentElement || document.head || document.body;
        if (!target) {
          return false;
        }
        var scriptEl = document.createElement('script');
        scriptEl.textContent = mainWorldScript;
        target.appendChild(scriptEl);
        scriptEl.remove();
        return true;
      } catch (e) {
        return false;
      }
    }

    // 立即尝试注入
    if (!injectMainWorldScript()) {
      // 文档还未开始解析，轮询等待 documentElement 出现
      var pollCount = 0;
      var pollTimer = setInterval(function() {
        pollCount++;
        if (injectMainWorldScript() || pollCount >= 100) {
          clearInterval(pollTimer);
        }
      }, 10);
    }
  } catch (e) {}

  // 监控所有网络请求，用于调试验证码请求来源（已禁用）
  /*
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          var name = entries[i].name;
          if (typeof name === 'string' && name.indexOf('api/code') >= 0) {
            console.log('[captcha] PerformanceObserver detected api/code request:', name, 'initiatorType:', entries[i].initiatorType);
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
    }
  } catch (_) {}
  */

  // 定期扫描已完成的网络请求（已禁用）
  /*
  setInterval(function() {
    try {
      var entries = performance.getEntriesByType('resource');
      for (var i = entries.length - 1; i >= 0 && i > entries.length - 20; i--) {
        var name = entries[i].name;
        if (typeof name === 'string' && name.indexOf('api/code') >= 0) {
          console.log('[captcha] Performance resource api/code:', name, 'initiatorType:', entries[i].initiatorType);
        }
      }
    } catch (_) {}
  }, 2000);
  */

  // Tab 名缓存：避免每次都遍历 DOM
  let _cachedTabTitle = '';
  let _cachedTabTitleTime = 0;
  const TAB_TITLE_CACHE_TTL = 2000; // 2秒内使用缓存



  function isCaptchaUrl(url) {
    var matched = typeof url === 'string' && /(?:^|\/)api\/code(?:[?#]|$)/i.test(url);
    return matched;
  }

  function extractCaptchaFromResponse(data) {
    try {
      if (data && typeof data === 'object' && data.result) {
        return String(data.result).trim();
      }
    } catch (e) {}
    return '';
  }

  // 自动填充验证码到输入框
  function autoFillCaptcha(code) {
    if (!code) return;
    try {
      // 优先查找 placeholder 包含"验证码"的输入框
      var captchaInput = document.querySelector('input[placeholder*="验证码"]');
      if (!captchaInput) {
        // 回退：查找所有 input，通过 placeholder 或附近文本匹配
        var inputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          var ph = (inp.getAttribute('placeholder') || '').toLowerCase();
          if (ph.indexOf('captcha') >= 0 || ph.indexOf('验证码') >= 0 || ph.indexOf('verify') >= 0) {
            captchaInput = inp;
            break;
          }
        }
      }
      if (captchaInput) {
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(captchaInput, code);
        captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
        captchaInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {}
  }

  // 统一设置验证码并触发自动填充
  function setCaptchaCode(code) {
    if (!code) return;
    window.__captchaCode = code;
    // 立即尝试填充
    autoFillCaptcha(code);
    // 输入框可能尚未渲染，延迟重试几次
    var retries = 0;
    var retryTimer = setInterval(function() {
      retries++;
      autoFillCaptcha(code);
      if (retries >= 5) {
        clearInterval(retryTimer);
      }
    }, 500);
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
  const MAX_SMALL_KEEP = 3;
  const BIG_ROW_THRESHOLD = 5000;
  const HUGE_ROW_THRESHOLD = 8000;
  const RENDER_ROW_LIMIT = 3000;
  const WEBVIEW_DATA_KEEP_LIMIT = 1000;
  const FILE_CACHE_ROW_THRESHOLD = 3000;

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

  function invalidateTabTitleCache() {
    _cachedTabTitle = '';
    _cachedTabTitleTime = 0;
  }

  // 轻量级验证：检查当前激活 Tab 的标题是否与缓存一致
  // 不一致说明用户已切换 Tab，应清除缓存重新查询
  function verifyCacheIfPossible() {
    if (!_cachedTabTitle) return;
    try {
      var activeEl = document.querySelector('.k-tab.k-active, .k-tabs-item.k-active');
      if (activeEl) {
        var span = activeEl.querySelector('span[title]');
        var currentTitle = '';
        if (span) currentTitle = (span.getAttribute('title') || '').trim();
        if (!currentTitle) {
          currentTitle = (activeEl.textContent || '').trim().replace(/ksicon-\S+/g, '').replace(/\s+/g, ' ').trim();
        }
        if (currentTitle && currentTitle.length > 0 && currentTitle !== _cachedTabTitle) {
          invalidateTabTitleCache();
        }
      }
    } catch (_) {}
  }

  function getActiveTabTitle() {
    var now = Date.now();
    if (_cachedTabTitle && _cachedTabTitleTime > 0 && (now - _cachedTabTitleTime) < TAB_TITLE_CACHE_TTL) {
      // 缓存命中前先验证是否与当前 DOM 一致
      verifyCacheIfPossible();
      if (_cachedTabTitle && (now - _cachedTabTitleTime) < TAB_TITLE_CACHE_TTL) {
        return _cachedTabTitle;
      }
    }
    try {
      var result = '';

      // ========== 第一优先级：K-Tab 组件精确提取 ==========
      var kTabActive = document.querySelector('.k-tab.k-active, .k-tabs-item.k-active');
      if (kTabActive) {
        var kTabSpan = kTabActive.querySelector('span[title]');
        if (kTabSpan) {
          var kTabName = (kTabSpan.getAttribute('title') || '').trim();
          if (kTabName && kTabName.length > 0 && kTabName.length < 100) {
            result = kTabName;
            _cachedTabTitle = result;
            _cachedTabTitleTime = now;
            return result;
          }
        }
        var kTabText = (kTabActive.textContent || '').trim();
        if (kTabText) {
          kTabText = kTabText.replace(/ksicon-\S+/g, '').replace(/\s+/g, ' ').trim();
          if (kTabText && kTabText.length > 0 && kTabText.length < 100 && !kTabText.startsWith('/')) {
            result = kTabText;
            _cachedTabTitle = result;
            _cachedTabTitleTime = now;
            return result;
          }
        }
      }

      // ========== 第二优先级：遍历 .k-tab 找激活的 ==========
      var allKTabs = document.querySelectorAll('.k-tab, .k-tabs-item');
      for (var idx = 0; idx < allKTabs.length; idx++) {
        var tab = allKTabs[idx];
        var isActive = tab.classList.contains('k-active') || tab.classList.contains('active');
        if (isActive) {
          var spanWithTitle2 = tab.querySelector('span[title]');
          if (spanWithTitle2) {
            var activeName = (spanWithTitle2.getAttribute('title') || '').trim();
            if (activeName && activeName.length > 0 && activeName.length < 100) {
              result = activeName;
              _cachedTabTitle = result;
              _cachedTabTitleTime = now;
              return result;
            }
          }
        }
      }

      // ========== 第三优先级：通用 Tab 组件选择器 ==========
      var selectors = [
        '.flow-tabs-item.k-active',
        '.flow-tabs-item.active',
        '.ant-tabs-tab-active',
        '.el-tabs__item.is-active',
        '.ivu-tabs-tab-active',
        '[role="tab"][aria-selected="true"]'
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) {
          var titleSpan = el.querySelector('span[title]');
          if (titleSpan) {
            var t = (titleSpan.getAttribute('title') || '').trim();
            if (t && t.length > 0 && t.length < 100 && !t.startsWith('/')) {
              result = t;
              _cachedTabTitle = result;
              _cachedTabTitleTime = now;
              return result;
            }
          }
          var text = (el.textContent || el.innerText || '').trim();
          if (text && text.length > 0 && text.length < 100 && !text.startsWith('/')) {
            result = text;
            _cachedTabTitle = result;
            _cachedTabTitleTime = now;
            return result;
          }
        }
      }

      // ========== 最后回退 ==========
      var hash = window.location.hash;
      if (hash && hash.length > 1 && hash.length < 50) {
        result = hash.substring(1);
        _cachedTabTitle = result;
        _cachedTabTitleTime = now;
        return result;
      }
      result = document.title || '';
      _cachedTabTitle = result;
      _cachedTabTitleTime = now;
      return result;
    } catch(e) {
      return _cachedTabTitle || document.title || '';
    }
  }
  window.__getActiveTabTitle = getActiveTabTitle;

  // 提取 URL 的去重 key：对 cacheData 轮询请求，去掉 timer 参数后比较
  function getUrlDedupKey(url) {
    if (typeof url !== 'string') return url;
    var m = url.match(/\/(?:i\/)?ds-standard-query\/(?:running|cacheData)\/(\d+\/\d+)/i);
    if (m && m[1]) {
      return 'ds-query:' + m[1];
    }
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
      const needFileCache = isHuge || (isBig && rowCount > FILE_CACHE_ROW_THRESHOLD);
      const tabTitle = requestTabTitle || getActiveTabTitle();
      let finalTabTitle = tabTitle;
      if (finalTabTitle && finalTabTitle.startsWith('/')) {
        const retryTab = getActiveTabTitle();
        if (retryTab && !retryTab.startsWith('/')) {
          finalTabTitle = retryTab;
        }
      }
      const entryTimestamp = requestStartTime || Date.now();

      if (rowCount > 0) {
        const timeStr = new Date(entryTimestamp).toLocaleTimeString();
        console.log('%c[JSON捕获] K-Tab: ' + (finalTabTitle || '(未知)') +
          ' | 行数: ' + rowCount + ' | 大小: ' + ((size || 0) / 1024).toFixed(1) + 'KB | 时间: ' + timeStr,
          'color: #fff; background: #4caf50; padding: 2px 6px; border-radius: 3px;');
      }

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
      if (rowCount > WEBVIEW_DATA_KEEP_LIMIT) {
        entry.data = null;
      }

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

  // 检查 URL 是否匹配目标 API（需要捕获的）
  function isTargetApiUrl(url) {
    if (typeof url !== 'string') return false;
    return /ds-standard-query|cacheData|running|getSearchDeatil|queryResult|\/api\/query/i.test(url);
  }

  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    let requestUrl = '';
    let requestStartTime = 0;
    let xhrPreSavedAsFile = false;

    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      requestStartTime = Date.now();
      xhrPreSavedAsFile = false;
      if (typeof url === 'string' && url.indexOf('api/code') >= 0) {
        // console.log('[captcha] XHR open matched api/code, url:', url);
      }
      return originalOpen.apply(xhr, [method, url, ...rest]);
    };
    // 预检：在 headers received 阶段检查 Content-Length，提前判断是否为大数据
    xhr.addEventListener('readystatechange', function() {
      try {
        if (xhr.readyState === 2 && shouldCaptureUrl(requestUrl) && !xhrPreSavedAsFile) {
          // readyState 2: headers received，此时 body 尚未读取
          var cl = xhr.getResponseHeader && xhr.getResponseHeader('content-length');
          var clNum = cl ? (parseInt(cl, 10) || 0) : 0;
          if (clNum > HUGE_RESPONSE_THRESHOLD) {
            xhrPreSavedAsFile = true;
            var tabTitle = isTargetApiUrl(requestUrl) ? getActiveTabTitle() : '';
            if (ipcRenderer) {
              ipcRenderer.send('re-fetch-and-save', {
                url: requestUrl,
                method: 'GET',
                pageTitle: tabTitle,
                timestamp: requestStartTime
              });
            }
          }
        }
      } catch (_) {}
    });

    xhr.addEventListener('load', function() {
      try {
        // 如果预检已判定为大数据，不读取 responseText，直接返回代理
        if (xhrPreSavedAsFile) {
          try {
            var proxyData = {
              __isFileProxy: true,
              status: 'success',
              message: 'success',
              result: { data: [], total: 0, columns: [], __fileProxyEmpty: true }
            };
            Object.defineProperty(xhr, 'response', {
              get: function() { return proxyData; },
              configurable: true
            });
            try {
              Object.defineProperty(xhr, 'responseText', {
                get: function() { return JSON.stringify(proxyData); },
                configurable: true
              });
            } catch (_) {}
          } catch (_) {}
          return;
        }

        let data = null;
        let size = 0;

        if (xhr.responseType === 'json' && xhr.response && typeof xhr.response === 'object') {
          data = xhr.response;
          size = (xhr.responseText && xhr.responseText.length) || 0;
        }

        if (isCaptchaUrl(requestUrl)) {
          try {
            // console.log('[captcha] XHR load handler, requestUrl:', requestUrl);
            const captchaData = data || JSON.parse(xhr.responseText);
            // console.log('[captcha] XHR response data:', JSON.stringify(captchaData).substring(0, 200));
            const code = extractCaptchaFromResponse(captchaData);
            if (code) setCaptchaCode(code);
          } catch (e) {
            // console.log('[captcha] XHR captcha parse error:', e.message);
          }
        }

        if (shouldCaptureUrl(requestUrl)) {
          const responseTabTitle = isTargetApiUrl(requestUrl) ? getActiveTabTitle() : '';

          if (!data) {
            const respText = xhr.responseText;
            if (!respText || respText.length <= 100 || respText.length > 50 * 1024 * 1024) return;
            if (!isJsonResponse(respText)) return;

            const respSize = respText.length;

            // 文本读取后才发现是大数据：立即丢弃，通知主进程重新请求
            if (respSize > HUGE_RESPONSE_THRESHOLD) {
              if (ipcRenderer) {
                ipcRenderer.send('re-fetch-and-save', {
                  url: requestUrl,
                  method: 'GET',
                  pageTitle: responseTabTitle,
                  timestamp: requestStartTime
                });
              }
              try {
                var proxyBig = {
                  status: 'success', message: 'success',
                  result: { data: [], total: 0, columns: [], __fileProxyEmpty: true }
                };
                Object.defineProperty(xhr, 'response', {
                  get: function() { return proxyBig; },
                  configurable: true
                });
                try {
                  Object.defineProperty(xhr, 'responseText', {
                    get: function() { return JSON.stringify(proxyBig); },
                    configurable: true
                  });
                } catch (_) {}
              } catch (_) {}
              return;
            }

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

  // ===== prototype 层面拦截：确保页面即使绕过构造函数也能捕获验证码 =====
  const _xhrProtoOpen = OriginalXHR.prototype.open;
  const _xhrProtoSend = OriginalXHR.prototype.send;
  const _xhrUrlMap = new WeakMap();

  // 使用 Object.defineProperty 确保即使页面缓存了引用也能拦截
  try {
    Object.defineProperty(OriginalXHR.prototype, 'open', {
      value: function(method, url, ...rest) {
        try {
          _xhrUrlMap.set(this, { url: url, method: method, startTime: Date.now() });
        } catch (_) {}
        return _xhrProtoOpen.apply(this, [method, url, ...rest]);
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(OriginalXHR.prototype, 'send', {
      value: function(...args) {
        try {
          const info = _xhrUrlMap.get(this);
          const url = info ? info.url : '';
          if (typeof url === 'string' && url.indexOf('api/code') >= 0) {
            const xhr = this;
            xhr.addEventListener('load', function() {
              try {
                var respText = xhr.responseText;
                if (respText) {
                  var data = JSON.parse(respText);
                  var code = extractCaptchaFromResponse(data);
                  if (code) setCaptchaCode(code);
                }
              } catch (e) {}
            });
          }
        } catch (_) {}
        return _xhrProtoSend.apply(this, args);
      },
      writable: true,
      configurable: true
    });
  } catch (e) {}

  // 检查是否有 iframe（已禁用）
  /*
  try {
    var iframes = document.querySelectorAll('iframe');
    console.log('[captcha] Number of iframes on page:', iframes.length);
    for (var fi = 0; fi < iframes.length; fi++) {
      console.log('[captcha] iframe[' + fi + '] src:', iframes[fi].src);
    }
  } catch (_) {}
  */

  let currentFetchUrl = '';
  const fetchRequestInfo = new WeakMap();
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : 'fetch');
    currentFetchUrl = urlStr;
    const requestStartTime = Date.now();
    if (typeof urlStr === 'string' && urlStr.indexOf('api/code') >= 0) {
      // console.log('[captcha] fetch called with api/code, url:', urlStr);
    }
    const response = await originalFetch.apply(this, args);

    fetchRequestInfo.set(response, { tabTitle: '', startTime: requestStartTime, url: urlStr });

    if (isCaptchaUrl(urlStr) && response.clone) {
      try {
        const cloned = response.clone();
        cloned.text().then(function(text) {
          try {
            // console.log('[captcha] fetch clone text:', text.substring(0, 200));
            const data = JSON.parse(text);
            const code = extractCaptchaFromResponse(data);
            if (code) setCaptchaCode(code);
          } catch(e) {
            // console.log('[captcha] fetch captcha parse error:', e.message);
          }
        }).catch(function(e){ /* console.log('[captcha] fetch clone text error:', e.message); */ });
      } catch(e) { /* console.log('[captcha] fetch captcha clone error:', e.message); */ }
    }

    try {
      if (shouldCaptureUrl(urlStr)) {
        const cl = response.headers && response.headers.get ? response.headers.get('content-length') : null;
        const size = cl ? (parseInt(cl, 10) || 0) : 0;
        if (size > HUGE_RESPONSE_THRESHOLD) {
          fetchRequestInfo.get(response).preServedAsFile = true;
          if (ipcRenderer) {
            const tabTitle = isTargetApiUrl(urlStr) ? getActiveTabTitle() : '';
            ipcRenderer.send('re-fetch-and-save', {
              url: urlStr,
              method: 'GET',
              pageTitle: tabTitle,
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
    const requestStartTime = requestInfo.startTime || Date.now();

    if (requestInfo.preServedAsFile) {
      const cl = resp.headers && resp.headers.get ? resp.headers.get('content-length') : null;
      const size = cl ? (parseInt(cl, 10) || 0) : 0;
      return Promise.resolve({
        __isFileProxy: true,
        __url: url,
        __tabTitle: '',
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

    if (shouldCaptureUrl(url) || isCaptchaUrl(url)) {
      return resp.text().then(function(text) {
        const size = text ? text.length : 0;

        if (isCaptchaUrl(url)) {
          try {
            // console.log('[captcha] fetch json path, text:', text.substring(0, 200));
            const data = JSON.parse(text);
            const code = extractCaptchaFromResponse(data);
            if (code) setCaptchaCode(code);
            return data;
          } catch (e) {
            // console.log('[captcha] fetch json path error:', e.message);
            return {};
          }
        }

        if (size > HUGE_RESPONSE_THRESHOLD) {
          if (ipcRenderer) {
            const tabTitle = isTargetApiUrl(url) ? getActiveTabTitle() : '';
            ipcRenderer.send('re-fetch-and-save', {
              url: url,
              method: 'GET',
              pageTitle: tabTitle,
              timestamp: requestStartTime
            });
          }
          return {
            __isFileProxy: true,
            __url: url,
            __tabTitle: '',
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

        try {
          const data = JSON.parse(text);
          // 立即释放 text 引用，避免 text 和 data 同时驻留内存
          text = null;
          const approxRows = fastEstimateRowCount(data);
          const isBig = size > BIG_RESPONSE_THRESHOLD || approxRows > BIG_ROW_THRESHOLD;
          const isHuge = size > HUGE_RESPONSE_THRESHOLD || approxRows > HUGE_ROW_THRESHOLD;
          const tabTitle = isTargetApiUrl(url) ? getActiveTabTitle() : '';

          if (isHuge) {
            setTimeout(function() {
              try {
                pushResponse(url, data, size, tabTitle, requestStartTime);
              } catch (_) {}
            }, 50);
          } else if (isBig) {
            setTimeout(function() {
              try {
                pushResponse(url, data, size, tabTitle, requestStartTime);
              } catch (_) {}
              try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
            }, 0);
          } else {
            pushResponse(url, data, size, tabTitle, requestStartTime);
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

    const origPromise = originalResponseJson.apply(this, arguments);
    return origPromise.then(function(data) {
      return data;
    });
  };

  const originalResponseText = Response.prototype.text;
  Response.prototype.text = function() {
    const resp = this;
    const url = currentFetchUrl || (resp.url || '');
    const requestInfo = fetchRequestInfo.get(resp) || {};
    const requestStartTime = requestInfo.startTime || Date.now();

    // 如果已经在 fetch 预检阶段判定为大数据，直接返回空代理文本，不读取实际响应
    if (requestInfo.preServedAsFile) {
      return Promise.resolve(JSON.stringify({
        status: 'success',
        message: 'success',
        result: { data: [], total: 0, columns: [], __fileProxyEmpty: true }
      }));
    }

    const origPromise = originalResponseText.apply(this, arguments);

    if (shouldCaptureUrl(url)) {
      return origPromise.then(function(text) {
        // 文本读取后检查大小：大数据立即丢弃，通知主进程重新请求
        if (text && text.length > HUGE_RESPONSE_THRESHOLD) {
          if (ipcRenderer) {
            const tabTitle = isTargetApiUrl(url) ? getActiveTabTitle() : '';
            ipcRenderer.send('re-fetch-and-save', {
              url: url,
              method: 'GET',
              pageTitle: tabTitle,
              timestamp: requestStartTime
            });
          }
          return JSON.stringify({
            status: 'success',
            message: 'success',
            result: { data: [], total: 0, columns: [], __fileProxyEmpty: true }
          });
        }

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
                const tabTitle = isTargetApiUrl(url) ? getActiveTabTitle() : '';

                if (isHuge) {
                  setTimeout(function() {
                    try {
                      pushResponse(url, data, size, tabTitle, requestStartTime);
                    } catch (_) {}
                  }, 50);
                } else if (isBig) {
                  setTimeout(function() {
                    try {
                      pushResponse(url, data, size, tabTitle, requestStartTime);
                    } catch (_) {}
                    try { truncateDataForRender(data, RENDER_ROW_LIMIT); } catch (_) {}
                  }, 0);
                } else {
                  pushResponse(url, data, size, tabTitle, requestStartTime);
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
        // 点击运行按钮时强制刷新 Tab 标题缓存，确保使用当前激活 Tab 的标题
        invalidateTabTitleCache();
        const activeTab = getActiveTabTitle();
        const btnText = (btn.textContent || btn.innerText || '').trim();
        try {
          if (!window.__queryButtonClickHistory) window.__queryButtonClickHistory = [];
          window.__queryButtonClickHistory.push({
            tabTitle: activeTab || '',
            buttonText: btnText,
            timestamp: Date.now()
          });
          if (window.__queryButtonClickHistory.length > 50) {
            window.__queryButtonClickHistory.shift();
          }
        } catch (_) {}
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
        setTimeout(function() {
          if (window.gc && typeof window.gc === 'function') {
            try { window.gc(); } catch (_) {}
          }
        }, 100);
      }
    } catch (_) {}
  }

  document.addEventListener('click', clearOnQueryClick, true);

  // Tab 切换监听：点击非激活 Tab 时清除标题缓存，避免新 Tab 请求使用旧 Tab 标题
  function handleTabSwitchClick(e) {
    try {
      if (!e.target || !e.target.closest) return;
      var tabEl = e.target.closest('.k-tab, .k-tabs-item, .flow-tabs-item, .ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, [role="tab"]');
      if (!tabEl) return;
      var isActive = tabEl.classList.contains('k-active') || tabEl.classList.contains('active') || tabEl.getAttribute('aria-selected') === 'true';
      if (!isActive) {
        // 点击的是非激活 Tab，用户即将切换，清除缓存
        invalidateTabTitleCache();
      }
    } catch (_) {}
  }
  document.addEventListener('click', handleTabSwitchClick, true);

  function handleTabCloseClick(e) {
    try {
      const target = e.target;
      if (!target || !target.closest) return;
      const closeBtn = target.closest('.anticon-close, .el-icon-close, .ivu-icon-ios-close, .tab-close, .close-icon, .deleteTabs-icon, [class*="close"], [class*="guanbi"], [class*="Close"], svg[class*="close"], i[class*="close"], span[class*="close"], [class*="icon-close"]');
      if (!closeBtn) return;
      const tabEl = closeBtn.closest('.ant-tabs-tab, .el-tabs__item, .ivu-tabs-tab, .tab-item, [role="tab"], .tab, .tabs-item, .flow-tabs-item, .k-tab, .k-tabs-item');
      if (!tabEl) return;
      let tabTitle = '';
      const titleSpan = tabEl.querySelector('span[title]');
      if (titleSpan) {
        tabTitle = (titleSpan.getAttribute('title') || '').trim();
      }
      if (!tabTitle) {
        tabTitle = (tabEl.textContent || tabEl.innerText || '').trim();
      }
      if (tabTitle && tabTitle.length > 0 && tabTitle.length < 100) {
        if (typeof window.__clearCapturedJsonByTab === 'function') {
          window.__clearCapturedJsonByTab(tabTitle);
        }
        if (ipcRenderer) {
          try {
            ipcRenderer.send('clear-tab-json', tabTitle);
          } catch (_) {}
        }
        if (window.gc && typeof window.gc === 'function') {
          try { window.gc(); } catch (_) {}
        }
      }
    } catch (_) {}
  }
  document.addEventListener('click', handleTabCloseClick, true);

  function handleContextMenuClose(e) {
    try {
      const target = e.target;
      if (!target) return;
      const text = (target.textContent || target.innerText || '').trim();
      if (!text) return;

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
        return;
      }
      if (window.gc && typeof window.gc === 'function') {
        try { window.gc(); } catch (_) {}
      }
    } catch (_) {}
  }
  document.addEventListener('click', handleContextMenuClose, true);

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
      if (window.__capturedJsonResponses.length > 3) {
        let totalSize = 0;
        for (let j = 0; j < window.__capturedJsonResponses.length; j++) {
          totalSize += window.__capturedJsonResponses[j].size || 0;
        }
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

    function isCaptchaUrlLocal(url) {
      return typeof url === 'string' && /(?:^|\/)api\/code(?:[?#]|$)/i.test(url);
    }

    function extractCaptchaFromResponseLocal(data) {
      try {
        if (data && typeof data === 'object' && data.result) {
          return String(data.result).trim();
        }
      } catch (_) {}
      return '';
    }

    function autoFillCaptchaLocal(doc, code) {
      if (!doc || !code) return;
      try {
        var inp = doc.querySelector('input[placeholder*="验证码"]');
        if (!inp) {
          var inputs = doc.querySelectorAll('input[type="text"], input:not([type])');
          for (var i = 0; i < inputs.length; i++) {
            var ph = (inputs[i].getAttribute('placeholder') || '').toLowerCase();
            if (ph.indexOf('验证码') >= 0 || ph.indexOf('captcha') >= 0 || ph.indexOf('verify') >= 0) {
              inp = inputs[i];
              break;
            }
          }
        }
        if (inp) {
          var setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set;
          setter.call(inp, code);
          inp.dispatchEvent(new win.Event('input', { bubbles: true }));
          inp.dispatchEvent(new win.Event('change', { bubbles: true }));
          return true;
        }
      } catch (_) {}
      return false;
    }

    function setCaptchaCodeLocal(code) {
      if (!code) return;
      win.__captchaCode = code;
      // 在当前 iframe 和顶层窗口中尝试填充
      autoFillCaptchaLocal(win.document, code);
      try {
        if (win.top && win.top !== win) autoFillCaptchaLocal(win.top.document, code);
      } catch (_) {}
      // 延迟重试
      var tries = 0;
      var timer = setInterval(function() {
        tries++;
        autoFillCaptchaLocal(win.document, code);
        try { if (win.top && win.top !== win) autoFillCaptchaLocal(win.top.document, code); } catch (_) {}
        if (tries >= 5) clearInterval(timer);
      }, 500);
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
              if (isCaptchaUrlLocal(requestUrl)) {
                const data = JSON.parse(xhr.responseText);
                const code = extractCaptchaFromResponseLocal(data);
                if (code) setCaptchaCodeLocal(code);
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
          if (isCaptchaUrlLocal(urlStr) && response.clone) {
            try {
              const cloned = response.clone();
              cloned.text().then(function(text) {
                try {
                  const data = JSON.parse(text);
                  const code = extractCaptchaFromResponseLocal(data);
                  if (code) setCaptchaCodeLocal(code);
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
