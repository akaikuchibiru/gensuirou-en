// 文字の「見かけの大きさ」を測る。
//   node scripts/check-type-size.mjs [base-url]
//
// 指定 px では判断できない。本番実測の 1em あたり x-height は
//   Cormorant Garamond 0.386 · Sawarabi Mincho 0.500 · Noto Serif SC 0.516
// で、同じ px を指定しても **ラテンだけ 23% 小さく見える**。
//
// 下限を 12px にしてある理由:
//   14px (和文と完全に同じ見かけ) まで持ち上げたところ、欧文ページが
//   大きすぎるとオーナー判断が出た。元の大きさと 14px の中間に置いている。
//   12 を割るものが出たら、それは中間ですらない小ささなので直す。
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'https://gensuirou.com';
const FLOOR = 12;
const PAGES = [['ja', '/'], ['en', '/en/'], ['zh', '/zh/'], ['ja', '/rooms/zui']];

const b = await chromium.launch({ channel: 'chrome' });
let bad = 0;
for (const [lang, path] of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(2500);
  const rows = await p.evaluate(() => {
    const out = [], seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!el.checkVisibility || !el.checkVisibility()) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').trim();
      if (!own) continue;
      const cs = getComputedStyle(el);
      const px = parseFloat(cs.fontSize);
      if (px <= 2 || cs.clipPath !== 'none' || el.classList.contains('seo') || el.classList.contains('skip')) continue;
      const fam = cs.fontFamily.split(',')[0].replace(/['"]/g, '');
      const adj = cs.fontSizeAdjust;
      // Cormorant に漢字・かなの字形は無い。指定が Cormorant でも CJK 文字は
      // 代替書体 (x-height 0.5 前後) で描かれるので換算しない。
      const latinOnly = !/[぀-ヿ㐀-鿿]/.test(own);
      const xh = (/Cormorant/.test(fam) && latinOnly) ? 0.386 : /Noto Serif SC/.test(fam) ? 0.516 : 0.5;
      // font-size-adjust が効いていれば書体側が V に正規化される
      const drawn = (adj && adj !== 'none') ? px * (parseFloat(adj) / xh) : px;
      const apparent = drawn * (xh / 0.5);
      const k = fam + px + adj + el.className;
      if (seen.has(k)) continue; seen.add(k);
      out.push({ px: +px.toFixed(1), drawn: +drawn.toFixed(1), app: +apparent.toFixed(1),
                 fam: fam.slice(0, 18), cls: (el.className || el.tagName).toString().slice(0, 22), t: own.slice(0, 16) });
    }
    return out.sort((a, c) => a.app - c.app);
  });
  const small = rows.filter((r) => r.app < FLOOR);
  console.log(`\n  ${lang}  ${path}   要素 ${rows.length} 種 · 最小の見かけ ${rows[0] ? rows[0].app : '-'}px`);
  if (small.length) { bad += small.length; small.forEach((r) => console.log(`    NG 指定 ${r.px}px → 描画 ${r.drawn}px → 見かけ ${r.app}px  ${r.cls} "${r.t}"`)); }
  else console.log(`    OK  ${FLOOR}px 未満なし`);
  for (const r of rows.slice(0, 4)) console.log(`      小さい順: 指定 ${String(r.px).padStart(5)} → 描画 ${String(r.drawn).padStart(5)} → 見かけ ${String(r.app).padStart(5)}  ${r.cls}`);
  await ctx.close();
}
await b.close();
console.log('─'.repeat(70));
console.log(bad === 0 ? `TYPE SIZE PASS — すべて見かけ ${FLOOR}px 以上` : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
