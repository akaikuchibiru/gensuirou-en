// Run: python3 -m http.server 8793 (from repo root), then: node scripts/check-form-align.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
console.log('width | formH3 | formSub | field1 | textarea | button | (band centre check)');
for (const w of [320, 375, 414, 768, 1000, 1200, 1440, 1920]) {
  const ctx = await b.newContext({ viewport:{width:w,height:900} });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8793/index.html', { waitUntil:'load' });
  await p.waitForSelector('.skip',{state:'attached'});
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const R = s => { const e = document.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect(); return {l:Math.round(b.left), r:Math.round(b.right)}; };
    const sec = R('.form-section');
    const f = R('.form-wrap form');
    return {
      h3: R('.form-section h3').l, sub: R('.form-sub').l, inp: R('.field input').l,
      ta: R('.form-wrap textarea').l, btn: R('.form-wrap button').l,
      leftGap: f.l - sec.l, rightGap: sec.r - f.r,
    };
  });
  const edges = [r.h3, r.sub, r.inp, r.ta, r.btn];
  const aligned = new Set(edges).size === 1;
  const balanced = Math.abs(r.leftGap - r.rightGap) <= 2;
  console.log(String(w).padStart(5) + ' | ' + edges.map(x=>String(x).padStart(6)).join(' |') +
    '  L' + String(r.leftGap).padStart(4) + ' R' + String(r.rightGap).padStart(4) +
    (aligned ? '  edges✓' : '  EDGES MISMATCH') + (balanced ? ' centred✓' : ' OFF-CENTRE'));
  await ctx.close();
}
await b.close();
