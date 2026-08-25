// 旅館側の確認用に、こちらで訳した文だけを一覧で出す。
//   node scripts/dump-translations.mjs
// reviewed: true が付いていない室が対象。確認が済んだら rooms.js で立てる。
import { ROOMS, ROOM_ORDER } from '../src/rooms.js';
let n = 0;
console.log('源翠瓏 客室紹介文 — 英語 / 中文 の確認用\n');
console.log('日本語は本番サイトの掲載どおり。英語と中国語はこちらで訳したものです。\n');
for (const slug of ROOM_ORDER) {
  const r = ROOMS[slug];
  if (r.reviewed) continue;
  n++;
  console.log('─'.repeat(72));
  console.log(`${r.kanji} ${r.roman}`);
  console.log('  【日本語 / 掲載どおり】', r.desc.ja);
  console.log('  【English / 要確認】  ', r.desc.en);
  console.log('  【中文 / 要確認】     ', r.desc.zh);
  console.log('  構成 en:', r.composition.en);
  console.log('  構成 zh:', r.composition.zh);
  console.log('  浴室 en:', r.bath.en, ' / zh:', r.bath.zh);
}
console.log('─'.repeat(72));
console.log(`確認待ち ${n} 室 / 全 ${ROOM_ORDER.length} 室`);
