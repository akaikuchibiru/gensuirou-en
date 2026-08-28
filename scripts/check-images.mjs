// 実際に見える画像が本当に出ているかを、人と同じ速度でスクロールして測る。
//   node scripts/check-images.mjs [base-url]
//
// 注意: 速いプログラム的スクロールや fullPage スクリーンショットでは
// native lazy-load が発火しないことがある。それで「読めていない」と出るのは
// **測り方の故障**。ここでは 1 画面ずつ止まりながら、
// 「今ビューポートに入っているのに naturalWidth が 0」だけを欠陥として数える。
import { chromium } from 'playwright-core';

// ⚠ checkVisibility() は **素で呼ぶと visibility:hidden と opacity:0 を「見えている」と返す**。
//   既定で見るのは display:none と content-visibility だけ (2026-08-28 に実測)。
//   閉じたスライドインパネルの中身まで数えてしまうので、必ず全オプションを渡す。
const BASE = process.argv[2] || 'https://gensuirou.com';
const PAGES = ['/', '/rooms', '/rooms/zui', '/cuisine', '/onsen', '/facilities', '/access', '/journal'];
const b = await chromium.launch({ channel: 'chrome' });
let bad = 0, seen = 0;
for (const path of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const failed = [];
  p.on('response', (r) => { if (/\.(jpg|jpeg|png|webp|avif|svg)$/i.test(new URL(r.url()).pathname) && r.status() >= 400) failed.push(r.status() + ' ' + new URL(r.url()).pathname); });
  await p.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });

  const broken = new Map();
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 700) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await p.waitForTimeout(700);                 // 人が読む速さ。ここを削ると偽陽性が出る
    const inView = await p.evaluate(() => [...document.images]
      .filter((i) => { const r = i.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && r.width > 1 && i.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }); })
      .map((i) => ({ src: new URL(i.currentSrc || i.src, location.href).pathname,
                     ok: i.complete && i.naturalWidth > 0 })));
    for (const i of inView) { if (i.ok) broken.delete(i.src); else if (!broken.has(i.src)) broken.set(i.src, 1); }
  }
  // 最後にもう一度だけ猶予を与えてから確定させる
  await p.waitForTimeout(1500);
  const still = await p.evaluate((list) => list.filter((s) => {
    const i = [...document.images].find((x) => new URL(x.currentSrc || x.src, location.href).pathname === s);
    return i && !(i.complete && i.naturalWidth > 0);
  }), [...broken.keys()]);
  const total = await p.evaluate(() => document.images.length);
  seen += total;
  const n = still.length + failed.length;
  if (n) bad += n;
  console.log(`  ${path.padEnd(14)} 画像 ${String(total).padStart(3)} 枚 · 欠け ${n}`);
  still.forEach((s) => console.log('     NG 表示されているのに読めていない:', s));
  failed.forEach((f) => console.log('     NG HTTP:', f));
  await ctx.close();
}
await b.close();
console.log('─'.repeat(56));
console.log(bad === 0 ? `IMAGES PASS — ${seen} 枚すべて表示` : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
