// Run: python3 -m http.server 8793 (public/ から起動する), then: node scripts/check-form-align.mjs
//
// Measures the left edge of every element in the enquiry band and asserts they
// share one edge, plus that the inner column sits centred in the full-bleed band.
//
// The band has two states: the wired form, and the telephone standby that
// replaces it while /api/enquiry does not exist. Measure whichever is present —
// a checker that only knows one state goes quiet exactly when the layout changed.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
let bad = 0;
for (const w of [320, 375, 414, 768, 1000, 1200, 1440, 1920]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8793/index.html', { waitUntil: 'load' });
  await p.waitForSelector('.skip', { state: 'attached' });
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    // ⚠ **可視な要素**を選ぶ。.form-sub はフォーム側と電話導線側の 2 つあり、
    //   querySelector は先頭 (隠れているほう) を返して left=0 になる。
    //   隠れた要素の座標は全部 0 なので、位置の検査は静かに嘘をつく。
    const R = (s) => {
      const list = [...document.querySelectorAll(s)];
      const e = list.find((x) => x.checkVisibility()) || null;
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right) };
    };
    // ⚠ 存在ではなく **可視** で判定する。フォームは宛先が未設定のとき
    //   hidden 付きで HTML に同居しており (Worker が出し分ける)、
    //   存在だけを見ると「フォーム状態」と誤判定して全幅で落ちる。
    const formEl = document.querySelector('.form-wrap form');
    const wired = !!formEl && formEl.checkVisibility();
    // Candidates for both states; absent ones drop out rather than throwing.
    const names = wired
      ? ['.form-section h3', '.form-sub', '.field input', '.form-wrap textarea', '.form-wrap button']
      : ['.form-section h3', '.form-sub', '.standby .reserve-btn', '.standby-hours'];
    const parts = names.map((s) => ({ s, box: R(s) })).filter((x) => x.box);
    const sec = R('.form-section');
    const col = R('.form-wrap form') || R('.standby') || R('.form-wrap');
    return {
      wired, missing: names.length - parts.length,
      edges: parts.map((x) => ({ s: x.s.replace(/^\./, ''), l: x.box.l })),
      leftGap: col.l - sec.l, rightGap: sec.r - col.r,
    };
  });
  const edges = r.edges.map((e) => e.l);
  const aligned = new Set(edges).size === 1;
  const balanced = Math.abs(r.leftGap - r.rightGap) <= 2;
  if (!aligned || !balanced || r.missing) bad++;
  console.log(
    String(w).padStart(5) + ' | ' + (r.wired ? 'form   ' : 'standby') + ' | ' +
    edges.map((x) => String(x).padStart(5)).join(' |') +
    '  L' + String(r.leftGap).padStart(4) + ' R' + String(r.rightGap).padStart(4) +
    (aligned ? '  edges✓' : '  EDGES MISMATCH ' + JSON.stringify(r.edges)) +
    (balanced ? ' centred✓' : ' OFF-CENTRE') +
    (r.missing ? '  MISSING ' + r.missing : '')
  );
  await ctx.close();
}
await b.close();
console.log(bad ? `FAIL — ${bad} width(s) off` : 'FORM-ALIGN PASS — 8 widths, edges shared and column centred');
process.exit(bad ? 1 : 0);
