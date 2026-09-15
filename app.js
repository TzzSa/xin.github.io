/* =============================================================================
   app.js —— 交互层（依赖 core.js 提供的 window.LoveCore）
   结构：
     0. 工具函数 / 动效
     1. 配置（默认值 · 读取 · 迁移 · 保存）
     2. 分享码
     3. 首次引导
     4. 视图切换
     5. 恋爱计时器
     6. 纪念日
     7. 八个游戏
     8. 名字选择弹层
     9. 设置 + 内容配置
    10. 启动
   ============================================================================= */
(function () {
  'use strict';

  var C = window.LoveCore;
  var $ = function (id) { return document.getElementById(id); };
  var MAX = C.MAX_ITEMS;                        // 所有可配置列表统一上限：50
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var qsa = function (sel) { return document.querySelectorAll(sel); };

  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(RM && RM.matches); }

  /* =========================================================================
     1. 存储键与配置
     ========================================================================= */
  var K = {
    setup: 'love.setup',
    anni: 'love.anniversaries',
    quiz: 'love.quiz',
    cfg: 'love.config',
    tap: 'love.tap',
    ten: 'love.ten',
    memBest: 'love.memBest',
    ui: 'love.ui',
    /* 旧版散落键，仅用于一次性迁移 */
    oldWheel: 'love.wheel',
    oldTruth: 'love.truth',
    oldMem: 'love.mem'
  };

  var DEFAULTS = {
    v: 2,
    quiz: {
      questions: [
        'TA 最喜欢吃的水果是什么？',
        'TA 最想和你一起去哪座城市？',
        'TA 生气的时候，最希望你怎么哄？',
        'TA 睡觉前一定要做的一件事是什么？',
        'TA 最讨厌做的家务是什么？',
        'TA 最常挂在嘴边的一句话 / 一个表情是什么？',
        'TA 最喜欢的颜色是什么？',
        '你们第一次一起看的电影是哪一部？',
        'TA 收到过最开心的一份礼物是什么？',
        'TA 最害怕的东西是什么？'
      ]
    },
    wheel: {
      items: ['你请客', '我请客', '石头剪刀布', '今天吃火锅', '今天吃面', '你说了算']
    },
    scratch: {
      cards: [
        '今天给 TA 一个不带理由的拥抱',
        '对 TA 说：我今天最喜欢你的瞬间是……',
        '今晚看一部 TA 选的电影，你不准吐槽',
        '给 TA 捏捏肩膀，五分钟起步',
        '写一张小纸条，偷偷塞进 TA 的口袋',
        '今天的碗筷我全包了',
        '一起散步二十分钟，两个人都别看手机',
        '认真夸 TA 三个具体的优点',
        '为 TA 做一道 TA 爱吃的菜',
        '翻出一张老照片，讲讲那天的故事',
        '给 TA 唱一首歌，跑调也算数',
        '什么都不做，安静地待在一起十分钟'
      ]
    },
    tap: { duration: 30 },
    ten: { target: 10 },
    memory: {
      emoji: ['💍', '🎬', '🍜', '✈️', '🌙', '🎁', '📷', '🐻'],
      words: []
    },
    draw: {
      words: ['火锅', '长颈鹿', '下雨天', '洗衣机', '摩天轮', '冰箱', '螃蟹', '拖鞋',
        '恐龙', '生日蛋糕', '地铁', '火山', '企鹅', '雨伞', '闹钟', '蜗牛',
        '彩虹', '微波炉', '袋鼠', '热气球', '西瓜', '眼镜', '章鱼', '消防车',
        '雪人', '吉他', '帆船', '斑马', '爆米花', '电风扇'],
      duration: 60
    },
    truth: {
      truth: [
        '说出第一次心动是在哪一刻',
        '你偷偷为对方做过但没说出口的一件事',
        '对方身上你最羡慕的一个优点',
        '如果我们吵架了，你希望怎么和好',
        '说一件你至今还记得的小事',
        '你最想和对方一起去的地方',
        '你手机里存着对方哪张照片',
        '说一个你从没告诉过对方的小秘密',
        '你觉得我们最像哪部电影里的情侣',
        '对方哪个瞬间让你觉得「就是这个人了」',
        '你最怕我们之间出现什么变化',
        '用三个词形容我们的关系'
      ],
      dare: [
        '给对方一个十秒的拥抱',
        '学对方说话的语气说一句话',
        '给对方唱两句歌',
        '单脚站立给对方比个心',
        '用夸张的语气念一段广告词',
        '模仿一个你们都认识的动物',
        '让对方在你脸上贴一张便利贴',
        '给对方画一张十秒速写',
        '说出对方三个优点，每个都要加例子',
        '对着镜头做三个鬼脸让对方拍下来',
        '给对方按摩肩膀一分钟',
        '用方言说一句「我喜欢你」'
      ]
    }
  };

  /** 读取配置：与默认值深合并，并迁移旧版散落的键 */
  function loadCfg() {
    var saved = C.store.get(K.cfg, null);
    var c = C.deepMerge(DEFAULTS, saved || {});
    if (!saved) {
      var migrated = false;
      var w = C.store.get(K.oldWheel, null);
      if (Array.isArray(w) && w.length >= 2) { c.wheel.items = C.limitList(w); migrated = true; }
      var t = C.store.get(K.oldTruth, null);
      if (t && Array.isArray(t.truth) && t.truth.length) { c.truth.truth = C.limitList(t.truth); migrated = true; }
      if (t && Array.isArray(t.dare) && t.dare.length) { c.truth.dare = C.limitList(t.dare); migrated = true; }
      var m = C.store.get(K.oldMem, null);
      if (m && Array.isArray(m.words) && m.words.length) { c.memory.words = C.limitList(m.words); migrated = true; }
      if (m && m.best) C.store.set(K.memBest, { '8': m.best });
      [K.oldWheel, K.oldTruth, K.oldMem].forEach(function (k) { C.store.remove(k); });
      if (migrated) C.store.set(K.cfg, c);
    }
    return c;
  }

  var cfg = loadCfg();
  function saveCfg() { C.store.set(K.cfg, cfg); }

  /* ---- 运行期状态 ---- */
  var setup = C.store.get(K.setup, null);
  var annis = C.store.get(K.anni, []);
  var quiz = C.store.get(K.quiz, { A: [], B: [] });
  var tapScores = C.store.get(K.tap, []);
  var tenScores = C.store.get(K.ten, []);
  var memBest = C.store.get(K.memBest, {});

  if (!C.isPlain(quiz)) quiz = { A: [], B: [] };
  if (!Array.isArray(quiz.A)) quiz.A = [];
  if (!Array.isArray(quiz.B)) quiz.B = [];
  if (!Array.isArray(annis)) annis = [];
  if (!Array.isArray(tapScores)) tapScores = [];
  if (!Array.isArray(tenScores)) tenScores = [];
  if (!C.isPlain(memBest)) memBest = {};

  function saveAnni() { C.store.set(K.anni, annis); }
  function saveQuiz() { C.store.set(K.quiz, quiz); }
  function saveMemBest() { C.store.set(K.memBest, memBest); }

  /* =========================================================================
     0. 工具函数与动效
     ========================================================================= */
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(d) { return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nickA() { return (setup && setup.nickA) || 'TA'; }
  function nickB() { return (setup && setup.nickB) || '我'; }

  function debounce(fn, wait) {
    var t = 0;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 350);
    };
  }

  /** 数字滚动：只改 textContent，不触发重排风暴 */
  function animateNumber(el, to, dur) {
    var from = parseFloat(el.dataset.v || '0');
    if (!isFinite(from)) from = 0;
    if (from === to) return;
    el.dataset.v = to;
    if (reduced()) { el.textContent = to; return; }
    var t0 = performance.now();
    dur = dur || 460;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /** 粒子迸发（点击爱心、胜利庆祝） */
  function burst(x, y, chars, count) {
    if (reduced() || !document.body.animate) return;
    var list = chars || ['💛', '✨', '💖'];
    var n = count || 12;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'burst';
      s.textContent = list[Math.floor(Math.random() * list.length)];
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.fontSize = (12 + Math.random() * 12).toFixed(1) + 'px';
      document.body.appendChild(s);
      var a = Math.random() * Math.PI * 2;
      var d = 36 + Math.random() * 84;
      var anim = s.animate([
        { transform: 'translate(-50%,-50%) scale(.35)', opacity: 1 },
        {
          transform: 'translate(calc(-50% + ' + (Math.cos(a) * d).toFixed(1) + 'px), calc(-50% + ' +
            (Math.sin(a) * d).toFixed(1) + 'px)) scale(1.1)',
          opacity: 0
        }
      ], { duration: 600 + Math.random() * 340, easing: 'cubic-bezier(.2,.7,.3,1)' });
      (function (el) { anim.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); }; })(s);
    }
  }

  /** 点按水波纹 */
  (function bindRipple() {
    document.addEventListener('pointerdown', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.btn, .tab, .icon-btn, .seg-btn, .game-card') : null;
      if (!b || reduced()) return;
      var r = b.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 2;
      var s = document.createElement('span');
      s.className = 'ripple';
      s.style.width = s.style.height = size + 'px';
      s.style.left = (e.clientX - r.left - size / 2) + 'px';
      s.style.top = (e.clientY - r.top - size / 2) + 'px';
      b.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 640);
    });
  })();

  /** 背景漂浮粒子（小屏少放几颗，省电） */
  (function bindBgFx() {
    var box = $('bgFx');
    if (!box || reduced()) return;
    var chars = ['💛', '🤍', '✨', '🌸', '💫'];
    var count = window.innerWidth < 520 ? 8 : 14;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'p';
      p.textContent = chars[i % chars.length];
      p.style.left = (Math.random() * 96 + 2).toFixed(2) + '%';
      p.style.fontSize = (11 + Math.random() * 10).toFixed(1) + 'px';
      p.style.animationDuration = (20 + Math.random() * 22).toFixed(1) + 's';
      p.style.animationDelay = (-Math.random() * 30).toFixed(1) + 's';
      p.style.opacity = (0.25 + Math.random() * 0.4).toFixed(2);
      box.appendChild(p);
    }
  })();

  /** 元素入场：重置动画后重新播放 */
  function replay(el, cls) {
    if (!el || reduced()) return;
    el.classList.remove(cls);
    void el.offsetWidth;   // 强制回流以重启动画
    el.classList.add(cls);
  }

  /* =========================================================================
     2. 分享码
     ========================================================================= */
  function buildShareUrl() {
    if (!setup) { toast('先完成设置再分享'); return ''; }
    var payload = {
      v: 1,
      setup: { date: setup.date, nickA: setup.nickA, nickB: setup.nickB },
      annis: annis.map(function (a) { return { title: a.title, date: a.date, yearly: a.yearly }; })
    };
    return C.buildShareUrl(payload, location.origin + location.pathname);
  }

  function showShare() {
    var url = buildShareUrl();
    if (!url) return;
    $('shareUrl').value = url;
    $('shareBox').hidden = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { toast('链接已复制，发给 TA 吧'); },
        function () { toast('链接已生成，长按输入框复制'); }
      );
    } else {
      toast('链接已生成，长按输入框复制');
    }
  }

  /** 从 URL 导入：本机没数据就直接采用；已有数据则先征得同意 */
  function tryImportFromShare() {
    var data = C.parseShareHash(location.hash);
    if (!data || !data.setup || !C.parseDate(data.setup.date)) return false;
    if (setup && !window.confirm('这个链接带有一份分享数据，要用它覆盖你现在的设置吗？')) return false;

    setup = {
      date: data.setup.date,
      nickA: data.setup.nickA || 'TA',
      nickB: data.setup.nickB || '我'
    };
    C.store.set(K.setup, setup);

    if (Array.isArray(data.annis)) {
      annis = C.limitList(data.annis
        .filter(function (a) { return a && a.title && C.parseDate(a.date); })
        .map(function (a) { return { id: uid(), title: String(a.title).slice(0, 16), date: a.date, yearly: !!a.yearly }; }));
      saveAnni();
    }
    if (window.history && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    return true;
  }

  /* =========================================================================
     3. 首次引导
     ========================================================================= */
  function initOnboard() {
    var ob = $('onboard'), app = $('app');
    var imported = tryImportFromShare();

    if (setup && C.parseDate(setup.date)) {
      ob.hidden = true;
      app.hidden = false;
      renderAll();
      if (imported) toast('已从分享链接导入你们的计时');
      return;
    }
    ob.hidden = false;
    app.hidden = true;
    var d = $('obDate');
    if (!d.value) d.value = new Date().toISOString().slice(0, 10);
  }

  $('obForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var date = $('obDate').value;
    var a = $('obNickA').value.trim();
    var b = $('obNickB').value.trim();
    if (!C.parseDate(date)) { toast('请选择一个有效的日期'); return; }
    if (!a || !b) { toast('两个昵称都要填哦'); return; }
    setup = { date: date, nickA: a, nickB: b };
    C.store.set(K.setup, setup);
    $('onboard').hidden = true;
    $('app').hidden = false;
    renderAll();
    toast('好了，从今天开始记录吧');
  });

  /* =========================================================================
     4. 视图切换
     ========================================================================= */
  function switchView(v) {
    each(qsa('.tab'), function (x) {
      var on = x.dataset.view === v;
      x.classList.toggle('on', on);
      x.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var timer = $('view-timer'), games = $('view-games');
    timer.hidden = v !== 'timer';
    games.hidden = v !== 'games';
    replay(v === 'timer' ? timer : games, 'view-in');
    C.store.set(K.ui, { view: v });
    if (v === 'timer') { renderAnni(); startTimer(); }
  }

  each(qsa('.tab'), function (btn) {
    btn.addEventListener('click', function () { switchView(btn.dataset.view); });
  });

  /* =========================================================================
     5. 恋爱计时器
     ========================================================================= */
  var timerId = null;

  function tickTimer() {
    if (!setup) return;
    var start = C.parseDate(setup.date);
    if (!start) return;
    var p = C.diffParts(start, new Date());

    if (p.negative) {
      $('dDays').textContent = '0';
      $('dHours').textContent = $('dMins').textContent = $('dSecs').textContent = '00';
      $('dayShort').textContent = '0';
      $('dSince').textContent = '这一天还没到，' + fmtDate(start) + ' 开始计时';
      return;
    }
    animateNumber($('dDays'), p.days);
    $('dHours').textContent = pad2(p.hours);
    $('dMins').textContent = pad2(p.minutes);
    $('dSecs').textContent = pad2(p.seconds);
    if ($('dayShort').textContent !== String(p.days)) $('dayShort').textContent = p.days;
    $('dSince').textContent = fmtDate(start);
  }

  function startTimer() {
    clearInterval(timerId);
    tickTimer();
    timerId = setInterval(tickTimer, 1000);
  }

  /* =========================================================================
     6. 纪念日
     ========================================================================= */
  function nextOf(a) { return C.nextOccurrence(a.date, a.yearly, new Date()); }

  function sortedAnnis() {
    return annis.slice().sort(function (x, y) {
      var nx = nextOf(x), ny = nextOf(y);
      if (nx && ny) return nx - ny;
      if (nx) return -1;
      if (ny) return 1;
      return 0;
    });
  }

  function renderAnni() {
    var now = new Date();
    var list = sortedAnnis();
    var nextAnni = null;
    for (var i = 0; i < list.length; i++) {
      if (nextOf(list[i])) { nextAnni = list[i]; break; }
    }

    if (nextAnni) {
      var nd = nextOf(nextAnni);
      var left = C.daysUntil(nd, now);
      $('anniLeft').textContent = left;
      $('anniName').textContent = nextAnni.title;
      $('anniDate').textContent = fmtDate(nd) + (nextAnni.yearly ? ' · 每年' : ' · 仅此一次');
      var prog = C.anniversaryProgress(nextAnni.date, nextAnni.yearly, now, setup ? setup.date : null);
      $('ringFg').style.strokeDashoffset = 326.7 * (1 - prog);
    } else {
      $('anniLeft').textContent = '—';
      $('anniName').textContent = annis.length ? '都过完啦，再加一个吧' : '还没有纪念日';
      $('anniDate').textContent = annis.length ? '等待新的期待' : '点右上角添加一个吧';
      $('ringFg').style.strokeDashoffset = 326.7;
    }

    var ul = $('anniList');
    ul.innerHTML = '';
    if (!list.length) {
      var li0 = document.createElement('li');
      li0.className = 'anni-empty';
      li0.textContent = '还没有添加纪念日';
      ul.appendChild(li0);
      return;
    }

    list.forEach(function (a, idx) {
      var nd = nextOf(a);
      var li = document.createElement('li');
      li.className = 'anni-item';
      li.style.animationDelay = Math.min(idx, 10) * 35 + 'ms';

      var em = document.createElement('div');
      em.className = 'anni-emoji';
      em.textContent = a.yearly ? '🎂' : '🎀';

      var meta = document.createElement('div');
      meta.className = 'anni-meta';
      var bt = document.createElement('b');
      bt.textContent = a.title;
      var sp = document.createElement('span');
      sp.textContent = nd
        ? fmtDate(nd) + (a.yearly ? ' · 每年' : '')
        : '已过去 · ' + fmtDate(C.parseDate(a.date) || now);
      meta.appendChild(bt); meta.appendChild(sp);

      var cnt = document.createElement('div');
      cnt.className = 'anni-count' + (nd ? '' : ' past');
      var cb = document.createElement('b');
      var cs = document.createElement('span');
      if (nd) {
        var lf = C.daysUntil(nd, now);
        cb.textContent = lf === 0 ? '今天' : lf;
        cs.textContent = lf === 0 ? '就是今天' : '天后';
      } else {
        cb.textContent = '完成';
        cs.textContent = '已过去';
      }
      cnt.appendChild(cb); cnt.appendChild(cs);

      var del = document.createElement('button');
      del.className = 'anni-del';
      del.type = 'button';
      del.title = '删除';
      del.setAttribute('aria-label', '删除 ' + a.title);
      del.textContent = '✕';
      del.addEventListener('click', function () {
        annis = annis.filter(function (x) { return x.id !== a.id; });
        saveAnni();
        renderAnni();
        toast('已删除「' + a.title + '」');
      });

      li.appendChild(em); li.appendChild(meta); li.appendChild(cnt); li.appendChild(del);
      ul.appendChild(li);
    });
  }

  $('btnAddAnni').addEventListener('click', function () {
    if (annis.length >= MAX) { toast('最多添加 ' + MAX + ' 个纪念日'); return; }
    var f = $('anniForm');
    f.hidden = !f.hidden;
    if (!f.hidden) {
      $('anniDateInput').value = new Date().toISOString().slice(0, 10);
      $('anniTitle').focus();
    }
  });

  $('anniCancel').addEventListener('click', function () {
    $('anniForm').hidden = true;
    $('anniForm').reset();
  });

  $('anniForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('anniTitle').value.trim();
    var d = $('anniDateInput').value;
    if (!t) { toast('给这个日子起个名字吧'); return; }
    if (!C.parseDate(d)) { toast('请选择一个有效的日期'); return; }
    if (annis.length >= MAX) { toast('最多添加 ' + MAX + ' 个纪念日'); return; }
    annis.push({ id: uid(), title: t.slice(0, 16), date: d, yearly: $('anniYearly').checked });
    saveAnni();
    $('anniForm').reset();
    $('anniForm').hidden = true;
    renderAnni();
    toast('已添加「' + t + '」');
  });

  /* =========================================================================
     7. 名字选择弹层（替代 window.prompt）
     ========================================================================= */
  var askCb = null;

  function closeAsk() {
    $('ask').hidden = true;
    askCb = null;
  }

  function askName(title, def, cb) {
    askCb = cb;
    $('askTitle').textContent = title || '这是谁？';
    var box = $('askWho');
    box.innerHTML = '';
    [nickA(), nickB()].forEach(function (n, i) {
      if (!n) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm ask-name' + (def && def === n ? ' on' : '');
      b.textContent = n;
      b.style.setProperty('--i', i);
      b.addEventListener('click', function () { var f = askCb; closeAsk(); if (f) f(n); });
      box.appendChild(b);
    });
    $('askInput').value = '';
    $('ask').hidden = false;
    replay($('ask').querySelector('.modal-card'), 'pop-in');
    setTimeout(function () { $('askInput').focus(); }, 60);
  }

  $('askOk').addEventListener('click', function () {
    var v = $('askInput').value.trim();
    if (!v) { toast('写个名字吧'); return; }
    var f = askCb;
    closeAsk();
    if (f) f(v.slice(0, 12));
  });

  $('askInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('askOk').click(); }
  });

  each(qsa('[data-ask-cancel]'), function (b) {
    b.addEventListener('click', closeAsk);
  });

  /* =========================================================================
     8. 游戏一：默契大考验
     ========================================================================= */
  var quizWho = 'A';
  var quizQuestions = function () { return cfg.quiz.questions; };

  function renderQuiz() {
    var ol = $('quizList');
    ol.innerHTML = '';
    var qs = quizQuestions();
    var mine = quiz[quizWho] || [];

    if (!qs.length) {
      var li0 = document.createElement('li');
      li0.className = 'anni-empty';
      li0.textContent = '还没有问题，去「设置 → 内容配置」加几条吧';
      ol.appendChild(li0);
    }

    qs.forEach(function (q, i) {
      var li = document.createElement('li');
      li.style.animationDelay = Math.min(i, 12) * 28 + 'ms';
      var n = document.createElement('span');
      n.className = 'quiz-n';
      n.textContent = i + 1;

      var wrap = document.createElement('div');
      wrap.className = 'quiz-q';
      var p = document.createElement('p');
      p.textContent = q;
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.maxLength = 40;
      inp.value = mine[i] || '';
      inp.placeholder = '写下你的答案（可留空）';
      inp.setAttribute('aria-label', '第 ' + (i + 1) + ' 题答案');
      inp.addEventListener('input', function () {
        if (!quiz[quizWho]) quiz[quizWho] = [];
        quiz[quizWho][i] = inp.value;
        saveQuiz();
      });
      wrap.appendChild(p); wrap.appendChild(inp);

      li.appendChild(n); li.appendChild(wrap);
      ol.appendChild(li);
    });

    each(qsa('.seg-btn[data-who]'), function (b) {
      b.classList.toggle('on', b.dataset.who === quizWho);
      b.textContent = b.dataset.who === 'A' ? nickA() : nickB();
    });

    renderQuizResult();
  }

  function filled(arr) {
    return (arr || []).filter(function (x) { return C.normalize(x) !== ''; }).length;
  }

  function renderQuizResult() {
    var box = $('quizResult');
    var qs = quizQuestions();
    var ca = filled(quiz.A), cb2 = filled(quiz.B);

    if (ca === 0 || cb2 === 0) {
      if (ca > 0 && cb2 === 0) {
        box.hidden = false;
        box.innerHTML = '';
        var d = document.createElement('div');
        d.className = 'result-score';
        var p = document.createElement('p');
        p.textContent = '已经收到一方的答案啦，换另一个人来答，就能看到默契度 ✨';
        d.appendChild(p);
        box.appendChild(d);
      } else {
        box.hidden = true;
      }
      return;
    }
    if (!qs.length) { box.hidden = true; return; }

    var r = C.calcCompatibility(quiz.A.slice(0, qs.length), quiz.B.slice(0, qs.length));
    while (r.details.length < qs.length) {
      r.details.push({ index: r.details.length, a: '', b: '', same: false, partial: false, score: 0, counted: false });
    }

    box.hidden = false;
    box.innerHTML = '';

    var head = document.createElement('div');
    head.className = 'result-score';
    var bEl = document.createElement('b');
    bEl.textContent = r.percent + '%';
    var sEl = document.createElement('span');
    sEl.textContent = '默契度 · 共 ' + r.answered + ' 题可比';
    var pEl = document.createElement('p');
    pEl.textContent = C.rateSyncPercent(r.percent);
    head.appendChild(bEl); head.appendChild(sEl); head.appendChild(pEl);
    box.appendChild(head);

    r.details.forEach(function (d) {
      var item = document.createElement('div');
      item.className = 'cmp-item';
      var q = document.createElement('div');
      q.className = 'cmp-q';
      q.textContent = (d.index + 1) + '. ' + (qs[d.index] || '');
      item.appendChild(q);

      [[nickA(), d.a], [nickB(), d.b]].forEach(function (pair) {
        var bx = document.createElement('div');
        bx.className = 'cmp-box' + (pair[1] ? '' : ' empty');
        if (d.counted && d.same) bx.className = 'cmp-box hit';
        else if (d.counted && d.partial) bx.className = 'cmp-box partial';
        var s = document.createElement('span');
        s.textContent = pair[0];
        var bb = document.createElement('b');
        bb.textContent = pair[1] ? pair[1] : '（未填）';
        bx.appendChild(s); bx.appendChild(bb);
        item.appendChild(bx);
      });
      box.appendChild(item);
    });

    if (r.percent >= 80 && !reduced()) {
      var rect = box.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + 70, ['💛', '💖', '✨'], 16);
    }
  }

  each(qsa('.seg-btn[data-who]'), function (b) {
    b.addEventListener('click', function () { quizWho = b.dataset.who; renderQuiz(); });
  });

  $('quizSubmit').addEventListener('click', function () {
    if (!quizQuestions().length) { toast('先去内容配置里加几个问题'); return; }
    if (filled(quiz[quizWho]) === 0) { toast('至少写一道题的答案吧'); return; }
    var other = quizWho === 'A' ? 'B' : 'A';
    var otherName = other === 'A' ? nickA() : nickB();
    renderQuizResult();
    if (filled(quiz[other]) === 0) {
      toast('已保存，接下来轮到 ' + otherName + ' 作答');
      quizWho = other;
      renderQuiz();
      var panel = $('panel-quiz');
      if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      toast('双方答案都在了，看看默契度吧');
    }
  });

  $('quizReset').addEventListener('click', function () {
    if (!window.confirm('清空双方的答案，重新开始？')) return;
    quiz = { A: [], B: [] };
    saveQuiz();
    renderQuiz();
    toast('已清空');
  });

  /* =========================================================================
     8.2 游戏二：转盘
     ========================================================================= */
  var WHEEL_COLORS = ['#E8A05C', '#E8907E', '#D98B6F', '#C97B3C', '#E0A87B', '#DB9A6A', '#E79C74', '#CE8A5E'];
  var wheelRotation = 0, wheelSpinning = false;

  function buildWheel() {
    var el = $('wheel');
    var items = cfg.wheel.items;
    el.innerHTML = '';
    var n = items.length;
    if (n < 2) {
      el.style.background = 'var(--cream-2)';
      return;
    }
    var seg = 360 / n;
    var stops = [];
    for (var i = 0; i < n; i++) {
      stops.push(WHEEL_COLORS[i % WHEEL_COLORS.length] + ' ' + (i * seg) + 'deg ' + ((i + 1) * seg) + 'deg');
    }
    el.style.background = 'conic-gradient(' + stops.join(',') + ')';

    /* 段数太多时标签会糊成一团，超过 12 段就不画文字，结果里仍然会显示 */
    if (n <= 12) {
      var r = Math.round(el.clientWidth / 2) || 130;
      items.forEach(function (txt, i) {
        var lab = document.createElement('div');
        lab.className = 'wheel-seg';
        var angle = i * seg + seg / 2;
        lab.style.width = '50%';
        lab.style.height = '26px';
        lab.style.marginTop = '-13px';
        lab.style.transform = 'rotate(' + angle + 'deg) translate(' + (r - 22) + 'px, 0)';
        lab.style.transformOrigin = '0 50%';
        lab.style.justifyContent = 'flex-end';
        lab.textContent = txt;
        el.appendChild(lab);
      });
    }
    el.style.transform = 'rotate(' + wheelRotation + 'deg)';
  }

  function syncWheelTextarea() { $('wheelItems').value = cfg.wheel.items.join('\n'); }

  function spinWheel() {
    if (wheelSpinning) return;
    var items = cfg.wheel.items;
    if (items.length < 2) { toast('至少填两个选项'); return; }
    buildWheel();

    var n = items.length, seg = 360 / n;
    var k = Math.floor(Math.random() * n);
    var targetMod = (360 - (k * seg + seg / 2)) % 360;
    var cur = ((wheelRotation % 360) + 360) % 360;
    var delta = targetMod - cur;
    if (delta < 0) delta += 360;

    wheelSpinning = true;
    $('wheelWrap').classList.add('spinning');
    wheelRotation += 360 * 5 + delta;
    $('wheel').style.transform = 'rotate(' + wheelRotation + 'deg)';
    $('wheelResult').hidden = true;

    setTimeout(function () {
      wheelSpinning = false;
      $('wheelWrap').classList.remove('spinning');
      var r = $('wheelResult');
      r.hidden = false;
      r.textContent = '结果是：' + items[k];
      replay(r, 'pop-in');
      if (!reduced()) {
        var rect = $('wheelWrap').getBoundingClientRect();
        burst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['🎉', '✨', '💛'], 14);
      }
    }, 4300);
  }

  $('wheelSpin').addEventListener('click', spinWheel);
  $('wheelCenter').addEventListener('click', spinWheel);

  $('wheelReset').addEventListener('click', function () {
    cfg.wheel.items = DEFAULTS.wheel.items.slice();
    saveCfg();
    syncWheelTextarea();
    buildWheel();
    $('wheelResult').hidden = true;
    if (cfgViewOpen()) renderCfg();
    toast('已恢复默认选项');
  });

  /* 转盘面板里的快捷编辑：写入配置 */
  var commitWheel = debounce(function () {
    var lines = C.splitLines($('wheelItems').value, MAX);
    if (lines.length < 2) { toast('至少填两个选项'); return; }
    cfg.wheel.items = lines;
    saveCfg();
    buildWheel();
    if (cfgViewOpen()) renderCfg();
  }, 500);
  $('wheelItems').addEventListener('input', commitWheel);

  /* =========================================================================
     8.3 游戏三：刮刮卡
     ========================================================================= */
  var scratchReady = false;
  var scratchMoves = 0;

  function todayCard() {
    var cards = cfg.scratch.cards;
    if (!cards.length) return '去内容配置里加几条吧';
    return cards[C.dailyIndex(cards.length, new Date(), 'scratch')];
  }

  function initScratch() {
    var cv = $('scratchCv');
    var wrap = cv.parentNode;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return false;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#C9BBA8';
    g.fillRect(0, 0, w, h);
    for (var i = 0; i < 700; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.10).toFixed(3) + ')';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = 'rgba(74,59,46,.55)';
    g.font = '14px -apple-system, "PingFang SC", sans-serif';
    g.textAlign = 'center';
    g.fillText('用手指或鼠标刮开', w / 2, h / 2 + 5);

    g.globalCompositeOperation = 'destination-out';
    cv.classList.remove('done');
    $('scratchText').textContent = todayCard();
    scratchMoves = 0;
    return true;
  }

  function scratchAt(cv, clientX, clientY) {
    var g = cv.getContext('2d');
    var r = cv.getBoundingClientRect();
    var x = clientX - r.left, y = clientY - r.top;
    g.beginPath();
    g.arc(x, y, 22, 0, Math.PI * 2);
    g.fill();

    /* 采样检测比较贵，每 5 次移动才查一次 */
    scratchMoves++;
    if (scratchMoves % 5) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = g.getImageData(0, 0, cv.width, cv.height).data;
    var clear = 0, step = 64;
    for (var i = 3; i < px.length; i += 4 * step) if (px[i] < 40) clear++;
    var total = Math.floor(px.length / (4 * step));
    if (total > 0 && clear / total > 0.42) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      g.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
      cv.classList.add('done');
      replay($('scratchText'), 'pop-in');
    }
  }

  (function bindScratch() {
    var cv = $('scratchCv');
    var down = false;
    cv.addEventListener('pointerdown', function (e) {
      down = true;
      if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
      scratchAt(cv, e.clientX, e.clientY);
    });
    cv.addEventListener('pointermove', function (e) { if (down) scratchAt(cv, e.clientX, e.clientY); });
    cv.addEventListener('pointerup', function () { down = false; });
    cv.addEventListener('pointercancel', function () { down = false; });
  })();

  $('scratchNew').addEventListener('click', function () { if (initScratch()) toast('换了一张新的'); });

  /* =========================================================================
     8.4 游戏四：爱心手速 PK
     ========================================================================= */
  var tap = { running: false, score: 0, combo: 0, spawnId: null, rafId: null, end: 0 };

  function renderTapBoard() {
    var box = $('tapBoard');
    box.innerHTML = '';
    if (!tapScores.length) return;
    tapScores.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 5).forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'tap-row' + (i === 0 ? ' top' : '');
      row.style.animationDelay = i * 45 + 'ms';
      var rk = document.createElement('span'); rk.className = 'rank'; rk.textContent = '#' + (i + 1);
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      var sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = r.score;
      row.appendChild(rk); row.appendChild(nm); row.appendChild(sc);
      box.appendChild(row);
    });
  }

  function spawnHeart() {
    var stage = $('tapStage');
    if (!tap.running) return;
    if (stage.querySelectorAll('.heart').length > 9) return;
    var h = document.createElement('div');
    h.className = 'heart';
    h.textContent = C.pick(['💛', '🧡', '💖', '✨']);
    var w = 36, sw = stage.clientWidth, sh = stage.clientHeight;
    h.style.left = Math.max(4, Math.random() * (sw - w - 8)) + 'px';
    h.style.top = Math.max(4, Math.random() * (sh - w - 8)) + 'px';
    h.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      if (!tap.running) return;
      tap.score += 1 + (tap.combo >= 5 ? 2 : tap.combo >= 3 ? 1 : 0);
      tap.combo += 1;
      $('tapScore').textContent = tap.score;
      $('tapCombo').textContent = tap.combo;
      h.classList.add('gone');
      burst(e.clientX, e.clientY, ['✨', '💛'], 5);
      setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 220);
    });
    stage.appendChild(h);
    setTimeout(function () {
      if (h.parentNode && !h.classList.contains('gone')) {
        h.parentNode.removeChild(h);
        tap.combo = 0;
        $('tapCombo').textContent = '0';
      }
    }, 2600);
  }

  function startTap() {
    if (tap.running) return;
    var stage = $('tapStage');
    stage.innerHTML = '';
    tap.running = true; tap.score = 0; tap.combo = 0;
    $('tapScore').textContent = '0';
    $('tapCombo').textContent = '0';

    var dur = cfg.tap.duration;
    tap.end = Date.now() + dur * 1000;
    (function loop() {
      if (!tap.running) return;
      var left = tap.end - Date.now();
      $('tapTime').textContent = Math.max(0, left / 1000).toFixed(1);
      if (left <= 0) { endTap(); return; }
      tap.rafId = requestAnimationFrame(loop);
    })();

    var gap = Math.max(360, Math.round(dur * 1000 / 46));
    tap.spawnId = setInterval(spawnHeart, gap);
    spawnHeart();
  }

  function endTap() {
    tap.running = false;
    clearInterval(tap.spawnId);
    cancelAnimationFrame(tap.rafId);
    $('tapTime').textContent = '0.0';

    var stage = $('tapStage');
    stage.innerHTML = '';
    var ready = document.createElement('div');
    ready.className = 'tap-ready';
    var p = document.createElement('p');
    p.textContent = '本轮得分 ' + tap.score + ' 分';
    var btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '再来一次';
    btn.addEventListener('click', startTap);
    ready.appendChild(p); ready.appendChild(btn);
    stage.appendChild(ready);

    var score = tap.score;
    askName('这一轮是谁的成绩？', nickB(), function (who) {
      tapScores.push({ name: who, score: score, at: Date.now() });
      tapScores.sort(function (a, b) { return b.score - a.score; });
      tapScores = tapScores.slice(0, 20);
      C.store.set(K.tap, tapScores);
      renderTapBoard();
      toast('已记录：' + who + ' ' + score + ' 分');
    });
  }

  $('tapStart').addEventListener('click', startTap);
  $('tapClear').addEventListener('click', function () {
    if (!window.confirm('清空所有人的战绩？')) return;
    tapScores = [];
    C.store.remove(K.tap);
    renderTapBoard();
    toast('战绩已清空');
  });

  /* =========================================================================
     8.5 游戏五：十秒挑战
     ========================================================================= */
  var ten = { running: false, t0: 0, raf: 0 };

  function tenTarget() { return cfg.ten.target; }

  function tenTick() {
    if (!ten.running) return;
    $('tenNum').textContent = ((performance.now() - ten.t0) / 1000).toFixed(2);
    ten.raf = requestAnimationFrame(tenTick);
  }

  function resetTenDisplay() {
    $('tenNum').textContent = tenTarget().toFixed(2);
    $('tenHint').textContent = '准备好了就点“开始数”';
    $('tenStart').disabled = false;
    $('tenStop').disabled = true;
  }

  function renderTenBoard() {
    var box = $('tenBoard');
    box.innerHTML = '';
    if (!tenScores.length) return;

    var latest = {}, order = [];
    tenScores.forEach(function (r) {
      if (!(r.name in latest)) order.push(r.name);
      latest[r.name] = r;
    });

    order.forEach(function (n, i) {
      var r = latest[n];
      var rate = C.rateTenSec(r.value - tenTarget(), tenTarget());
      var row = document.createElement('div');
      row.className = 'soft-row';
      row.style.animationDelay = i * 45 + 'ms';
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = n;
      var sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = r.value.toFixed(2) + ' 秒';
      var tg = document.createElement('span'); tg.className = 'tg'; tg.textContent = rate.title;
      row.appendChild(nm); row.appendChild(sc); row.appendChild(tg);
      box.appendChild(row);
    });

    if (order.length >= 2) {
      var a = latest[order[0]], b = latest[order[1]];
      var sync = C.rateSync(a.value - b.value);
      var note = document.createElement('div');
      note.className = 'soft-note';
      var t = document.createElement('div');
      t.innerHTML = '两人相差 <b>' + Math.abs(a.value - b.value).toFixed(2) + '</b> 秒 · <b>' + sync.title + '</b>';
      var s = document.createElement('span');
      s.textContent = sync.desc;
      note.appendChild(t); note.appendChild(s);
      box.appendChild(note);
    }
  }

  $('tenStart').addEventListener('click', function () {
    ten.running = true;
    ten.t0 = performance.now();
    $('tenStart').disabled = true;
    $('tenStop').disabled = false;
    $('tenHint').textContent = '现在开始，在心里数：1、2、3……';
    tenTick();
  });

  $('tenStop').addEventListener('click', function () {
    if (!ten.running) return;
    ten.running = false;
    cancelAnimationFrame(ten.raf);
    var got = (performance.now() - ten.t0) / 1000;
    var target = tenTarget();
    $('tenStart').disabled = false;
    $('tenStop').disabled = true;
    $('tenNum').textContent = got.toFixed(2);

    var err = got - target;
    var rate = C.rateTenSec(err, target);
    $('tenHint').textContent = '你的 ' + target + ' 秒是 ' + got.toFixed(2) + ' 秒，' +
      (err >= 0 ? '慢了 ' : '快了 ') + Math.abs(err).toFixed(2) + ' 秒 · ' + rate.title;

    var value = +got.toFixed(3);
    askName('这是谁的成绩？', nickB(), function (who) {
      tenScores.push({ name: who, value: value, at: Date.now() });
      tenScores = tenScores.slice(-20);
      C.store.set(K.ten, tenScores);
      renderTenBoard();
      toast('已记录：' + who + ' ' + value.toFixed(2) + ' 秒');
    });
  });

  $('tenClear').addEventListener('click', function () {
    if (!window.confirm('清空十秒挑战的记录？')) return;
    tenScores = [];
    C.store.remove(K.ten);
    renderTenBoard();
    resetTenDisplay();
    toast('记录已清空');
  });

  /* =========================================================================
     8.6 游戏六：记忆翻牌
     ========================================================================= */
  var mem = { deck: [], open: [], done: [], moves: 0, pairs: 0, useWords: false, lock: false };

  function memItems() {
    var words = cfg.memory.words, emo = cfg.memory.emoji;
    if (mem.useWords && words.length >= 2) return C.limitList(words);
    return C.limitList(emo.length >= 2 ? emo : DEFAULTS.memory.emoji);
  }

  function memCols(cards) {
    return Math.max(2, Math.min(10, Math.ceil(Math.sqrt(cards))));
  }

  function buildDeck() {
    var items = memItems();
    mem.pairs = items.length;
    mem.deck = C.shuffle(items.concat(items)).map(function (v, i) { return { id: i, v: v }; });
    mem.open = []; mem.done = []; mem.moves = 0; mem.lock = false;
  }

  function renderMem() {
    var grid = $('memGrid');
    grid.innerHTML = '';
    var cols = memCols(mem.deck.length);
    grid.style.setProperty('--mem-cols', cols);
    grid.classList.toggle('dense', cols >= 6);

    $('memMoves').textContent = mem.moves;
    $('memPairs').textContent = (mem.done.length / 2) + ' / ' + mem.pairs;
    var best = memBest[mem.pairs];
    $('memBest').textContent = best ? best + ' 步' : '—';
    $('memMode').textContent = mem.useWords ? '换成图案' : '换成我们的词';
    $('memMode').disabled = !(cfg.memory.words.length >= 2) && !mem.useWords;

    mem.deck.forEach(function (card, i) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'mem-card';
      var isOpen = mem.open.indexOf(i) >= 0;
      var isDone = mem.done.indexOf(i) >= 0;
      /* 已配对的静态展示；刚翻开的才播动画，否则每次重绘都会集体重播 */
      if (isDone) el.classList.add('open', 'done');
      else if (isOpen) el.classList.add('open', 'just');
      el.textContent = (isOpen || isDone) ? card.v : '';
      if (mem.useWords && (isOpen || isDone)) el.classList.add('word');
      el.setAttribute('aria-label', '第 ' + (i + 1) + ' 张牌');
      el.addEventListener('click', function () { flip(i); });
      grid.appendChild(el);
    });
  }

  function flip(i) {
    if (mem.lock) return;
    if (mem.done.indexOf(i) >= 0 || mem.open.indexOf(i) >= 0) return;
    mem.open.push(i);
    if (mem.open.length < 2) { renderMem(); return; }

    mem.moves++;
    var a = mem.open[0], b = mem.open[1];
    renderMem();

    if (mem.deck[a].v === mem.deck[b].v) {
      mem.done.push(a, b);
      mem.open = [];
      renderMem();
      if (mem.done.length === mem.deck.length) {
        var cur = memBest[mem.pairs];
        if (!cur || mem.moves < cur) {
          memBest[mem.pairs] = mem.moves;
          saveMemBest();
          toast('新纪录！' + mem.moves + ' 步完成');
          if (!reduced()) {
            var r = $('memGrid').getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height / 2, ['🎉', '💛', '✨'], 18);
          }
        } else {
          toast('完成！用了 ' + mem.moves + ' 步');
        }
        renderMem();
      }
    } else {
      mem.lock = true;
      setTimeout(function () { mem.open = []; mem.lock = false; renderMem(); }, 750);
    }
  }

  $('memNew').addEventListener('click', function () { buildDeck(); renderMem(); });

  $('memMode').addEventListener('click', function () {
    if (mem.useWords) {
      mem.useWords = false;
      $('memWords').hidden = true;
      buildDeck(); renderMem();
      return;
    }
    if (!(cfg.memory.words.length >= 2)) {
      $('memWords').hidden = false;
      replay($('memWords'), 'pop-in');
      return;
    }
    mem.useWords = true;
    $('memWords').hidden = true;
    buildDeck(); renderMem();
    toast('已经换成你们的词了');
  });

  $('memWordsBack').addEventListener('click', function () {
    mem.useWords = false;
    $('memWords').hidden = true;
    buildDeck(); renderMem();
  });

  $('memOpenCfg').addEventListener('click', function () { openSettings('content'); });

  /* =========================================================================
     8.7 游戏七：你画我猜
     ========================================================================= */
  var DRAW_COLORS = ['#4A3B2E', '#E8907E', '#E8A05C', '#8FBFA8', '#6E8FC7', '#C58FC7'];

  var draw = {
    ctx: null, cv: null, dpr: 1, w: 0, h: 0,
    drawing: false, color: DRAW_COLORS[0], erasing: false,
    history: [], timer: 0, left: 60, word: '', sized: false
  };

  function drawDuration() { return cfg.draw.duration; }

  /** 尺寸按容器宽度自适应；preserve=true 时把旧画面搬过去 */
  function sizeCanvas(preserve) {
    var cv = $('drawCv');
    var w = cv.parentNode.clientWidth;
    if (!w) return false;
    var h = Math.max(200, Math.min(360, Math.round(w * 0.62)));
    var old = null;
    if (preserve && draw.ctx && draw.cv) {
      try { old = draw.ctx.getImageData(0, 0, draw.cv.width, draw.cv.height); } catch (e) { old = null; }
    }
    draw.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * draw.dpr);
    cv.height = Math.round(h * draw.dpr);
    cv.style.height = h + 'px';
    var g = cv.getContext('2d');
    g.setTransform(draw.dpr, 0, 0, draw.dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    draw.ctx = g; draw.cv = cv; draw.w = w; draw.h = h; draw.sized = true;
    if (old) { try { g.putImageData(old, 0, 0); } catch (e) { /* 忽略 */ } }
    return true;
  }

  function clearCanvas(saveHistory) {
    if (!draw.ctx) return;
    if (saveHistory) pushHistory();
    draw.ctx.clearRect(0, 0, draw.w, draw.h);
  }

  function pushHistory() {
    if (!draw.ctx) return;
    try {
      draw.history.push(draw.ctx.getImageData(0, 0, draw.cv.width, draw.cv.height));
      if (draw.history.length > 20) draw.history.shift();
    } catch (e) { /* 忽略画布安全异常 */ }
  }

  function undoDraw() {
    if (!draw.ctx || !draw.history.length) return;
    draw.ctx.putImageData(draw.history.pop(), 0, 0);
  }

  function posOf(e) {
    var r = draw.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  (function bindDraw() {
    var cv = $('drawCv');
    var up = function () { draw.drawing = false; };
    cv.addEventListener('pointerdown', function (e) {
      if (!draw.ctx) return;
      draw.drawing = true;
      pushHistory();
      var p = posOf(e);
      draw.ctx.beginPath();
      draw.ctx.moveTo(p.x, p.y);
      if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!draw.drawing || !draw.ctx) return;
      var p = posOf(e);
      draw.ctx.strokeStyle = draw.erasing ? 'rgba(0,0,0,0)' : draw.color;
      draw.ctx.globalCompositeOperation = draw.erasing ? 'destination-out' : 'source-over';
      draw.ctx.lineWidth = draw.erasing ? 22 : 4;
      draw.ctx.lineTo(p.x, p.y);
      draw.ctx.stroke();
    });
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', up);
  })();

  (function buildPalette() {
    var box = $('drawPalette');
    DRAW_COLORS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (i === 0 ? ' on' : '');
      b.style.background = c;
      b.setAttribute('aria-label', '颜色 ' + (i + 1));
      b.addEventListener('click', function () {
        draw.color = c;
        draw.erasing = false;
        $('drawErase').classList.remove('on');
        each(box.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      box.appendChild(b);
    });
  })();

  $('drawErase').addEventListener('click', function () {
    draw.erasing = !draw.erasing;
    this.classList.toggle('on', draw.erasing);
  });
  $('drawUndo').addEventListener('click', undoDraw);
  $('drawClear').addEventListener('click', function () { clearCanvas(true); });

  function newWord() {
    var pool = cfg.draw.words;
    draw.word = pool.length ? C.pick(pool) : '（没有词了）';
    $('drawWord').textContent = draw.word;
    replay($('drawWord'), 'pop-in');
  }

  function stopDrawTimer() { clearInterval(draw.timer); draw.timer = 0; }

  function startDrawTimer() {
    stopDrawTimer();
    draw.left = drawDuration();
    $('drawTime').textContent = draw.left;
    draw.timer = setInterval(function () {
      draw.left--;
      $('drawTime').textContent = Math.max(0, draw.left);
      if (draw.left <= 0) { stopDrawTimer(); $('drawDone').click(); }
    }, 1000);
  }

  $('drawNewWord').addEventListener('click', newWord);
  $('drawDone').addEventListener('click', function () {
    stopDrawTimer();
    $('drawVeil').hidden = false;
    replay($('drawVeil'), 'fade-in');
  });
  $('drawReveal').addEventListener('click', function () {
    var old = draw.word;
    $('drawVeil').hidden = true;
    clearCanvas(true);
    newWord();
    toast('刚才画的是：' + old + ' · 已换新题');
    startDrawTimer();
  });

  /* 视口变化时重排画布（保留画面） */
  window.addEventListener('resize', debounce(function () {
    if (!draw.sized || $('panel-draw').hidden) return;
    sizeCanvas(true);
  }, 260));

  /* =========================================================================
     8.8 游戏八：真心话大冒险
     ========================================================================= */
  var tdUsed = { truth: [], dare: [] };
  var tdMode = 'truth';

  function tdPool(kind) { return cfg.truth[kind] || []; }

  $('tdDraw').addEventListener('click', function () {
    var kind = tdMode;
    if (kind === 'any') kind = Math.random() < 0.5 ? 'truth' : 'dare';
    var pool = tdPool(kind);
    if (!pool.length) { toast('题库是空的，去内容配置里加几条'); return; }

    var r = C.drawNoRepeat(pool.length, tdUsed[kind]);
    tdUsed[kind] = r.used;
    $('tdBadge').textContent = kind === 'truth' ? '真心话' : '大冒险';
    $('tdBadge').className = 'td-badge ' + kind;
    $('tdText').textContent = pool[r.index];
    replay($('tdText'), 'pop-in');
    if (r.reset) toast('这一轮抽完啦，重新开始');
  });

  each(qsa('.seg-btn[data-td]'), function (b) {
    b.addEventListener('click', function () {
      tdMode = b.dataset.td;
      each(qsa('.seg-btn[data-td]'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
  });

  $('tdEdit').addEventListener('click', function () {
    var box = $('tdEditBox');
    box.hidden = !box.hidden;
    if (!box.hidden) replay(box, 'pop-in');
  });

  $('tdOpenCfg').addEventListener('click', function () { openSettings('content'); });

  $('tdRestore').addEventListener('click', function () {
    if (!window.confirm('恢复默认题库？自定义内容会丢失。')) return;
    cfg.truth.truth = DEFAULTS.truth.truth.slice();
    cfg.truth.dare = DEFAULTS.truth.dare.slice();
    saveCfg();
    tdUsed = { truth: [], dare: [] };
    $('tdEditBox').hidden = true;
    if (cfgViewOpen()) renderCfg();
    toast('已恢复默认');
  });

  /* =========================================================================
     9. 游戏面板开关
     ========================================================================= */
  each(qsa('.game-card'), function (card) {
    card.addEventListener('click', function () {
      var g = card.dataset.game;
      var panel = $('panel-' + g);
      var wasHidden = panel.hidden;
      each(qsa('.game-panel'), function (p) { p.hidden = true; });

      if (!wasHidden) { panel.hidden = true; return; }   // 再点一次收起
      panel.hidden = false;
      replay(panel, 'view-in');

      if (g === 'wheel') { syncWheelTextarea(); buildWheel(); }
      if (g === 'scratch') { scratchReady = initScratch(); }
      if (g === 'quiz') { renderQuiz(); }
      if (g === 'tap') { renderTapBoard(); $('tapReadyTip').textContent = cfg.tap.duration + ' 秒内点中尽可能多的爱心'; }
      if (g === 'ten') { renderTenBoard(); if (!ten.running) resetTenDisplay(); }
      if (g === 'memory') { if (!mem.deck.length) buildDeck(); renderMem(); }
      if (g === 'draw') {
        if (!draw.sized && sizeCanvas(false)) { newWord(); startDrawTimer(); }
      }

      setTimeout(function () {
        if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });
  });

  each(qsa('[data-close]'), function (b) {
    b.addEventListener('click', function () { $('panel-' + b.dataset.close).hidden = true; });
  });

  /* =========================================================================
     10. 设置 + 内容配置
     ========================================================================= */
  function cfgViewOpen() { return !$('settings').hidden && !$('setPane-content').hidden; }

  function switchSetPane(name) {
    each(qsa('.set-tabs .seg-btn'), function (b) { b.classList.toggle('on', b.dataset.set === name); });
    ['basic', 'content', 'share'].forEach(function (n) {
      $('setPane-' + n).hidden = n !== name;
    });
    if (name === 'content') renderCfg();
    replay($('setPane-' + name), 'view-in');
  }

  function openSettings(pane) {
    if (setup) {
      $('setDate').value = setup.date;
      $('setNickA').value = setup.nickA || '';
      $('setNickB').value = setup.nickB || '';
    }
    $('settings').hidden = false;
    switchSetPane(pane || 'basic');
    replay($('settings').querySelector('.modal-card'), 'pop-in');
  }

  each(qsa('.set-tabs .seg-btn'), function (b) {
    b.addEventListener('click', function () { switchSetPane(b.dataset.set); });
  });

  /* ---------------- 内容配置编辑器（由 schema 生成） ---------------- */
  var CFG_SCHEMA = [
    { path: 'quiz.questions', name: '💌 默契大考验 · 问题', type: 'list', min: 1, def: DEFAULTS.quiz.questions, hint: '一行一个问题' },
    { path: 'wheel.items', name: '🎡 今天听谁的 · 转盘选项', type: 'list', min: 2, def: DEFAULTS.wheel.items, hint: '一行一个，至少 2 个' },
    { path: 'scratch.cards', name: '✨ 刮刮卡 · 内容', type: 'list', min: 1, def: DEFAULTS.scratch.cards, hint: '一行一条' },
    { path: 'tap.duration', name: '💛 爱心手速 · 单局时长', type: 'num', min: 5, max: 120, step: 5, unit: '秒', def: DEFAULTS.tap.duration, hint: '5–120 秒' },
    { path: 'ten.target', name: '⏱ 十秒挑战 · 目标秒数', type: 'num', min: 3, max: 60, step: 1, unit: '秒', def: DEFAULTS.ten.target, hint: '3–60 秒' },
    { path: 'memory.emoji', name: '🧠 记忆翻牌 · 图案库', type: 'list', min: 2, def: DEFAULTS.memory.emoji, hint: '每个图案成一对，最多 50 个（即 100 张牌）' },
    { path: 'memory.words', name: '🧠 记忆翻牌 · 你们的词', type: 'list', min: 0, def: DEFAULTS.memory.words, hint: '留空则只用图案；填了就能在游戏里切换' },
    { path: 'draw.words', name: '🎨 你画我猜 · 词库', type: 'list', min: 1, def: DEFAULTS.draw.words, hint: '一行一个' },
    { path: 'draw.duration', name: '🎨 你画我猜 · 单局时长', type: 'num', min: 15, max: 300, step: 15, unit: '秒', def: DEFAULTS.draw.duration, hint: '15–300 秒' },
    { path: 'truth.truth', name: '🎯 真心话题库', type: 'list', min: 1, def: DEFAULTS.truth.truth, hint: '一行一条' },
    { path: 'truth.dare', name: '🎯 大冒险题库', type: 'list', min: 1, def: DEFAULTS.truth.dare, hint: '一行一条' }
  ];

  /**
   * 列表输入：边打边存。
   * - 超过 50 条：立刻截断（不弹提示，避免打字时刷屏）
   * - 少于下限：不动数据，只把计数标红；失焦时再回滚并提示
   */
  function commitList(it, ta, cnt, blur) {
    var lines = C.splitLines(ta.value, MAX + 1);
    var over = lines.length > MAX;
    if (over) {
      lines = lines.slice(0, MAX);
      ta.value = lines.join('\n');
      toast('最多 ' + MAX + ' 条，已保留前 ' + MAX + ' 条');
    }
    cnt.textContent = lines.length + ' / ' + MAX;
    cnt.classList.toggle('over', lines.length < it.min);

    if (lines.length < it.min) {
      if (!blur) return false;                       // 打字过程中先不管
      var keep = (C.getPath(cfg, it.path) || []).slice();
      ta.value = keep.join('\n');
      cnt.textContent = keep.length + ' / ' + MAX;
      cnt.classList.remove('over');
      toast(it.min === 0 ? '已清空' : '至少需要 ' + it.min + ' 条，已保留原来的内容');
      return false;
    }

    C.setPath(cfg, it.path, lines);
    cnt.classList.remove('over');
    saveCfg();
    applyCfg(it.path);
    return true;
  }

  function renderCfg() {
    var box = $('cfgBox');
    box.innerHTML = '';

    CFG_SCHEMA.forEach(function (it) {
      var sec = document.createElement('div');
      sec.className = 'cfg-item';

      var head = document.createElement('div');
      head.className = 'cfg-head';
      var t = document.createElement('b');
      t.textContent = it.name;
      var cnt = document.createElement('span');
      cnt.className = 'cfg-cnt';
      head.appendChild(t); head.appendChild(cnt);
      sec.appendChild(head);

      if (it.type === 'list') {
        var cur = C.getPath(cfg, it.path) || [];
        var ta = document.createElement('textarea');
        ta.className = 'cfg-ta';
        ta.rows = Math.min(6, Math.max(3, cur.length));
        ta.spellcheck = false;
        ta.value = cur.join('\n');
        ta.placeholder = it.hint || '';
        cnt.textContent = cur.length + ' / ' + MAX;
        /* 计数实时更新；真正落盘/重建游戏状态防抖，避免每敲一个字都写 localStorage */
        var commitSoon = debounce(function () { commitList(it, ta, cnt, false); }, 420);
        ta.addEventListener('input', function () {
          var n = C.splitLines(ta.value, MAX + 1).length;
          cnt.textContent = Math.min(n, MAX) + ' / ' + MAX;
          cnt.classList.toggle('over', n > MAX || n < it.min);
          commitSoon();
        });
        ta.addEventListener('blur', function () { commitList(it, ta, cnt, true); });

        var foot = document.createElement('div');
        foot.className = 'cfg-foot';
        var note = document.createElement('span');
        note.className = 'hint-inline';
        note.textContent = it.hint || '';
        var reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'btn btn-ghost btn-sm';
        reset.textContent = '恢复默认';
        reset.addEventListener('click', function () {
          var def = (it.def || []).slice();
          C.setPath(cfg, it.path, def);
          ta.value = def.join('\n');
          cnt.textContent = def.length + ' / ' + MAX;
          saveCfg();
          applyCfg(it.path);
          toast('已恢复默认');
        });
        foot.appendChild(note); foot.appendChild(reset);
        sec.appendChild(ta); sec.appendChild(foot);
      } else {
        var val = C.getPath(cfg, it.path);
        cnt.textContent = it.hint || '';
        var row = document.createElement('div');
        row.className = 'cfg-num';
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.min = it.min; inp.max = it.max; inp.step = it.step || 1;
        inp.value = val;
        inp.addEventListener('change', function () {
          var v = C.clampInt(inp.value, it.min, it.max, it.def);
          inp.value = v;
          C.setPath(cfg, it.path, v);
          saveCfg();
          applyCfg(it.path);
        });
        var unit = document.createElement('span');
        unit.textContent = it.unit || '';
        var resetN = document.createElement('button');
        resetN.type = 'button';
        resetN.className = 'btn btn-ghost btn-sm';
        resetN.textContent = '恢复默认';
        resetN.addEventListener('click', function () {
          inp.value = it.def;
          C.setPath(cfg, it.path, it.def);
          saveCfg();
          applyCfg(it.path);
        });
        row.appendChild(inp); row.appendChild(unit); row.appendChild(resetN);
        sec.appendChild(row);
      }

      box.appendChild(sec);
    });
  }

  /** 配置改动后，把变化同步到界面上 */
  function applyCfg(path) {
    $('tapCardSub').textContent = cfg.tap.duration + ' 秒，看谁点得多';
    $('tenCardSub').textContent = '心里默数 ' + cfg.ten.target + ' 秒，看谁更准';
    $('drawCardSub').textContent = cfg.draw.duration + ' 秒涂鸦，让 TA 猜猜看';
    $('tapReadyTip').textContent = cfg.tap.duration + ' 秒内点中尽可能多的爱心';
    $('tenTip').textContent = '心里默数 ' + cfg.ten.target + ' 秒，觉得到了就按“停”。两个人各来一次，看看误差和默契。';
    $('memCardSub').textContent = '翻出成对的小事，比谁步数少';

    if (!ten.running) resetTenDisplay();
    if (!draw.timer) $('drawTime').textContent = drawDuration();

    if (path === 'quiz.questions') {
      quiz = { A: [], B: [] };
      saveQuiz();
      if (!$('panel-quiz').hidden) renderQuiz();
      toast('问题已更新，答案已重置');
    }
    if (path === 'wheel.items') {
      syncWheelTextarea();
      buildWheel();
    }
    if (path === 'scratch.cards' && scratchReady) initScratch();
    if (path === 'draw.duration' && draw.timer) startDrawTimer();
    if (path === 'truth.truth' || path === 'truth.dare') tdUsed = { truth: [], dare: [] };
    if (path === 'memory.emoji' || path === 'memory.words') {
      if (mem.useWords && !(cfg.memory.words.length >= 2)) mem.useWords = false;
      buildDeck();
      if (!$('panel-memory').hidden) renderMem();
    }
  }

  $('cfgResetAll').addEventListener('click', function () {
    if (!window.confirm('所有题库和时长都会恢复默认，确定吗？')) return;
    cfg = C.deepMerge(DEFAULTS, null);
    saveCfg();
    renderCfg();
    applyCfg('quiz.questions');
    applyCfg('wheel.items');
    applyCfg('memory.emoji');
    tdUsed = { truth: [], dare: [] };
    if (scratchReady) initScratch();
    toast('已全部恢复默认');
  });

  /* ---------------- 设置：基本 / 分享 / 备份 ---------------- */
  $('btnSettings').addEventListener('click', function () { openSettings('basic'); });

  $('btnShare').addEventListener('click', function () {
    openSettings('share');
    showShare();
  });

  $('setShare').addEventListener('click', showShare);

  $('shareCopy').addEventListener('click', function () {
    var inp = $('shareUrl');
    inp.select();
    inp.setSelectionRange(0, 99999);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inp.value).then(
        function () { toast('已复制链接'); },
        function () { try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('请手动复制'); } }
      );
    } else {
      try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('请手动复制'); }
    }
  });

  each(qsa('[data-close-modal]'), function (b) {
    b.addEventListener('click', function () { $('settings').hidden = true; });
  });

  $('setForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = $('setDate').value;
    var a = $('setNickA').value.trim();
    var b = $('setNickB').value.trim();
    if (!C.parseDate(d)) { toast('请选择一个有效的日期'); return; }
    if (!a || !b) { toast('两个昵称都要填哦'); return; }
    setup = { date: d, nickA: a, nickB: b };
    C.store.set(K.setup, setup);
    $('settings').hidden = true;
    renderAll();
    toast('已保存');
  });

  $('setExport').addEventListener('click', function () {
    var payload = {
      v: 2, setup: setup, annis: annis, quiz: quiz,
      tap: tapScores, ten: tenScores, memBest: memBest, cfg: cfg
    };
    var code = C.encodeBackup(payload);
    if (!code) { toast('导出失败'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        function () { toast('备份口令已复制到剪贴板'); },
        function () { window.prompt('复制这段备份口令：', code); }
      );
    } else {
      window.prompt('复制这段备份口令：', code);
    }
  });

  $('setImport').addEventListener('click', function () {
    var code = $('setImportBox').value.trim();
    if (!code) { toast('先粘贴备份口令'); return; }
    var data = C.decodeBackup(code);
    if (!data || !C.isPlain(data)) { toast('口令无效或已损坏'); return; }
    if (!window.confirm('会用这份备份覆盖本机现在的数据，确定吗？')) return;

    if (C.isPlain(data.setup) && C.parseDate(data.setup.date)) {
      setup = {
        date: data.setup.date,
        nickA: data.setup.nickA || 'TA',
        nickB: data.setup.nickB || '我'
      };
      C.store.set(K.setup, setup);
    }
    if (Array.isArray(data.annis)) {
      annis = C.limitList(data.annis.filter(function (a) { return a && a.title && C.parseDate(a.date); })
        .map(function (a) { return { id: uid(), title: String(a.title).slice(0, 16), date: a.date, yearly: !!a.yearly }; }));
      saveAnni();
    }
    if (C.isPlain(data.quiz)) {
      quiz = { A: [], B: [] };
      if (Array.isArray(data.quiz.A)) quiz.A = data.quiz.A.slice(0, MAX);
      if (Array.isArray(data.quiz.B)) quiz.B = data.quiz.B.slice(0, MAX);
      saveQuiz();
    }
    if (Array.isArray(data.tap)) { tapScores = data.tap.slice(0, 20); C.store.set(K.tap, tapScores); }
    if (Array.isArray(data.ten)) { tenScores = data.ten.slice(-20); C.store.set(K.ten, tenScores); }
    if (C.isPlain(data.memBest)) { memBest = data.memBest; saveMemBest(); }
    if (C.isPlain(data.cfg)) { cfg = C.deepMerge(DEFAULTS, data.cfg); saveCfg(); }

    $('setImportBox').value = '';
    $('settings').hidden = true;
    $('onboard').hidden = true;
    $('app').hidden = false;
    mem.deck = [];
    renderAll();
    toast('已从备份恢复');
  });

  $('setReset').addEventListener('click', function () {
    if (!window.confirm('会清掉计时设置、纪念日、答案、题库和战绩，确定吗？')) return;
    [K.setup, K.anni, K.quiz, K.cfg, K.tap, K.ten, K.memBest, K.ui,
      K.oldWheel, K.oldTruth, K.oldMem].forEach(function (k) { C.store.remove(k); });
    location.reload();
  });

  /* Esc 关闭弹层 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('ask').hidden) { closeAsk(); return; }
    if (!$('settings').hidden) $('settings').hidden = true;
  });

  /* =========================================================================
     11. 启动
     ========================================================================= */
  function renderAll() {
    if (!setup) return;
    document.title = nickA() + ' & ' + nickB();
    startTimer();
    renderAnni();
    renderQuiz();
    renderTapBoard();
    renderTenBoard();
    buildWheel();
    applyCfg('');
    var ui = C.store.get(K.ui, null);
    if (ui && (ui.view === 'games' || ui.view === 'timer')) switchView(ui.view);
  }

  /* 跨天刷新按日内容（刮刮卡）与纪念日 */
  var lastDay = new Date().getDate();
  setInterval(function () {
    var d = new Date().getDate();
    if (d !== lastDay) {
      lastDay = d;
      renderAnni();
      if (scratchReady) initScratch();
    }
  }, 60000);

  /* 回到页面时刷新一次，避免长时间挂后台后数字停住 */
  document.addEventListener('visibilitychange', function () {
    /* 切到后台就冻结背景动效，别白烧电 */
    document.body.classList.toggle('bg-paused', document.hidden);
    if (document.hidden || !setup) return;
    tickTimer();
    renderAnni();
  });

  initOnboard();
})();
