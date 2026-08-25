// 言語別 URL のブラウザ側検査。
//
//   node scripts/check-i18n-browser.mjs [base-url]
//
// check-i18n.mjs はサーバが返す HTML しか見ない。ヘッダ・フッタ・言語切替は
// site.js が実行時に組み立てるので、そこは実際に描画してクリックしないと
// 検証できない。挿入した markup は「存在する」ではなく「押して行き先が正しい」で測る。
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'https://gensuirou.japanese-government-official.workers.dev';
let bad = 0;
const ok = (m) => console.log('  OK  ' + m);
const ng = (m) => { console.log('  NG  ' + m); bad++; };

const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
page.on('response', (r) => { if (r.status() >= 400 && new URL(r.url()).origin === new URL(BASE).origin) errors.push(`${r.status()} ${r.url()}`); });

console.log(`検査対象: ${BASE}`);

// ── 1. 各言語で、JS が生成したリンクが全部その言語の接頭辞を持つか ──
console.log('── 生成されたヘッダ・フッタのリンクが言語接頭辞を保つか');
for (const [lang, prefix] of [['ja', ''], ['en', '/en'], ['zh', '/zh']]) {
  await page.goto(`${BASE}${prefix}/rooms`, { waitUntil: 'load' });
  await page.waitForSelector('.langs a', { state: 'attached' });
  const r = await page.evaluate((pfx) => {
    // 言語切替そのものは他言語を指すのが仕事なので除外する。
    const links = [...document.querySelectorAll('header a[href], footer a[href], .nav-index a[href]')]
      .filter((a) => !a.closest('.langs'))
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h.startsWith('/'))
      .map((h) => h.split('#')[0] || h);   // /en#reserve は /en として見る
    const wrong = links.filter((h) => (pfx === '' ? /^\/(en|zh)(\/|$)/.test(h) : !(h === pfx || h.startsWith(pfx + '/'))));
    return { total: links.length, wrong: [...new Set(wrong)], lang: document.documentElement.lang };
  }, prefix);
  r.lang === lang ? ok(`${prefix || '/'}/rooms html[lang]=${r.lang}`) : ng(`html[lang]=${r.lang} (期待 ${lang})`);
  r.wrong.length === 0
    ? ok(`${prefix || '/'}/rooms 生成リンク ${r.total} 本すべて接頭辞が正しい`)
    : ng(`${prefix || '/'}/rooms 接頭辞が違うリンク: ${r.wrong.slice(0, 5).join(', ')}`);
}

// ── 2. 言語切替を実際に押して、同じページの別言語に行くか ──
console.log('── 言語切替を実際にクリックする');
for (const [from, to, wantPath] of [
  ['/rooms', 'en', '/en/rooms'],
  ['/en/rooms', 'zh', '/zh/rooms'],
  ['/zh/cuisine', 'ja', '/cuisine'],
  ['/en', 'ja', '/'],
  ['/faq', 'zh', '/zh/faq'],
]) {
  await page.goto(BASE + from, { waitUntil: 'load' });
  const sel = `.langs a[data-lang="${to}"]`;
  await page.waitForSelector(sel, { state: 'visible' });
  await Promise.all([page.waitForURL('**', { waitUntil: 'load' }), page.click(sel)]);
  const got = new URL(page.url()).pathname;
  const lang = await page.evaluate(() => document.documentElement.lang);
  got === wantPath && lang === to
    ? ok(`${from} で「${to}」を押す → ${got} (lang=${lang})`)
    : ng(`${from} で「${to}」を押した結果 ${got} (lang=${lang})、期待 ${wantPath}`);
}

// ── 3. 言語内を回遊しても言語が落ちないか ──
console.log('── 英語のまま回遊できるか (メニュー → 客室 → 予約導線)');
await page.goto(BASE + '/en', { waitUntil: 'load' });
await page.click('#navToggle');
await page.waitForSelector('.nav-index[data-open="true"] a', { state: 'visible' });
await Promise.all([page.waitForURL('**', { waitUntil: 'load' }), page.click('.nav-index a[href="/en/rooms"]')]);
let path = new URL(page.url()).pathname;
path === '/en/rooms' ? ok(`メニューから /en/rooms`) : ng(`メニューの行き先が ${path}`);
const reserve = await page.getAttribute('header .reserve-btn', 'href');
reserve === '/en/#reserve' || reserve === '/en#reserve'
  ? ok(`予約導線 ${reserve} が英語のまま`)
  : ng(`予約導線が ${reserve}`);

// ── 4. 切替リンクの当たり判定 (44px 以上) ──
console.log('── 言語切替の当たり判定');
const boxes = await page.evaluate(() =>
  [...document.querySelectorAll('.langs a')].map((a) => {
    const r = a.getBoundingClientRect();
    return { t: a.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), vis: a.checkVisibility() };
  }));
const small = boxes.filter((x) => x.vis && x.h < 44);
small.length === 0
  ? ok(`可視な切替 ${boxes.filter((x) => x.vis).length} 本すべて 44px 以上 (${boxes.filter((x) => x.vis).map((x) => x.h + 'px').join(' ')})`)
  : ng(`44px 未満: ${JSON.stringify(small)}`);

console.log('── JS エラーと 4xx');
errors.length === 0 ? ok('なし') : ng(`${errors.length} 件: ${[...new Set(errors)].slice(0, 5).join(' / ')}`);

await b.close();
console.log('────────────────────────────────────────────');
console.log(bad === 0 ? 'I18N BROWSER PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
