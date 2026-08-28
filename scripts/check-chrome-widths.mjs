// ナビとフッタが、行き先を増やしても どの幅でも溢れないか。
//   node scripts/check-chrome-widths.mjs [base-url]
//
// 「狭も広も無事なので目視で気付けない」型の欠陥を狙う。
// 中間幅を刻んで、横スクロールの発生と要素のはみ出しを実測する。
import { chromium } from 'playwright-core';

// ⚠ checkVisibility() は **素で呼ぶと visibility:hidden と opacity:0 を「見えている」と返す**。
//   既定で見るのは display:none と content-visibility だけ (2026-08-28 に実測)。
//   閉じたスライドインパネルの中身まで数えてしまうので、必ず全オプションを渡す。
const BASE = process.argv[2] || 'https://gensuirou.japanese-government-official.workers.dev';
const WIDTHS = [320, 360, 375, 390, 414, 480, 560, 640, 720, 768, 820, 900, 1024, 1180, 1280, 1440, 1600, 1920];
let bad = 0;
const b = await chromium.launch({ channel: 'chrome' });
console.log(`検査対象: ${BASE}`);
console.log('  幅   横スク  ナビ内訳                      フッタ行き先  はみ出し');
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/journal', { waitUntil: 'load' });
  await p.waitForSelector('footer nav.fmenu a', { state: 'attached' });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const doc = document.documentElement;
    const over = doc.scrollWidth > doc.clientWidth;
    const inner = document.querySelector('.nav-inner');
    const navKids = inner ? [...inner.children].filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })).length : 0;
    const navFits = inner ? inner.scrollWidth <= inner.clientWidth + 1 : true;
    const fmenu = document.querySelector('footer nav.fmenu');
    const fLinks = fmenu ? [...fmenu.querySelectorAll('a')].length : 0;
    const fFits = fmenu ? fmenu.scrollWidth <= fmenu.clientWidth + 1 : true;
    // 画面幅を超えて右に出ている要素。
    // ⚠ 横スクロールが発生しているときだけ数える。全幅ヒーローは 100vw なので
    //   スクロールバーぶん clientWidth を数 px 超える。overflow-x:clip で
    //   封じ込めてあり実害は無いのに、素で数えると全幅で誤検出する
    //   (2026-08-25 に 13 幅で誤検出)。正常なページで 0 件になる検査でなければ意味がない。
    const spill = !over ? [] : [...document.querySelectorAll('body *')]
      .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }))
      .filter((e) => e.getBoundingClientRect().right > doc.clientWidth + 1)
      .map((e) => (e.className && String(e.className).split(' ')[0]) || e.tagName)
      .filter((c, i, a) => a.indexOf(c) === i).slice(0, 3);
    return { over, navKids, navFits, fLinks, fFits, spill };
  });
  const ng = r.over || !r.navFits || !r.fFits || r.spill.length;
  if (ng) bad++;
  console.log(`  ${String(w).padStart(4)}  ${r.over ? 'あり ' : 'なし '}  ` +
    `nav 子${r.navKids} ${r.navFits ? '収まる' : '溢れ  '}          ` +
    `${String(r.fLinks).padStart(2)} ${r.fFits ? '収まる' : '溢れ'}   ${r.spill.join(',') || '-'}`);
  await ctx.close();
}
// 横スクロールする箱が、ページの縦スクロールを食っていないか。
// overflow-x:auto は overflow-y を auto に格上げするので、
// 箱の上でホイールを回すとページが動かなくなることがある。
// computed style では判定できない。本物のホイールを投げて測る。
console.log('  ── 横スクロールする箱の上でホイールを投げる');
for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/journal/choosing-your-villa', { waitUntil: 'load' });
  await p.waitForSelector('.jl-table');
  await p.waitForTimeout(700);
  await p.locator('.jl-table').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  const box = await p.locator('.jl-table').boundingBox();
  const before = await p.evaluate(() => window.scrollY);
  await p.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 300));
  await p.mouse.wheel(0, 400);
  await p.waitForTimeout(400);
  const moved = (await p.evaluate(() => window.scrollY)) - before;
  if (moved > 100) console.log(`  ${String(w).padStart(4)}  ホイール 400 → ページが ${moved}px 動いた`);
  else { console.log(`  ${String(w).padStart(4)}  NG 表が縦スクロールを食っている (${moved}px)`); bad++; }
  await ctx.close();
}

await b.close();
console.log('────────────────────────────────────────────');
console.log(bad === 0 ? 'CHROME WIDTHS PASS' : `FAIL — ${bad} 幅`);
process.exit(bad ? 1 : 0);
