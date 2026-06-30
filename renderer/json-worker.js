self.onmessage = function(e) {
  const { type, data, limit } = e.data;

  try {
    if (type === 'parse') {
      let parsed = JSON.parse(data.text);
      const rowCount = estimateRowCount(parsed);
      const isBig = rowCount > 50000;
      
      if (isBig && limit && limit > 0) {
        truncateData(parsed, limit);
      }

      self.postMessage({
        type: 'parse-result',
        url: data.url,
        size: data.size,
        data: parsed,
        rowCount: rowCount,
        isBig: isBig
      });
    } else if (type === 'analyze') {
      const result = analyzeJson(data);
      self.postMessage({
        type: 'analyze-result',
        result: result
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err.message
    });
  }
};

function estimateRowCount(data) {
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
  return 0;
}

function truncateData(data, limit) {
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

function analyzeJson(json) {
  if (!json || typeof json !== 'object') return [];

  const candidates = [];
  const seen = new Set();
  const DATA_KEYS = ['result', 'data', 'tableData', 'listData', 'dataList', 'queryResult', 'RECORDS'];
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
                row.push(v === null || v === undefined ? '' : v);
              }
              rows.push(row);
            }
          }
          return { headers: firstKeys, rows: rows, rowCount: rows.length, path: path };
        }
      }
    }
    return null;
  }

  if (Array.isArray(json)) {
    const extracted = extractTableFromArray(json, 'root');
    if (extracted && extracted.rowCount > 0) candidates.push(extracted);
  }

  for (let i = 0; i < DATA_KEYS.length; i++) {
    const val = json[DATA_KEYS[i]];
    if (Array.isArray(val) && val.length > 0) {
      const extracted = extractTableFromArray(val, 'root.' + DATA_KEYS[i]);
      if (extracted && extracted.rowCount > 0) candidates.push(extracted);
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
