// 言語別 URL の検査。
//
//   node scripts/check-i18n.mjs [base-url]
//
// 見るもの:
//   1. 8 ページ × 3 言語が 200 で、html[lang] / title / description が言語ごとに違う
//   2. canonical が自己参照で、hreflang が ja/en/zh/x-default の 4 本そろっている
//   3. その言語以外の本文が **消えている** (CSS で隠すだけでは Google に 3 言語混在に見える)
//   4. 描画後の HTML に相対 URL が 1 つも残っていない
//   5. 全ページの全リンク・全アセットを実際に叩いて 404 が無い
//
// 5 が肝。書き換えの取りこぼしは目視では絶対に見つからない。/en/rooms から
// "assets/site.css" を読むと /en/assets/site.css になって静かに 404 する。
import { execFileSync } from 'node:child_process';
import { LANGS, PAGES, langPath } from '../src/i18n.js';

const BASE = process.argv[2] || 'https://gensuirou.japanese-government-official.workers.dev';
let bad = 0;
const ok = (m) => console.log('  OK  ' + m);
const ng = (m) => { console.log('  NG  ' + m); bad++; };

// node の fetch は IPv6 の取りこぼしで落ちることがあるので curl を使う。
function get(url) {
  try {
    const out = execFileSync('curl', ['-sS', '--max-time', '30', '-w', '\\n@@%{http_code}', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const i = out.lastIndexOf('\n@@');
    return { body: out.slice(0, i), status: Number(out.slice(i + 3)) };
  } catch (e) {
    return { body: '', status: 0 };
  }
}
function head(url) {
  try {
    return Number(execFileSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '30', url],
      { encoding: 'utf8' }));
  } catch { return 0; }
}

const attr = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

console.log(`検査対象: ${BASE}`);
console.log('── ページごとの言語・メタ・hreflang');

const seen = new Set();   // 全ページから集めたリンク/アセット
const pages = Object.keys(PAGES);

for (const path of pages) {
  for (const lang of LANGS) {
    const url = BASE + langPath(lang, path);
    const { body, status } = get(url);
    const label = `${langPath(lang, path)} [${lang}]`;
    if (status !== 200) { ng(`${label} status=${status}`); continue; }

    // 1. html[lang]
    const htmlLang = attr(body, /<html[^>]*\blang="([^"]*)"/i);
    htmlLang === lang ? ok(`${label} html[lang]=${htmlLang}`) : ng(`${label} html[lang]=${htmlLang} (期待 ${lang})`);

    // 2. title / description がその言語のもの
    const title = attr(body, /<title>([\s\S]*?)<\/title>/i);
    const desc = attr(body, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
    title === PAGES[path][lang].title ? ok(`${label} title`) : ng(`${label} title="${title}"`);
    desc === PAGES[path][lang].desc ? ok(`${label} description`) : ng(`${label} description が違う`);

    // 3. canonical は自己参照
    const canon = attr(body, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
    canon === url ? ok(`${label} canonical 自己参照`) : ng(`${label} canonical=${canon} (期待 ${url})`);

    // 4. hreflang 4 本
    const alts = {};
    for (const m of body.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]*)"[^>]+href="([^"]*)"/gi)) alts[m[1]] = m[2];
    const want = Object.fromEntries(LANGS.map((l) => [l, BASE + langPath(l, path)]));
    want['x-default'] = BASE + langPath('ja', path);
    const missing = Object.entries(want).filter(([k, v]) => alts[k] !== v);
    missing.length === 0 ? ok(`${label} hreflang 4 本`) : ng(`${label} hreflang: ${JSON.stringify(missing)}`);

    // 5. 他言語の本文が消えている
    // ⚠ 単純な includes だと data-enquiry を data-en として拾う (2026-08-25 誤検出)。
    //    属性名として一致させる。
    const others = LANGS.filter((l) => l !== lang)
      .filter((l) => new RegExp(`data-${l}\\b`).test(body));
    others.length === 0 ? ok(`${label} 他言語の本文なし`) : ng(`${label} data-${others.join('/')} が残っている`);

    // 6. 相対 URL が残っていない
    const rel = [];
    for (const m of body.matchAll(/\b(?:href|src|poster)="([^"]*)"/gi)) {
      const v = m[1].trim();
      if (!v || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(v)) continue;
      rel.push(v);
    }
    rel.length === 0 ? ok(`${label} 相対 URL なし`) : ng(`${label} 相対 URL が残存: ${[...new Set(rel)].slice(0, 5).join(', ')}`);

    // リンク収集 (同一オリジンのみ)
    for (const m of body.matchAll(/\b(?:href|src|poster)="([^"]*)"/gi)) {
      const v = m[1].trim();
      if (v.startsWith('/')) seen.add(v.split('#')[0]);
    }
  }
}

console.log(`── 収集した内部 URL ${seen.size} 本を実際に叩く`);
let dead = 0;
for (const u of [...seen].sort()) {
  const s = head(BASE + u);
  if (s >= 400 || s === 0) { ng(`${u} → ${s}`); dead++; }
}
dead === 0 ? ok(`${seen.size} 本すべて到達`) : ng(`${dead} 本が到達不能`);

console.log('── robots.txt / sitemap.xml');
const r = get(BASE + '/robots.txt');
r.status === 200 ? ok('robots.txt 200') : ng(`robots.txt ${r.status}`);
const sm = get(BASE + '/sitemap.xml');
if (sm.status !== 200) ng(`sitemap.xml ${sm.status}`);
else {
  const locs = [...sm.body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  const expect = pages.flatMap((p) => LANGS.map((l) => BASE + langPath(l, p)));
  const miss = expect.filter((e) => !locs.includes(e));
  locs.length === expect.length && miss.length === 0
    ? ok(`sitemap ${locs.length} URL (${pages.length} ページ × ${LANGS.length} 言語) すべて一致`)
    : ng(`sitemap ${locs.length} URL / 欠落 ${miss.length}: ${miss.slice(0, 3)}`);
  // sitemap に載せた URL が本当に 200 か。載っているのに 404 は GSC で全部弾かれる。
  const badLoc = locs.filter((l) => head(l) !== 200);
  badLoc.length === 0 ? ok('sitemap の全 URL が 200') : ng(`sitemap に 200 でない URL: ${badLoc.slice(0, 3)}`);
}

console.log('── /en 配下の 404 が英語のままか');
const nf = get(BASE + '/en/no-such-page');
if (nf.status !== 404) ng(`/en/no-such-page status=${nf.status}`);
else {
  const l = attr(nf.body, /<html[^>]*\blang="([^"]*)"/i);
  l === 'en' ? ok('/en/no-such-page → 404 かつ lang=en') : ng(`/en の 404 が lang=${l}`);
}
const strip = head(BASE + '/en/assets/site.css');
[200, 301].includes(strip) ? ok(`/en/assets/site.css → ${strip} (接頭辞を外して救済)`) : ng(`/en/assets/site.css → ${strip}`);

console.log('────────────────────────────────────────────');
console.log(bad === 0 ? 'I18N PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
