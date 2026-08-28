// 検索まわりの、目視では原理的に見えない欠陥を数える。
//   node scripts/check-seo.mjs [base-url]
//
// 見るもの:
//   1. title / description の 長さ と 重複
//   2. h1 が 1 本あるか、ページごとに違うか (SPA shell の h1 漏れの検出)
//   3. canonical が自己参照か
//   4. og:image が実在するか
//   5. img の alt 欠落
//   6. トップからの到達クリック数 (孤立ページ)  ※ sitemap は内部リンクの代わりにならない
//   7. 旧サイトの URL が 301 で受け止められているか
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

// ⚠ checkVisibility() は **素で呼ぶと visibility:hidden と opacity:0 を「見えている」と返す**。
//   既定で見るのは display:none と content-visibility だけ (2026-08-28 に実測)。
//   閉じたスライドインパネルの中身まで数えてしまうので、必ず全オプションを渡す。

const BASE = process.argv[2] || 'https://gensuirou.com';
const OLD_IP = '153.123.7.215';
// 表示幅。全角 2 / 半角 1 で数える。Google の切り詰めは約 600px = 62 単位。
const width = (s) => [...s].reduce((n, c) => n + (/[　-鿿＀-￯]/.test(c) ? 2 : 1), 0);
const TITLE_MAX = 62, DESC_MAX = 250, DESC_MIN = 60;

const sitemap = execFileSync('curl', ['-sS', '--max-time', '30', BASE + '/sitemap.xml'], { encoding: 'utf8' });
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// ヒーロー動画は 18.8MB。69 ページを順に開くと 'load' が待てない (実測タイムアウト)。
// 見たいのは head と DOM なので、動画と音声は最初から落とさない。
await page.route('**/*', (route) => {
  const t = route.request().resourceType();
  return (t === 'media' || /\.(mp4|webm)(\?|$)/i.test(route.request().url()))
    ? route.abort() : route.continue();
});
let bad = 0;
const titles = new Map(), descs = new Map(), h1s = new Map();
const rows = [];

for (const u of urls) {
  const res = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(700);   // site.js がヘッダー/フッタを描くのを待つ
  const r = await page.evaluate(() => {
    const meta = (n) => (document.querySelector(`meta[name="${n}"]`) || {}).content || '';
    const prop = (n) => (document.querySelector(`meta[property="${n}"]`) || {}).content || '';
    const h1el = [...document.querySelectorAll('h1')];
    const imgs = [...document.images].filter((i) => i.checkVisibility && i.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }));
    return {
      title: document.title,
      desc: meta('description'),
      robots: meta('robots'),
      canonical: (document.querySelector('link[rel=canonical]') || {}).href || '',
      og: prop('og:image'),
      h1n: h1el.length,
      h1: h1el.map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
      // ⚠ alt="" は **欠落ではない**。装飾画像に対する正しい書き方で、
      //   読み上げから意図的に外すためのもの。!alt だと空文字も拾ってしまい、
      //   2026-08-28 に「126 枚欠落」と誤報した (実際の欠落は 0 枚)。
      //   欠陥は「alt 属性が無い」ことだけ。
      noAlt: imgs.filter((i) => i.getAttribute('alt') === null).length,
      imgs: imgs.length,
      // 装飾画像だけを含む押せる要素は、名前が無いと「リンク」としか読まれない。
      // 検索から見てもアンカー文言が空になる。ここが本当の欠陥。
      unnamed: [...document.querySelectorAll('a[href],button')]
        .filter((el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }))
        .filter((el) => !((el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') ||
          [...el.querySelectorAll('img')].map((i) => i.getAttribute('alt') || '').join('').trim()))
        .map((el) => (el.className || el.tagName).toString().slice(0, 24)),
      links: [...document.querySelectorAll('a[href]')]
        .map((a) => a.href).filter((h) => h.startsWith(location.origin)),
    };
  });
  rows.push({ u, ...r, status: res.status() });
  const key = (m, k, v) => { if (!v) return; (m.get(v) || m.set(v, []).get(v)).push(k); };
  key(titles, u, r.title); key(descs, u, r.desc); key(h1s, u, r.h1);
}

const say = (okc, msg) => { if (!okc) bad++; console.log(`  ${okc ? 'OK' : 'NG'}  ${msg}`); };
console.log(`検査対象 ${urls.length} URL\n── 1. title`);
const longT = rows.filter((r) => width(r.title) > TITLE_MAX);
say(!longT.length, longT.length ? `長すぎ ${longT.length} 本 (上限 ${TITLE_MAX} 単位): ` +
  longT.slice(0, 3).map((r) => `${r.u.replace(BASE, '')}=${width(r.title)}`).join(' ') : `全 ${rows.length} 本が ${TITLE_MAX} 単位以内`);
const dupT = [...titles].filter(([, v]) => v.length > 1);
say(!dupT.length, dupT.length ? `重複 ${dupT.length} 組: ` + dupT.slice(0, 2).map(([t, v]) => `"${t.slice(0, 26)}"×${v.length}`).join(' ') : '重複なし');

