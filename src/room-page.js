// ════════════════════════════════════════════════════════════════════
//  客室詳細ページ (/rooms/<slug>)
//
//  本番 gensuirou.com には 12 室ぶんの客室ページが実在していたのに、
//  新サイトは客室一覧 1 枚しか持っていなかった。うち 11 室のカードが
//  href="#" の死んだリンクだったのはそのため。ここで 12 室を作り直す。
//
//  静的 HTML を 12 枚置くのではなく、データから組み立てる:
//    - 3 言語ぶんの本文を 1 つの HTML に入れて localizePage に渡すので、
//      言語別 URL・canonical・hreflang・JSON-LD が既存の仕組みでそのまま効く
//    - 12 枚を手で保守すると、必ずどれか 1 枚だけ古くなる
//
//  class 名は既存の rooms.html の 紫 Shiori 詳細と同じものを使う。
//  design.md 管理下なので、この 1 ページのために新しい意匠を作らない。
// ════════════════════════════════════════════════════════════════════

import { COMMON, ROOMS, ROOM_ORDER, roomImages } from './rooms.js';
import { BOOKING_URL } from './booking.js';

const LANGS = ['ja', 'en', 'zh'];

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 3 言語ぶんの <span data-xx> を並べる。既存ページと同じ書き方。 */
const spans = (o) => LANGS.map((l) => `<span data-${l}>${esc(o[l])}</span>`).join('');

export const roomPath = (slug) => `/rooms/${slug}`;
export const roomSlugs = () => ROOM_ORDER;

/** i18n.js の PAGES に混ぜる 12 室ぶんのメタ。 */
export function roomPageMeta() {
  const out = {};
  for (const slug of ROOM_ORDER) {
    const r = ROOMS[slug];
    const cap = { ja: `${r.capacity}名`, en: `${r.capacity} guests`, zh: `${r.capacity} 人` };
    out[roomPath(slug)] = {
      room: slug,
      nav: { ja: `${r.kanji} ${r.roman}`, en: r.roman, zh: `${r.kanji} ${r.roman}` },
      ja: {
        title: `${r.kanji} - ${r.roman} - ｜ 源翠瓏 - 阿蘇の露天風呂付き離れ客室`,
        // 紹介文をそのまま使う。長い場合だけ句点で切る。
        desc: trim(`${r.kanji} - ${r.roman} -（${r.area.ja}・定員${cap.ja}）${r.desc.ja}`, 150, 'ja'),
      },
      en: {
        // 62 単位に収める。超えると検索結果で宿名が切れる (2026-08-28 実測 63〜68)。
        title: `${r.roman} ${r.kanji} — Detached Villa with Private Onsen | Gensuirou`,
        desc: trim(`${r.roman} (${r.area.en}, ${cap.en}). ${r.desc.en}`, 155, 'en'),
      },
      zh: {
        title: `${r.kanji} ${r.roman} ｜ 源翠瓏 — 独立别墅・专属露天温泉`,
        desc: trim(`${r.kanji} ${r.roman}（${r.area.zh}・定员${cap.zh}）${r.desc.zh}`, 150, 'zh'),
      },
    };
  }
  return out;
}

// description は語の途中で切らない。日本語は句点、英語は語境界で落とす。
function trim(s, n, lang) {
  // 和文は 1 字が全角 2 単位。150 字 = 300 単位で、検索結果の枠 (約 250) を
  // 超えていた (2026-08-28 実測 /rooms/rin 252・/rooms/sou 263)。
  // 上限は文字数ではなく **表示幅** で持つ。
  const w = (t) => [...t].reduce((a, c) => a + (/[　-鿿＀-￯]/.test(c) ? 2 : 1), 0);
  if (lang !== 'en') { while (w(s) > 240 && s.length > 20) s = s.slice(0, -1); }
  if (s.length <= n) return s;
  if (lang === 'en') {
    const cut = s.slice(0, n);
    return cut.slice(0, cut.lastIndexOf(' ')) + '…';
  }
  const cut = s.slice(0, n);
  const i = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('、'), cut.lastIndexOf('，'));
  return (i > n * 0.5 ? cut.slice(0, i + 1) : cut) + '…';
}

/** 前後の部屋。12 室を一巡できるようにして、行き止まりを作らない。 */
function neighbours(slug) {
  const i = ROOM_ORDER.indexOf(slug);
  return {
    prev: ROOM_ORDER[(i - 1 + ROOM_ORDER.length) % ROOM_ORDER.length],
    next: ROOM_ORDER[(i + 1) % ROOM_ORDER.length],
  };
}

/**
 * 3 言語入りの HTML を組み立てる。この後 localizePage が言語ごとに削る。
 * href は相対で書く (既存ページと同じ)。localizePage が言語接頭辞を付ける。
 */
