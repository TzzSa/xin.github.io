/* =============================================================================
   app.js —— 交互层（依赖 core.js 提供的 window.LoveCore）
   ============================================================================= */
(function () {
  'use strict';

  var C = window.LoveCore;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 存储键与状态 ---------------- */
  var K = {
    setup: 'love.setup',
    anni: 'love.anniversaries',
    quiz: 'love.quiz',
    wheel: 'love.wheel',
    tap: 'love.tap',
    ten: 'love.ten',
    mem: 'love.mem',
    truth: 'love.truth'
  };

  var setup = C.store.get(K.setup, null);
  var annis = C.store.get(K.anni, []);
  var quiz = C.store.get(K.quiz, { A: [], B: [] });
  var wheelSaved = C.store.get(K.wheel, null);
  var tapScores = C.store.get(K.tap, []);

  if (!quiz || typeof quiz !== 'object') quiz = { A: [], B: [] };
  if (!Array.isArray(quiz.A)) quiz.A = [];
  if (!Array.isArray(quiz.B)) quiz.B = [];
  if (!Array.isArray(annis)) annis = [];
  if (!Array.isArray(tapScores)) tapScores = [];

  /* ---------------- 静态内容 ---------------- */
  var QUESTIONS = [
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
  ];

  var CARDS = [
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
  ];

  var DEFAULT_WHEEL = ['你请客', '我请客', '石头剪刀布', '今天吃火锅', '今天吃面', '你说了算'];
  var WHEEL_COLORS = ['#E8A05C', '#E8907E', '#D98B6F', '#C97B3C', '#E0A87B', '#DB9A6A', '#E79C74', '#CE8A5E'];

  /* ---------------- 小工具 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtDate(d) {
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function saveAnni() { C.store.set(K.anni, annis); }
  function saveQuiz() { C.store.set(K.quiz, quiz); }

  /* =========================================================================
     1. 首次引导
     ========================================================================= */
  function initOnboard() {
    var ob = $('onboard'), app = $('app');
    if (setup && C.parseDate(setup.date)) {
      ob.hidden = true;
      app.hidden = false;
      renderAll();
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
     2. 视图切换
     ========================================================================= */
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.remove('on'); });
      btn.classList.add('on');
      var v = btn.dataset.view;
      $('view-timer').hidden = v !== 'timer';
      $('view-games').hidden = v !== 'games';
    });
  });

  /* =========================================================================
     3. 恋爱计时器
     ========================================================================= */
  var timerId = null;

  function tickTimer() {
    if (!setup) return;
    var start = C.parseDate(setup.date);
    var now = new Date();
    var p = C.diffParts(start, now);

    if (p.negative) {
      $('dDays').textContent = '0';
      $('dHours').textContent = $('dMins').textContent = $('dSecs').textContent = '00';
      $('dayShort').textContent = '0';
      $('dSince').textContent = '这一天还没到，' + fmtDate(start) + ' 开始计时';
      return;
    }

    $('dDays').textContent = p.days;
    $('dHours').textContent = pad2(p.hours);
    $('dMins').textContent = pad2(p.minutes);
    $('dSecs').textContent = pad2(p.seconds);
    $('dayShort').textContent = p.days;
    $('dSince').textContent = fmtDate(start);
  }

  function startTimer() {
    clearInterval(timerId);
    tickTimer();
    timerId = setInterval(tickTimer, 1000);
  }

  /* =========================================================================
     4. 纪念日
     ========================================================================= */
  function nextOf(a) { return C.nextOccurrence(a.date, a.yearly, new Date()); }

  function sortedAnnis() {
    var now = new Date();
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

    /* 大卡片 */
    if (nextAnni) {
      var nd = nextOf(nextAnni);
      var left = C.daysUntil(nd, now);
      $('anniLeft').textContent = left;
      $('anniName').textContent = nextAnni.title;
      $('anniDate').textContent = fmtDate(nd) + (nextAnni.yearly ? ' · 每年' : ' · 仅此一次');
      var prog = C.anniversaryProgress(nextAnni.date, nextAnni.yearly, now, setup ? setup.date : null);
      var CIRC = 326.7;
      $('ringFg').style.strokeDashoffset = CIRC * (1 - prog);
    } else {
      $('anniLeft').textContent = '—';
      $('anniName').textContent = annis.length ? '都过完啦，再加一个吧' : '还没有纪念日';
      $('anniDate').textContent = annis.length ? '等待新的期待' : '点右上角添加一个吧';
      $('ringFg').style.strokeDashoffset = 326.7;
    }

    /* 列表 */
    var ul = $('anniList');
    ul.innerHTML = '';
    if (!list.length) {
      var li0 = document.createElement('li');
      li0.className = 'anni-empty';
      li0.textContent = '还没有添加纪念日';
      ul.appendChild(li0);
      return;
    }

    list.forEach(function (a) {
      var nd = nextOf(a);
      var li = document.createElement('li');
      li.className = 'anni-item';

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
        var left = C.daysUntil(nd, now);
        cb.textContent = left === 0 ? '今天' : left;
        cs.textContent = left === 0 ? '就是今天' : '天后';
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
    var f = $('anniForm');
    f.hidden = !f.hidden;
    if (!f.hidden) { $('anniTitle').focus(); $('anniDateInput').value = new Date().toISOString().slice(0, 10); }
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
    annis.push({ id: uid(), title: t, date: d, yearly: $('anniYearly').checked });
    saveAnni();
    $('anniForm').reset();
    $('anniForm').hidden = true;
    renderAnni();
    toast('已添加「' + t + '」');
  });

  /* =========================================================================
     5. 游戏一：默契大考验
     ========================================================================= */
  var quizWho = 'A';

  function renderQuiz() {
    var ol = $('quizList');
    ol.innerHTML = '';
    var mine = quiz[quizWho] || [];

    QUESTIONS.forEach(function (q, i) {
      var li = document.createElement('li');
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
      inp.dataset.idx = i;
      inp.addEventListener('input', function () {
        if (!quiz[quizWho]) quiz[quizWho] = [];
        quiz[quizWho][i] = inp.value;
        saveQuiz();
      });
      wrap.appendChild(p); wrap.appendChild(inp);

      li.appendChild(n); li.appendChild(wrap);
      ol.appendChild(li);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.seg-btn[data-who]'), function (b) {
      b.classList.toggle('on', b.dataset.who === quizWho);
      b.textContent = b.dataset.who === 'A'
        ? (setup && setup.nickA ? setup.nickA : 'TA')
        : (setup && setup.nickB ? setup.nickB : '我');
    });

    renderQuizResult();
  }

  function filled(arr) {
    return (arr || []).filter(function (x) { return C.normalize(x) !== ''; }).length;
  }

  function renderQuizResult() {
    var box = $('quizResult');
    var ca = filled(quiz.A), cb2 = filled(quiz.B);

    if (ca === 0 || cb2 === 0) {
      box.hidden = true;
      if (ca > 0 && cb2 === 0) {
        box.hidden = false;
        box.innerHTML = '';
        var tip = document.createElement('div');
        tip.className = 'result-score';
        tip.innerHTML = '<p>已经收到一方的答案啦，换另一个人来答，就能看到默契度 ✨</p>';
        box.appendChild(tip);
      }
      return;
    }

    var r = C.calcCompatibility(quiz.A.map(function (x, i) { return x || ''; }).slice(0, QUESTIONS.length),
      quiz.B.map(function (x, i) { return x || ''; }).slice(0, QUESTIONS.length));
    // 补齐长度，避免某一方中途新增题目导致数组偏短
    while (r.details.length < QUESTIONS.length) {
      r.details.push({ index: r.details.length, a: '', b: '', same: false, partial: false, score: 0, counted: false });
    }

    box.hidden = false;
    box.innerHTML = '';

    var head = document.createElement('div');
    head.className = 'result-score';
    var comment = r.percent >= 80 ? '心有灵犀，说的就是你们'
      : r.percent >= 60 ? '相当不错，剩下的是惊喜'
        : r.percent >= 35 ? '有点意思，回去互相补课吧'
          : '嗯……今晚得好好聊聊了';
    head.innerHTML = '<b>' + r.percent + '%</b><span>默契度 · 共 ' + r.answered + ' 题可比</span><p>' + comment + '</p>';
    box.appendChild(head);

    r.details.forEach(function (d) {
      var item = document.createElement('div');
      item.className = 'cmp-item';

      var q = document.createElement('div');
      q.className = 'cmp-q';
      q.textContent = (d.index + 1) + '. ' + QUESTIONS[d.index];
      item.appendChild(q);

      [[setup && setup.nickA || 'TA', d.a], [setup && setup.nickB || '我', d.b]].forEach(function (pair) {
        var bx = document.createElement('div');
        bx.className = 'cmp-box' + (pair[1] ? '' : ' empty');
        if (d.counted && d.same) bx.className = 'cmp-box hit';
        else if (d.counted && d.partial) bx.className = 'cmp-box partial';
        var s = document.createElement('span');
        s.textContent = pair[0];
        var bEl = document.createElement('b');
        bEl.textContent = pair[1] ? pair[1] : '（未填）';
        bx.appendChild(s); bx.appendChild(bEl);
        item.appendChild(bx);
      });

      box.appendChild(item);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.seg-btn[data-who]'), function (b) {
    b.addEventListener('click', function () {
      quizWho = b.dataset.who;
      renderQuiz();
    });
  });

  $('quizSubmit').addEventListener('click', function () {
    var n = filled(quiz[quizWho]);
    if (n === 0) { toast('至少写一道题的答案吧'); return; }
    var other = quizWho === 'A' ? 'B' : 'A';
    var otherName = other === 'A' ? (setup && setup.nickA || 'TA') : (setup && setup.nickB || '我');
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
     6. 游戏二：转盘
     ========================================================================= */
  var wheelRotation = 0, wheelSpinning = false;
  var wheelItems = (wheelSaved && wheelSaved.length >= 2) ? wheelSaved.slice(0, 8) : DEFAULT_WHEEL.slice();

  function buildWheel() {
    var el = $('wheel');
    el.innerHTML = '';
    var n = wheelItems.length;
    var seg = 360 / n;

    var stops = [];
    for (var i = 0; i < n; i++) {
      var c1 = WHEEL_COLORS[i % WHEEL_COLORS.length];
      stops.push(c1 + ' ' + (i * seg) + 'deg ' + ((i + 1) * seg) + 'deg');
    }
    el.style.background = 'conic-gradient(' + stops.join(',') + ')';

    wheelItems.forEach(function (txt, i) {
      var lab = document.createElement('div');
      lab.className = 'wheel-seg';
      var angle = i * seg + seg / 2;
      var R = 96;
      lab.style.width = '50%';
      lab.style.height = '26px';
      lab.style.marginLeft = '0';
      lab.style.marginTop = '-13px';
      lab.style.transform = 'rotate(' + angle + 'deg) translate(' + R + 'px, 0)';
      lab.style.transformOrigin = '0 50%';
      lab.style.justifyContent = 'flex-end';
      lab.style.textShadow = '0 1px 2px rgba(90,60,30,.35)';
      lab.textContent = txt;
      el.appendChild(lab);
    });

    el.style.transform = 'rotate(' + wheelRotation + 'deg)';
  }

  function saveWheel() { C.store.set(K.wheel, wheelItems); }

  $('wheelItems').value = wheelItems.join('\n');

  $('wheelSpin').addEventListener('click', function () {
    if (wheelSpinning) return;
    var lines = $('wheelItems').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (lines.length < 2) { toast('至少填两个选项'); return; }
    if (lines.length > 8) { toast('最多 8 个选项'); return; }
    wheelItems = lines.slice(0, 8);
    saveWheel();
    buildWheel();

    var n = wheelItems.length, seg = 360 / n;
    var k = Math.floor(Math.random() * n);
    var targetMod = (360 - (k * seg + seg / 2)) % 360;
    var cur = ((wheelRotation % 360) + 360) % 360;
    var delta = targetMod - cur;
    if (delta < 0) delta += 360;

    wheelSpinning = true;
    wheelRotation += 360 * 5 + delta;
    $('wheel').style.transform = 'rotate(' + wheelRotation + 'deg)';
    $('wheelResult').hidden = true;

    setTimeout(function () {
      wheelSpinning = false;
      var r = $('wheelResult');
      r.hidden = false;
      r.textContent = '结果是：' + wheelItems[k];
    }, 4300);
  });

  $('wheelReset').addEventListener('click', function () {
    wheelItems = DEFAULT_WHEEL.slice();
    $('wheelItems').value = wheelItems.join('\n');
    saveWheel();
    buildWheel();
    $('wheelResult').hidden = true;
    toast('已恢复默认选项');
  });

  $('wheelItems').addEventListener('change', function () {
    var lines = $('wheelItems').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (lines.length >= 2 && lines.length <= 8) {
      wheelItems = lines; saveWheel(); buildWheel();
    }
  });

  /* =========================================================================
     7. 游戏三：刮刮卡
     ========================================================================= */
  var scratchReady = false;

  function todayCard() {
    return CARDS[C.dailyIndex(CARDS.length, new Date(), 'scratch')];
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
    g.scale(dpr, dpr);

    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#C9BBA8';
    g.fillRect(0, 0, w, h);
    // 细微纹理，让刮层不像纯色块
    for (var i = 0; i < 900; i++) {
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
    return true;
  }

  function scratchAt(cv, clientX, clientY) {
    var g = cv.getContext('2d');
    var r = cv.getBoundingClientRect();
    var x = clientX - r.left, y = clientY - r.top;
    g.beginPath();
    g.arc(x, y, 22, 0, Math.PI * 2);
    g.fill();

    // 抽样统计已刮开比例
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = g.getImageData(0, 0, cv.width, cv.height).data;
    var clear = 0, step = 40;                       // 每 10 个像素抽 1 个
    for (var i = 3; i < px.length; i += 4 * step) {
      if (px[i] < 40) clear++;
    }
    var total = px.length / (4 * step);
    if (total > 0 && clear / total > 0.42) {
      g.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
      cv.classList.add('done');
    }
  }

  (function bindScratch() {
    var cv = $('scratchCv');
    var down = false;
    cv.addEventListener('pointerdown', function (e) { down = true; cv.setPointerCapture(e.pointerId); scratchAt(cv, e.clientX, e.clientY); });
    cv.addEventListener('pointermove', function (e) { if (down) scratchAt(cv, e.clientX, e.clientY); });
    cv.addEventListener('pointerup', function () { down = false; });
    cv.addEventListener('pointercancel', function () { down = false; });
  })();

  $('scratchNew').addEventListener('click', function () {
    if (initScratch()) toast('换了一张新的');
  });

  /* =========================================================================
     8. 游戏四：爱心手速 PK
     ========================================================================= */
  var tap = { running: false, score: 0, combo: 0, endAt: 0, spawnId: null, rafId: null };

  function renderTapBoard() {
    var box = $('tapBoard');
    box.innerHTML = '';
    if (!tapScores.length) return;
    tapScores.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 5).forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'tap-row' + (i === 0 ? ' top' : '');
      var rk = document.createElement('span'); rk.className = 'rank'; rk.textContent = '#' + (i + 1);
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      var sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = r.score;
      row.appendChild(rk); row.appendChild(nm); row.appendChild(sc);
      box.appendChild(row);
    });
  }

  function spawnHeart() {
    var stage = $('tapStage');
    var h = document.createElement('div');
    h.className = 'heart';
    h.textContent = ['💛', '🧡', '💖', '✨'][Math.floor(Math.random() * 4)];
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

    var DUR = 30000;
    var end = Date.now() + DUR;

    (function loop() {
      if (!tap.running) return;
      var left = end - Date.now();
      $('tapTime').textContent = Math.max(0, left / 1000).toFixed(1);
      if (left <= 0) { endTap(); return; }
      tap.rafId = requestAnimationFrame(loop);
    })();

    tap.spawnId = setInterval(spawnHeart, 620);
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

    var meName = setup && setup.nickB ? setup.nickB : '我';
    var who = window.prompt('这一轮是谁的成绩？', meName);
    if (who && who.trim()) {
      tapScores.push({ name: who.trim().slice(0, 12), score: tap.score, at: Date.now() });
      tapScores.sort(function (a, b) { return b.score - a.score; });
      tapScores = tapScores.slice(0, 20);
      C.store.set(K.tap, tapScores);
      renderTapBoard();
      toast('已记录：' + who.trim() + ' ' + tap.score + ' 分');
    }
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
  var tenScores = C.store.get(K.ten, []);
  if (!Array.isArray(tenScores)) tenScores = [];

  function tenTick() {
    if (!ten.running) return;
    $('tenNum').textContent = ((performance.now() - ten.t0) / 1000).toFixed(2);
    ten.raf = requestAnimationFrame(tenTick);
  }

  function renderTenBoard() {
    var box = $('tenBoard');
    box.innerHTML = '';
    if (!tenScores.length) return;

    // 每人保留最近一次成绩
    var latest = {}, order = [];
    tenScores.forEach(function (r) {
      if (!(r.name in latest)) order.push(r.name);
      latest[r.name] = r;
    });

    order.forEach(function (n) {
      var r = latest[n];
      var err = r.value - 10;
      var rate = C.rateTenSec(err);
      var row = document.createElement('div');
      row.className = 'soft-row';
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = n;
      var sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = r.value.toFixed(2) + ' 秒';
      var tg = document.createElement('span'); tg.className = 'tg'; tg.textContent = rate.title;
      row.appendChild(nm); row.appendChild(sc); row.appendChild(tg);
      box.appendChild(row);
    });

    // 两人都有成绩时，给出同步评级
    if (order.length >= 2) {
      var a = latest[order[0]], b = latest[order[1]];
      var sync = C.rateSync(a.value - b.value);
      var note = document.createElement('div');
      note.className = 'soft-note';
      note.innerHTML = '两人相差 <b>' + Math.abs(a.value - b.value).toFixed(2) + '</b> 秒 · <b>' +
        sync.title + '</b><span>' + sync.desc + '</span>';
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
    $('tenStart').disabled = false;
    $('tenStop').disabled = true;
    $('tenNum').textContent = got.toFixed(2);

    var err = got - 10;
    var rate = C.rateTenSec(err);
    $('tenHint').textContent = '你的十秒是 ' + got.toFixed(2) + ' 秒，' +
      (err >= 0 ? '慢了 ' : '快了 ') + Math.abs(err).toFixed(2) + ' 秒 · ' + rate.title;

    var who = window.prompt('这是谁的成绩？', setup && setup.nickB ? setup.nickB : '我');
    if (who && who.trim()) {
      tenScores.push({ name: who.trim().slice(0, 12), value: +got.toFixed(3), at: Date.now() });
      tenScores = tenScores.slice(-20);
      C.store.set(K.ten, tenScores);
      renderTenBoard();
      toast('已记录：' + who.trim() + ' ' + got.toFixed(2) + ' 秒');
    }
  });

  $('tenClear').addEventListener('click', function () {
    if (!window.confirm('清空十秒挑战的记录？')) return;
    tenScores = [];
    C.store.remove(K.ten);
    renderTenBoard();
    $('tenNum').textContent = '10.00';
    $('tenHint').textContent = '准备好了就点“开始数”';
    toast('记录已清空');
  });

  /* =========================================================================
     8.6 游戏六：记忆翻牌
     ========================================================================= */
  var MEMO_EMOJI = ['💍', '🎬', '🍜', '✈️', '🌙', '🎁', '📷', '🐻'];
  var mem = { deck: [], open: [], done: [], moves: 0, mode: 'emoji', words: [], lock: false };
  var memSaved = C.store.get(K.mem, null);
  if (memSaved && Array.isArray(memSaved.words)) mem.words = memSaved.words;

  function buildDeck() {
    var items;
    if (mem.mode === 'word' && mem.words.length >= 2) {
      items = mem.words.slice(0, 8);
    } else {
      mem.mode = 'emoji';
      items = MEMO_EMOJI.slice();
    }
    while (items.length < 8) items.push('❓');
    var pairs = items.slice(0, 8);
    mem.deck = C.shuffle(pairs.concat(pairs)).map(function (v, i) { return { id: i, v: v }; });
    mem.open = []; mem.done = []; mem.moves = 0; mem.lock = false;
  }

  function renderMem() {
    var grid = $('memGrid');
    grid.innerHTML = '';
    $('memMoves').textContent = mem.moves;
    $('memPairs').textContent = (mem.done.length / 2) + ' / 8';
    var best = memSaved && memSaved.best ? memSaved.best : null;
    $('memBest').textContent = best ? best + ' 步' : '—';

    mem.deck.forEach(function (card, i) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'mem-card';
      var isOpen = mem.open.indexOf(i) >= 0;
      var isDone = mem.done.indexOf(i) >= 0;
      if (isOpen || isDone) el.classList.add('open');
      if (isDone) el.classList.add('done');
      el.textContent = (isOpen || isDone) ? card.v : '';
      if (mem.mode === 'word' && (isOpen || isDone)) el.classList.add('word');
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
        var best = (memSaved && memSaved.best) ? memSaved.best : Infinity;
        if (mem.moves < best) {
          memSaved = { best: mem.moves, words: mem.words };
          C.store.set(K.mem, memSaved);
          toast('新纪录！' + mem.moves + ' 步完成');
        } else {
          toast('完成！用了 ' + mem.moves + ' 步');
        }
        renderMem();
      }
    } else {
      mem.lock = true;
      setTimeout(function () {
        mem.open = [];
        mem.lock = false;
        renderMem();
      }, 750);
    }
  }

  $('memNew').addEventListener('click', function () { buildDeck(); renderMem(); });

  $('memMode').addEventListener('click', function () {
    var box = $('memWords');
    box.hidden = !box.hidden;
    if (!box.hidden) {
      $('memWordsInput').value = mem.words.length ? mem.words.join('\n') : '';
      $('memWordsInput').focus();
    }
  });

  $('memWordsSave').addEventListener('click', function () {
    var lines = $('memWordsInput').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (lines.length < 2) { toast('至少写 2 个词'); return; }
    mem.words = lines.slice(0, 8);
    mem.mode = 'word';
    memSaved = { best: (memSaved && memSaved.best) || null, words: mem.words };
    C.store.set(K.mem, memSaved);
    $('memWords').hidden = true;
    buildDeck(); renderMem();
    toast('已经换成你们的词了');
  });

  $('memWordsBack').addEventListener('click', function () {
    mem.mode = 'emoji';
    $('memWords').hidden = true;
    buildDeck(); renderMem();
  });

  /* =========================================================================
     8.7 游戏七：你画我猜
     ========================================================================= */
  var DRAW_WORDS = ['火锅', '长颈鹿', '下雨天', '洗衣机', '摩天轮', '冰箱', '螃蟹', '拖鞋',
    '恐龙', '生日蛋糕', '地铁', '火山', '企鹅', '雨伞', '闹钟', '蜗牛',
    '彩虹', '微波炉', '袋鼠', '热气球', '西瓜', '眼镜', '章鱼', '消防车',
    '雪人', '吉他', '帆船', '洗衣机', '斑马', '爆米花'];
  var DRAW_COLORS = ['#4A3B2E', '#E8907E', '#E8A05C', '#8FBFA8', '#6E8FC7', '#C58FC7'];

  var draw = {
    ctx: null, cv: null, dpr: 1,
    drawing: false, color: DRAW_COLORS[0], erasing: false,
    history: [], timer: 0, left: 60, word: '', sized: false
  };

  function sizeCanvas() {
    var cv = $('drawCv');
    var w = cv.parentNode.clientWidth;
    if (!w) return false;
    var h = 260;
    draw.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * draw.dpr);
    cv.height = Math.round(h * draw.dpr);
    cv.style.height = h + 'px';
    var g = cv.getContext('2d');
    g.setTransform(draw.dpr, 0, 0, draw.dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 4;
    draw.ctx = g; draw.cv = cv; draw.sized = true;
    return true;
  }

  function clearCanvas(saveHistory) {
    if (!draw.ctx) return;
    if (saveHistory) pushHistory();
    draw.ctx.clearRect(0, 0, draw.cv.width, draw.cv.height);
  }

  function pushHistory() {
    if (!draw.ctx) return;
    try {
      var d = draw.ctx.getImageData(0, 0, draw.cv.width, draw.cv.height);
      draw.history.push(d);
      if (draw.history.length > 20) draw.history.shift();
    } catch (e) { /* 忽略跨域等异常 */ }
  }

  function undoDraw() {
    if (!draw.ctx || !draw.history.length) return;
    var d = draw.history.pop();
    draw.ctx.putImageData(d, 0, 0);
  }

  function posOf(e) {
    var r = draw.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  (function bindDraw() {
    var cv = $('drawCv');
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
    var up = function () { draw.drawing = false; };
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
        draw.color = c; draw.erasing = false;
        $('drawErase').classList.remove('on');
        Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); });
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
    draw.word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
    $('drawWord').textContent = draw.word;
  }

  function stopDrawTimer() {
    clearInterval(draw.timer);
    draw.timer = 0;
  }

  function startDrawTimer() {
    stopDrawTimer();
    draw.left = 60;
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
  });

  $('drawReveal').addEventListener('click', function () {
    var old = draw.word;                 // 先留住旧答案，别被换掉了
    $('drawVeil').hidden = true;
    clearCanvas(true);
    newWord();
    toast('刚才画的是：' + old + ' · 已换新题');
    startDrawTimer();
  });

  /* =========================================================================
     8.8 游戏八：真心话大冒险
     ========================================================================= */
  var DEFAULT_TRUTH = [
    '说出第一次心动是在哪一刻',
    '你偷偷为对方做过但没说出口的一件事',
    '对方身上你最羡慕的一个优点',
    '如果我们吵架了，你希望怎么和好',
    '说一件你至今还记得的小事',
    '你最想和对方一起去的地方',
    '你手机里存着对方哪张照片',
    '说一个你从没告诉过对方的小秘密',
    '你觉得我们最像哪部电影里的情侣',
    '对方哪个瞬间让你觉得"就是这个人了"',
    '你最怕我们之间出现什么变化',
    '用三个词形容我们的关系'
  ];
  var DEFAULT_DARE = [
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
    '用方言说一句"我喜欢你"'
  ];

  var tdSaved = C.store.get(K.truth, null);
  var tdLists = {
    truth: (tdSaved && tdSaved.truth && tdSaved.truth.length) ? tdSaved.truth : DEFAULT_TRUTH.slice(),
    dare: (tdSaved && tdSaved.dare && tdSaved.dare.length) ? tdSaved.dare : DEFAULT_DARE.slice()
  };
  var tdUsed = { truth: [], dare: [] };
  var tdMode = 'truth';

  function drawTd() {
    var kind = tdMode;
    if (kind === 'any') kind = Math.random() < 0.5 ? 'truth' : 'dare';
    var pool = tdLists[kind];
    if (!pool || !pool.length) return;

    var r = C.drawNoRepeat(pool.length, tdUsed[kind]);
    tdUsed[kind] = r.used;
    var text = pool[r.index];

    $('tdBadge').textContent = kind === 'truth' ? '真心话' : '大冒险';
    $('tdBadge').className = 'td-badge ' + kind;
    $('tdText').textContent = text;
    if (r.reset) toast('这一轮抽完啦，重新开始');
  }

  Array.prototype.forEach.call(document.querySelectorAll('.seg-btn[data-td]'), function (b) {
    b.addEventListener('click', function () {
      tdMode = b.dataset.td;
      Array.prototype.forEach.call(document.querySelectorAll('.seg-btn[data-td]'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
  });

  $('tdDraw').addEventListener('click', drawTd);

  $('tdEdit').addEventListener('click', function () {
    var box = $('tdEditBox');
    box.hidden = !box.hidden;
    if (!box.hidden) {
      $('tdTruthInput').value = tdLists.truth.join('\n');
      $('tdDareInput').value = tdLists.dare.join('\n');
    }
  });

  $('tdSave').addEventListener('click', function () {
    var t = $('tdTruthInput').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var d = $('tdDareInput').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!t.length && !d.length) { toast('至少写一条吧'); return; }
    tdLists.truth = t.length ? t : DEFAULT_TRUTH.slice();
    tdLists.dare = d.length ? d : DEFAULT_DARE.slice();
    tdUsed = { truth: [], dare: [] };
    C.store.set(K.truth, tdLists);
    $('tdEditBox').hidden = true;
    toast('题库已更新');
  });

  $('tdRestore').addEventListener('click', function () {
    if (!window.confirm('恢复默认题库？自定义内容会丢失。')) return;
    tdLists = { truth: DEFAULT_TRUTH.slice(), dare: DEFAULT_DARE.slice() };
    tdUsed = { truth: [], dare: [] };
    C.store.remove(K.truth);
    $('tdEditBox').hidden = true;
    toast('已恢复默认');
  });

  /* =========================================================================
     9. 游戏面板开关
     ========================================================================= */
  Array.prototype.forEach.call(document.querySelectorAll('.game-card'), function (card) {
    card.addEventListener('click', function () {
      var g = card.dataset.game;
      Array.prototype.forEach.call(document.querySelectorAll('.game-panel'), function (p) { p.hidden = true; });
      var panel = $('panel-' + g);
      panel.hidden = false;

      if (g === 'wheel') { buildWheel(); if (!$('wheelItems').value) $('wheelItems').value = wheelItems.join('\n'); }
      if (g === 'scratch') { scratchReady = initScratch(); }
      if (g === 'quiz') { renderQuiz(); }
      if (g === 'tap') { renderTapBoard(); }
      if (g === 'ten') { renderTenBoard(); }
      if (g === 'memory') { if (!mem.deck.length) buildDeck(); renderMem(); }
      if (g === 'draw') {
        // 首次打开时才初始化画布并开始计时；之后保留上一局画面
        if (!draw.sized && sizeCanvas()) { newWord(); startDrawTimer(); }
      }

      setTimeout(function () {
        if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', function () {
      $('panel-' + b.dataset.close).hidden = true;
    });
  });

  /* =========================================================================
     10. 设置
     ========================================================================= */
  $('btnSettings').addEventListener('click', function () {
    if (setup) {
      $('setDate').value = setup.date;
      $('setNickA').value = setup.nickA || '';
      $('setNickB').value = setup.nickB || '';
    }
    $('settings').hidden = false;
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-close-modal]'), function (b) {
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
    var payload = { v: 1, setup: setup, annis: annis, quiz: quiz, tap: tapScores, ten: tenScores, truth: tdLists, mem: memSaved };
    var code = C.encodeBackup(payload);
    if (!code) { toast('导出失败'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () {
        toast('备份口令已复制到剪贴板');
      }, function () { window.prompt('复制这段备份口令：', code); });
    } else {
      window.prompt('复制这段备份口令：', code);
    }
  });

  $('setReset').addEventListener('click', function () {
    if (!window.confirm('会清掉计时设置、纪念日、答案和战绩，确定吗？')) return;
    [K.setup, K.anni, K.quiz, K.wheel, K.tap, K.ten, K.mem, K.truth].forEach(function (k) { C.store.remove(k); });
    location.reload();
  });

  /* =========================================================================
     11. 启动
     ========================================================================= */
  function renderAll() {
    if (!setup) return;
    document.title = (setup.nickA || '') + ' & ' + (setup.nickB || '');
    startTimer();
    renderAnni();
    renderQuiz();
    renderTapBoard();
    renderTenBoard();
    buildWheel();
  }

  // 跨天 / 跨天后刷新按日内容（刮刮卡）
  var lastDay = new Date().getDate();
  setInterval(function () {
    var d = new Date().getDate();
    if (d !== lastDay) { lastDay = d; renderAnni(); if (scratchReady) initScratch(); }
  }, 60000);

  initOnboard();
})();
