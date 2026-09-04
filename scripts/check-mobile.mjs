// スマートフォンで壊れていないかを、実機のプロファイルで測る。
//
//   node scripts/check-mobile.mjs [base-url]
//
// なぜ要るか:
//   本番ログ (2026-09-02) の内訳は モバイル 9,401 / デスクトップ 5,010。
//   **見に来る人の 65% はスマホ**なのに、既存の検査で端末を真似ているのは
//   header / nav / vitals の 3 本だけで、残りは 1280px で測っていた。
//
// 見るもの (全部、実際に触って測る):
//   1. 横あふれ            — 画面より広い箱があると、指で横に流れて読めない
//   2. タップの当たり判定  — 44px あるか + 中心を押して**本当にその要素に届くか**
//   3. 縦スワイプ          — 実際に指で払って、ページが動くか
//   4. iOS のズーム        — 入力欄が 16px 未満だと、触った瞬間に拡大される
//   5. 文字の大きさ        — 見かけ 12px 未満が無いか
//   6. 画像の出し過ぎ      — 表示より極端に大きい画像を落としていないか
//
// ⚠ 測り方の注意 (過去に踏んだもの):
//   - **アニメが終わってから測る**。せり上がり中は座標が嘘になる。
//   - elementFromPoint は誤検出が多い。返ってきた要素が対象の**祖先か子孫**なら
//     当たりとみなす。そうしないと、包んだ <a> や装飾の ::after で落ちる。
//   - 画面の外にある要素は数えない (閉じたメニューの中身まで数えてしまう)。
//   - checkVisibility は素で呼ぶと visibility:hidden を「見えている」と返す。

import { chromium } from 'playwright-core';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const BASE = args[0] || 'https://gensuirou.com';
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

// 実機の内訳に合わせる。日本の旅行客は iPhone が主、次に Android。
// 320 は最小の現行機 (iPhone SE 第1世代相当) — ここで溢れるなら全部溢れる。
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const AND = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
// ⚠ 幅は自分で書く。playwright の devices['iPhone SE'] は **320px** (初代) で、
//   名前から想像する幅と違う (2026-09-04 に取り違えた)。
const PROFILES = [
  { name: '最小      320', w: 320, h: 640, dpr: 2, ua: IOS },
  { name: 'iPhone SE 375', w: 375, h: 667, dpr: 2, ua: IOS },
  { name: 'iPhone 14 390', w: 390, h: 844, dpr: 3, ua: IOS },
  { name: 'Pixel 7   412', w: 412, h: 915, dpr: 2.6, ua: AND },
];


const sm = await (await fetch(BASE + '/sitemap.xml')).text();
let urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (ONLY) urls = urls.filter((u) => new URL(u).pathname.includes(ONLY));

let failed = 0;
const problems = [];
const note = (kind, profile, path, detail) => {
  failed++;
  problems.push({ kind, profile, path, detail });
};

const b = await chromium.launch();
console.log(`\nスマホ  ${BASE}  (${urls.length} URL × ${PROFILES.length} 端末)\n`);

