// ════════════════════════════════════════════════════════════════════
//  読み物 (/journal)
//
//  方針: **埋めるために書かない。**
//  旅館のブログは「季節のごあいさつ」で埋まりがちだが、中身の無い記事を
//  並べるとサイト全体の評価を下げる。ここに置くのは、
//    (a) サイトに既にある事実だけで構成できて、
//    (b) 既存ページと重複せず、
//    (c) 泊まる人が実際に迷うことに答える
//  ものに限る。
//
//  第 1 稿は「客室のえらび方」。12 室の面積・定員・お風呂は各室ページに
//  散っていて、横に並べて比べられる場所がどこにも無かった。
//  この記事は ROOMS のデータから **生成する** ので、客室情報を直せば
//  記事も自動で追随する。手で書き写すと必ずどこかが古くなる。
// ════════════════════════════════════════════════════════════════════

import { ROOMS, ROOM_ORDER } from './rooms.js';

const LANGS = ['ja', 'en', 'zh'];
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const spans = (o) => LANGS.map((l) => `<span data-${l}>${esc(o[l])}</span>`).join('');

export const JOURNAL_BASE = '/journal';

// 面積は「1階 63.76 m² ／ 2階 28.15 m²」のような 2 階建て表記があるので、
// 並べ替え用の数値は全部の数字を足して作る。表示は必ず掲載どおりの文字列を使う。
function areaValue(r) {
  const nums = (r.area.en.match(/[0-9.]+/g) || []).map(Number);
  return nums.reduce((a, b) => a + b, 0);
}

// お風呂の記述から特徴を拾う。判定語は各室ページの掲載文そのもの。
const FEATURES = [
  { key: 'sauna',  test: (r) => /サウナ/.test(r.bath.ja),          ja: 'サウナ付き',     en: 'With a sauna',            zh: '附桑拿' },
  { key: 'pool',   test: (r) => /プール/.test(r.bath.ja),          ja: 'プール付き（夏季）', en: 'With a pool (summer)', zh: '附泳池（夏季）' },
  { key: 'ashiyu', test: (r) => /足湯/.test(r.bath.ja),            ja: '足湯付き',       en: 'With a foot bath',        zh: '附足汤' },
  { key: 'view',   test: (r) => /展望/.test(r.bath.ja),            ja: '展望露天風呂',   en: 'Open-air bath with a view', zh: '观景露天浴' },
  { key: 'hinoki', test: (r) => /桧/.test(r.bath.ja),              ja: '桧風呂',         en: 'Hinoki bath',             zh: '桧木浴' },
  { key: 'rock',   test: (r) => /岩風呂/.test(r.bath.ja),          ja: '露天岩風呂',     en: 'Open-air rock bath',      zh: '露天岩浴' },
];

const T = {
  title: { ja: '客室のえらび方 — 十二棟をひとつの表で', en: 'Choosing your villa — all twelve, side by side', zh: '如何选房 — 十二栋一览' },
  lead: {
    ja: '源翠瓏の客室は全部で十二棟。どれも離れで、それぞれに露天風呂がついています。広さも定員もお風呂の形も棟ごとに違うので、横に並べて比べられるようにまとめました。数字はすべて各客室ページの掲載どおりです。',
    en: 'Gensuirou has twelve villas. Each stands on its own, and each has its own open-air bath. Size, capacity and the shape of the bath differ from villa to villa, so here they are side by side. Every figure is as published on the individual villa pages.',
    zh: '源翠瓏共有十二栋客房，皆为独栋，且各自设有露天温泉。面积、定员与浴池形式各不相同，故在此并列比较。所有数字均与各客房页面的记载一致。',
  },
  bySize:  { ja: '広さで選ぶ', en: 'By size', zh: '按面积' },
  byCap:   { ja: '人数で選ぶ', en: 'By party size', zh: '按人数' },
  byBath:  { ja: 'お風呂で選ぶ', en: 'By bath', zh: '按浴池' },
  all:     { ja: '十二棟一覧', en: 'All twelve', zh: '十二栋一览' },
  colName: { ja: '客室', en: 'Villa', zh: '客房' },
  colArea: { ja: '建築面積', en: 'Area', zh: '建筑面积' },
  colCap:  { ja: '定員', en: 'Guests', zh: '定员' },
  colBath: { ja: 'お風呂', en: 'Bath', zh: '浴室' },
  sizeNote: {
    ja: '碧と凛は二階建てで、掲載も階ごとの面積です。並べ替えは合計で行っています。',
    en: 'Midori and Rin are two-storey; their areas are published per floor. The ordering here uses the total.',
    zh: '碧与凛为两层，面积按层分别记载。此处排序使用合计值。',
  },
  capNote: {
    ja: 'お子様のご宿泊は、お部屋の構造やご年齢に応じて個別にご相談を承っております。',
    en: 'For children, please contact us — arrangements depend on the villa and the child’s age.',
    zh: '儿童入住请提前联系，将依房型与年龄安排。',
  },
  seeRoom: { ja: '詳しく見る', en: 'See the villa', zh: '查看客房' },
};

