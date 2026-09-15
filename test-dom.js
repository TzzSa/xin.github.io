/* =============================================================================
   test-dom.js —— app.js 交互层测试（零依赖，node test-dom.js）
   本机没有浏览器/playwright 时，用一套最小 DOM 桩把 app.js 真跑一遍，
   捕获「引用了不存在的元素」「运行时 TypeError」这类只有真机才暴露的问题。

   覆盖：引导提交 → 计时器 → 视图切换 → 8 个游戏面板与核心操作 →
         名字弹层 → 纪念日（含 50 条上限）→ 设置三分页 → 内容配置读写与夹紧 →
         导出/导入备份 → 分享链接 → 后台冻结背景动效

   部署到 GitHub Pages 时不需要上传本文件。
   ============================================================================= */
const fs = require('fs');
const path = require('path');

/* ------------------------- 最小 DOM 桩 ------------------------- */
let uidCounter = 0;
const listeners = new WeakMap();

/* 从 index.html 读出「初始就带 hidden 属性」的 id，桩元素要对齐 */
const htmlSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const hiddenIds = new Set();
[...htmlSrc.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].forEach(m => {
  if (/\shidden(\s|\/|>)/.test(m[0])) hiddenIds.add(m[1]);
});

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...cs) { cs.forEach(c => this.set.add(c)); this.sync(); }
  remove(...cs) { cs.forEach(c => this.set.delete(c)); this.sync(); }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(c) : !!force;
    if (on) this.set.add(c); else this.set.delete(c);
    this.sync(); return on;
  }
  contains(c) { return this.set.has(c); }
  sync() { this.el._className = [...this.set].join(' '); }
}

/* 真实 DOM 里 style 允许直接赋值（el.style.x = 1），这里也要支持 */
class Style {
  setProperty(k, v) { this[k] = v; }
  getPropertyValue(k) { return this[k]; }
}

class El {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.id = '';
    this._uid = ++uidCounter;
    this.classList = new ClassList(this);
    this._className = '';
    this.style = new Style();
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this._html = '';
    this.value = '';
    this.disabled = false;
    this.checked = false;
    this.children = [];
    this.parentNode = null;
    this.clientWidth = 360;
    this.clientHeight = 150;
    this.offsetWidth = 360;
    this._attrs = {};
    this._canvasCtx = null;
  }
  get className() { return this._className; }
  set className(v) {
    this._className = String(v || '');
    this.classList.set = new Set(this._className.split(/\s+/).filter(Boolean));
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null; return c;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) {
    let m = listeners.get(this);
    if (!m) { m = {}; listeners.set(this, m); }
    (m[type] = m[type] || []).push(fn);
  }
  removeEventListener() {}
  querySelector(sel) { return makeStub(sel); }
  querySelectorAll(sel) { return queryAll(sel); }
  closest() { return this; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 150, right: 360, bottom: 150 }; }
  scrollIntoView() {}
  focus() {}
  select() {}
  setSelectionRange() {}
  reset() { this.children.forEach(c => { if ('value' in c) c.value = ''; }); }
  animate() { return { onfinish: null, cancel() {} }; }
  getContext() {
    if (!this._canvasCtx) {
      const noop = () => {};
      this._canvasCtx = {
        canvas: this,
        scale: noop, setTransform: noop, clearRect: noop, fillRect: noop,
        beginPath: noop, arc: noop, fill: noop, moveTo: noop, lineTo: noop, stroke: noop,
        fillText: noop, drawImage: noop, save: noop, restore: noop,
        globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000',
        font: '', textAlign: '', lineWidth: 1, lineCap: '', lineJoin: '',
        getImageData(x, y, w, h) {
          const n = Math.max(1, Math.round(w * h) * 4);
          return { data: new Uint8ClampedArray(n), width: w, height: h };
        },
        putImageData: noop
      };
    }
    return this._canvasCtx;
  }
}

/* 按选择器造桩元素（只覆盖 app.js 真正用到的那些） */
const byId = new Map();
function stubFor(id) {
  if (!byId.has(id)) {
    const el = new El('div');
    el.id = id;
    el.hidden = hiddenIds.has(id);
    byId.set(id, el);
  }
  return byId.get(id);
}

