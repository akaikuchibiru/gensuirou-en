// 構造化データの検査。
//
//   node scripts/check-schema.mjs [base-url]
//
// 見るもの:
//   1. 24 ページすべてに JSON-LD が 1 つあり、**JSON として parse できる**
//      (</script> のエスケープ漏れはここで落ちる。目視では気付けない)
//   2. ページ種別ごとに必要なノードがそろっている
//   3. **本文とのズレ検出** — FAQ の設問・客室名・パンくずの語が、
//      実際にそのページに描画されている文字列と一致するか。
//      構造化データのためだけに本文を二重に持っているので、
//      「重複させない」ではなく「ズレたら落とす」で守る
//   4. **持っていない事実を出していないか** — priceRange / aggregateRating /
//      geo / starRating / review。埋めたくなる欄なので機械で禁止する
import { execFileSync } from 'node:child_process';
import { LANGS, PAGES, langPath } from '../src/i18n.js';
import { FAQ, ROOMS } from '../src/content-data.js';
import { jsonLd } from '../src/schema.js';

const BASE = process.argv[2] || 'https://gensuirou.japanese-government-official.workers.dev';
let bad = 0;
const ok = (m) => console.log('  OK  ' + m);
const ng = (m) => { console.log('  NG  ' + m); bad++; };

