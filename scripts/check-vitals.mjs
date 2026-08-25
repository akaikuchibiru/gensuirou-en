// 表示速度の実測。
//   node scripts/check-vitals.mjs [base-url] [--fast]
//
// 測るもの: LCP / CLS / FCP / TBT(長いタスクの合計) と、種別ごとの転送量。
//
// 注意していること:
//   - **測定中にスクリーンショットを撮らない**。撮影が再レイアウトを起こして
//     CLS と LCP が変わる (別プロジェクトで実測済み)
//   - キャッシュを毎回空にする。2 回目以降は速くて当たり前
//   - 回線を絞る。手元の光回線で測ると、和文フォントも 18MB の動画も一瞬で通り、
//     現地のスマホで何が起きているか分からない
//   - LCP は「読み込み完了」ではなく確定するまで待つ。途中で読むと嘘の値が出る
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'https://gensuirou.com';
const FAST = process.argv.includes('--fast');

// 4G 相当。阿蘇の宿を調べる人がスマホで見る状況に寄せる。
const NET_4G = { offline: false, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8, latency: 80 };

const PAGES = FAST ? ['/'] : ['/', '/rooms', '/rooms/zui', '/journal/choosing-your-villa'];
const DEVICES = [
  { name: 'モバイル', viewport: { width: 390, height: 844 }, dsf: 3, cpu: 4, net: NET_4G },
  { name: 'デスクトップ', viewport: { width: 1440, height: 900 }, dsf: 2, cpu: 1, net: null },
];

const b = await chromium.launch({ channel: 'chrome' });
const rows = [];

for (const dev of DEVICES) {
  for (const path of PAGES) {
    const ctx = await b.newContext({
      viewport: dev.viewport,
      deviceScaleFactor: dev.dsf,
      isMobile: dev.viewport.width < 600,
      hasTouch: dev.viewport.width < 600,
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    if (dev.net) await cdp.send('Network.emulateNetworkConditions', { ...dev.net, connectionType: 'cellular4g' });
    if (dev.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: dev.cpu });

    // 種別ごとの転送量。Content-Length ではなく実際に流れた量を CDP から取る。
    const bytes = {};
    cdp.on('Network.loadingFinished', () => {});
    const urlOf = new Map();
    cdp.on('Network.responseReceived', (e) => urlOf.set(e.requestId, { url: e.response.url, type: e.type }));
    cdp.on('Network.loadingFinished', (e) => {
      const m = urlOf.get(e.requestId);
      if (!m) return;
      const k = m.type;
      bytes[k] = (bytes[k] || 0) + e.encodedDataLength;
    });

    // 観測は goto より前に仕込む。あとから付けても最初の LCP 候補を取り逃す。
    await page.addInitScript(() => {
      window.__v = { lcp: 0, cls: 0, fcp: 0, tbt: 0, shifts: [] };
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__v.lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;      // 操作直後のずれは数えない
          window.__v.cls += e.value;
          if (e.value > 0.01) window.__v.shifts.push({
            v: +e.value.toFixed(4),
            src: (e.sources || []).map((s) => (s.node && (s.node.className || s.node.tagName)) || '?').slice(0, 2),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__v.fcp = e.startTime;
      }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (e.duration > 50) window.__v.tbt += e.duration - 50;
      }).observe({ type: 'longtask', buffered: true });
    });

    const t0 = Date.now();
    await page.goto(BASE + path, { waitUntil: 'load' });
    // LCP は操作か 5 秒程度の静止で確定する。慌てて読まない。
    await page.waitForTimeout(5000);
    const v = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] || {};
      return { ...window.__v, ttfb: n.responseStart || 0, dcl: n.domContentLoadedEventEnd || 0 };
    });
    const fonts = await page.evaluate(() =>
      performance.getEntriesByType('resource').filter((r) => /\.(woff2?|ttf|otf)(\?|$)/.test(r.name))
        .map((r) => ({ n: r.name.split('/').pop().slice(0, 28), kb: Math.round(r.transferSize / 1024) })));
    const media = await page.evaluate(() =>
      performance.getEntriesByType('resource').filter((r) => /\.(mp4|webm)(\?|$)/.test(r.name))
        .map((r) => ({ n: r.name.split('/').pop(), kb: Math.round(r.transferSize / 1024) })));

    const total = Object.values(bytes).reduce((a, x) => a + x, 0);
    rows.push({ dev: dev.name, path, ...v, total, bytes, fonts, media, wall: Date.now() - t0 });
    await ctx.close();
  }
}
await b.close();

const kb = (n) => (n / 1024).toFixed(0).padStart(5) + 'KB';
const ms = (n) => Math.round(n).toString().padStart(5) + 'ms';
// しきい値は Google の Core Web Vitals の「良好」。
const judge = (lcp, cls, tbt) =>
  [lcp <= 2500 ? 'LCP◯' : lcp <= 4000 ? 'LCP△' : 'LCP✗',
   cls <= 0.1 ? 'CLS◯' : cls <= 0.25 ? 'CLS△' : 'CLS✗',
   tbt <= 200 ? 'TBT◯' : tbt <= 600 ? 'TBT△' : 'TBT✗'].join(' ');

console.log(`計測: ${BASE}  (キャッシュ空・モバイルは 4G 相当 + CPU 4 倍遅い)`);
console.log('─'.repeat(96));
console.log('  端末       ページ                        TTFB     FCP     LCP    CLS    TBT   転送   判定');
let bad = 0;
for (const r of rows) {
  const flag = judge(r.lcp, r.cls, r.tbt);
  if (/✗/.test(flag)) bad++;
  console.log(`  ${r.dev.padEnd(9)} ${r.path.padEnd(28)} ${ms(r.ttfb)} ${ms(r.fcp)} ${ms(r.lcp)} ${r.cls.toFixed(3).padStart(6)} ${ms(r.tbt)} ${kb(r.total)}  ${flag}`);
}
console.log('─'.repeat(96));
const first = rows[0];
console.log('  種別ごとの転送量 (モバイル・トップ):');
for (const [k, v] of Object.entries(first.bytes).sort((a, b2) => b2[1] - a[1])) console.log(`    ${k.padEnd(12)} ${kb(v)}`);
console.log(`  Web フォント ${first.fonts.length} 本 / 計 ${first.fonts.reduce((a, f) => a + f.kb, 0)}KB`);
for (const f of first.fonts.slice(0, 8)) console.log(`    ${f.n.padEnd(30)} ${String(f.kb).padStart(4)}KB`);
if (first.media.length) { console.log('  動画:'); for (const m of first.media) console.log(`    ${m.n.padEnd(30)} ${String(m.kb).padStart(5)}KB`); }
const shifts = rows.flatMap((r) => r.shifts);
if (shifts.length) { console.log('  ずれの原因 (上位):'); for (const s of shifts.slice(0, 6)) console.log(`    ${String(s.v).padStart(7)}  ${s.src.join(', ')}`); }
console.log('─'.repeat(96));
console.log(bad === 0 ? 'VITALS OK — ✗ なし' : `注意 — ${bad} 件が「不良」域`);