/* 两个 canvas 的 parentNode 在真实 DOM 里是存在的容器，这里补上 */
stubFor('scratchCv').parentNode = stubFor('scratchWrap');
stubFor('drawCv').parentNode = stubFor('drawStage');

function makeStub(sel) {
  const el = new El('div');
  el.className = String(sel).replace(/^\./, '');
  return el;
}

const GAMES = ['quiz', 'wheel', 'scratch', 'tap', 'ten', 'memory', 'draw', 'truth'];
const SELECTORS = {
  '.tab': () => ['timer', 'games'].map(v => { const e = new El('button'); e.dataset.view = v; e.className = 'tab'; return e; }),
  '.seg-btn[data-who]': () => ['A', 'B'].map(v => { const e = new El('button'); e.dataset.who = v; e.className = 'seg-btn'; return e; }),
  '.seg-btn[data-td]': () => ['truth', 'dare', 'any'].map(v => { const e = new El('button'); e.dataset.td = v; e.className = 'seg-btn'; return e; }),
  '.game-card': () => GAMES.map(v => { const e = new El('button'); e.dataset.game = v; e.className = 'game-card'; return e; }),
  '.game-panel': () => GAMES.map(v => stubFor('panel-' + v)),
  '[data-close]': () => GAMES.map(v => { const e = new El('button'); e.dataset.close = v; return e; }),
  '[data-close-modal]': () => [new El('div'), new El('button')],
  '[data-ask-cancel]': () => [new El('div'), new El('button'), new El('button')],
  '.set-tabs .seg-btn': () => ['basic', 'content', 'share'].map(v => { const e = new El('button'); e.dataset.set = v; e.className = 'seg-btn'; return e; })
};
const selectorCache = new Map();
function queryAll(sel) {
  if (!selectorCache.has(sel)) selectorCache.set(sel, (SELECTORS[sel] || (() => []))());
  return selectorCache.get(sel);
}

/* ------------------------- 全局环境 ------------------------- */
const lsData = new Map();
const winListeners = {};
globalThis.window = globalThis;
globalThis.document = {
  body: new El('body'),
  documentElement: new El('html'),
  hidden: false,
  title: '',
  getElementById: (id) => stubFor(id),
  querySelector: (sel) => makeStub(sel),
  querySelectorAll: queryAll,
  createElement: (tag) => new El(tag),
  addEventListener: (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); },
  execCommand: () => true
};
globalThis.localStorage = {
  getItem: (k) => (lsData.has(k) ? lsData.get(k) : null),
  setItem: (k, v) => { lsData.set(k, String(v)); },
  removeItem: (k) => { lsData.delete(k); }
};
globalThis.location = { origin: 'http://localhost', pathname: '/index.html', search: '', hash: '' };
globalThis.history = { replaceState() {} };
globalThis.navigator = { clipboard: null };
globalThis.devicePixelRatio = 2;
globalThis.innerWidth = 900;
globalThis.confirm = () => true;
globalThis.prompt = () => 'X';
globalThis.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.addEventListener = (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); };
globalThis.removeEventListener = () => {};

const pendingTimers = [];
globalThis.setTimeout = (fn, ms) => { pendingTimers.push({ fn, ms: ms || 0 }); return pendingTimers.length; };
globalThis.clearTimeout = () => {};
globalThis.setInterval = () => 1;    // 不真正调度，避免进程挂住
globalThis.clearInterval = () => {};
function drainTimers(rounds) {
  for (let r = 0; r < (rounds || 1); r++) {
    pendingTimers.splice(0, pendingTimers.length).forEach(t => t.fn());
  }
}