function get(url) {
  try {
    return execFileSync('curl', ['-sS', '--max-time', '30', url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// 持っていない事実。作れば規約違反にも実害にもなる。
//
// geo は 2026-08-28 に **外した**。旅館が自分のサイトの地図に置いていた
// ピン (place id 0x3540e70c75a8c961:0x4956ef597574e46a) が見つかり、
// 推測ではなくなったため。OSM の 小森 重心と 1.65km で照合済み。
// priceRange は今も出さない — 料金の唯一の出所は予約エンジン sec.489.jp で、
// 転記した瞬間に実際の請求額とズレる ([[feedback_price_in_multiple_places]])。
const FORBIDDEN = ['priceRange', 'aggregateRating', 'starRating', 'review', 'ratingValue'];

// 逆に **必ず要る** もの。予約の入口を検索エンジンに見せられなくなると、
// 2026-08-24〜28 の障害 (予約導線の消失) が構造化データ側で再発する。
const REQUIRED_ON_HOME = { 'ReserveAction': 'sec.489.jp' };

console.log(`検査対象: ${BASE}`);

for (const path of Object.keys(PAGES)) {
  for (const lang of LANGS) {
    const label = `${langPath(lang, path)} [${lang}]`;
    const html = get(BASE + langPath(lang, path));
    if (!html) { ng(`${label} 取得できない`); continue; }

    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!m) { ng(`${label} JSON-LD が無い`); continue; }
    let data;
    try { data = JSON.parse(m[1]); }
    catch (e) { ng(`${label} JSON-LD が parse できない: ${e.message}`); continue; }

    const graph = data['@graph'] || [];
    const types = new Set(graph.map((n) => n['@type']));

    // 2. 必要なノード。ページ種別で名乗る型が変わる。
    //    FAQ は FAQPage、読み物の一覧は CollectionPage (WebPage の下位型で、
    //    一覧ページとしてはこちらが正しい)。
    const pageType = path === '/faq' ? 'FAQPage'
      : (PAGES[path].journal === 'index' ? 'CollectionPage' : 'WebPage');
    const want = ['Hotel', 'WebSite', pageType];
    if (path !== '/') want.push('BreadcrumbList');
    if (path === '/rooms') want.push('ItemList');
    if (PAGES[path].journal && PAGES[path].journal !== 'index') want.push('Article');
    const missing = want.filter((t) => !types.has(t));
    missing.length === 0 ? ok(`${label} ${[...types].join(', ')}`) : ng(`${label} 欠落: ${missing.join(', ')}`);

    // 4. 持っていない事実を出していないか
    const raw = JSON.stringify(data);
    const leaked = FORBIDDEN.filter((k) => raw.includes(`"${k}"`));
    leaked.length === 0 || ng(`${label} 根拠の無い項目が入っている: ${leaked.join(', ')}`);

    // 5. 予約の入口が構造化データにあるか (Hotel を出すページすべて)
    if (types.has('Hotel')) {
      for (const [k, mustPointAt] of Object.entries(REQUIRED_ON_HOME)) {
        if (!raw.includes(`"${k}"`)) ng(`${label} ${k} が無い — 予約の入口を検索エンジンに示せていない`);
        else if (!raw.includes(mustPointAt)) ng(`${label} ${k} の行き先が ${mustPointAt} でない`);
        else ok(`${label} ${k} → ${mustPointAt}`);
      }
    }

    const text = strip(html);

    // 3-a. FAQ の設問が本文に実在するか
    if (path === '/faq') {
      const faqNode = graph.find((n) => n['@type'] === 'FAQPage');
      const qs = (faqNode?.mainEntity || []).map((q) => q.name);
      qs.length === FAQ.length || ng(`${label} FAQ ${qs.length} 問 (ページは ${FAQ.length} 問)`);
      const drift = qs.filter((q) => !text.includes(q));
      drift.length === 0
        ? ok(`${label} FAQ ${qs.length} 問すべて本文に実在`)
        : ng(`${label} 本文に無い設問: ${drift.slice(0, 2).join(' / ')}`);
      const adrift = (faqNode?.mainEntity || []).filter((q) => !text.includes(q.acceptedAnswer.text.slice(0, 20)));
      adrift.length === 0 || ng(`${label} 本文に無い回答が ${adrift.length} 件`);
    }

    // 3-b. 客室名が本文に実在するか
    if (path === '/rooms') {
      const list = graph.find((n) => n['@type'] === 'ItemList');
      list?.numberOfItems === ROOMS.length || ng(`${label} 客室 ${list?.numberOfItems} 室 (ページは ${ROOMS.length} 室)`);
      const drift = ROOMS.filter((r) => !text.includes(r.kanji) || !text.includes(r.roman));
      drift.length === 0
        ? ok(`${label} 客室 ${ROOMS.length} 室すべて本文に実在`)
        : ng(`${label} 本文に無い客室: ${drift.map((r) => r.roman).join(', ')}`);
    }

    // 3-c. パンくずの語が、そのページのナビに実在するか
    if (path !== '/') {
      const bc = graph.find((n) => n['@type'] === 'BreadcrumbList');
      const names = (bc?.itemListElement || []).map((i) => i.name);
      const drift = names.filter((n) => !text.includes(n));
      drift.length === 0
        ? ok(`${label} パンくず ${names.join(' > ')}`)
        : ng(`${label} ナビに無い語がパンくずに: ${drift.join(', ')} — i18n.js の nav が site.js の DESTS とズレている`);
    }

    // 参照の整合。@id で結んでいるので、指した先が同じ graph に居ること。
    const ids = new Set(graph.map((n) => n['@id']).filter(Boolean));
    const refs = [...raw.matchAll(/\{"@id":"([^"]+)"\}/g)].map((x) => x[1]);
    const dangling = [...new Set(refs)].filter((r) => !ids.has(r));
    dangling.length === 0 || ng(`${label} 参照先が居ない @id: ${dangling.join(', ')}`);
  }
}

// 5. schema.org の公式語彙と突き合わせる。
//    プロパティ名の綴りミスは自前の検査では絶対に拾えない
//    (JSON としては正しく、Google は黙って無視するだけなので)。
console.log('── schema.org の語彙と突合');
try {
  const vocab = execFileSync('curl', ['-sS', '--max-time', '90',
    'https://schema.org/version/latest/schemaorg-current-https.jsonld'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const g = JSON.parse(vocab)['@graph'];
  const types = new Set(), props = new Set();
  for (const n of g) {
    const id = (n['@id'] || '').replace('schema:', '');
    const t = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
    if (t.includes('rdfs:Class')) types.add(id);
    if (t.includes('rdf:Property')) props.add(id);
  }
  const badT = new Set(), badP = new Set();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    for (const [k, val] of Object.entries(o)) {
      if (k === '@type') (Array.isArray(val) ? val : [val]).forEach((t) => { if (!types.has(t)) badT.add(t); });
      else if (!k.startsWith('@')) { if (!props.has(k)) badP.add(k); }
      walk(val);
    }
  };
  for (const p of Object.keys(PAGES)) for (const l of LANGS) walk(JSON.parse(jsonLd('https://gensuirou.com', l, p)));
  badT.size === 0 ? ok(`型 ${types.size} 件と照合、未知の型なし`) : ng(`未知の型: ${[...badT].join(', ')}`);
  badP.size === 0 ? ok(`プロパティ ${props.size} 件と照合、未知のプロパティなし`) : ng(`未知のプロパティ: ${[...badP].join(', ')}`);
} catch (e) {
  console.log('  --  語彙を取得できないので綴り検証は省略 (' + String(e.message).slice(0, 60) + ')');
}

console.log('────────────────────────────────────────────');
console.log(bad === 0 ? 'SCHEMA PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
