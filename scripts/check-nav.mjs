// Run: python3 -m http.server 8793  (from repo root), then: node scripts/check-nav.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const fails = [];
for (const w of [375, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: w < 700, isMobile: w < 700 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8793/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // open
  await page.click('#navToggle');
  await page.waitForTimeout(400);
  let open = await page.getAttribute('#navIndex', 'data-open');
  if (open !== 'true') fails.push(`@${w} panel did not open`);
  // the toggle must remain clickable above the panel
  const hit = await page.evaluate(() => {
    const b = document.getElementById('navToggle').getBoundingClientRect();
    const el = document.elementFromPoint(b.x + b.width/2, b.y + b.height/2);
    return el ? (el.closest('#navToggle') ? 'toggle' : (el.className || el.tagName)) : 'none';
  });
  if (hit !== 'toggle') fails.push(`@${w} toggle occluded by ${hit}`);
  // close via the same control
  await page.click('#navToggle');
  await page.waitForTimeout(400);
  open = await page.getAttribute('#navIndex', 'data-open');
  if (open !== 'false') fails.push(`@${w} panel did not close via toggle`);

  // language switch must work at this width (bar on desktop, panel on phone)
  await page.click('#navToggle'); await page.waitForTimeout(300);
  const cands = await page.$$('.langs [data-lang="en"]');
  let clicked = false;
  for (const c of cands) { if (await c.isVisible()) { await c.click(); clicked = true; break; } }
  if (!clicked) fails.push(`@${w} no visible language button`);
  await page.waitForTimeout(300);
  const lang = await page.getAttribute('html', 'lang');
  if (lang !== 'en') fails.push(`@${w} language switch failed (lang=${lang})`);

  // escape closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.getAttribute('#navIndex','data-open') !== 'false') fails.push(`@${w} Escape did not close`);
  await ctx.close();
}
await browser.close();
if (fails.length) { console.log('FAIL'); fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
console.log('PASS — disclosure opens/closes, toggle reachable, lang switch works, Escape closes');
