// Run: python3 -m http.server 8793  (from repo root), then: node scripts/check-contrast.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const fails = [];
for (const p of ['index.html','rooms.html','cuisine.html','onsen.html','access.html','faq.html','facilities.html','wedding.html']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8793/' + p, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const bad = await page.evaluate(() => {
    // Resolve ANY css colour (incl. oklch) to sRGBA via canvas.
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const cache = new Map();
    const toRGBA = (css) => {
      if (cache.has(css)) return cache.get(css);
      cx.clearRect(0,0,1,1); cx.fillStyle = '#000';
      cx.fillStyle = css;                       // invalid → stays #000
      cx.clearRect(0,0,1,1); cx.fillRect(0,0,1,1);
      const d = cx.getImageData(0,0,1,1).data;
      const v = [d[0],d[1],d[2],d[3]/255];
      cache.set(css, v); return v;
    };
    const over = (fg, bg) => fg.slice(0,3).map((c,i) => c*fg[3] + bg[i]*(1-fg[3]));
    const lum = (c) => { const [r,g,bl] = c.map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*bl; };
    // Composite the effective background by walking ancestors.
    const bgOf = (el) => {
      const stack = []; let n = el;
      while (n) { const c = toRGBA(getComputedStyle(n).backgroundColor); if (c[3] > 0) stack.push(c); n = n.parentElement; }
      let base = [12,10,7];
      for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
      return base;
    };
    const hidden = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return true;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return true;
      if (r.right < 0 || r.bottom < 0) return true;           // off-canvas (skip link, h1.seo)
      if (el.closest('.skip, h1.seo, .nav-index[data-open="false"]')) return true;
      return false;
    };
    const out = [];
    document.querySelectorAll('p,li,td,a,button,h1,h2,h3,h4,.fade-body,.form-sub,.addr,.fine,.form-note,.numbers .l,.numbers .k,.room-label .roman,.hero-block .sub,.hero-block .eyebrow').forEach(el => {
      if (hidden(el)) return;
      const txt = (el.textContent||'').trim(); if (!txt) return;
      const cs = getComputedStyle(el);
      const fgc = toRGBA(cs.color);
      const bg = bgOf(el);
      const fg = over(fgc, bg);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight)||400;
      const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
      if (ratio < need) out.push(`${el.tagName}.${(el.className||'').toString().split(' ')[0]} "${txt.slice(0,16)}" ${ratio.toFixed(2)}:1 need ${need} (${Math.round(size)}px)`);
    });
    return [...new Set(out)].slice(0, 8);
  });
  if (bad.length) fails.push(p + '\n      ' + bad.join('\n      '));
  await ctx.close();
}
await b.close();
if (fails.length) { console.log('CONTRAST FAIL'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('CONTRAST PASS — gates 40–41 clear on all 8 pages @1280');
