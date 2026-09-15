/* =============================================================================
   core.js —— 纯逻辑层（不接触 DOM，可单独在 Node 中测试）
   提供：安全存储 / 日期与倒计时 / 纪念日推算 / 答案比对 / 按日稳定随机
   ============================================================================= */
(function (root) {
  'use strict';

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

  /* ---------------- 2. 日期工具 ---------------- */
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
    // 拒绝 2024-02-31 这类被 Date 自动进位的日期
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  /** 两个时间点之间的差值拆解（用于"在一起 X 天 X 时 X 分 X 秒"） */
  function diffParts(from, to) {
    var a = new Date(from).getTime(), b = new Date(to).getTime();
    if (!isFinite(a) || !isFinite(b)) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, negative: true };
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
   * yearly=true  → 每年重复，返回今年或明年的该月日
   * yearly=false → 一次性，已过则返回 null
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
    // 今天就正好是纪念日时，视为 0 天后（不推到明年）
    if (t.getTime() < today.getTime()) t = make(y + 1);
    return t;
  }

  /**
   * 纪念日进度（0~1），用于进度环。
   * yearly → 以一整年为周期；一次性 → 以 anchor（默认在一起日）到目标日为周期。
   */
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
    var p = 1 - left / total;
    return Math.max(0, Math.min(1, p));
  }

  /* ---------------- 3. 答案比对（默契度） ---------------- */
  var PUNCT = /[\s\u3000，。！？、；：,.!?;:'"“”‘’~～·\-_*#]/g;

  /** 归一化：去空白与标点、转小写 */
  function normalize(s) {
    return String(s === null || s === undefined ? '' : s)
      .toLowerCase()
      .replace(PUNCT, '');
  }

  /**
   * 单题比对。
   * 完全一致 10 分；一方包含另一方 6 分（"草莓" vs "草莓蛋糕"）；否则 0 分。
   */
  function compareAnswers(a, b) {
    var na = normalize(a), nb = normalize(b);
    if (!na || !nb) return { same: false, partial: false, score: 0 };
    if (na === nb) return { same: true, partial: false, score: 10 };
    if (na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) return { same: false, partial: true, score: 6 };
    return { same: false, partial: false, score: 0 };
  }

  /**
   * 整套问卷比对。
   * answersA / answersB 为等长字符串数组，空项不参与计分。
   * 返回 { score, maxScore, percent, answered, details[] }
   */
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
    var percent = maxScore > 0 ? Math.round(score / maxScore * 100) : 0;
    return { score: score, maxScore: maxScore, percent: percent, answered: answered, details: details };
  }

  /* ---------------- 4. 按日稳定的随机 ---------------- */
  function hashCode(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;                       // 强制 32 位整数
    }
    return h;
  }

  /** 同一天内取固定下标，跨天自动变化；salt 用于分流不同用途 */
  function dailyIndex(len, now, salt) {
    if (!len) return 0;
    var d = startOfDay(now);
    var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '|' + (salt || '');
    return Math.abs(hashCode(key)) % len;
  }

  /** 可复现的伪随机（转盘等需要"真随机"的场景用 Math.random 即可） */
  function seededPick(arr, seed) {
    if (!arr || !arr.length) return null;
    return arr[Math.abs(hashCode(String(seed))) % arr.length];
  }

  /* ---------------- 4.5 小游戏辅助 ---------------- */

  /** Fisher-Yates 洗牌（不改原数组） */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * 十秒挑战评级：误差（秒）越小越好
   * 返回 { level, title, desc }
   */
  function rateTenSec(err) {
    var e = Math.abs(err);
    if (!isFinite(e)) return { level: 0, title: '—', desc: '' };
    if (e < 0.2) return { level: 5, title: '人体原子钟', desc: '你是怎么做到的' };
    if (e < 0.5) return { level: 4, title: '相当精准', desc: '这秒感有点东西' };
    if (e < 1.0) return { level: 3, title: '很不错', desc: '差一点点就完美了' };
    if (e < 2.0) return { level: 2, title: '还行', desc: '再来几次能更准' };
    if (e < 4.0) return { level: 1, title: '有点飘', desc: '数太快还是太慢了？' };
    return { level: 0, title: '放空了', desc: '你是不是忘了在数数' };
  }

  /** 双人同步评级：两人按下时刻之差 */
  function rateSync(diff) {
    var d = Math.abs(diff);
    if (!isFinite(d)) return { level: 0, title: '—', desc: '' };
    if (d < 0.15) return { level: 5, title: '心有灵犀', desc: '这个同步率有点吓人' };
    if (d < 0.4) return { level: 4, title: '很合拍', desc: '你们节奏几乎一致' };
    if (d < 1.0) return { level: 3, title: '算默契', desc: '再练练能更接近' };
    if (d < 2.5) return { level: 2, title: '各数各的', desc: '差得有点明显了' };
    return { level: 1, title: '不在同一频道', desc: '需要多磨合啊' };
  }

  /**
   * 不重复抽取：从池中取一个未用过的项
   * used 为已用下标数组（会被就地更新）
   * 全部用尽时自动重置。返回 { index, value, reset }
   */
  function drawNoRepeat(poolLen, used) {
    if (!poolLen) return { index: -1, value: null, reset: false };
    var list = Array.isArray(used) ? used : [];
    var reset = false;
    if (list.length >= poolLen) { list.length = 0; reset = true; }
    var rest = [];
    for (var i = 0; i < poolLen; i++) if (list.indexOf(i) < 0) rest.push(i);
    var pick = rest[Math.floor(Math.random() * rest.length)];
    list.push(pick);
    return { index: pick, value: null, reset: reset, used: list };
  }

  /* ---------------- 5. 导出 / 导入（备份口令） ---------------- */
  function encodeBackup(obj) {
    try {
      var json = JSON.stringify(obj);
      return root.btoa ? root.btoa(unescape(encodeURIComponent(json))) : json;
    } catch (e) { return ''; }
  }
  function decodeBackup(str) {
    if (!str) return null;
    try {
      var json = root.atob ? decodeURIComponent(escape(root.atob(str))) : str;
      var o = JSON.parse(json);
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  /* ---------------- 导出 ---------------- */
  root.LoveCore = {
    store: store,
    startOfDay: startOfDay,
    parseDate: parseDate,
    isLeap: isLeap,
    diffParts: diffParts,
    daysUntil: daysUntil,
    nextOccurrence: nextOccurrence,
    anniversaryProgress: anniversaryProgress,
    normalize: normalize,
    compareAnswers: compareAnswers,
    calcCompatibility: calcCompatibility,
    dailyIndex: dailyIndex,
    seededPick: seededPick,
    shuffle: shuffle,
    rateTenSec: rateTenSec,
    rateSync: rateSync,
    drawNoRepeat: drawNoRepeat,
    hashCode: hashCode,
    encodeBackup: encodeBackup,
    decodeBackup: decodeBackup
  };
})(typeof window !== 'undefined' ? window : globalThis);
