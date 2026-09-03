// 本番の全 URL を実ブラウザで開き、「その要素が実際に使う書体」ごとに
// 出ている文字を集めて JSON で出す。make-fonts.sh から呼ばれる。
//
//   node scripts/_font-inventory.mjs [base-url] > inventory.json
//
// HTML を読むだけでは足りない理由:
//   - 言語ごとに畳んだ span (data-ja/en/zh) が全部入ってしまう
//   - ライトボックスの「1 / 12」やフォームのエラー文は JS が後から入れる
//   - 客室名の漢字は英語面でも和文書体で出る (書体は言語と一致しない)
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'https://gensuirou.com';
const sm = await (await fetch(BASE + '/sitemap.xml')).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const stacks = new Map();          // "A|B|C" -> Set(char)

for (const u of urls) {
  await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const found = await page.evaluate(() => {
    // ここでは仕分けない。**スタックと文字をそのまま**返す。
    // どの書体が受け持つかは、原本の cmap を見られる作成側で決める
    // (先頭の書体で仕分けると、欧文書体が先頭の要素に出ている和文や、
    //  和文書体しか無いスタックに出ているダッシュを取り違える)。
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const t = n.textContent;
      if (!t || !t.trim()) continue;
      const el = n.parentElement;
      if (!el || !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) continue;
      const stack = getComputedStyle(el).fontFamily.split(',').map((f) => f.replace(/["']/g, '').trim());
      out.push([stack.join('|'), [...new Set(t)].join('')]);
    }
    return out;
  });
  for (const [key, chars] of found) {
    const set = stacks.get(key) || new Set();
    for (const c of chars) if (c.codePointAt(0) > 0x1f) set.add(c);
    stacks.set(key, set);
  }
}

// JS が後から出す文字 (件数・エラー文・404 の文面) も拾う。
const src = [];
for (const f of ['public/assets/site.js', 'src/enquiry.js', 'src/worker.js', 'src/i18n.js']) {
  try { src.push(await (await import('node:fs/promises')).readFile(f, 'utf8')); } catch { /* 無ければ飛ばす */ }
}
const jsChars = [...new Set(src.join('').match(/[　-ヿ一-鿿＀-￯]/g) || [])].join('');

// 保険。かな全部と ASCII と約物は読み書体に入れておく (フォームに打たれた字、
// 将来の 1 行追加で穴が開かないように)。判定に使うのは used だけ。
const pad = [];
for (let c = 0x20; c < 0x7f; c++) pad.push(String.fromCharCode(c));
for (let c = 0x3000; c <= 0x30ff; c++) pad.push(String.fromCharCode(c));
for (const c of '・〜～ー…‐—–′″×÷°±¥§•©®※→、。「」『』（）〈〉《》【】〒') pad.push(c);

const out = {
  stacks: [...stacks].map(([k, v]) => [k.split('|'), [...v].sort().join('')]),
  pad: { ja: [...new Set(pad.join('') + jsChars)].sort().join(''),
         zh: [...new Set(pad)].sort().join(''),
         latin: [...new Set(pad.filter((c) => c.codePointAt(0) < 0x100))].sort().join('') },
};

await b.close();
process.stdout.write(JSON.stringify(out, null, 1));
