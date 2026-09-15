/* =============================================================================
   core.js —— 纯逻辑层（不接触 DOM，可单独在 Node 中测试）
   提供：安全存储 / 日期与倒计时 / 纪念日推算 / 答案比对 /
         按日稳定随机 / 配置合并 / 分享码编解码
   ============================================================================= */
(function (root) {
  'use strict';

  /** 所有可配置列表的统一上限 */
  var MAX_ITEMS = 50;

  /* ---------------- 1. 存储：localStorage 不可用时降级为内存 ---------------- */
  var memory = {};
  var hasLS = (function () {
    try {
      var k = '__t__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  var store = {
    available: hasLS,
    get: function (key, def) {
      try {
        var raw = hasLS ? root.localStorage.getItem(key) : memory[key];
        if (raw === null || raw === undefined) return def;
        return JSON.parse(raw);
      } catch (e) { return def; }
    },
    set: function (key, val) {
      var raw = JSON.stringify(val);
      try {
        if (hasLS) root.localStorage.setItem(key, raw); else memory[key] = raw;
        return true;
      } catch (e) { memory[key] = raw; return false; }
    },
    remove: function (key) {
      try {
        if (hasLS) root.localStorage.removeItem(key); else delete memory[key];
      } catch (e) { delete memory[key]; }
    }
  };

  /* ---------------- 2. 通用小工具 ---------------- */

  function isPlain(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o);
  }

  function clampInt(v, min, max, def) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  }

  function clampNum(v, min, max, def) {
    var n = parseFloat(v);
    if (!isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  }

  /** 截断到上限，返回新数组 */
  function limitList(arr, max) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, max === undefined || max === null ? MAX_ITEMS : max);
  }

  /**
   * 多行文本 → 列表：按行拆分、去首尾空白、丢空行、去重、截断到 max。
   * 用于所有「一行一个」的配置输入框。
   */
  function splitLines(text, max, dedupe) {
    var lim = (max === undefined || max === null) ? MAX_ITEMS : max;
    var out = [], seen = {};
    String(text === null || text === undefined ? '' : text).split(/\r?\n/).forEach(function (line) {
      var s = line.trim();
      if (!s) return;
      if (dedupe !== false) {
        var k = s.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
      }
      if (out.length < lim) out.push(s);
    });
    return out;
  }

  /** 深合并：对象递归，数组整体替换（并截断），其余以 over 为准 */
  function deepMerge(base, over) {
    var out;
    if (isPlain(base)) {
      out = {};
      Object.keys(base).forEach(function (k) {
        var v = base[k];
        out[k] = Array.isArray(v) ? v.slice() : (isPlain(v) ? deepMerge(v, null) : v);
      });
    } else if (Array.isArray(base)) {
      out = base.slice();
    } else {
      out = base;
    }
    if (isPlain(over)) {
      Object.keys(over).forEach(function (k) {
        var bv = out[k], ov = over[k];
        if (ov === undefined || ov === null) return;
        if (isPlain(bv) && isPlain(ov)) out[k] = deepMerge(bv, ov);
        else if (Array.isArray(ov)) out[k] = limitList(ov);
        else out[k] = ov;
      });
    }
    return out;
  }

  function getPath(obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, val) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!isPlain(cur[parts[i]])) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
    return obj;
  }

  /* ---------------- 3. 日期工具 ---------------- */
  var DAY = 86400000;

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /** 解析 "YYYY-MM-DD"，按本地时区构造，非法输入返回 null */
  function parseDate(str) {
    if (typeof str !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  /** 两个时间点之间的差值拆解 */
  function diffParts(from, to) {
    var a = new Date(from).getTime(), b = new Date(to).getTime();
    if (!isFinite(a) || !isFinite(b)) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, negative: true };
    }
    var ms = b - a;
    var neg = ms < 0;
    ms = Math.abs(ms);
    var totalSec = Math.floor(ms / 1000);
    return {
      days: Math.floor(totalSec / 86400),
      hours: Math.floor(totalSec % 86400 / 3600),
      minutes: Math.floor(totalSec % 3600 / 60),
      seconds: Math.floor(totalSec % 60),
      totalMs: ms,
      negative: neg
    };
  }

  /** 自然日差：今天 23:59 到明天 00:01 也算 1 天 */
  function daysUntil(target, now) {
    var a = startOfDay(now), b = startOfDay(target);
    return Math.round((b.getTime() - a.getTime()) / DAY);
  }

  /**
   * 下一次发生的时间点。
   * yearly=true  → 每年重复；yearly=false → 一次性，已过返回 null
   * 2 月 29 日在非闰年回落到 2 月 28 日。
   */
  function nextOccurrence(dateStr, yearly, now) {
    var base = parseDate(dateStr);
    if (!base) return null;
    var m = base.getMonth() + 1, d = base.getDate();
    var today = startOfDay(now);
    var y = today.getFullYear();

    function make(year) {
      var dd = d;
      if (m === 2 && d === 29 && !isLeap(year)) dd = 28;
      return new Date(year, m - 1, dd, 0, 0, 0, 0);
    }

    if (!yearly) {
      var once = new Date(base.getFullYear(), m - 1, d, 0, 0, 0, 0);
      return once.getTime() >= today.getTime() ? once : null;
    }
    var t = make(y);
    if (t.getTime() < today.getTime()) t = make(y + 1);
    return t;
  }

  /** 纪念日进度（0~1） */
  function anniversaryProgress(dateStr, yearly, now, anchorStr) {
    var next = nextOccurrence(dateStr, yearly, now);
    if (!next) return 1;
    var total;
    if (yearly) {
      total = isLeap(next.getFullYear()) ? 366 : 365;
    } else {
      var anchor = parseDate(anchorStr) || startOfDay(now);
      total = daysUntil(anchor, next) + 1;
      if (!isFinite(total) || total < 1) total = 1;
    }
    var left = daysUntil(next, now);
    if (left <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - left / total));
  }

  /* ---------------- 4. 答案比对（默契度） ---------------- */
  var PUNCT = /[\s\u3000，。！？、；：,.!?;:'"“”‘’~～·\-_*#]/g;

  function normalize(s) {
    return String(s === null || s === undefined ? '' : s)
      .toLowerCase()
      .replace(PUNCT, '');
  }

  /** 一致 10 分；包含 6 分；否则 0 分 */
  function compareAnswers(a, b) {
    var na = normalize(a), nb = normalize(b);
    if (!na || !nb) return { same: false, partial: false, score: 0 };
    if (na === nb) return { same: true, partial: false, score: 10 };
    if (na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) return { same: false, partial: true, score: 6 };
    return { same: false, partial: false, score: 0 };
  }

  function calcCompatibility(answersA, answersB) {
    var n = Math.min(answersA.length, answersB.length);
    var details = [], score = 0, answered = 0;
    for (var i = 0; i < n; i++) {
      var a = answersA[i], b = answersB[i];
      var hasA = normalize(a) !== '', hasB = normalize(b) !== '';
      var r = compareAnswers(a, b);
      var counted = hasA && hasB;
      if (counted) { answered++; score += r.score; }
      details.push({
        index: i, a: a, b: b,
        same: r.same, partial: r.partial,
        score: counted ? r.score : 0,
        counted: counted
      });
    }
    var maxScore = answered * 10;
    return {
      score: score, maxScore: maxScore,
      percent: maxScore > 0 ? Math.round(score / maxScore * 100) : 0,
      answered: answered, details: details
    };
  }

  /** 默契度文案 */
  function rateSyncPercent(p) {
    if (p >= 80) return '心有灵犀，说的就是你们';
    if (p >= 60) return '相当不错，剩下的是惊喜';
    if (p >= 35) return '有点意思，回去互相补课吧';
    return '嗯……今晚得好好聊聊了';
  }

  /* ---------------- 5. 随机 ---------------- */
  function hashCode(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function dailyIndex(len, now, salt) {
    if (!len) return 0;
    var d = startOfDay(now);
    var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '|' + (salt || '');
    return Math.abs(hashCode(key)) % len;
  }

  function seededPick(arr, seed) {
    if (!arr || !arr.length) return null;
    return arr[Math.abs(hashCode(String(seed))) % arr.length];
  }

  function pick(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------- 6. 小游戏评级 ---------------- */

  /** 误差按目标秒数归一化到「10 秒」量纲，这样 5 秒目标和 30 秒目标都公平 */
  function rateTenSec(err, target) {
    var t = (isFinite(target) && target > 0) ? target : 10;
    var e = Math.abs(err) * (10 / t);
    if (!isFinite(e)) return { level: 0, title: '—', desc: '' };
    if (e < 0.2) return { level: 5, title: '人体原子钟', desc: '你是怎么做到的' };
    if (e < 0.5) return { level: 4, title: '相当精准', desc: '这秒感有点东西' };
    if (e < 1.0) return { level: 3, title: '很不错', desc: '差一点点就完美了' };
    if (e < 2.0) return { level: 2, title: '还行', desc: '再来几次能更准' };
    if (e < 4.0) return { level: 1, title: '有点飘', desc: '数太快还是太慢了？' };
    return { level: 0, title: '放空了', desc: '你是不是忘了在数数' };
  }

  function rateSync(diff) {
    var d = Math.abs(diff);
    if (!isFinite(d)) return { level: 0, title: '—', desc: '' };
    if (d < 0.15) return { level: 5, title: '心有灵犀', desc: '这个同步率有点吓人' };
    if (d < 0.4) return { level: 4, title: '很合拍', desc: '你们节奏几乎一致' };
    if (d < 1.0) return { level: 3, title: '算默契', desc: '再练练能更接近' };
    if (d < 2.5) return { level: 2, title: '各数各的', desc: '差得有点明显了' };
    return { level: 1, title: '不在同一频道', desc: '需要多磨合啊' };
  }

  /** 不重复抽取；抽完自动重置并标记 reset */
  function drawNoRepeat(poolLen, used) {
    if (!poolLen) return { index: -1, value: null, reset: false, used: [] };
    var list = Array.isArray(used) ? used.slice() : [];
    var reset = false;
    if (list.length >= poolLen) { list.length = 0; reset = true; }
    var rest = [];
    for (var i = 0; i < poolLen; i++) if (list.indexOf(i) < 0) rest.push(i);
    var pickIdx = rest[Math.floor(Math.random() * rest.length)];
    list.push(pickIdx);
    return { index: pickIdx, value: null, reset: reset, used: list };
  }

  /* ---------------- 7. Base64 / 分享码 ---------------- */
  function b64encode(str) {
    var bytes = unescape(encodeURIComponent(str));
    return root.btoa ? root.btoa(bytes) : bytes;
  }
  function b64decode(b64) {
    if (!root.atob) return b64;
    return decodeURIComponent(escape(root.atob(b64)));
  }
  function toUrlSafe(b64) { return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromUrlSafe(s) {
    var x = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (x.length % 4) x += '=';
    return x;
  }

  /** 备份口令（完整数据，用于换设备迁移） */
  function encodeBackup(obj) {
    try { return b64encode(JSON.stringify(obj)); } catch (e) { return ''; }
  }
  function decodeBackup(str) {
    if (!str) return null;
    try {
      var o = JSON.parse(b64decode(String(str).trim()));
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  /** 分享码：URL 安全的 Base64，可直接放进链接 hash */
  function encodeShare(obj) {
    try { return toUrlSafe(b64encode(JSON.stringify(obj))); } catch (e) { return ''; }
  }
  function decodeShare(code) {
    if (!code) return null;
    try {
      var o = JSON.parse(b64decode(fromUrlSafe(code)));
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  /**
   * 生成分享链接。把数据放进 hash —— hash 不会发送到服务器，比 query 更私密。
   * base 形如 "https://u.github.io/our-days/"，已存在的 hash 会被替换。
   */
  function buildShareUrl(obj, base) {
    var code = encodeShare(obj);
    if (!code) return '';
    var u = String(base || '');
    var i = u.indexOf('#');
    if (i >= 0) u = u.slice(0, i);
    return u + '#d=' + code;
  }

  /** 从 hash 中解出分享数据；没有或不合法返回 null */
  function parseShareHash(hash) {
    if (!hash) return null;
    var m = /(?:^|[#&])d=([A-Za-z0-9\-_]+)/.exec(String(hash));
    if (!m) return null;
    return decodeShare(m[1]);
  }

  /* ---------------- 导出 ---------------- */
  root.LoveCore = {
    MAX_ITEMS: MAX_ITEMS,
    store: store,

    /* 通用 */
    isPlain: isPlain,
    clampInt: clampInt,
    clampNum: clampNum,
    limitList: limitList,
    splitLines: splitLines,
    deepMerge: deepMerge,
    getPath: getPath,
    setPath: setPath,

    /* 日期 */
    startOfDay: startOfDay,
    parseDate: parseDate,
    isLeap: isLeap,
    diffParts: diffParts,
    daysUntil: daysUntil,
    nextOccurrence: nextOccurrence,
    anniversaryProgress: anniversaryProgress,

    /* 比对 */
    normalize: normalize,
    compareAnswers: compareAnswers,
    calcCompatibility: calcCompatibility,
    rateSyncPercent: rateSyncPercent,

    /* 随机 */
    hashCode: hashCode,
    dailyIndex: dailyIndex,
    seededPick: seededPick,
    pick: pick,
    shuffle: shuffle,

    /* 小游戏 */
    rateTenSec: rateTenSec,
    rateSync: rateSync,
    drawNoRepeat: drawNoRepeat,

    /* 编解码 */
    encodeBackup: encodeBackup,
    decodeBackup: decodeBackup,
    encodeShare: encodeShare,
    decodeShare: decodeShare,
    buildShareUrl: buildShareUrl,
    parseShareHash: parseShareHash
  };
})(typeof window !== 'undefined' ? window : globalThis);
