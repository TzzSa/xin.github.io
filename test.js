/* =============================================================================
   test.js —— core.js 逻辑层测试（零依赖，直接 node test.js 即可）
   覆盖：列表工具 / 深合并 / 路径读写 / 日期与闰年 / 纪念日推算 /
         默契度评分 / 十秒评级归一化 / 不重复抽取 / 分享码与备份口令往返
   ============================================================================= */
globalThis.window = globalThis;
require('./core.js');
var C = globalThis.LoveCore;
var fail = 0;
function ok(name, cond, extra) {
  if (!cond) { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
  else console.log('ok    ' + name);
}

// --- 列表工具 ---
ok('MAX_ITEMS = 50', C.MAX_ITEMS === 50);
ok('splitLines 去空行/去重/截断',
  JSON.stringify(C.splitLines('a\n\n b \na\nc', 50)) === JSON.stringify(['a', 'b', 'c']),
  C.splitLines('a\n\n b \na\nc', 50));
ok('splitLines 截断到 3', C.splitLines('a\nb\nc\nd', 3).length === 3);
ok('limitList 截断到 50', C.limitList(Array.from({ length: 80 }, function (_, i) { return i; })).length === 50);
ok('clampInt 夹紧', C.clampInt(999, 5, 120, 30) === 120 && C.clampInt('x', 5, 120, 30) === 30);

// --- deepMerge ---
var base = { a: 1, b: { c: 2, d: 3 }, list: [1, 2] };
var merged = C.deepMerge(base, { b: { c: 9 }, list: [7], z: 5 });
ok('deepMerge 递归合并', merged.b.c === 9 && merged.b.d === 3);
ok('deepMerge 数组整体替换', JSON.stringify(merged.list) === '[7]');
ok('deepMerge 不改动 base', base.b.c === 2 && base.list.length === 2);
ok('deepMerge 拷贝一份（引用不同）', C.deepMerge(base, null).b !== base.b);
ok('deepMerge 数组截断到 50', C.deepMerge(base, { list: new Array(80).fill(1) }).list.length === 50);

// --- getPath / setPath ---
var o = { x: { y: { z: 1 } } };
ok('getPath', C.getPath(o, 'x.y.z') === 1);
C.setPath(o, 'x.y.z', 2); C.setPath(o, 'p.q', 3);
ok('setPath 覆盖 + 自动建中间层', o.x.y.z === 2 && o.p.q === 3);

// --- 日期 ---
ok('parseDate 合法', !!C.parseDate('2024-02-29'));
ok('parseDate 拒绝 2023-02-29', C.parseDate('2023-02-29') === null);
ok('parseDate 拒绝乱码', C.parseDate('abc') === null);
var now = new Date(2026, 8, 15);
ok('daysUntil 同日 = 0', C.daysUntil(new Date(2026, 8, 15), now) === 0);
ok('daysUntil 明天 = 1', C.daysUntil(new Date(2026, 8, 16), now) === 1);
var nx = C.nextOccurrence('2020-12-25', true, now);
ok('每年重复取今年', nx.getFullYear() === 2026 && nx.getMonth() === 11);
var nx2 = C.nextOccurrence('2020-01-01', true, now);
ok('今年已过则取明年', nx2.getFullYear() === 2027);
ok('一次性已过返回 null', C.nextOccurrence('2020-01-01', false, now) === null);
var p = C.anniversaryProgress('2020-01-01', true, now);
ok('进度在 0~1 之间', p >= 0 && p <= 1, p);

// --- 默契度 ---
ok('完全一致 10 分', C.compareAnswers('火锅！', '火锅').score === 10);
ok('包含关系 6 分', C.compareAnswers('吃火锅', '火锅').score === 6);
ok('不相干 0 分', C.compareAnswers('火锅', '爬山').score === 0);
var r = C.calcCompatibility(['a', 'b', ''], ['a', 'c', '']);
ok('只统计双方都填的题', r.answered === 2 && r.percent === 50, r.percent);
ok('rateSyncPercent 分档', C.rateSyncPercent(85).indexOf('心有灵犀') === 0);

// --- 十秒评级（按目标归一化）---
ok('10 秒目标 误差 0.1 是最高档', C.rateTenSec(0.1, 10).level === 5);
ok('5 秒目标 误差 0.05 也是最高档', C.rateTenSec(0.05, 5).level === 5);
ok('30 秒目标 误差 1 秒仍算不错', C.rateTenSec(1, 30).level >= 3, C.rateTenSec(1, 30));

// --- 不重复抽取 ---
var used = [], resets = 0;
for (var i = 0; i < 10; i++) {
  var d = C.drawNoRepeat(3, used);
  used = d.used;
  if (d.reset) resets++;
}
ok('抽满 3 个后重置（10 次抽应重置 3 次）', resets === 3, resets);
ok('drawNoRepeat 空池安全', C.drawNoRepeat(0, []).index === -1);

// --- 分享码往返 ---
var payload = { v: 1, setup: { date: '2020-05-20', nickA: '小熊🐻', nickB: '小兔/兔' }, annis: [] };
var code = C.encodeShare(payload);
var back = C.decodeShare(code);
ok('分享码中文往返无损', back.setup.nickA === '小熊🐻' && back.setup.nickB === '小兔/兔');
ok('分享码是 URL 安全字符', /^[A-Za-z0-9\-_]+$/.test(code));
var url = C.buildShareUrl(payload, 'https://x.github.io/our-days/#old');
ok('buildShareUrl 覆盖旧 hash', url.indexOf('#d=') > 0 && url.indexOf('old') < 0);
ok('parseShareHash 能解出', C.parseShareHash(url).setup.date === '2020-05-20');
ok('坏 hash 返回 null', C.parseShareHash('#d=!!!!') === null && C.parseShareHash('') === null);
var bk = C.encodeBackup({ hello: '世界' });
ok('备份口令往返', C.decodeBackup(bk).hello === '世界');
ok('坏备份口令返回 null', C.decodeBackup('@@@') === null);

console.log(fail === 0 ? '\n全部通过 ✅' : '\n失败 ' + fail + ' 项 ❌');
process.exit(fail ? 1 : 0);
