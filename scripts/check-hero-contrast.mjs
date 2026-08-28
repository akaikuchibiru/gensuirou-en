// ヒーローの文字が「映像の上で」読めるかを、合成後の画素で測る。
//   node scripts/check-hero-contrast.mjs [base-url]
//
// 既存の check-contrast.mjs は祖先の background-color を辿るので、
// **動画や写真の上の文字は原理的に測れない**。ここが唯一の盲点だった。
// やり方: 文字だけ消してヒーローを撮り、文字があった矩形の画素を読む。
// 映像はフレームで明るさが変わるので、複数の時刻をサンプルして
// 一番きびしいフレームで判定する。
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

// ⚠ checkVisibility() は **素で呼ぶと visibility:hidden と opacity:0 を「見えている」と返す**。
//   既定で見るのは display:none と content-visibility だけ (2026-08-28 に実測)。
//   閉じたスライドインパネルの中身まで数えてしまうので、必ず全オプションを渡す。

const BASE = process.argv[2] || 'https://gensuirou.com';
const MIN = 4.5;
const FRAMES = 8;                      // 尺全体から等間隔。太陽が抜けるカットが最悪値になる
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const b = await chromium.launch({ channel: 'chrome' });
let bad = 0;
for (const [lang, url] of [['ja', '/'], ['en', '/en/'], ['zh', '/zh/']]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + url, { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(4500);

  // 文字の位置と色。まだ消さない。
  // ★ 要素の矩形ではなく **文字そのものの矩形** を採る。
  //   .eyebrow は幅いっぱいのブロックで、文字は左端にしか無い。要素の箱で
  //   測ると文字から遠い明るい部分まで拾い、直す必要のない所を暗くしてしまう。
  const items = await p.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('.hero-block .cap :is(.eyebrow,.title,.sub,.scroll)')) {
      if (!e.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) continue;
      const cs = getComputedStyle(e);
      const c = document.createElement('canvas').getContext('2d');
      c.fillStyle = cs.color; c.fillRect(0, 0, 1, 1);
      const d = c.getImageData(0, 0, 1, 1).data;
      const rects = [];
      for (const n of e.childNodes) {
        const walk = n.nodeType === 3 ? [n] : [...n.childNodes].filter((m) => m.nodeType === 3);
        for (const tn of walk) {
          if (!tn.textContent.trim()) continue;
          if (tn.parentElement && !tn.parentElement.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) continue;
          const r = document.createRange(); r.selectNodeContents(tn);
          for (const b of r.getClientRects()) if (b.width > 1 && b.height > 1)
            rects.push({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
        }
      }
      if (!rects.length) { const b = e.getBoundingClientRect();
        rects.push({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }); }
      out.push({ cls: e.className, t: e.textContent.trim().slice(0, 16), rects,
                 rgb: [d[0], d[1], d[2]], shadow: cs.textShadow !== 'none' });
    }
    return out;
  });

  const heroBox = await p.evaluate(() => { const r = document.querySelector('.hero-block').getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(Math.min(r.height, innerHeight - r.y)) }; });

  // 文字を消す。scrim は残す — 測りたいのは「文字の背後の合成結果」。
  await p.evaluate(() => document.querySelectorAll('.hero-block .cap :is(.eyebrow,.title,.sub,.scroll)')
    .forEach((e) => { e.style.visibility = 'hidden'; }));

  const worst = new Map();
  // seek はしない。preload=none で src を後入れしているため、バッファ外へ
  // seek しても最後にデコードしたフレームが出たままになり、暗い 1 枚だけを
  // 見て「合格」にしてしまう (実測済み)。**再生させて** 実際に流れる絵を撮る。
  const dur = await p.evaluate(async () => {
    const v = document.querySelector('.hero-block video');
    if (!v || !v.src) return 0;
    if (v.readyState < 2) await Promise.race([
      new Promise((r) => v.addEventListener('loadeddata', r, { once: true })),
      new Promise((r) => setTimeout(r, 20000))]);
    if (v.readyState >= 2) { try { await v.play(); } catch {} }
    return v.readyState >= 2 && isFinite(v.duration) ? v.duration : 0;
  });
  const shots = dur > 0 ? FRAMES : 1;
  const seenLum = [];
  for (let k = 0; k < shots; k++) {
    if (dur > 0 && k) await p.waitForTimeout(1400);      // 再生が進むぶんだけ待つ
    const t = dur > 0
      ? await p.evaluate(() => +document.querySelector('.hero-block video').currentTime.toFixed(1))
      : 0;
    const png = PNG.sync.read(await p.screenshot({ clip: heroBox, animations: 'allow' }));

    // フレームが本当に変わっているかを、画面全体の平均輝度で見る
    { let sum = 0, n = 0;
      for (let i = 0; i < png.data.length; i += 4 * 97) { sum += lum(png.data[i], png.data[i + 1], png.data[i + 2]); n++; }
      seenLum.push(+(sum / n).toFixed(4)); }

    for (const it of items) {
      const tl = lum(...it.rgb);
      const vals = [];
      for (const rc of it.rects) {
        // 字の周り 2px までを込みで見る (グリフの隙間から地が透ける)
        const x0 = Math.max(0, rc.x - heroBox.x - 2), y0 = Math.max(0, rc.y - heroBox.y - 2);
        const x1 = Math.min(png.width, x0 + rc.w + 4), y1 = Math.min(png.height, y0 + rc.h + 4);
        for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
          const i = (png.width * y + x) << 2;
          vals.push(lum(png.data[i], png.data[i + 1], png.data[i + 2]));
        }
      }
      if (!vals.length) continue;
      vals.sort((c, d) => c - d);
      // 明るい文字にとって最悪なのは明るい背景。1 画素の外れ値を拾わないよう
      // 最大値ではなく上位 5% を最悪値とする。
      const p95 = vals[Math.floor(vals.length * 0.95)];
      const cr = ratio(tl, p95);
      const cur = worst.get(it.cls);
      if (!cur || cr < cur.cr) worst.set(it.cls, { cr, t, it, p95 });
    }
  }
  const variety = new Set(seenLum).size;

  console.log(`\n  ${lang}  ${BASE + url}   ${dur > 0 ? `動画 ${dur.toFixed(1)}s / ${shots} フレーム (相異なる ${variety})` : 'ポスターのみ'}`);
  if (dur > 0 && variety < 2) { bad++; console.log('    NG  フレームが変わっていない — 暗い 1 枚だけで合格にしてしまう'); }
  for (const [cls, w] of worst) {
    const ok = w.cr >= MIN;
    if (!ok) bad++;
    console.log(`    ${ok ? 'OK' : 'NG'}  ${w.cr.toFixed(2).padStart(5)}:1  ${String(cls).padEnd(8)} ${w.it.shadow ? '影あり' : '影なし'}  最悪 ${w.t}s  "${w.it.t}"`);
  }
  await ctx.close();
}
await b.close();
console.log('─'.repeat(64));
console.log(bad === 0 ? `HERO CONTRAST PASS — すべて ${MIN}:1 以上` : `FAIL — ${bad} 件が ${MIN}:1 未満`);
process.exit(bad ? 1 : 0);