for (const prof of PROFILES) {
  const { name } = prof;
  const device = { viewport: { width: prof.w, height: prof.h }, deviceScaleFactor: prof.dpr,
                   isMobile: true, hasTouch: true, userAgent: prof.ua };
  const ctx = await b.newContext({ ...device });
  const page = await ctx.newPage();
  let checked = 0;

  for (const u of urls) {
    const path = new URL(u).pathname;
    await page.goto(u, { waitUntil: 'load', timeout: 60000 });
    // 演出が終わってから測る。動いている最中の座標は嘘になる。
    await page.waitForTimeout(1400);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    const r = await page.evaluate(() => {
      const vw = window.innerWidth;
      const out = { overflow: null, small: [], tiny: [], zoom: [], heavy: [] };

      // 1. 横あふれ
      if (document.documentElement.scrollWidth > vw + 1) {
        let worst = null;
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0) continue;
          if (rect.right > vw + 1 && (!worst || rect.right > worst.right)) {
            worst = { right: Math.round(rect.right), tag: el.tagName.toLowerCase(),
                      cls: (el.className || '').toString().slice(0, 40), w: Math.round(rect.width) };
          }
        }
        out.overflow = { scrollWidth: document.documentElement.scrollWidth, vw, worst };
      }

      const vis = (el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true });
      const inView = (rect) => rect.width > 0 && rect.height > 0
        && rect.left >= -1 && rect.right <= vw + 1
        && rect.top >= -1 && rect.top < window.innerHeight;

      // 2. タップの当たり判定
      for (const el of document.querySelectorAll('a[href], button, [role="button"], input, select, textarea')) {
        if (!vis(el)) continue;
        const rect = el.getBoundingClientRect();
        if (!inView(rect)) continue;
        const label = (el.textContent || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 24);
        // 本文中のインラインリンクは 44px の対象外 (段落の行の高さで決まる)
        const inline = el.tagName === 'A' && getComputedStyle(el).display.startsWith('inline')
          && el.closest('p, li, td');
        const min = Math.min(rect.width, rect.height);
        if (!inline && min < 44) out.small.push({ label, w: Math.round(rect.width), h: Math.round(rect.height) });

        // 中心を押して、本当にその要素に届くか。
        // ⚠ 中心が画面の外だと elementFromPoint は null を返す。
        //   これを「覆われている」と数えると、背の高い要素で偽陽性が出る
        //   (2026-09-04 に Pixel 7 の予約ボタンで踏んだ)。
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        if (x < 0 || y < 0 || x > vw || y > window.innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        if (!hit) continue;
        if (hit !== el && !el.contains(hit) && !hit.contains(el)) {
          out.small.push({ label, blocked: hit.tagName.toLowerCase() + '.' + (hit.className || '').toString().slice(0, 24) });
        }
      }

      // 4. iOS のズーム (入力欄が 16px 未満)
      for (const el of document.querySelectorAll('input, textarea, select')) {
        if (!vis(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) out.zoom.push({ name: el.name || el.type, fs });
      }

      // 5. 文字の大きさ
      const seen = new Set();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim();
        if (!t) continue;
        const el = n.parentElement;
        if (!el || !vis(el) || seen.has(el)) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (!inView(rect)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) out.tiny.push({ text: t.slice(0, 18), fs });
      }

      // 6. 画像の出し過ぎ (表示幅の 2.5 倍を超える実寸)
      for (const img of document.images) {
        if (!img.naturalWidth || !vis(img)) continue;
        const rect = img.getBoundingClientRect();
        if (rect.width < 2) continue;
        const ratio = img.naturalWidth / (rect.width * (window.devicePixelRatio || 1));
        if (ratio > 2.5) out.heavy.push({ src: img.currentSrc.split('/').pop().slice(0, 32),
                                          nat: img.naturalWidth, shown: Math.round(rect.width), ratio: +ratio.toFixed(1) });
      }
      return out;
    });

    if (r.overflow) note('横あふれ', name, path, `${r.overflow.scrollWidth}px > 画面 ${r.overflow.vw}px  はみ出し: ${r.overflow.worst ? `<${r.overflow.worst.tag} class="${r.overflow.worst.cls}"> 右端 ${r.overflow.worst.right}px` : '不明'}`);
    for (const s of r.small.slice(0, 4)) {
      note(s.blocked ? 'タップが届かない' : '当たり判定 44px 未満', name, path,
           s.blocked ? `「${s.label}」を ${s.blocked} が覆っている` : `「${s.label}」 ${s.w}×${s.h}px`);
    }
    for (const z of r.zoom.slice(0, 3)) note('iOS が拡大する入力欄', name, path, `${z.name} が ${z.fs}px (16px 未満)`);
    for (const t of r.tiny.slice(0, 3)) note('文字が小さい', name, path, `「${t.text}」 ${t.fs}px`);
    for (const h of r.heavy.slice(0, 3)) note('画像の出し過ぎ', name, path, `${h.src} 実寸 ${h.nat}px / 表示 ${h.shown}px (${h.ratio} 倍)`);

    checked++;
  }

  // 3. 縦スワイプ — CDP の実ジェスチャで払う。
  //
  // ⚠ JS で作った TouchEvent を dispatch しても**ページは動かない**。
  //   スクロールはブラウザの入力経路 (compositor) が動かすもので、
  //   スクリプトが作ったイベントはそこを通らない。2026-09-04 に
  //   これで「全ページ縦に動かない」という偽の障害を出した。
  //   Input.synthesizeScrollGesture (gestureSourceType: touch) が正しい道具。
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (p) => {
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1200);
    const before = await page.evaluate(() => window.scrollY);
    await cdp.send('Input.synthesizeScrollGesture', {
      x: Math.round(device.viewport.width / 2), y: Math.round(device.viewport.height / 2),
      xDistance: 0, yDistance: -500, gestureSourceType: 'touch', speed: 2000,
    });
    await page.waitForTimeout(600);
    return (await page.evaluate(() => window.scrollY)) - before;
  };
  const scrollTests = [];
  for (const p of ['/', '/rooms', '/reservation', '/rooms/zui']) {
    const moved = await swipe(p);
    scrollTests.push([p, moved]);
    if (moved < 60) note('縦に動かない', name, p, `指で払っても ${moved}px しか動かない`);
  }
  // 検出器の対照。どこかで 1 つでも動いていなければ、測れていない。
  if (scrollTests.every(([, d]) => d < 60)) {
    console.log(`  ! ${name}: どのページも動かなかった — ジェスチャが効いていない可能性`);
  }
  console.log(`  ${name}  ${checked} URL 走査 / 縦スワイプ ${scrollTests.map(([p, d]) => `${p}:${d}px`).join(' ')}`);
  await ctx.close();
}
await b.close();

// ── まとめ ──
console.log('');
if (!problems.length) console.log('  PASS  横あふれ・当たり判定・縦スワイプ・入力欄・文字の大きさ・画像、すべて問題なし');
else {
  const byKind = new Map();
  for (const p of problems) {
    const k = p.kind;
    byKind.set(k, (byKind.get(k) || []).concat(p));
  }
  for (const [kind, list] of byKind) {
    console.log(`  FAIL  ${kind} — ${list.length} 件`);
    const shown = new Set();
    for (const p of list) {
      const key = p.path + p.detail;
      if (shown.has(key)) continue;
      shown.add(key);
      if (shown.size > 6) { console.log(`          … 他 ${list.length - 6} 件`); break; }
      console.log(`          [${p.profile}] ${p.path}  ${p.detail}`);
    }
  }
}
console.log(failed === 0 ? '\nMOBILE PASS\n' : `\nMOBILE FAIL — ${failed} 件\n`);
process.exit(failed === 0 ? 0 : 1);
