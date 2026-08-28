// 使い勝手の検査。
//   node scripts/check-ux.mjs [base-url]
//
// 目視では気付けないものだけを機械で見る:
//   1. ライトボックスが本当に開き、送れて、Escape で閉じ、フォーカスが戻る
//   2. 開いている間、背面がスクロールしない (html 側でロック)
//   3. 主要な当たり判定が 44px 以上 (design.md の非交渉項目)
//   4. reveal が固着していない (**アニメが止まってから**測る)
//   5. キーボードだけで操作できる
import { chromium } from 'playwright-core';

// ⚠ checkVisibility() は **素で呼ぶと visibility:hidden と opacity:0 を「見えている」と返す**。
//   既定で見るのは display:none と content-visibility だけ (2026-08-28 に実測)。
//   閉じたスライドインパネルの中身まで数えてしまうので、必ず全オプションを渡す。

const BASE = process.argv[2] || 'https://gensuirou.japanese-government-official.workers.dev';
let bad = 0;
const ok = (m) => console.log('  OK  ' + m);
const ng = (m) => { console.log('  NG  ' + m); bad++; };

const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));

console.log(`検査対象: ${BASE}`);
console.log('── ライトボックス (写真 12 枚の客室で)');
await page.goto(BASE + '/rooms/zui', { waitUntil: 'load' });
await page.waitForTimeout(1200);
const n = await page.locator('.gallery a[data-full]').count();
await page.locator('.gallery a').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.locator('.gallery a').first().click();
await page.waitForTimeout(600);

let st = await page.evaluate(() => {
  const lb = document.querySelector('.lb');
  return { open: lb && lb.classList.contains('on') && lb.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }),
           count: lb?.querySelector('.lb-count')?.textContent,
           locked: document.documentElement.classList.contains('lb-open'),
           focus: document.activeElement?.className };
});
st.open ? ok(`開いた (${st.count})`) : ng('開かない');
st.locked ? ok('背面を html 側でロック') : ng('背面のロックが無い');
/lb-close/.test(st.focus || '') ? ok('フォーカスが閉じるボタンに移る') : ng(`フォーカスが ${st.focus}`);

// 背面が本当に動かないか、ホイールを投げて測る
const y0 = await page.evaluate(() => window.scrollY);
await page.mouse.move(640, 450); await page.mouse.wheel(0, 600); await page.waitForTimeout(400);
const y1 = await page.evaluate(() => window.scrollY);
y1 === y0 ? ok('開いている間は背面が動かない') : ng(`背面が ${y1 - y0}px 動いた`);

// 矢印キーで送れるか
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
const c2 = await page.evaluate(() => document.querySelector('.lb-count')?.textContent);
c2 !== st.count ? ok(`→ で送れる (${st.count} → ${c2})`) : ng('→ で送れない');
// 端で一巡するか
for (let i = 0; i < n; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(90); }
const c3 = await page.evaluate(() => document.querySelector('.lb-count')?.textContent);
c3 === c2 ? ok(`${n} 回戻ると一周して戻る (${c3})`) : ng(`一周しない (${c2} → ${c3})`);

await page.keyboard.press('Escape'); await page.waitForTimeout(500);
st = await page.evaluate(() => ({
  closed: !document.querySelector('.lb')?.classList.contains('on'),
  locked: document.documentElement.classList.contains('lb-open'),
  focus: document.activeElement?.tagName + '.' + (document.activeElement?.className || ''),
}));
st.closed ? ok('Escape で閉じる') : ng('Escape で閉じない');
!st.locked ? ok('閉じたらロックが外れる') : ng('ロックが残る');
/A\./.test(st.focus) ? ok('フォーカスが元のサムネイルに戻る') : ng(`フォーカスが ${st.focus}`);

console.log('── 当たり判定 44px (ナビ・フッタ・チップ)');
for (const [u, label] of [['/', 'トップ'], ['/rooms/zui', '客室'], ['/journal/choosing-your-villa', '読み物']]) {
  await page.goto(BASE + u, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('header a, header button, footer nav.fmenu a, footer .socials a, .reserve-btn, .langs a, .nav-toggle')]
      .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }))
      .map((e) => ({ t: (e.textContent || '').trim().slice(0, 12), h: Math.round(e.getBoundingClientRect().height) }))
      .filter((x) => x.h > 0 && x.h < 44));
  small.length === 0 ? ok(`${label}: すべて 44px 以上`) : ng(`${label}: ${small.map((x) => `${x.t}=${x.h}px`).join(', ')}`);
}

console.log('── reveal (最後までスクロールして落ち着かせてから測る)');
for (const u of ['/', '/rooms', '/journal/choosing-your-villa']) {
  await page.goto(BASE + u, { waitUntil: 'load' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); }
    await new Promise((r) => setTimeout(r, 900));
  });
  const stuck = await page.evaluate(() => [...document.querySelectorAll('.fade,.anim,.block')]
    .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }) && parseFloat(getComputedStyle(e).opacity) < 0.05).length);
  stuck === 0 ? ok(`${u} 固着なし`) : ng(`${u} ${stuck} 件が opacity 0 のまま`);
}

errs.length === 0 ? ok('JS エラーなし') : ng(`JS エラー: ${[...new Set(errs)].slice(0, 3).join(' / ')}`);
await b.close();
console.log('────────────────────────────────────────────');
console.log(bad === 0 ? 'UX PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