// ── サウナ付き貸切露天風呂の記事 (2026-09-13 の営業形態変更を受けて) ──
// 数字はすべて施設・温泉・FAQ ページの掲載どおり。ここで新しい数字を作らない。
const T2 = {
  title: {
    ja: 'サウナ付き貸切露天風呂のご案内',
    en: 'The private open-air bath with sauna',
    zh: '附桑拿的包场露天温泉',
  },
  lead: {
    ja: '源翠瓏の貸切露天風呂は、サウナ付きになりました。ご利用は午後三時半から夜九時まで、一回四十分の貸切制で、最終のご案内は夜九時です。湯と水風呂のこと、そしてサウナ付きの客室という選択肢までをまとめました。',
    en: 'Gensuirou’s private open-air bath now comes with a sauna. It is yours in private 40-minute sessions from 15:30 to 21:00, with the last entry at 21:00. Here is how it works, along with the villas that have a sauna of their own.',
    zh: '源翠瓏的包场露天温泉现附带桑拿。开放时间为 15:30 至 21:00，每次包场 40 分钟，最迟入场 21:00。本文整理其使用方式、水风吕，以及自带桑拿的客房选项。',
  },
  how: { ja: 'ご利用のかたち', en: 'How it works', zh: '使用方式' },
  howBody: {
    ja: '一回四十分、完全な貸切でご案内しています。ご利用時間は午後三時半から夜九時まで、最終のご案内は夜九時。一日の枠には限りがあるため、予約優先です。ご到着の際、フロントでお申し付けください。',
    en: 'Each session is 40 minutes, entirely private. Hours run from 15:30 to 21:00, with the last entry at 21:00. Daily slots are limited, so reservation is recommended — just ask at the front desk when you arrive.',
    zh: '每次 40 分钟、完全包场。开放时间为 15:30 至 21:00，最迟入场 21:00。每日名额有限，采预约优先制，抵达时向前台预约即可。',
  },
  water: { ja: '湯と水風呂', en: 'The water', zh: '汤与水风吕' },
  waterBody: {
    ja: 'お湯は阿蘇の地下一〇〇〇メートルから湧くアルカリ性単純温泉（pH 8.0）の源泉かけ流し。サウナのあとには水風呂があります。貸切露天岩風呂「月光桜の湯」のご利用期間は三月から十一月末で、天候によりご利用いただけない日もあります。',
    en: 'The spring is drawn from 1,000 m below Aso — an alkaline simple spring (pH 8.0), served free-flowing from the source. A cold plunge waits after the sauna. The open-air rock bath Gekkou Sakura no Yu is open March to the end of November and may close in poor weather.',
    zh: '温泉取自阿苏地下 1,000 米，为碱性单纯泉（pH 8.0）源泉放流。桑拿之后设有水风吕。露天岩浴「月光樱之汤」开放期间为 3 月至 11 月底，遇天候不佳时可能停止使用。',
  },
  rooms: { ja: '客室のサウナという選択肢', en: 'Villas with their own sauna', zh: '自带桑拿的客房' },
  roomsBody: {
    ja: '十二棟すべての客室に露天風呂が付いているので、貸切露天風呂は「もうひとつの湯」としてお使いいただけます。お部屋から出ずにサウナを楽しみたい方には、サウナ付きの客室もございます。',
    en: 'Every one of the twelve villas has its own open-air bath, so the shared bath is best thought of as a second bath. If you would rather not leave your villa at all, some villas have a sauna of their own.',
    zh: '十二栋客房皆设专属露天温泉，包场露天温泉可作为「另一处汤池」使用。若想足不出户享受桑拿，亦有自带桑拿的客房。',
  },
  reserve: {
    ja: 'ご宿泊のご予約はこちらから。',
    en: 'To book your stay, see the reservation page.',
    zh: '住宿预约请见预约页面。',
  },
  reserveLabel: { ja: 'ご予約ページへ', en: 'Reservation page', zh: '前往预约页面' },
};

