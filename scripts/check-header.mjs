// ヘッダーが幅によって壊れないかを、細かい刻みで見る。
//   node scripts/check-header.mjs [base-url]
//
// なぜ 10px 刻みか: 2026-08-26 に、英語ページの **370〜399px だけ** で
// 「源翠瓏」が 2 行に割れていた。320 でも 414 でも起きない。
// 節目の幅だけ見る検査では原理的に通り抜ける (iPhone の 375 / 390 が丸ごと該当した)。
// 原因は、その帯でだけ予約ボタンが現れてヘッダーの余りが 8px になり、
// brand が 53px まで潰されたこと。英語は RESERVE / MENU が
// 「ご予約」「目次」より長いぶん先に破綻する。
import { chromium } from 'playwright-core';

// ⚠ checkVisibility() は **素で呼ぶと visibility:hidden と opacity:0 を「見えている」と返す**。
//   既定で見るのは display:none と content-visibility だけ (2026-08-28 に実測)。
//   閉じたスライドインパネルの中身まで数えてしまうので、必ず全オプションを渡す。

const BASE = process.argv[2] || 'https://gensuirou.com';
const MIN_GAP = 8;                 // brand と nav-right の最小すきま
const b = await chromium.launch({ channel: 'chrome' });
let bad = 0;
for (const path of ['/en/', '/', '/zh/']) {
  let worst = { gap: 1e9 }, wraps = [], overs = [];
  for (let w = 320; w <= 480; w += 10) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const t = document.querySelector('.nav .brand .txt');
      const img = document.querySelector('.nav .brand img');
      const vis = (e) => !!(e && e.checkVisibility && e.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }));
      // 出ているほうの brand を測る (狭い幅では画像を隠して文字が代役)
      const el = vis(t) ? t : img;
      const cs = el ? getComputedStyle(el) : null;
      const lh = cs ? (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2) : 0;
      const h = el ? el.getBoundingClientRect().height : 0;
      return {
        gap: Math.round(document.querySelector('.nav-right').getBoundingClientRect().left
             - document.querySelector('.brand').getBoundingClientRect().right),
        over: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        lines: vis(t) && lh ? Math.round(h / lh) : 1,
        clipped: el ? el.scrollWidth > Math.ceil(el.getBoundingClientRect().width) + 1 : false,
      };
    });
    if (r.gap < worst.gap) worst = { gap: r.gap, w };
    if (r.lines > 1 || r.clipped) wraps.push(`${w}px(${r.lines}行${r.clipped ? '・切れ' : ''})`);
    if (r.over > 0) overs.push(`${w}px(+${r.over})`);
    await ctx.close();
  }
  const okAll = !wraps.length && !overs.length && worst.gap >= MIN_GAP;
  if (!okAll) bad++;
  console.log(`  ${okAll ? 'OK' : 'NG'}  ${path.padEnd(6)} 最小すきま ${String(worst.gap).padStart(4)}px @ ${worst.w}px` +
    (wraps.length ? `  ★宿名が折れる: ${wraps.join(' ')}` : '') +
    (overs.length ? `  ★横あふれ: ${overs.join(' ')}` : ''));
}
await b.close();
console.log('─'.repeat(60));
console.log(bad === 0 ? `HEADER PASS — 320〜480px を 10px 刻みで確認` : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