console.log('── 2. description');
const badD = rows.filter((r) => !r.desc || width(r.desc) < DESC_MIN || width(r.desc) > DESC_MAX);
say(!badD.length, badD.length ? `長さが範囲外 ${badD.length} 本: ` + badD.slice(0, 3).map((r) => `${r.u.replace(BASE, '')}=${width(r.desc)}`).join(' ') : `全 ${rows.length} 本が ${DESC_MIN}〜${DESC_MAX} 単位`);
const dupD = [...descs].filter(([, v]) => v.length > 1);
say(!dupD.length, dupD.length ? `重複 ${dupD.length} 組` : '重複なし');

console.log('── 3. h1');
const badH = rows.filter((r) => r.h1n !== 1);
say(!badH.length, badH.length ? `h1 が 1 本でない ${badH.length} 本` : '全ページ h1 が 1 本');
const dupH = [...h1s].filter(([, v]) => v.length > 1);
say(!dupH.length, dupH.length ? `h1 が使い回し ${dupH.length} 組: ` + dupH.slice(0, 2).map(([t, v]) => `"${t.slice(0, 24)}"×${v.length}`).join(' ') : '全ページ違う h1');

console.log('── 4. canonical / robots / og');
const badC = rows.filter((r) => r.canonical !== r.u);
say(!badC.length, badC.length ? `自己参照でない ${badC.length} 本: ` + badC.slice(0, 2).map((r) => r.u.replace(BASE, '')).join(' ') : '全ページ自己参照');
const noix = rows.filter((r) => /noindex/.test(r.robots));
say(!noix.length, noix.length ? `noindex が付いている ${noix.length} 本` : 'noindex なし');
const ogMissing = rows.filter((r) => !r.og || /\.svg$/i.test(r.og));
say(!ogMissing.length, ogMissing.length ? `og:image が無い/SVG ${ogMissing.length} 本` : 'og:image あり (SVG でない)');

console.log('── 5. 画像の alt / 押せる要素の名前');
const noAlt = rows.filter((r) => r.noAlt > 0);
say(!noAlt.length, noAlt.length ? `alt 属性が無い ${noAlt.reduce((a, r) => a + r.noAlt, 0)} 枚 / ${noAlt.length} ページ`
  : `全 ${rows.reduce((a, r) => a + r.imgs, 0)} 枚に alt 属性あり (空文字は装飾として正しい)`);
const unnamed = rows.filter((r) => r.unnamed.length);
say(!unnamed.length, unnamed.length
  ? `名前の無い操作 ${unnamed.reduce((a, r) => a + r.unnamed.length, 0)} 件 / ${unnamed.length} ページ: ` +
    unnamed.slice(0, 3).map((r) => `${r.u.replace(BASE, '')}(${r.unnamed.slice(0, 2).join(',')})`).join(' ')
  : '押せる要素すべてに読み上げ名あり');

console.log('── 6. トップからの到達クリック数');
const jaUrls = new Set(rows.filter((r) => !/\/(en|zh)\//.test(r.u)).map((r) => r.u));
const byUrl = new Map(rows.map((r) => [r.u, r]));
const depth = new Map([[BASE + '/', 0]]);
let frontier = [BASE + '/'];
while (frontier.length) {
  const next = [];
  for (const u of frontier) {
    const r = byUrl.get(u); if (!r) continue;
    for (const l of new Set(r.links.map((x) => x.split('#')[0].replace(/\/$/, '') || BASE + '/'))) {
      const t = jaUrls.has(l) ? l : (jaUrls.has(l + '/') ? l + '/' : null);
      if (t && !depth.has(t)) { depth.set(t, depth.get(u) + 1); next.push(t); }
    }
  }
  frontier = next;
}
const orphan = [...jaUrls].filter((u) => !depth.has(u));
say(!orphan.length, orphan.length ? `トップから辿り着けない ${orphan.length} 本: ` + orphan.slice(0, 4).map((u) => u.replace(BASE, '')).join(' ') : `日本語 ${jaUrls.size} ページすべて到達 (最大 ${Math.max(...depth.values())} クリック)`);

console.log('── 7. 旧サイトの URL が 301 で受け止められているか');
const OLD = ['/index.html', '/rooms/index.html', '/cuisine/index.html', '/onsen/index.html',
  '/facilities/index.html', '/access/index.html', '/faq/index.html', '/wedding/index.html',
  '/reservation/index.html', '/m/', '/m/index.html', '/m/rooms/index.html',
  '/rooms/aoi/index.html', '/rooms/shiori/index.html'];
let redirBad = [];
for (const p of OLD) {
  const out = execFileSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code} %{redirect_url}',
    '--max-time', '20', BASE + p], { encoding: 'utf8' }).trim();
  const [code, to] = out.split(' ');
  if (!(code === '301' && to && to.startsWith(BASE))) redirBad.push(`${p} → ${out}`);
}
say(!redirBad.length, redirBad.length ? `301 でない ${redirBad.length} 本: ` + redirBad.slice(0, 3).join(' / ') : `旧 ${OLD.length} URL すべて 301`);

await b.close();
console.log('─'.repeat(66));
console.log(bad === 0 ? 'SEO PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
