import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel:'chrome' });
const WIDTHS = [320,375,414,600,768,1024,1280,1440];
const URLS = ['https://gensuirou.com/','https://gensuirou.com/en/','https://gensuirou.com/rooms/zui'];
let bad = 0;

// ① 見かけの大きさ (x-height 換算) が 14px を下回るテキストが無いか
console.log('■ 文字の見かけの大きさ  (基準 x-height 0.5em / 下限 14px)');
for (const url of URLS) {
  const ctx = await b.newContext({viewport:{width:1440,height:900}});
  const p = await ctx.newPage();
  await p.goto(url,{waitUntil:'load',timeout:45000}); await p.waitForTimeout(2500);
  const small = await p.evaluate(() => {
    const out=[]; const seen=new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!el.checkVisibility || !el.checkVisibility()) continue;
      const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('').trim();
      if (own.length<1) continue;
      const cs=getComputedStyle(el); const px=parseFloat(cs.fontSize);
      if (px<=2 || cs.clipPath!=='none' || el.classList.contains('seo') || el.classList.contains('skip')) continue;  // 視覚的隠し
      const fam=cs.fontFamily.split(',')[0].replace(/['"]/g,'');
      const adj=cs.fontSizeAdjust;
      // font-size-adjust が効いていれば見かけ = px。none なら書体の x-height 比。
      // Cormorant に漢字・かなの字形は無い。指定が Cormorant でも
      // CJK 文字は代替書体 (x-height 0.5 前後) で描かれるので換算しない。
      const latinOnly = !/[぀-ヿ㐀-鿿]/.test(own);
      const xh = (/Cormorant/.test(fam) && latinOnly) ? 0.386
               : /Noto Serif SC/.test(fam) ? 0.516 : 0.5;
      const app = (adj && adj!=='none') ? px : px*(xh/0.5);
      if (app >= 14) continue;
      const k=fam+px+el.className; if(seen.has(k))continue; seen.add(k);
      out.push({px:+px.toFixed(1),app:+app.toFixed(1),fam:fam.slice(0,18),cls:(el.className||el.tagName).toString().slice(0,24),t:own.slice(0,20)});
    }
    return out;
  });
  console.log(`  ${url}`);
  if (!small.length) console.log('    OK  14px 未満なし');
  else { bad++; for (const s of small) console.log(`    NG ${String(s.px).padStart(5)}px → 見かけ ${String(s.app).padStart(5)}px  ${s.fam.padEnd(18)} ${s.cls.padEnd(24)} "${s.t}"`); }
  await ctx.close();
}

// ② ヘッダーの折返し / 横あふれ
console.log('\n■ 幅ごとの ヘッダー と ページ の あふれ');
console.log('   幅   ヘッダー高  brand右端  nav右端  ページ横あふれ  ロゴ');
for (const w of WIDTHS) {
  const ctx = await b.newContext({viewport:{width:w,height:900},deviceScaleFactor:2,isMobile:w<600,hasTouch:w<600});
  const p = await ctx.newPage();
  await p.goto('https://gensuirou.com/',{waitUntil:'load',timeout:45000}); await p.waitForTimeout(2200);
  const r = await p.evaluate(() => {
    const nav=document.querySelector('.nav-inner'), brand=document.querySelector('.brand');
    const right=document.querySelector('.nav-right');
    const img=document.querySelector('.brand img'), txt=document.querySelector('.brand .txt');
    const vis=(e)=>e&&e.checkVisibility&&e.checkVisibility();
    return { h:Math.round(nav.getBoundingClientRect().height),
      brandR:Math.round(brand.getBoundingClientRect().right),
      rightL:Math.round(right.getBoundingClientRect().left),
      over:Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      logos:[vis(img)?'画像':null, vis(txt)?'文字':null].filter(Boolean).join('+')||'なし' };
  });
  const collide = r.brandR > r.rightL;
  const flag = (collide?' ←重なり':'') + (r.over>0?' ←横あふれ':'') + (r.logos.includes('+')?' ←ロゴ2つ':'');
  if (collide || r.over>0 || r.logos.includes('+')) bad++;
  console.log(`  ${String(w).padStart(5)} ${String(r.h).padStart(9)}px ${String(r.brandR).padStart(9)} ${String(r.rightL).padStart(8)} ${String(r.over).padStart(13)}px  ${r.logos}${flag}`);
  await ctx.close();
}
await b.close();
console.log('─'.repeat(70));
console.log(bad===0?'TYPE & HEADER PASS':`FAIL — ${bad} 件`);
process.exit(bad?1:0);
