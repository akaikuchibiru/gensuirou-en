// 日本語話者が外国語の面に着地したときの案内帯を実描画で検査する。
//
//   node scripts/check-langsug.mjs [base-url]     # 既定 https://gensuirou.com
//
// なぜ要るか:
//   Instagram / Facebook のプロフィールのリンクが /en/reservation を指しており
//   (こちらでは直せない)、日本の携帯からそのまま英語ページに着いている。
//   帯はその人を日本語へ渡すためだけのもの。**リダイレクトはしない** ので、
//   「出る条件」と「出ない条件」の両方を測らないと意味がない。
//
// ⚠ この帯の文言は JS が組むので、書体の部分集合の走査 (_font-inventory.mjs)
//   には映らない。英語・中国語の面の --font-ja は 21 字の部分集合なので、
//   帯だけは端末の明朝で統一している。ここで「部分集合を使っていない」ことを
//   検査しているのはそのため (戻すと字が混ざる)。
import { chromium } from 'playwright-core';

const BASE = (process.argv[2] || 'https://gensuirou.com').replace(/\/$/, '');
// ローカルの wrangler dev は http なので https 強制に捕まる。cf-visitor で名乗る。
const HEADERS = BASE.startsWith('http://') ? { 'cf-visitor': '{"scheme":"https"}' } : {};
// 同じ理由でローカルだけ資産が cross-origin (本番は https で同一生成元) になり
// CSP に弾かれる。ローカルのときだけ CSP の console error を数えない。
const LOCAL = BASE.startsWith('http://');

const browser = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  OK  ' : '  NG  ') + m); if (!c) fail++; };

async function open({ locale, path, width = 360 }) {
  const ctx = await browser.newContext({
    locale, extraHTTPHeaders: HEADERS,
    viewport: { width, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !(LOCAL && /Content Security Policy/.test(t))) errs.push(t);
  });
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  return { page, ctx, errs };
}

const read = (page) => page.evaluate(() => {
  const d = document.querySelector('.langsug');
  const mc = document.querySelector('.mcta');
  const mctaShown = mc ? getComputedStyle(mc).display !== 'none' : false;
  if (!d) return { present: false, bodyPad: getComputedStyle(document.body).paddingBottom };
  const a = d.querySelector('a'), x = d.querySelector('.langsug-x');
  const rd = d.getBoundingClientRect();
  return {
    present: true, text: a.textContent, href: a.getAttribute('href'),
    pos: getComputedStyle(d).position,
    inView: rd.bottom <= innerHeight + 1 && rd.top >= 0,
    bandH: Math.round(rd.height),
    tapA: Math.round(a.getBoundingClientRect().height),
    tapX: Math.round(x.getBoundingClientRect().height),
    linkFont: getComputedStyle(a).fontFamily,
    bg: getComputedStyle(d).backgroundColor,
    bodyPad: getComputedStyle(document.body).paddingBottom,
    mctaShown,
    gapOverMcta: mctaShown ? Math.round(rd.top - mc.getBoundingClientRect().bottom) : null,
  };
});

const cls = (page) => page.evaluate(() => new Promise((res) => {
  let v = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
  setTimeout(() => res(Number(v.toFixed(4))), 600);
}));

console.log(`── ${BASE}\n`);

console.log('日本語が第一希望の端末 / /en/reservation / 360px');
{
  const { page, ctx, errs } = await open({ locale: 'ja-JP', path: '/en/reservation' });
  const r = await read(page);
  const c = await cls(page);
  console.log('   ', JSON.stringify(r));
  ok(r.present, '帯が出る');
  ok(r.href === '/reservation', `リンク先が日本語版 (実測 ${r.href})`);
  ok(r.pos === 'fixed' && r.inView, '画面下に固定で見えている');
  ok(r.tapA >= 44 && r.tapX >= 44, `タップ域 44px 以上 (リンク ${r.tapA} / 閉じる ${r.tapX})`);
  ok(!/Gensuirou/.test(r.linkFont), '部分集合フォントに依存していない');
  ok(r.bg !== 'rgba(0, 0, 0, 0)', `地が不透明 (${r.bg})`);
  ok(c <= 0.01, `CLS ${c} ≤ 0.01`);
  ok(errs.length === 0, `JS エラー 0 (${errs.join(' | ')})`);
  await page.click('.langsug-x');
  ok(await page.evaluate(() => !document.querySelector('.langsug')
    && !document.body.classList.contains('has-langsug')), '× で消える');
  await page.goto(`${BASE}/en/`, { waitUntil: 'load' });
  ok(!(await page.evaluate(() => !!document.querySelector('.langsug'))),
    '閉じたら同じセッションでは出ない');
  await ctx.close();
}

console.log('\n浮いている予約 CTA と重ならない (360px で両方出る面)');
for (const path of ['/en/', '/en/rooms', '/zh/rooms']) {
  const { page, ctx } = await open({ locale: 'ja-JP', path });
  const r = await read(page);
  ok(r.present && r.mctaShown && r.gapOverMcta > 0,
    `${path} 帯=${r.present} CTA=${r.mctaShown} 隙間=${r.gapOverMcta}px`);
  await ctx.close();
}

console.log('\n出てはいけない場合');
{
  const { page, ctx } = await open({ locale: 'ja-JP', path: '/reservation' });
  const r = await read(page);
  ok(!r.present, '日本語のページには出ない');
  ok(parseFloat(r.bodyPad) < 64, `body の余白も足されない (${r.bodyPad})`);
  await ctx.close();
}
{
  const { page, ctx } = await open({ locale: 'en-US', path: '/en/reservation' });
  ok(!(await read(page)).present, '英語が第一希望の端末には出ない');
  await ctx.close();
}
{
  const { page, ctx } = await open({ locale: 'zh-CN', path: '/zh/' });
  ok(!(await read(page)).present, '中国語が第一希望の端末には出ない');
  await ctx.close();
}

console.log('\n広い幅 (1280px)');
{
  const { page, ctx } = await open({ locale: 'ja-JP', path: '/en/', width: 1280 });
  const r = await read(page);
  const c = await cls(page);
  ok(r.present && r.inView, `帯が画面内 (高さ ${r.bandH}px)`);
  ok(c <= 0.01, `CLS ${c}`);
  await ctx.close();
}

await browser.close();
console.log('\n────────────────────────────');
console.log(fail ? `LANGSUG FAIL  ${fail} 件` : 'LANGSUG PASS');
process.exit(fail ? 1 : 0);
