// 「予約」と書いてあるボタンが、本当に予約できる場所へ行くかを見る。
//   node scripts/check-booking-route.mjs [base-url]
//
// なぜ要るか (2026-08-24〜28 の実障害):
//   旧サイトの /reservation には **予約エンジン (sec.489.jp)** への導線があり、
//   お客さまはそこで料金と空室を見て予約していた。移行時にそれを
//   /#reserve (問い合わせフォーム) へ 301 で飛ばしてしまい、
//   「金額の確認と予約ができない」状態を 4 日間つくった。
//   サイトは 200 を返し、見た目も正常で、既存の検査は全部 PASS していた。
//   **リンクの行き先を意味で確かめる検査が無かった** ことが原因。
import { chromium } from 'playwright-core';

// ⚠ checkVisibility() は **素で呼ぶと visibility:hidden と opacity:0 を「見えている」と返す**。
//   既定で見るのは display:none と content-visibility だけ (2026-08-28 に実測)。
//   閉じたスライドインパネルの中身まで数えてしまうので、必ず全オプションを渡す。

const BASE = process.argv[2] || 'https://gensuirou.com';
const ENGINE = 'sec.489.jp';
const BOOKABLE = (href) => href.includes(ENGINE) || /\/reservation(\/|$|\?)/.test(href);
// ラベルがこれらを含むなら「予約できる場所」へ行かねばならない。
// 「お問い合わせ」「ご相談」だけのボタンは対象外 (フォームで正しい)。
const BOOKING_WORD = /予约|予約|Reserve|Book/i;
const ENQUIRY_ONLY = /^(お問い合わせ|咨询|Enquire|Enquiry|ウェディングをご相談)$/;

const PAGES = ['/', '/rooms', '/rooms/zui', '/cuisine', '/onsen', '/facilities',
               '/access', '/faq', '/wedding', '/journal', '/reservation'];
const LANGS = ['', '/en', '/zh'];

const b = await chromium.launch({ channel: 'chrome' });
let bad = 0, checked = 0;
for (const lang of LANGS) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const offenders = [], missing = [];
  for (const path of PAGES) {
    const url = BASE + lang + path;
    const res = await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    if (!res || res.status() >= 400) { missing.push(`${path} HTTP ${res && res.status()}`); continue; }
    await p.waitForTimeout(900);
    const r = await p.evaluate(({ bw, eo }) => {
      const bookRe = new RegExp(bw, 'i'), enqRe = new RegExp(eo);
      const out = [], routes = [];
      for (const a of document.querySelectorAll('a[href]')) {
        if (!a.checkVisibility || !a.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) continue;
        const label = (a.textContent || '').replace(/\s+/g, ' ').trim();
        const href = a.href;
        if (href.includes('sec.489.jp') || /\/reservation(\/|$|\?)/.test(href)) routes.push(label.slice(0, 20));
        if (!label || !bookRe.test(label) || enqRe.test(label)) continue;
        out.push({ label: label.slice(0, 28), href });
      }
      return { out, routes: routes.length };
    }, { bw: BOOKING_WORD.source, eo: ENQUIRY_ONLY.source });
    checked += r.out.length;
    for (const c of r.out) if (!BOOKABLE(c.href)) offenders.push(`${path} 「${c.label}」→ ${c.href.replace(BASE, '')}`);
    // どのページからも予約に到達できること
    if (r.routes === 0) missing.push(`${path} 予約への導線が 0 本`);
  }
  const tag = lang || '/ja';
  if (offenders.length || missing.length) {
    bad += offenders.length + missing.length;
    console.log(`  NG  ${tag}`);
    offenders.forEach((o) => console.log('     ラベルは予約なのに行き先が違う:', o));
    missing.forEach((m) => console.log('     ', m));
  } else console.log(`  OK  ${tag}  全 ${PAGES.length} ページから予約に到達`);
  await ctx.close();
}
await b.close();
console.log('─'.repeat(64));
console.log(bad === 0 ? `BOOKING ROUTE PASS — 予約ラベル ${checked} 本すべて予約先へ` : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
