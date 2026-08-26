// CSS の var(--x) が本当に解決するかを本番で確かめる。
//   node scripts/check-css-vars.mjs [base-url]
//
// なぜ要るか: 2026-08-26 に `--x-height-ref: 0.5;` を **どのルールの外にも**
// 書いてしまい、CSS として無効なまま deploy した。参照側の
// `font-size-adjust: var(--x-height-ref)` は黙って無効になるだけで、
// 画面は今までどおり表示される。つまり **目視では絶対に気付けない**。
// 未定義の変数を参照している箇所を数える。
import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'https://gensuirou.com';
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(); const p = await ctx.newPage();
await p.goto(BASE + '/', { waitUntil: 'load', timeout: 45000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(async () => {
  const sheets = [...document.styleSheets].filter((s) => s.href && s.href.startsWith(location.origin));
  const texts = await Promise.all(sheets.map((s) => fetch(s.href).then((x) => x.text())));
  const src = texts.join('\n');
  const used = new Set([...src.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
  const cs = getComputedStyle(document.documentElement);
  const missing = [];
  for (const name of used) {
    // :root 以外で定義される変数もあるので、body でも見る
    const a = cs.getPropertyValue(name).trim();
    const c = getComputedStyle(document.body).getPropertyValue(name).trim();
    if (!a && !c) missing.push(name);
  }
  // ルールの外に落ちた宣言を直接探す (上の障害そのもの)
  const stray = [];
  for (const t of texts) {
    const noComment = t.replace(/\/\*[\s\S]*?\*\//g, '');
    // `}` で切ると、各断片の「最初の `{` より前」がセレクタ (prelude) になる。
    // そこにカスタムプロパティの宣言があれば、どのルールにも属していない。
    for (const chunk of noComment.split('}')) {
      const prelude = chunk.includes('{') ? chunk.slice(0, chunk.indexOf('{')) : chunk;
      const m = prelude.match(/(--[\w-]+)\s*:/);
      if (m) stray.push(m[1]);
    }
  }
  return { used: used.size, missing, stray: [...new Set(stray)],
           adjust: getComputedStyle(document.body).fontSizeAdjust };
});
await b.close();

console.log(`  var(--x) 参照 ${r.used} 種`);
console.log(`  body の font-size-adjust = ${r.adjust}`);
let bad = 0;
if (r.missing.length) { bad++; console.log('  NG  未定義:'); r.missing.forEach((m) => console.log('   ·', m)); }
else console.log('  OK  すべて解決');
if (r.stray.length) { bad++; console.log('  NG  ルールの外に落ちた宣言:'); r.stray.forEach((m) => console.log('   ·', m)); }
else console.log('  OK  ルール外の宣言なし');
console.log('────────────────────────────');
console.log(bad === 0 ? 'CSS VARS PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
