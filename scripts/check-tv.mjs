// 客室テレビに出す館内案内 (/gensuiro/) の検査。
//
//   node scripts/check-tv.mjs [base-url]
//
// なぜ要るか:
//   このページは **客室で実際にお客様の目に触れる**が、サイトの検査は
//   sitemap を辿るので /gensuiro/ に来ない。テレビは離れて見る・リモコン
//   しかない・1 画面に収まらないと下が読めない、という前提もサイトとは違う。
//
// 見るもの:
//   1. 1280x720 / 1920x1080 で **スクロールなしに収まる**か
//   2. ロゴ画像が実際に読めているか (欠けても画面は出てしまう)
//   3. 数字が折り返していないか (電話番号が 2 行に割れると読めない)
//   4. 写真の上の文字が **合成後の画素で** 4.5:1 以上か
//      (背景が写真なので、色の指定だけでは判断できない)

import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

const BASE = process.argv[2] || 'https://gensuirou.com';

const lin = (v) => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
const lum = (r,g,b) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
const ratio = (a,b) => (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);

let failed = 0;
const b = await chromium.launch({ channel:'chrome' });
for (const [w,h] of [[1920,1080],[1280,720]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  const p = await ctx.newPage();
  await p.goto(BASE + '/gensuiro/', { waitUntil:'load', timeout:45000 });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({
    fit: document.documentElement.scrollHeight <= window.innerHeight + 1,
    sh: document.documentElement.scrollHeight, h: window.innerHeight,
    logo: (() => { const i = document.querySelector('.id img'); return !!(i && i.complete && i.naturalWidth > 0); })(),
    wrapped: [...document.querySelectorAll('.v,.tel,.fact .n')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0,12)),
  }));
  if (!r.fit) { failed++; console.log(`  FAIL ${w}x${h} 1 画面に収まらない (${r.sh}/${r.h})`); }
  else console.log(`  PASS ${w}x${h} 1 画面に収まる`);
  if (!r.logo) { failed++; console.log(`  FAIL ${w}x${h} ロゴ画像が読めていない`); }
  if (r.wrapped.length) { failed++; console.log(`  FAIL ${w}x${h} 折り返している: ${r.wrapped.join(' , ')}`); }

  const items = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.strip .n, .strip .l, .foot .t, .clock, .card h2, .row .v, .tel')) {
      const cs = getComputedStyle(el);
      const c = document.createElement('canvas').getContext('2d');
      c.fillStyle = cs.color; c.fillRect(0,0,1,1);
      const d = c.getImageData(0,0,1,1).data;
      const rg = document.createRange(); rg.selectNodeContents(el);
      for (const box of rg.getClientRects()) {
        if (box.width > 8 && box.height > 6) {
          out.push({ label: (el.textContent||'').trim().slice(0,14), rgb:[d[0],d[1],d[2]],
                     x:Math.round(box.x), y:Math.round(box.y), w:Math.round(box.width), h:Math.round(box.height) });
          break;
        }
      }
    }
    return out;
  });
  // 文字を消して背景だけ撮り、文字があった所の画素で測る
  await p.evaluate(() => { document.querySelectorAll('.strip,.foot,.clock,.card').forEach(e=>{e.style.color='transparent';
    e.querySelectorAll('*').forEach(n=>n.style.color='transparent');}); });
  await p.waitForTimeout(300);
  const png = PNG.sync.read(await p.screenshot({ type:'png' }));
  let worst = { r: 99, label: '' };
  for (const it of items) {
    let sum=0, n=0;
    for (let y=it.y; y<it.y+it.h; y++) for (let x=it.x; x<it.x+it.w; x++) {
      const i=(png.width*y+x)<<2; sum+=lum(png.data[i],png.data[i+1],png.data[i+2]); n++;
    }
    const rr = ratio(lum(...it.rgb), sum/n);
    if (rr < worst.r) worst = { r: rr, label: it.label };
    if (rr < 4.5) { failed++; console.log(`  FAIL ${w}x${h} 読みにくい ${rr.toFixed(2)}:1 「${it.label}」`); }
  }
  console.log(`  PASS ${w}x${h} 写真の上の文字 ${items.length} 箇所 / 最小 ${worst.r.toFixed(2)}:1`);
  await ctx.close();
}
await b.close();
console.log(failed === 0 ? '\nTV PASS\n' : `\nTV FAIL — ${failed} 件\n`);
process.exit(failed === 0 ? 0 : 1);
