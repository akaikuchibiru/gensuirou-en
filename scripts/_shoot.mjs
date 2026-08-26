import { chromium } from 'playwright-core';
const OUT = process.argv[2], WHICH = process.argv[3];
const args = WHICH==='old' ? ['--host-resolver-rules=MAP gensuirou.com 153.123.7.215'] : [];
const b = await chromium.launch({ channel:'chrome', args });
for (const d of [{n:'pc',w:1440,h:900,dsf:1}]) {
  const ctx = await b.newContext({viewport:{width:d.w,height:d.h},deviceScaleFactor:d.dsf,ignoreHTTPSErrors:true});
  const p = await ctx.newPage();
  try {
    await p.goto('https://gensuirou.com/',{waitUntil:'load',timeout:45000});
    await p.waitForTimeout(4000);
    await p.evaluate(()=>document.querySelectorAll('.anim,.fade,[class*=reveal]').forEach(e=>{e.style.opacity='1';e.style.transform='none';}));
    await p.waitForTimeout(500);
    await p.screenshot({path:`${OUT}/${WHICH}-${d.n}.png`});
    console.log(WHICH, d.n, JSON.stringify(await p.evaluate(()=>({title:document.title.slice(0,50), h1:(document.querySelector('h1')||{}).textContent?.trim().slice(0,44)}))));
  } catch(e){ console.log(WHICH,'ERR',e.message.split('\n')[0]); }
  await ctx.close();
}
await b.close();