/* ------------------------- 载入脚本 ------------------------- */
let fail = 0;
function ok(name, cond, extra) {
  if (!cond) { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
  else console.log('ok    ' + name);
}
function step(name, fn) {
  try { fn(); console.log('ok    ' + name); }
  catch (e) { fail++; console.log('FAIL  ' + name + '  -> ' + e.message); }
}

try {
  require('./core.js');
  require('./app.js');
} catch (e) {
  console.log('FAIL  app.js 载入时抛错: ' + e.message);
  console.log(e.stack);
  process.exit(1);
}

function fire(el, type, extra) {
  const m = listeners.get(el);
  const evt = Object.assign({ type, preventDefault() {}, stopPropagation() {}, clientX: 10, clientY: 10, pointerId: 1, key: '' }, extra || {});
  if (m && m[type]) m[type].forEach(fn => fn(evt));
  return !!(m && m[type]);
}

/* ------------------------- 1. 引导流程 ------------------------- */
step('引导页填表提交 → 进入主界面', () => {
  stubFor('obDate').value = '2020-05-20';
  stubFor('obNickA').value = '小熊';
  stubFor('obNickB').value = '小兔';
  fire(stubFor('obForm'), 'submit');
});
ok('主界面已显示', stubFor('app').hidden === false);
ok('引导层已隐藏', stubFor('onboard').hidden === true);
ok('标题变成双方昵称', document.title === '小熊 & 小兔', document.title);
ok('天数已渲染', /^\d+$/.test(String(stubFor('dDays').textContent)), stubFor('dDays').textContent);
ok('起始日期已渲染', String(stubFor('dSince').textContent).indexOf('2020') === 0, stubFor('dSince').textContent);
ok('默认配置在改动前不写盘（省空间）', !lsData.has('love.config'));
ok('配置已生效到界面', String(stubFor('tapCardSub').textContent).indexOf('30 秒') === 0, stubFor('tapCardSub').textContent);

/* ------------------------- 2. 视图切换 ------------------------- */
step('切换到游戏视图', () => { fire(queryAll('.tab')[1], 'click'); });
ok('游戏视图显示 / 计时视图隐藏', stubFor('view-games').hidden === false && stubFor('view-timer').hidden === true);

/* ------------------------- 3. 八个游戏面板 ------------------------- */
GAMES.forEach(g => {
  step(`打开游戏面板：${g}`, () => {
    fire(queryAll('.game-card').find(c => c.dataset.game === g), 'click');
    drainTimers(2);
  });
  ok(`面板 ${g} 已展开`, stubFor('panel-' + g).hidden === false);
});

/* ------------------------- 4. 各游戏核心操作 ------------------------- */
step('转盘：点 GO 旋转并出结果', () => {
  stubFor('wheelItems').value = 'A\nB\nC\nD';
  fire(stubFor('wheelItems'), 'input');
  fire(stubFor('wheelCenter'), 'click');
  drainTimers(3);
});
ok('转盘结果已渲染', String(stubFor('wheelResult').textContent).indexOf('结果是') === 0, stubFor('wheelResult').textContent);

step('转盘：50 个选项也不报错', () => {
  stubFor('wheelItems').value = Array.from({ length: 50 }, (_, i) => '选项' + i).join('\n');
  fire(stubFor('wheelItems'), 'input');
  fire(stubFor('wheelCenter'), 'click');
  drainTimers(3);
});
ok('50 选项也能出结果', String(stubFor('wheelResult').textContent).indexOf('结果是') === 0);

step('默契问答：切换答题人 + 填答案 + 提交', () => {
  fire(queryAll('.seg-btn[data-who]')[0], 'click');
  const li = stubFor('quizList').children[0];
  const inp = li.children[1].children[1];
  inp.value = '火锅';
  if (!fire(inp, 'input')) throw new Error('答题输入框没有绑定 input 监听器');
  if (!/火锅/.test(lsData.get('love.quiz') || '')) throw new Error('答案没有写进存储');
  fire(stubFor('quizSubmit'), 'click');
});
ok('提交后提示轮到另一方', String(stubFor('toast').textContent).indexOf('轮到') >= 0, stubFor('toast').textContent);

step('爱心手速：开始一局', () => { fire(stubFor('tapStart'), 'click'); });
ok('开始后舞台里已出现爱心', stubFor('tapStage').children.length >= 1, stubFor('tapStage').children.length);

step('十秒挑战：开始 / 停止 → 弹出名字选择', () => {
  fire(stubFor('tenStart'), 'click');
  fire(stubFor('tenStop'), 'click');
  drainTimers(2);
});
ok('十秒提示包含目标秒数', String(stubFor('tenHint').textContent).indexOf('10') >= 0, stubFor('tenHint').textContent);
ok('名字弹层已弹出（替代 window.prompt）', stubFor('ask').hidden === false);
ok('弹层里有 TA / 我 两个快捷选项', stubFor('askWho').children.length === 2, stubFor('askWho').children.length);

step('点昵称按钮记录成绩', () => { fire(stubFor('askWho').children[1], 'click'); });
ok('成绩已写入 localStorage', (JSON.parse(lsData.get('love.ten')) || []).length === 1, lsData.get('love.ten'));
ok('记录后弹层已关闭', stubFor('ask').hidden === true);

step('自定义名字也能记录', () => {
  fire(stubFor('tenStart'), 'click');
  fire(stubFor('tenStop'), 'click');
  stubFor('askInput').value = '路人甲';
  fire(stubFor('askOk'), 'click');
});
ok('自定义名字已记录', (JSON.parse(lsData.get('love.ten')) || []).some(r => r.name === '路人甲'));

step('记忆翻牌：翻两张牌', () => {
  fire(queryAll('.game-card').find(c => c.dataset.game === 'memory'), 'click');
  const grid = stubFor('memGrid');
  fire(grid.children[0], 'click');
  fire(grid.children[1], 'click');
  drainTimers(2);
});
ok('翻牌产生了步数', Number(stubFor('memMoves').textContent) >= 1, stubFor('memMoves').textContent);
ok('牌数是偶数（成对）', stubFor('memGrid').children.length % 2 === 0, stubFor('memGrid').children.length);

step('画板：绘制一笔（回归旧版 dpr 崩溃）', () => {
  fire(queryAll('.game-card').find(c => c.dataset.game === 'draw'), 'click');
  const cv = stubFor('drawCv');
  fire(cv, 'pointerdown', { clientX: 20, clientY: 20 });
  fire(cv, 'pointermove', { clientX: 40, clientY: 40 });
  fire(cv, 'pointerup');
});
ok('画板已初始化（旧版这里抛 ReferenceError: dpr is not defined）', stubFor('drawWord').textContent.length > 0, stubFor('drawWord').textContent);

step('画板：画完 → 揭晓', () => {
  fire(stubFor('drawDone'), 'click');
  fire(stubFor('drawReveal'), 'click');
  drainTimers(2);
});
ok('揭晓后画面已盖上', stubFor('drawVeil').hidden === true);

step('刮刮卡：重新生成', () => { fire(stubFor('scratchNew'), 'click'); });
ok('刮刮卡文字已生成', stubFor('scratchText').textContent.length > 0);

step('真心话大冒险：抽一张', () => { fire(stubFor('tdDraw'), 'click'); });
ok('抽到了内容', stubFor('tdText').textContent !== '点下面的按钮抽一张', stubFor('tdText').textContent);

/* ------------------------- 5. 纪念日 ------------------------- */
step('添加纪念日', () => {
  fire(stubFor('btnAddAnni'), 'click');
  stubFor('anniTitle').value = '在一起纪念日';
  stubFor('anniDateInput').value = '2021-05-20';
  stubFor('anniYearly').checked = true;
  fire(stubFor('anniForm'), 'submit');
});
ok('纪念日列表已渲染', stubFor('anniList').children.length === 1, stubFor('anniList').children.length);
ok('倒计时环已更新', stubFor('ringFg').style.strokeDashoffset !== undefined);

step('纪念日上限 50：塞满后再加会被拦截', () => {
  for (let i = 0; i < 60; i++) {
    fire(stubFor('btnAddAnni'), 'click');
    stubFor('anniTitle').value = '纪念日' + i;
    stubFor('anniDateInput').value = '2021-01-01';
    fire(stubFor('anniForm'), 'submit');
  }
});
ok('纪念日数量被限制在 50', stubFor('anniList').children.length === 50, stubFor('anniList').children.length);

/* ------------------------- 6. 设置与内容配置 ------------------------- */
step('打开设置', () => { fire(stubFor('btnSettings'), 'click'); });
ok('设置弹层已显示', stubFor('settings').hidden === false);

step('切到内容配置分页（渲染配置编辑器）', () => { fire(queryAll('.set-tabs .seg-btn')[1], 'click'); });
const cfgItems = stubFor('cfgBox').children;
ok('配置项全部生成（11 项）', cfgItems.length === 11, cfgItems.length);

const tas = cfgItems.map(i => i.children.find(c => c.tagName === 'TEXTAREA')).filter(Boolean);
const nums = cfgItems
  .map(i => i.children.find(c => c.tagName === 'DIV' && c.classList.contains('cfg-num')))
  .filter(Boolean).map(d => d.children.find(c => c.tagName === 'INPUT'));
ok('生成了 8 个列表编辑器', tas.length === 8, tas.length);
ok('生成了 3 个数字编辑器', nums.length === 3, nums.length);
ok('计数显示为 n / 50', /\/ 50$/.test(String(cfgItems[0].children[0].children[1].textContent)));

step('把「默契问题」改成 60 行 → 截断到 50', () => {
  tas[0].value = Array.from({ length: 60 }, (_, i) => '问题' + i).join('\n');
  fire(tas[0], 'input');
  fire(tas[0], 'blur');
  drainTimers(2);
});
ok('问题被截断到 50 条', String(cfgItems[0].children[0].children[1].textContent) === '50 / 50');
ok('50 条问题已存进配置', JSON.parse(lsData.get('love.config')).quiz.questions.length === 50);
ok('改问题会重置旧答案', JSON.parse(lsData.get('love.quiz')).A.length === 0);
step('重新打开问答面板 → 渲染 50 题', () => {
  const card = queryAll('.game-card').find(c => c.dataset.game === 'quiz');
  fire(card, 'click'); fire(card, 'click'); fire(card, 'click');
});
ok('问答列表渲染出 50 题', stubFor('quizList').children.length === 50, stubFor('quizList').children.length);

step('把「转盘选项」清空 → 应回滚并保留原值', () => {
  const before = tas[1].value;
  tas[1].value = '';
  fire(tas[1], 'input');
  fire(tas[1], 'blur');
  drainTimers(2);
  ok('清空后回滚到原值', tas[1].value === before);
});

step('把「手速时长」改成 999 → 夹到 120', () => {
  nums[0].value = '999';
  fire(nums[0], 'change');
});
ok('时长被夹到 120', Number(nums[0].value) === 120, nums[0].value);
ok('卡片副标题同步更新', String(stubFor('tapCardSub').textContent).indexOf('120') === 0);

step('把「十秒目标」改成 1 → 夹到 3', () => {
  nums[1].value = '1';
  fire(nums[1], 'change');
});
ok('目标被夹到 3', Number(nums[1].value) === 3, nums[1].value);
ok('十秒卡片副标题同步', String(stubFor('tenCardSub').textContent).indexOf('3 秒') >= 0);

step('记忆翻牌词库写 50 个词', () => {
  tas[4].value = Array.from({ length: 50 }, (_, i) => '词' + i).join('\n');
  fire(tas[4], 'input');
  fire(tas[4], 'blur');
  drainTimers(2);
});
ok('词库已保存 50 个', (JSON.parse(lsData.get('love.config')).memory.words || []).length === 50);

step('全部恢复默认', () => { fire(stubFor('cfgResetAll'), 'click'); });
const afterReset = JSON.parse(lsData.get('love.config'));
ok('问题回到 10 条', afterReset.quiz.questions.length === 10, afterReset.quiz.questions.length);
ok('手速时长回到 30', afterReset.tap.duration === 30);
ok('十秒目标回到 10', afterReset.ten.target === 10);

/* ------------------------- 7. 备份 ------------------------- */
step('导出备份口令', () => { fire(stubFor('setExport'), 'click'); drainTimers(2); });
step('从备份恢复', () => {
  const cfg = JSON.parse(lsData.get('love.config'));
  cfg.quiz.questions = ['恢复后的唯一问题'];
  const code = Buffer.from(JSON.stringify({
    v: 2, setup: { date: '2020-05-20', nickA: '小熊', nickB: '小兔' },
    annis: [], quiz: { A: [], B: [] }, tap: [], ten: [], memBest: {}, cfg
  }), 'utf8').toString('base64');
  stubFor('setImportBox').value = code;
  fire(stubFor('setImport'), 'click');
});
ok('恢复后问题被替换', JSON.parse(lsData.get('love.config')).quiz.questions[0] === '恢复后的唯一问题');

step('坏口令不会崩', () => {
  stubFor('setImportBox').value = '@@@not-base64@@@';
  fire(stubFor('setImport'), 'click');
});
ok('坏口令给出提示', String(stubFor('toast').textContent).indexOf('口令') >= 0, stubFor('toast').textContent);

/* ------------------------- 8. 分享 ------------------------- */
step('生成分享链接', () => { fire(stubFor('btnShare'), 'click'); drainTimers(2); });
ok('分享链接已生成', String(stubFor('shareUrl').value).indexOf('#d=') > 0, String(stubFor('shareUrl').value).slice(0, 40));

/* ------------------------- 9. 后台冻结背景动效 ------------------------- */
step('切到后台 → 冻结背景动效', () => {
  document.hidden = true;
  (winListeners['visibilitychange'] || []).forEach(fn => fn());
});
ok('body 已加上 bg-paused', document.body.classList.contains('bg-paused') === true);
step('切回前台 → 恢复背景动效', () => {
  document.hidden = false;
  (winListeners['visibilitychange'] || []).forEach(fn => fn());
});
ok('body 已移除 bg-paused', document.body.classList.contains('bg-paused') === false);
ok('背景粒子已生成', stubFor('bgFx').children.length > 0, stubFor('bgFx').children.length);

/* ------------------------- 10. 横竖屏切换：刮刮卡画布重排 ------------------------- */
step('横屏：容器变宽 → 刮刮卡画布按新宽度重画', () => {
  stubFor('panel-draw').hidden = true;          // 一次只开一个面板，隔离被测逻辑
  stubFor('panel-scratch').hidden = false;
  stubFor('scratchWrap').clientWidth = 360;
  fire(stubFor('scratchNew'), 'click');         // 记录初始 CSS 宽度 360
  stubFor('scratchWrap').clientWidth = 640;     // 模拟旋转到横屏
  (winListeners['resize'] || []).forEach(fn => fn());
  drainTimers(2);
});
ok('旋转后记录到新宽度', stubFor('scratchCv').__cssW === 640, stubFor('scratchCv').__cssW);
ok('canvas 位图宽 = CSS 宽 × dpr(2)', stubFor('scratchCv').width === 1280, stubFor('scratchCv').width);

step('宽度只差几像素 → 不重画，保住刮到一半的进度', () => {
  stubFor('scratchWrap').clientWidth = 645;     // 只差 5px，低于 8px 阈值
  (winListeners['resize'] || []).forEach(fn => fn());
  drainTimers(2);
});
ok('小幅变化不触发重画', stubFor('scratchCv').__cssW === 640, stubFor('scratchCv').__cssW);

step('已刮完的卡片旋转后仍是「已刮完」', () => {
  stubFor('scratchCv').classList.add('done');
  stubFor('scratchWrap').clientWidth = 800;
  (winListeners['resize'] || []).forEach(fn => fn());
  drainTimers(2);
});
ok('旋转后 done 状态被保留', stubFor('scratchCv').classList.contains('done') === true);
ok('并已按新宽度重画', stubFor('scratchCv').__cssW === 800, stubFor('scratchCv').__cssW);

console.log(fail === 0 ? '\napp.js 交互层测试全部通过 ✅' : `\n发现 ${fail} 个问题 ❌`);
process.exit(fail ? 1 : 0);
