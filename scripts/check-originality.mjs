// 旧サイトとの重なりを測る。
//   node scripts/check-originality.mjs
//
// 移行では本文をそのまま移したので、載せ替えが済んだあと どれだけ離れたかを
// 数字で持っておく。旧サイトは Plesk 上に残っているので IP 直で読める
// (gensuirou.com は Cloudflare を向いているため --resolve が要る)。
//
// **残ってよい一致**もある。泉質の公式記述、料理写真の注記、
// 「お車でのアクセス」のような機能的ラベルは、言い換えるほうが不誠実か不便になる。
// それらは ALLOW に列挙して、増えたときだけ気付けるようにする。
import { execFileSync } from 'node:child_process';

const OLD_IP = '153.123.7.215';
const PAIRS = [['/','/'],['/rooms/index.html','/rooms'],['/cuisine/index.html','/cuisine'],
  ['/onsen/index.html','/onsen'],['/facilities/index.html','/facilities'],
  ['/access/index.html','/access'],['/faq/index.html','/faq'],['/wedding/index.html','/wedding']];

// 意図して残している一致 (2026-08-26 時点)
// 言い換えてはいけないもの。事実・商品名・機能的なラベルは、旧サイトと
// 一致していて **当然** で、変えるほうが不誠実か不便になる。
// 2026-08-28 に旅館の実データ (FAQ・設備・ウェディングの料金) を戻したので、
// この種の一致はこれからも増える。増やすときは「宣伝文句でないこと」を確かめる。
const ALLOW = [
  '各お部屋ページで紹介動画を順次公開中です。',   // 旅館自身のお知らせ
  '※料理の一例です。',
  '肌触りが柔らかく肌への刺激が少ない',          // 泉質の公式記述
  '効能（浴用の適応症）',
  '『源翠瓏』への交通アクセス',                 // 機能的なラベル
  'お車でのアクセス',
  'ロケーションフォト',                        // ウェディングの商品名
];
const LIMIT = 8;

const get = (args) => { try { return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 64e6 }); } catch { return ''; } };
const old = (p) => get(['-sS','--resolve',`gensuirou.com:443:${OLD_IP}`,'--max-time','25','https://gensuirou.com'+p]);
const now = (p) => get(['-sS','--max-time','25','https://gensuirou.com'+p]);
const text = (h) => h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/g,' ').replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').split('\n')
  .map((l)=>l.replace(/\s+/g,' ').trim()).filter((l)=>l.length>=6);

let bad = 0, totalNew = 0, totalSame = 0;
const unexpected = [];
console.log('  ページ          新の行数  旧と一致  一致率');
for (const [o,n] of PAIRS) {
  const lo = new Set(text(old(o)));
  const ln = text(now(n));
  const same = ln.filter((l) => lo.has(l));
  totalNew += ln.length; totalSame += same.length;
  console.log(`  ${n.padEnd(14)} ${String(ln.length).padStart(8)} ${String(same.length).padStart(9)}  ${(100*same.length/Math.max(1,ln.length)).toFixed(1).padStart(5)}%`);
  for (const l of same) if (!ALLOW.some((a) => l.includes(a))) unexpected.push(`${n}: ${l.slice(0,70)}`);
}
const pct = 100*totalSame/Math.max(1,totalNew);
console.log(`  ${'合計'.padEnd(14)} ${String(totalNew).padStart(8)} ${String(totalSame).padStart(9)}  ${pct.toFixed(1).padStart(5)}%`);
if (unexpected.length) { bad++; console.log('  NG  想定外の一致:'); unexpected.forEach((u)=>console.log('   ·',u)); }
else console.log(`  OK  一致は ALLOW に列挙した ${totalSame} 行のみ`);
if (totalSame > LIMIT) { bad++; console.log(`  NG  一致行が ${totalSame} 行 (上限 ${LIMIT})`); }
console.log('────────────────────────────────────────────');
console.log(bad === 0 ? 'ORIGINALITY PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
