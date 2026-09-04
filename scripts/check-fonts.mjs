// 自前ホストの部分集合フォントに、**実際に出ている字が全部入っているか**を測る。
//
//   node scripts/check-fonts.mjs [base-url]
//
// なぜ要るか:
//   書体を「このサイトで使う文字だけ」に絞ってあるので、文章を足して
//   `./scripts/make-fonts.sh` を回し忘れると、その字だけシステムの書体で出る。
//   1 文字だけ書体が違っても目視ではまず気付かないし、ページは 200 のまま。
//
// 測り方:
//   ① 配信中の woff2 を落として sha256 を照合する。
//      作った物と配信中の物が同じでなければ、以下の判定は意味を持たない。
//   ② 全 URL を実ブラウザで開き、「その要素が実際に使う書体」ごとに
//      出ている文字を集め、作成時に書き出した一覧 (scripts/fonts-coverage.json)
//      と突き合わせる。
//
//   ⚠ 画面の見た目で測ろうとしない。canvas の幅比較は和文・中文では効かない
//     (どの書体でも 1em ちょうど)。画素比較も Chrome の CJK フォールバックが
//     指定と別経路なので、入っていない字を「ある」と答える。
//     2026-09-03 に両方試して、前者は 11,162 件の偽陽性、後者は対照 (鬱) を
//     素通りした。中身は **作った側が書き出した一覧** と突き合わせるのが正しい。

import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE = process.argv[2] || 'https://gensuirou.com';
const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com/;

const manifest = JSON.parse(await readFile(new URL('./fonts-coverage.json', import.meta.url), 'utf8'));
const covered = new Map();                 // family -> Set(char)
for (const [fam, m] of Object.entries(manifest)) covered.set(fam, new Set(m.chars));

let failed = 0;
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { failed++; console.log('  FAIL  ' + m); };

console.log(`\n書体の網羅  ${BASE}\n`);

// ── 1. 配信中のファイルが、作った物と同じか ──
for (const [fam, m] of Object.entries(manifest)) {
  const res = await fetch(BASE + m.file);
  if (!res.ok) { bad(`${m.file} が ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== m.sha256) bad(`${m.file} が作った物と違う (deploy し忘れ?)`);
  else ok(`${m.file} ${(buf.length / 1024).toFixed(1)}KB — 作った物と一致 (${fam})`);
}

// ── 2. 出ている字が全部入っているか ──
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const external = new Set();
page.on('request', (r) => { if (FONT_HOSTS.test(r.url())) external.add(r.url()); });

const sm = await (await fetch(BASE + '/sitemap.xml')).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
urls.push(BASE + '/gensuiro/?bg=0');   // 客室テレビの館内案内 (sitemap 外)

const missing = new Map();                 // family -> Map(char -> 最初に見つけた URL)
for (const u of urls) {
  await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const found = await page.evaluate(() => {
    // 「その字を受け持てる書体がスタックの中にあるか」で見る。
    // 先頭の書体だけ見ると、欧文書体が先頭の要素に出ている和文を
    // 全部「無い」と数えてしまう (2026-09-03 にこれで偽陽性を出した)。
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const t = n.textContent;
      if (!t || !t.trim()) continue;
      const el = n.parentElement;
      // ⚠ checkVisibility は素で呼ぶと visibility:hidden を「見えている」と返す。
      if (!el || !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) continue;
      const stack = getComputedStyle(el).fontFamily.split(',').map((f) => f.replace(/["']/g, '').trim());
      out.push([stack, [...new Set(t)].join('')]);
    }
    return out;
  });

  for (const [stack, chars] of found) {
    const shipped = stack.filter((f) => covered.has(f));
    for (const ch of chars) {
      if (!ch.trim() || ch.codePointAt(0) < 0x20) continue;
      // 総称 (ui-serif 等) しか無い所は、そもそも自前で持つ気が無い字。
      if (!shipped.length) continue;
      if (shipped.some((f) => covered.get(f).has(ch))) continue;
      // どの自前書体も持っていない = 端末まかせで出ている
      const key = shipped[0];
      const m = missing.get(key) || new Map();
      if (!m.has(ch)) m.set(ch, new URL(u).pathname);
      missing.set(key, m);
    }
  }
}
await b.close();

console.log(`  ${urls.length} ページを走査`);
if (missing.size === 0) ok('出ている字はすべて部分集合に入っている');
else {
  for (const [fam, m] of missing) {
    bad(`${fam} に無い字が ${m.size} 文字: ${[...m.keys()].join('')}`);
    console.log(`        最初に出た所: ${[...new Set([...m.values()])].slice(0, 4).join(' , ')}`);
  }
  console.log('  → ./scripts/make-fonts.sh を回して deploy し直す');
}
if (external.size) {
  bad(`外部の書体ホストへ要求が出ている (${external.size} 件): ${[...external][0]}`);
} else ok('外部の書体ホストへの要求なし');

console.log(failed === 0 ? '\nFONTS PASS\n' : `\nFONTS FAIL — ${failed} 件\n`);
process.exit(failed === 0 ? 0 : 1);