function renderSaunaBath() {
  const saunaRooms = ROOM_ORDER.filter((s) => /サウナ/.test(ROOMS[s].bath.ja));
  const roomLinks = saunaRooms
    .map((s) => `<a href="rooms/${s}.html">${esc(ROOMS[s].kanji)} ${esc(ROOMS[s].roman)}</a>`)
    .join('・');
  return `
    <section class="block anim">
      <div class="section-title"><h2>${spans(T2.how)}</h2></div>
      <p>${spans(T2.howBody)}</p>
    </section>
    <section class="block anim">
      <div class="section-title"><h2>${spans(T2.water)}</h2></div>
      <p>${spans(T2.waterBody)}</p>
    </section>
    <section class="block anim">
      <div class="section-title"><h2>${spans(T2.rooms)}</h2></div>
      <p>${spans(T2.roomsBody)}</p>
      ${roomLinks ? `<p class="jl-group">${roomLinks}</p>` : ''}
      <p>${spans(T2.reserve)} <a href="reservation.html">${spans(T2.reserveLabel)}</a></p>
    </section>`;
}

/** 記事の一覧。新しいものを先頭に。 */
export const ARTICLES = [
  {
    slug: 'private-sauna-bath',
    date: '2026-09-15',
    title: T2.title,
    lead: T2.lead,
    og: '/assets/facilities_main.jpg',
    render: renderSaunaBath,
  },
  {
    slug: 'choosing-your-villa',
    date: '2026-08-25',
    title: T.title,
    lead: T.lead,
    render: renderVillaGuide,
  },
];

export const articleBySlug = (slug) => ARTICLES.find((a) => a.slug === slug);

/** i18n.js の PAGES に混ぜるメタ。 */
export function journalPageMeta() {
  const out = {
    [JOURNAL_BASE]: {
      journal: 'index',
      og: '/assets/onsen_main.jpg',
      nav: { ja: '読み物', en: 'Journal', zh: '读物' },
      ja: { title: '読み物 ｜ 源翠瓏 - 阿蘇の温泉旅館', desc: '源翠瓏からの読み物。客室のえらび方など、お泊まりの前に読んでいただきたいことをまとめています。' },
      en: { title: 'Journal | Gensuirou — Onsen Ryokan in Aso', desc: 'Reading from Gensuirou: how to choose among the twelve villas, and other things worth knowing before you stay.' },
      zh: { title: '读物 ｜ 源翠瓏 — 阿苏温泉旅馆', desc: '源翠瓏的读物。如何在十二栋客房中选择，以及入住前值得了解的事。' },
    },
  };
  for (const a of ARTICLES) {
    out[`${JOURNAL_BASE}/${a.slug}`] = {
      journal: a.slug,
      og: a.og || '/assets/onsen_main.jpg',
      published: a.date,
      nav: a.title,
      ja: { title: `${a.title.ja} ｜ 源翠瓏`, desc: a.lead.ja.slice(0, 150) },
      en: { title: `${a.title.en} | Gensuirou`, desc: a.lead.en.slice(0, 155) },
      zh: { title: `${a.title.zh} ｜ 源翠瓏`, desc: a.lead.zh.slice(0, 150) },
    };
  }
  return out;
}

// ── 記事本文 (12 室のデータから生成する) ───────────────────────────
function villaRow(slug) {
  const r = ROOMS[slug];
  const cap = { ja: `${r.capacity}名`, en: `${r.capacity}`, zh: `${r.capacity} 人` };
  return `<tr>
      <td><a href="rooms/${slug}.html">${esc(r.kanji)} ${esc(r.roman)}</a></td>
      <td>${spans(r.area)}</td>
      <td>${spans(cap)}</td>
      <td>${spans(r.bath)}</td>
    </tr>`;
}

