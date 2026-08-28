// Run: python3 -m http.server 8793 (public/ から起動する), then: node scripts/check-gates.mjs
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:8793/';
const PAGES = ['index.html','rooms.html','cuisine.html','onsen.html','facilities.html','access.html','faq.html','wedding.html'];
const WIDTHS = [320, 375, 414, 768, 1440];

const browser = await chromium.launch({ channel: 'chrome' });
const fails = [];

for (const p of PAGES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_/.test(m.text())) consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForSelector('.skip', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(150);

    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const out = {
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        htmlOverflowX: getComputedStyle(de).overflowX,
        bodyOverflowX: getComputedStyle(document.body).overflowX,
        wrappers: [],
        smallTargets: [],
        italicHeads: [],
        bodyPx: parseFloat(getComputedStyle(document.body).fontSize),
        hasMain: !!document.getElementById('main'),
        hasSkip: !!document.querySelector('.skip'),
        navIndexItems: document.querySelectorAll('#navIndex ol a').length,  // 切替 (.langs a) は数えない
        kickers: document.querySelectorAll('.kicker').length,
        inlineHover: document.querySelectorAll('[onmouseover]').length,
        splash: document.querySelectorAll('#gsSplash').length,
      };
      // gate 49 — clickable text must not wrap to two lines
      document.querySelectorAll('.reserve-btn, .nav-toggle, .langs a, .langs button, footer nav.fmenu a, footer .socials a, #navIndex a, .form-wrap button').forEach(el => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        const rect = el.getBoundingClientRect();
        if (rect.height > lh * 1.85 + 24) {
          out.wrappers.push((el.className || el.tagName) + ' h=' + Math.round(rect.height) + ' lh=' + Math.round(lh));
        }
      });
      // hit targets ≥44px
      document.querySelectorAll('a.reserve-btn, .nav-toggle, .langs button, footer .socials a, .form-wrap button').forEach(el => {
        const r2 = el.getBoundingClientRect();
        if (r2.width > 0 && r2.height > 0 && r2.height < 44) out.smallTargets.push((el.className||el.tagName) + ' ' + Math.round(r2.height));
      });
      // gate 38a — no italic display type
      document.querySelectorAll('h1,h2,h3,h4,.fade-title,.hero-block .title,.page-hero .en').forEach(el => {
        if (getComputedStyle(el).fontStyle === 'italic') out.italicHeads.push(el.className || el.tagName);
      });
      return out;
    });

    const tag = `${p} @${w}`;
    if (r.scrollW > r.clientW + 1) fails.push(`${tag} · horizontal scroll ${r.scrollW}>${r.clientW}`);
    if (r.htmlOverflowX !== 'clip') fails.push(`${tag} · html overflow-x=${r.htmlOverflowX}`);
    if (r.bodyOverflowX !== 'clip') fails.push(`${tag} · body overflow-x=${r.bodyOverflowX}`);
    if (r.wrappers.length) fails.push(`${tag} · wrapping affordance: ${r.wrappers.join(' | ')}`);
    if (r.smallTargets.length) fails.push(`${tag} · hit target <44: ${r.smallTargets.join(' | ')}`);
    if (r.italicHeads.length) fails.push(`${tag} · italic head: ${r.italicHeads.join(' | ')}`);
    if (r.bodyPx < 16) fails.push(`${tag} · body font ${r.bodyPx}px < 16`);
    if (!r.hasMain) fails.push(`${tag} · no <main id=main>`);
    if (!r.hasSkip) fails.push(`${tag} · no skip link`);
    // 行き先は site.js の DESTS と同数。読み物を足して 9 になった (2026-08-25)。
    // 10 = 客室/料理/温泉/施設/アクセス/よくある質問/結婚式/読み物/ご予約/ホーム。
    // 2026-08-28 に「ご予約」を追加 (予約エンジンへ戻す導線)。数を変えるときは
    // 足したものが本当に要るか考えること — この数は site.js の DESTS と同期する。
    if (r.navIndexItems !== 10) fails.push(`${tag} · nav index has ${r.navIndexItems} items (want 10)`);
    if (r.kickers) fails.push(`${tag} · ${r.kickers} kicker(s) remain`);
    if (r.inlineHover) fails.push(`${tag} · ${r.inlineHover} inline onmouseover remain`);
    if (r.splash) fails.push(`${tag} · splash remains`);
    if (consoleErrors.length) fails.push(`${tag} · console: ${consoleErrors.slice(0,2).join(' | ')}`);

    await ctx.close();
  }
}

await browser.close();
if (fails.length) { console.log('FAIL (' + fails.length + ')'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('PASS — ' + PAGES.length + ' pages × ' + WIDTHS.length + ' widths, all gates clear');
