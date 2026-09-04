// 客室テレビに出す館内案内 (/gensuiro/) の検査。
//
//   node scripts/check-tv.mjs [base-url]
//
// なぜ要るか:
//   このページは客室で実際にお客様の目に触れるが、サイトの検査は sitemap を
//   辿るのでここに来ない。テレビは離れて見る・リモコンしかない・1 画面に
//   収まらないと下が読めない、という前提もサイトとは違う。
//
// 見るもの:
//   1. 1280x720 / 1920x1080 で **スクロールなしに収まる**か
//   2. 明朝の部分集合が実際に読み込めているか (落ちてもゴシックで出てしまう)
//   3. 時計が動き、挨拶が出ているか
//   4. ロゴ画像が読めているか / 数字・電話が折り返していないか
//   5. **背景 6 枚それぞれ**で、文字が合成後の画素で 4.5:1 以上か
//      (?bg=N で写真を固定して測る。ローテのままだと画素が決定的にならない)
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

const BASE = process.argv[2] || 'https://gensuirou.com';
const BGS = 6;
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

let failed = 0;
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { failed++; console.log('  FAIL  ' + m); };

const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // ── 構造・機能 (bg=0 で 1 回) ──
  await page.goto(`${BASE}/gensuiro/?bg=0`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(`document.body.getAttribute('data-ready')==='1'`, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      fit: document.documentElement.scrollHeight <= window.innerHeight + 1,
      sh: document.documentElement.scrollHeight, wh: window.innerHeight,
      serif: document.fonts.check('16px "Sawarabi Mincho"'),
      extra: document.fonts.check('16px "Gensuirou Kanji Extra"'),
      clock: (document.getElementById('clock')?.textContent || '').trim(),
      greet: (document.getElementById('greet')?.textContent || '').trim(),
      logo: (() => { const i = document.querySelector('.id img'); return !!(i && i.complete && i.naturalWidth > 0); })(),
      wrapped: [...document.querySelectorAll('.v,.tel,.fact .n,.clock')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 12)),
      bgShown: getComputedStyle(document.getElementById('bgA')).opacity,
    };
  });
  r.fit ? ok(`${w}x${h} 1 画面に収まる`) : bad(`${w}x${h} 収まらない (${r.sh}/${r.wh})`);
  r.serif && r.extra ? ok(`${w}x${h} 明朝の部分集合が読み込めている`) : bad(`${w}x${h} 書体が読めていない serif=${r.serif} extra=${r.extra}`);
  /\d{1,2}:\d{2}/.test(r.clock) ? ok(`${w}x${h} 時計 "${r.clock}"`) : bad(`${w}x${h} 時計が出ていない "${r.clock}"`);
  /—/.test(r.greet) && r.greet.length > 5 ? ok(`${w}x${h} 挨拶 "${r.greet}"`) : bad(`${w}x${h} 挨拶が出ていない "${r.greet}"`);
  r.logo ? ok(`${w}x${h} ロゴ画像が読めている`) : bad(`${w}x${h} ロゴ画像が読めていない`);
  r.wrapped.length === 0 ? ok(`${w}x${h} 折り返しなし`) : bad(`${w}x${h} 折り返し: ${r.wrapped.join(' , ')}`);
  Number(r.bgShown) === 1 ? ok(`${w}x${h} 背景写真が表示されている`) : bad(`${w}x${h} 背景写真が出ていない (opacity=${r.bgShown})`);

  // ── 背景ごとの可読性 ──
  let worstAll = { r: 99, label: '', bg: -1 };
  for (let i = 0; i < BGS; i++) {
    await page.goto(`${BASE}/gensuiro/?bg=${i}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForFunction(`document.body.getAttribute('data-bg')==='${i}'`, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const items = await page.evaluate(() => {
      const out = [];
      const sel = '.id .t b, .clock, .greet, .card h2, .row .k, .row .v, .tel, .note, .fact .n, .fact .l, .foot .t';
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        const c = document.createElement('canvas').getContext('2d');
        c.fillStyle = cs.color; c.fillRect(0, 0, 1, 1);
        const d = c.getImageData(0, 0, 1, 1).data;
        const rg = document.createRange(); rg.selectNodeContents(el);
        for (const box of rg.getClientRects()) {
          if (box.width > 8 && box.height > 6) {
            out.push({ label: (el.textContent || '').trim().slice(0, 12), rgb: [d[0], d[1], d[2]],
                       x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) });
            break;
          }
        }
      }
      return out;
    });
    await page.evaluate(() => {
      document.querySelectorAll('.wrap, .wrap *').forEach((n) => { n.style.color = 'transparent'; });
    });
    await page.waitForTimeout(250);
    const png = PNG.sync.read(await page.screenshot({ type: 'png' }));
    for (const it of items) {
      let sum = 0, n = 0;
      for (let y = it.y; y < Math.min(it.y + it.h, png.height); y++)
        for (let x = it.x; x < Math.min(it.x + it.w, png.width); x++) {
          const k = (png.width * y + x) << 2;
          sum += lum(png.data[k], png.data[k + 1], png.data[k + 2]); n++;
        }
      if (!n) continue;
      const rr = ratio(lum(...it.rgb), sum / n);
      if (rr < worstAll.r) worstAll = { r: rr, label: it.label, bg: i };
      if (rr < 4.5) bad(`${w}x${h} bg=${i} 読みにくい ${rr.toFixed(2)}:1 「${it.label}」`);
    }
  }
  if (worstAll.r >= 4.5) ok(`${w}x${h} 写真 ${BGS} 枚すべてで文字 4.5:1 以上 (最小 ${worstAll.r.toFixed(2)}:1 bg=${worstAll.bg}「${worstAll.label}」)`);
  else console.log(`        → 最小 ${worstAll.r.toFixed(2)}:1 bg=${worstAll.bg}「${worstAll.label}」`);
  await ctx.close();
}
await b.close();
console.log(failed === 0 ? '\nTV PASS\n' : `\nTV FAIL — ${failed} 件\n`);
process.exit(failed === 0 ? 0 : 1);