export function renderRoomPage(slug) {
  const r = ROOMS[slug];
  const imgs = roomImages(slug);
  const { prev, next } = neighbours(slug);
  const cap = { ja: `${r.capacity}名`, en: `${r.capacity} guests`, zh: `${r.capacity} 人` };

  const gallery = imgs.map((src, i) =>
    `<a href="#" data-full="${src}"><img src="${src}" alt="${esc(r.kanji + ' ' + r.roman)}"${i > 1 ? ' loading="lazy"' : ''}></a>`,
  ).join('\n        ');

  const row = (label, value) => `<tr><td>${spans(label)}</td><td>${spans(value)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>${esc(r.kanji)} - ${esc(r.roman)} - ｜ 源翠瓏</title>
<meta name="description" content="" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png" />
<link rel="stylesheet" href="/tokens.css" />
<link rel="stylesheet" href="/assets/site.css" />
</head>
<body data-page="rooms">
<h1 class="seo">${spans({
    ja: `${r.kanji} - ${r.roman} - ｜ 阿蘇の全室離れ露天風呂付き温泉旅館 源翠瓏の客室`,
    en: `${r.roman} — a detached villa with private open-air onsen at Gensuirou, Aso`,
    zh: `${r.kanji} ${r.roman} — 源翠瓏 阿苏 独立别墅・专属露天温泉`,
  })}</h1>
<div id="siteHeader"></div>
<main id="main">

<div class="page-hero">
    <!-- ヒーローは全幅。客室写真は 600x460 なので、ここに置くと 2 倍以上に
         引き伸ばされて甘くなる。横長に切ってある共通のヒーロー画像を使い、
         客室そのものの写真は 325px 枠のギャラリーで見せる。 -->
    <img class="bg" src="/assets/rooms_main.jpg" alt="" fetchpriority="high" decoding="async">
    <div class="cap">
      <div class="en">${spans({ ja: '客室', en: 'Villa', zh: '客房' })}</div>
      <div class="ja">${esc(r.kanji)} - ${esc(r.roman)} -</div>
    </div>
</div>

<div class="shell">
  <div class="inner">

    <section class="block anim">
      <div class="section-title">
        <h2>${esc(r.kanji)} - ${esc(r.roman)} -</h2>
        <p>${spans(r.desc)}</p>
      </div>

      <div class="gallery">
        ${gallery}
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h4>${spans({ ja: '間取り・定員', en: 'Layout & Capacity', zh: '房型 · 定员' })}</h4>
          <table>
            ${row({ ja: '建築面積', en: 'Area', zh: '建筑面积' }, r.area)}
            ${row({ ja: '定員', en: 'Guests', zh: '定员' }, cap)}
            ${row({ ja: '構成', en: 'Rooms', zh: '结构' }, r.composition)}
            ${row({ ja: 'お風呂', en: 'Bath', zh: '浴室' }, r.bath)}
          </table>
          ${r.note ? `<p class="fine-note">${spans(r.note)}</p>` : ''}
        </div>
        <div class="info-block">
          <h4>${spans({ ja: '温泉・チェックイン', en: 'Onsen & Check-in', zh: '温泉 · 入住' })}</h4>
          <table>
            ${row({ ja: '泉質', en: 'Spring', zh: '泉质' }, COMMON.spring)}
            ${row({ ja: 'チェックイン', en: 'Check-in', zh: '入住' }, COMMON.checkin)}
            ${row({ ja: 'チェックアウト', en: 'Check-out', zh: '退房' }, COMMON.checkout)}
            ${row({ ja: 'お食事', en: 'Meals', zh: '餐食' }, COMMON.meals)}
          </table>
        </div>
      </div>

      <!-- 設備・アメニティ。移行時に 12 室すべてから落ちていた (2026-08-28 復活)。
           部屋によって違う (洗濯機・ワインセラー・バスローブ) ので、
           「全室共通」に畳まず室ごとに出す。部屋選びの判断材料になる。 -->
      <div class="info-grid">
        <div class="info-block">
          <h4>${spans({ ja: '設備', en: 'In the villa', zh: '设备' })}</h4>
          <p class="amenity-list">${spans(r.equip)}</p>
        </div>
        <div class="info-block">
          <h4>${spans({ ja: 'アメニティ', en: 'Amenities', zh: '备品' })}</h4>
          <p class="amenity-list">${spans(r.amen)}</p>
        </div>
      </div>

      ${r.video ? `<div class="room-video">
        <h4>${spans({ ja: 'お部屋の動画', en: 'Room video', zh: '客房影片' })}</h4>
        <button type="button" class="video-facade" data-yt="${r.video}"
                aria-label="${esc(r.kanji)} ${esc(r.roman)} の紹介動画を再生">
          <img src="/assets/video-thumbs/${slug}.jpg" alt="" loading="lazy" decoding="async" width="800" height="450">
          <span class="play" aria-hidden="true"></span>
        </button>
      </div>` : ''}

      <!-- このお部屋を見ている人が、そのまま予約に進めるようにする。
           これまで客室ページには予約への導線が本文に 1 つも無く、
           room-nav の 3 つのボタンは全部よそへ行っていた。 -->
      <div class="room-cta">
        <a class="reserve-btn" href="${BOOKING_URL}" target="_blank" rel="noopener">
          ${spans({ ja: 'このお部屋の空室・料金を見る', en: 'Check dates and rates', zh: '查看空房与价格' })}
        </a>
        <a class="reserve-btn" href="reservation.html">
          ${spans({ ja: 'ご予約の方法', en: 'How to book', zh: '预约方式' })}
        </a>
      </div>

      <div class="room-nav">
        <a class="reserve-btn" href="rooms/${prev}.html">← ${esc(ROOMS[prev].kanji)} ${esc(ROOMS[prev].roman)}</a>
        <a class="reserve-btn" href="rooms.html">${spans({ ja: '客室一覧', en: 'All Villas', zh: '客房一览' })}</a>
        <a class="reserve-btn" href="rooms/${next}.html">${esc(ROOMS[next].kanji)} ${esc(ROOMS[next].roman)} →</a>
      </div>
    </section>

  </div>
</div>

</main>
<div id="siteFooter"></div>
<script src="/assets/site.js"></script>
</body>
</html>
`;
}