function renderVillaGuide() {
  const bySize = [...ROOM_ORDER].sort((a, b) => areaValue(ROOMS[b]) - areaValue(ROOMS[a]));
  const caps = [...new Set(ROOM_ORDER.map((s) => ROOMS[s].capacity))].sort((a, b) => a - b);

  const sizeList = bySize.map((s) => {
    const r = ROOMS[s];
    return `<li><a href="rooms/${s}.html">${esc(r.kanji)} ${esc(r.roman)}</a> — ${spans(r.area)}</li>`;
  }).join('\n        ');

  const capBlocks = caps.map((c) => {
    const list = ROOM_ORDER.filter((s) => ROOMS[s].capacity === c);
    const label = { ja: `${c}名まで`, en: `Up to ${c} guests`, zh: `最多 ${c} 人` };
    return `<div class="jl-group">
          <h4>${spans(label)}</h4>
          <p>${list.map((s) => `<a href="rooms/${s}.html">${esc(ROOMS[s].kanji)} ${esc(ROOMS[s].roman)}</a>`).join('・')}</p>
        </div>`;
  }).join('\n        ');

  const featBlocks = FEATURES.map((f) => {
    const list = ROOM_ORDER.filter((s) => f.test(ROOMS[s]));
    if (!list.length) return '';
    return `<div class="jl-group">
          <h4>${spans({ ja: f.ja, en: f.en, zh: f.zh })}</h4>
          <p>${list.map((s) => `<a href="rooms/${s}.html">${esc(ROOMS[s].kanji)} ${esc(ROOMS[s].roman)}</a>`).join('・')}</p>
        </div>`;
  }).filter(Boolean).join('\n        ');

  return `
    <section class="block anim">
      <div class="section-title"><h2>${spans(T.bySize)}</h2></div>
      <ol class="jl-rank">
        ${sizeList}
      </ol>
      <p class="fine-note">${spans(T.sizeNote)}</p>
    </section>

    <section class="block anim">
      <div class="section-title"><h2>${spans(T.byCap)}</h2></div>
      <div class="jl-groups">
        ${capBlocks}
      </div>
      <p class="fine-note">${spans(T.capNote)}</p>
    </section>

    <section class="block anim">
      <div class="section-title"><h2>${spans(T.byBath)}</h2></div>
      <div class="jl-groups">
        ${featBlocks}
      </div>
    </section>

    <section class="block anim">
      <div class="section-title"><h2>${spans(T.all)}</h2></div>
      <div class="jl-table">
        <table>
          <thead><tr>
            <th>${spans(T.colName)}</th><th>${spans(T.colArea)}</th>
            <th>${spans(T.colCap)}</th><th>${spans(T.colBath)}</th>
          </tr></thead>
          <tbody>
    ${ROOM_ORDER.map(villaRow).join('\n    ')}
          </tbody>
        </table>
      </div>
    </section>`;
}

// ── ページ組み立て ──────────────────────────────────────────────
function shell({ bodyPage, h1, heroCap, inner }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>${esc(h1.ja)}</title>
<meta name="description" content="" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png" />
<link rel="stylesheet" href="/tokens.css" />
<link rel="stylesheet" href="/assets/site.css" />
</head>
<body data-page="${bodyPage}">
<h1 class="seo">${spans(h1)}</h1>
<div id="siteHeader"></div>
<main id="main">

<div class="page-hero">
    <img class="bg" src="/assets/onsen_main.jpg" alt="" fetchpriority="high" decoding="async">
    <div class="cap">
      <div class="en">${spans({ ja: '読み物', en: 'Journal', zh: '读物' })}</div>
      <div class="ja">${spans(heroCap)}</div>
    </div>
</div>

<div class="shell">
  <div class="inner">
${inner}
  </div>
</div>

</main>
<div id="siteFooter"></div>
<script src="/assets/site.js"></script>
</body>
</html>
`;
}

export function renderJournalIndex() {
  const items = ARTICLES.map((a) => `
      <li class="jl-card">
        <a href="journal/${a.slug}.html">
          <time datetime="${a.date}">${a.date}</time>
          <h3>${spans(a.title)}</h3>
          <p>${spans(a.lead)}</p>
        </a>
      </li>`).join('');
  return shell({
    bodyPage: 'journal',
    h1: { ja: '源翠瓏の読み物', en: 'The Gensuirou Journal', zh: '源翠瓏读物' },
    heroCap: { ja: '読み物', en: 'Journal', zh: '读物' },
    inner: `    <section class="block anim">
      <ul class="jl-list">${items}
      </ul>
    </section>`,
  });
}

export function renderArticle(slug) {
  const a = articleBySlug(slug);
  return shell({
    bodyPage: 'journal',
    h1: a.title,
    heroCap: a.title,
    inner: `    <section class="block anim">
      <p class="jl-date"><time datetime="${a.date}">${a.date}</time></p>
      <div class="section-title">
        <h2>${spans(a.title)}</h2>
        <p>${spans(a.lead)}</p>
      </div>
    </section>
${a.render()}

    <div class="room-nav">
      <a class="reserve-btn" href="journal.html">${spans({ ja: '読み物の一覧', en: 'All journal entries', zh: '读物一览' })}</a>
      <a class="reserve-btn" href="rooms.html">${spans({ ja: '客室を見る', en: 'View the villas', zh: '查看客房' })}</a>
    </div>
`,
  });
}
