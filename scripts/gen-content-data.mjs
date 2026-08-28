// public/faq.html と public/rooms.html から、構造化データ用のデータを作り直す。
//   node scripts/gen-content-data.mjs
//
// src/content-data.js は JSON-LD (FAQPage / ItemList) の材料。本文とは別に
// 持たざるを得ないので、**ズレたら気付く** で守る (check-schema.mjs が突合)。
// これまで再生成する手段が無く、FAQ を 9 問足しても構造化データが 8 問のまま
// になるところだった (2026-08-28)。
import { readFileSync, writeFileSync } from 'node:fs';

const LANGS = ['ja', 'en', 'zh'];
const dec = (t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const spans = (html) => {
  const o = {};
  for (const l of LANGS) {
    const m = html.match(new RegExp(`<span data-${l}\\b[^>]*>([\\s\\S]*?)</span>`));
    o[l] = m ? dec(m[1].replace(/<[^>]+>/g, '')) : '';
  }
  return o;
};

const faqHtml = readFileSync('public/faq.html', 'utf8');
const FAQ = [...faqHtml.matchAll(/<details[^>]*>([\s\S]*?)<\/details>/g)].map((m) => {
  const blk = m[1];
  const q = blk.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
  const a = blk.match(/<div class="ans"[^>]*>([\s\S]*?)<\/div>/);
  return { q: spans(q ? q[1] : ''), a: spans(a ? a[1] : '') };
}).filter((x) => x.q.ja && x.a.ja);

const roomsHtml = readFileSync('public/rooms.html', 'utf8');
const ROOMS = [...roomsHtml.matchAll(/<a[^>]*class="room"[^>]*>([\s\S]*?)<\/a>/g)]
  .map((m) => {
    const kanji = (m[1].match(/<div class="kanji"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1].replace(/<[^>]+>/g, '').trim();
    const roman = (m[1].match(/<div class="roman"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1].replace(/<[^>]+>/g, '').trim();
    return { kanji, roman };
  }).filter((r) => r.kanji);

const out = `// 自動生成 — public/faq.html と public/rooms.html から抜き出したもの。
// 手で書き換えないこと。ページを直したら次で作り直す:
//     node scripts/gen-content-data.mjs
// ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する。
//
// 構造化データのためだけに本文を二重に持つのは危険なので、
// 「重複させない」ではなく「ズレたら気付く」で守る。
export const FAQ = ${JSON.stringify(FAQ, null, 2)};

export const ROOMS = ${JSON.stringify(ROOMS, null, 2)};
`;
writeFileSync('src/content-data.js', out);
console.log(`  FAQ ${FAQ.length} 問 / 客室 ${ROOMS.length} 件 を書き出した`);
const missing = FAQ.filter((f) => LANGS.some((l) => !f.q[l] || !f.a[l]));
if (missing.length) { console.log(`  NG 3 言語が揃っていない ${missing.length} 問`); process.exit(1); }
console.log('  OK 全問 3 言語そろっている');
