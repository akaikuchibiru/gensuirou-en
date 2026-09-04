// ════════════════════════════════════════════════════════════════════
//  言語別 URL
//
//  移行前の状態: 3 言語ぶんの本文が 1 枚の HTML に入っていて、表示しない
//  言語は CSS で display:none。言語の選択は localStorage だけに入っていた。
//  つまり **EN と ZH に URL が存在しなかった**。8 ページとも canonical 0 件 /
//  hreflang 0 件で、Google が拾えるのは既定の日本語版だけ。英語・中国語で
//  集客する旅館サイトとしては、ここが一番大きな欠陥だった。
//
//  ここでやること:
//    /        …… ja (x-default)
//    /en/…    …… en
//    /zh/…    …… zh
//  同じ 1 枚の HTML を読み、その言語以外の <span data-XX> を落として返す。
//  URL が言語の唯一の正。localStorage では上書きしない
//  (localStorage だけだと、共有された URL が相手の言語で開かない)。
//
//  生成ではなく実行時に書き換えているのは、本文の正が 1 か所のままだから。
//  ページを直すのは public/*.html だけでよく、生成物との二重管理が要らない。
//  取りこぼしは scripts/check-i18n.mjs が全リンクを実際に叩いて検出する。
// ════════════════════════════════════════════════════════════════════

import { jsonLdTag } from './schema.js';
import { roomPageMeta } from './room-page.js';
import { journalPageMeta } from './journal.js';
import { LASTMOD } from './lastmod.js';

export const LANGS = ['ja', 'en', 'zh'];
export const DEFAULT_LANG = 'ja';
export const PROD_HOST = 'gensuirou.com';

// クリーン URL → 3 言語ぶんの title / description。
// 実ファイルへの対応付けは Static Assets の html_handling に任せる。
//
// 数字と固有名は既存ページの記載から取っている。design.md の非交渉項目に
// 「Real numbers only」があるので、埋めるために数字を作らないこと。
//   全 12 棟 / 敷地 4,000 坪 / 地下 1,000m / 熊本県阿蘇郡西原村
const BASE_PAGES = {
  '/': {
    og: '/assets/movie/poster.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: 'ホーム', en: 'Home', zh: '首页' },
    ja: {
      title: '源翠瓏｜阿蘇の全室露天風呂付き離れ宿・熊本の温泉旅館',
      desc: '源翠瓏 (Gensuirou) — 熊本県阿蘇郡西原村の全12室・全室離れ露天風呂付き温泉旅館。日本語・English・中文でご案内。',
    },
    en: {
      title: 'Gensuirou | Onsen Ryokan in Aso, Kumamoto — 12 Detached Villas',
      desc: 'Gensuirou is a twelve-villa onsen ryokan in Nishihara, Aso, Kumamoto. Every villa stands on its own, each with a private open-air hot spring bath.',
    },
    zh: {
      title: '源翠瓏 — 熊本阿苏温泉旅馆 ｜ 全 12 栋独立别墅・专属露天温泉',
      desc: '源翠瓏位于熊本县阿苏郡西原村。全 12 栋独立别墅，每栋皆设专属露天温泉。提供日文、English、中文导览。',
    },
  },
  '/reservation': {
    og: '/assets/rooms_main.jpg',
    nav: { ja: 'ご予約', en: 'Reservation', zh: '预约' },
    ja: {
      title: 'ご予約 Reservation ｜ 源翠瓏 - プラン・料金・空室のご確認',
      desc: '源翠瓏のご予約。プラン・料金・空室状況はWEB予約ページよりご確認いただけます。お電話（096-279-1800／10:00–18:00）でも承ります。',
    },
    en: {
      title: 'Reservations | Gensuirou — Plans, Rates and Availability',
      desc: 'Book Gensuirou online to see plans, rates and availability, or reserve by telephone on +81 (0)96-279-1800 (10:00–18:00 JST).',
    },
    zh: {
      title: '预约 ｜ 源翠瓏 — 方案・价格・空房查询',
      desc: '源翠瓏预约。方案、价格与空房状况请于网络预约页面确认，亦可来电 +81 (0)96-279-1800（10:00–18:00 日本时间）。',
    },
  },
  '/rooms': {
    og: '/assets/rooms_main.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '客室', en: 'Rooms', zh: '客房' },
    ja: {
      title: '客室 Rooms ｜ 源翠瓏 - 全12室の露天風呂付き離れ客室',
      desc: '源翠瓏の客室は全12棟すべてが離れのスイートルーム。各棟に源泉かけ流しの露天風呂を備え、広さ・定員・お風呂の形はそれぞれ異なります。紫・葵・華・碧・瑩・結・凛・宙・瑞・皇・禅・想。',
    },
    en: {
      title: 'Villas | Gensuirou — Twelve Detached Villas with Private Onsen',
      desc: 'Twelve detached villa suites, each with its own free-flowing open-air onsen. Size, capacity and the shape of the bath differ by villa: Shiori, Aoi, Hana, Midori, Ei, Yui, Rin, Sora, Zui, Sumeragi, Zen, Sou.',
    },
    zh: {
      title: '客房 ｜ 源翠瓏 — 12 栋独立别墅・专属露天温泉',
      desc: '源翠瓏 12 栋独立别墅介绍，每栋皆附专属露天温泉：紫、葵、華、碧、瑩、結、凛、宙、瑞、皇、禅、想。',
    },
  },
  '/cuisine': {
    og: '/assets/cuisine_main.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '料理', en: 'Cuisine', zh: '料理' },
    ja: {
      title: '料理｜源翠瓏 - 九州の山海の幸による創作フレンチ和食',
      desc: '源翠瓏のお食事は、和とフレンチを融合した創作料理。山海の幸に恵まれた九州の厳選された食材を使い、季節ごとに彩りを変えてご用意しています。',
    },
    en: {
      title: 'Cuisine | Gensuirou — French-Japanese from Kyushu',
      desc: 'French-Japanese cuisine at Gensuirou, built on carefully selected produce from the mountains and seas of Kyushu. The plates change with the season.',
    },
    zh: {
      title: '料理 ｜ 源翠瓏 — 取材九州山海的和法创作料理',
      desc: '源翠瓏的和法创作料理。选用山海富饶九州的精选食材，随季节更换菜单，献上暖心款待。',
    },
  },
  '/onsen': {
    og: '/assets/onsen_main.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '温泉', en: 'Onsen', zh: '温泉' },
    ja: {
      title: '温泉 Onsen ｜ 源翠瓏 - 阿蘇の地下1000mから湧く天然温泉',
      desc: '源翠瓏の温泉は、阿蘇の地下1000mから湧くアルカリ性単純温泉（pH 8.0）の源泉かけ流し。全12棟の露天風呂に加え、貸切露天大浴場「月光桜の湯」と檜のサウナもございます。',
    },
    en: {
      title: 'Onsen | Gensuirou — Natural Hot Spring from 1,000 m Below Aso',
      desc: 'Gensuirou’s natural hot spring is drawn from 1,000 m below Aso — an alkaline simple spring (pH 8.0), served free-flowing from the source in all twelve villa baths, the private bath house Gekko-Sakura no Yu and a hinoki sauna.',
    },
    zh: {
      title: '温泉 ｜ 源翠瓏 — 涌自阿苏地下 1,000 米的天然温泉',
      desc: '源翠瓏的天然温泉取自阿苏地下 1,000 米，为碱性单纯泉（pH 8.0）源泉放流。除全 12 栋的专属露天温泉外，另有包场大浴场「月光樱之汤」与桧木桑拿。',
    },
  },
  '/facilities': {
    og: '/assets/facilities_main.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '施設', en: 'Facilities', zh: '设施' },
    ja: {
      title: '施設紹介｜源翠瓏 - 貸切露天大浴場・サウナ・ボディケア',
      desc: '源翠瓏の館内施設。貸切露天大浴場「月光桜の湯」（3月〜11月末）、檜のサウナルーム（1回40分・無料）、ボディケア。いずれも朝7:30〜夜21:00に貸切でご案内しています。',
    },
    en: {
      title: 'Facilities | Gensuirou — Open-Air Bath House, Sauna, Body Care',
      desc: 'Facilities at Gensuirou: the private open-air bath house Gekko-Sakura no Yu (March to end of November), a hinoki sauna (40 minutes per session, free) and body care — all reserved for private use, 07:30–21:00.',
    },
    zh: {
      title: '馆内设施 ｜ 源翠瓏 — 包场露天大浴场・桑拿・身体护理',
      desc: '源翠瓏的馆内设施。包场露天大浴场「月光樱之汤」（3 月至 11 月底）、桧木桑拿（每次 40 分钟・免费）、身体护理。均以包场方式提供，7:30〜21:00。',
    },
  },
  '/access': {
    og: '/assets/access_main.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: 'アクセス', en: 'Access', zh: '交通' },
    ja: {
      title: '交通アクセス Access ｜ 源翠瓏 - 熊本県阿蘇郡西原村',
      desc: '源翠瓏（熊本県阿蘇郡西原村小森2113-3）への交通アクセス。熊本空港よりお車で約15分、JR熊本駅より約1時間15分。バスは萌の里バス停より徒歩約10分です。',
    },
    en: {
      title: 'Access | Gensuirou — Nishihara, Aso, Kumamoto',
      desc: 'How to reach Gensuirou (2113-3 Komori, Nishihara, Aso, Kumamoto): about 15 minutes by car from Kumamoto Airport, 1 h 15 min from JR Kumamoto Station, or 10 minutes on foot from the Moe-no-Sato bus stop.',
    },
    zh: {
      title: '交通指引 ｜ 源翠瓏 — 熊本县阿苏郡西原村',
      desc: '前往源翠瓏（熊本县阿苏郡西原村小森 2113-3）的交通方式。距熊本机场约 15 分钟车程，距 JR 熊本站约 1 小时 15 分，由萌之里巴士站步行约 10 分钟。',
    },
  },
  '/faq': {
    og: '/assets/onsen_main.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: 'よくある質問', en: 'Questions', zh: '常见问题' },
    ja: {
      title: 'よくある質問 FAQ ｜ 源翠瓏',
      desc: '源翠瓏のよくあるご質問。チェックイン15:30（最終18:00）／チェックアウト11:00、ご宿泊は中学生から、送迎、キャンセル料など、ご予約の前に多いお問い合わせをまとめています。',
    },
    en: {
      title: 'FAQ | Gensuirou',
      desc: 'Frequently asked questions about Gensuirou: check-in 15:30 (latest 18:00) and check-out 11:00, guests of junior-high age and above, no shuttle service, cancellation fees, and the private bath and sauna hours.',
    },
    zh: {
      title: '常见问题 ｜ 源翠瓏',
      desc: '源翠瓏的常见问题。入住 15:30／退房 11:00、儿童同行、接送、餐食与温泉的使用时间等，出发前请先确认。',
    },
  },
  '/wedding': {
    og: '/assets/wedding_main.jpg',
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '結婚式', en: 'Wedding', zh: '婚礼' },
    ja: {
      title: '結婚式｜源翠瓏 - 阿蘇の森の隠れ家でのプライベート挙式',
      desc: '森の隠れ家 源翠瓏でのプライベートウェディング。ロケーションフォト55万円〜、ウェディングパーティー60万円〜（いずれも税別）、対応人数2〜18名。ブライダル事業パートナー「ラヴィアンシェリー」が承ります。',
    },
    en: {
      title: 'Weddings | Gensuirou — A Private Ceremony in the Forest',
      desc: 'A private wedding at Gensuirou, a hideaway in the Aso forest. Location photography from ¥550,000 and wedding parties from ¥600,000 (before tax), for parties of 2 to 18. Arranged with our bridal partner La Vie en Chérie.',
    },
    zh: {
      title: '婚礼 ｜ 源翠瓏 — 森中隐匿的私人婚礼',
      desc: '在阿苏森林中隐匿的源翠瓏举办私人婚礼。外景摄影 55 万日元起、婚宴 60 万日元起（均为税前），可对应 2〜18 人。由婚礼合作伙伴「La Vie en Chérie」承办。',
    },
  },
};

// 客室 12 室は静的ファイルではなくデータから組み立てる。
// PAGES に混ぜてしまえば、言語別 URL・canonical・hreflang・sitemap・
// JSON-LD が既存の仕組みのまま効く。
export const PAGES = { ...BASE_PAGES, ...roomPageMeta(), ...journalPageMeta() };

// 書体はその言語で使うものだけ読む。
//
// 3 書体をまとめて要求すると Google Fonts の CSS が **455KB / @font-face 436 件**
// になり、描画を止める (2026-08-25 実測)。内訳は Noto Serif SC が 340KB、
// 書体は自前ホストの部分集合 (2026-09-03 に Google Fonts をやめた)。
// その言語で **実際に読む書体だけ** を先に取りに行かせる。
//   ja  ja + latin   158KB
//   en  latin のみ    11KB
//   zh  zh + latin   252KB
// 置き換え前は実測で ja 479KB / zh 1,380KB だった。
// extra は Sawarabi に無い 6 字 (凛嗜檜瑩瓏贅) の補い。3KB。
// 宿の名前の「瓏」が入っているので、どの言語の面でも要る。
const FONT_FILES = {
  ja: ['/assets/fonts/gensuirou-ja.woff2', '/assets/fonts/gensuirou-latin.woff2',
       '/assets/fonts/gensuirou-ja-extra.woff2'],
  // 英語・中国語の面に出る和文は客室名と切替の 19 字だけ。155KB でなく 5KB を取る。
  en: ['/assets/fonts/gensuirou-latin.woff2', '/assets/fonts/gensuirou-ja-mini.woff2',
       '/assets/fonts/gensuirou-ja-extra.woff2'],
  zh: ['/assets/fonts/gensuirou-zh.woff2', '/assets/fonts/gensuirou-latin.woff2',
       '/assets/fonts/gensuirou-ja-mini.woff2', '/assets/fonts/gensuirou-ja-extra.woff2'],
};

// og:locale はハイフン付きの地域込みで書く。ja だけだと Facebook が落とす。
const OG_LOCALE = { ja: 'ja_JP', en: 'en_US', zh: 'zh_CN' };

/**
 * URL を解釈する。返り値は 3 通り:
 *   { lang, path }       … 既知のページ
 *   { strip }            … /en/assets/… のような紛れ。接頭辞を外して 301
 *   { lang, notFound }   … /en/なにか。その言語のまま 404 を出す
 *   null                 … 言語接頭辞なしの非ページ (アセット等)。素通し
 */
export function parsePath(pathname) {
  const m = pathname.match(/^\/(en|zh)(\/.*)?$/);
  if (!m) return PAGES[pathname] ? { lang: DEFAULT_LANG, path: pathname } : null;
  const rest = m[2] || '/';
  if (PAGES[rest]) return { lang: m[1], path: rest };
  // 最後の区切りにドットがあればアセットとみなし、接頭辞を外して 301。
  // /en/assets/site.css が 404 になるのを防ぐ (古いキャッシュや手打ち対策)。
  const last = rest.split('/').pop();
  if (last.includes('.')) return { strip: rest };
  // それ以外は、その言語のまま 404 を出す。接頭辞を捨てると
  // 英語で見ていた人に日本語の 404 が出る。
  return { lang: m[1], notFound: true };
}

/** 言語 + クリーンパス → その言語での URL パス。ja は接頭辞なし。 */
export function langPath(lang, path) {
  const p = path === '/' ? '' : path;
  return (lang === DEFAULT_LANG ? '' : '/' + lang) + p || '/';
}

/** 相対 URL か (スキーム・ルート絶対・フラグメントのいずれでもない)。 */
const isRelative = (v) =>
  !!v && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(v.trim());

/**
 * どのページにも共通の書き換え。
 *
 * - html[lang] を立てる。CSS の言語出し分けと、JS が生成するヘッダ・フッタが
 *   これに従う
 * - その言語以外の <span data-XX> を落とす。CSS で隠すだけだと、Google からは
 *   3 言語が混ざった 1 ページに見える
 * - 相対 URL を絶対に直す。/en/rooms から "assets/site.css" を読むと
 *   /en/assets/site.css になって 404 する
 */
function buildRewriter(lang) {
  let rw = new HTMLRewriter()
    .on('html', { element: (el) => el.setAttribute('lang', lang) })
    // HTML コメントは配信しない。ソースの注記は開発者のためのもので、
    // お客さまのページに出す必要はない。移行や不具合の経緯を書いた
    // 内部メモがそのまま見えていた (2026-08-28 実測: トップで 1,439 字)。
    // 注記はリポジトリに残り、配信物からだけ消える。
    .onDocument({ comments: (c) => c.remove() });

  for (const l of LANGS) {
    if (l === lang) continue;
    rw = rw.on(`[data-${l}]`, { element: (el) => el.remove() });
  }

  // ページ間リンク。相対 href は "foo.html" か "foo.html#frag" の形しかない
  // (2026-08-25 に 8 ページ全部を機械で棚卸しして確認済み)。
  rw = rw.on('a[href]', {
    element(el) {
      const v = el.getAttribute('href');
      if (!isRelative(v)) return;
      const i = v.indexOf('#');
      const hash = i >= 0 ? v.slice(i) : '';
      const file = i >= 0 ? v.slice(0, i) : v;
      let clean = '/' + file.replace(/\.html$/, '');
      if (clean === '/index') clean = '/';
      el.setAttribute('href', langPath(lang, clean) + hash);
    },
  });

  // アセットは言語に依らず 1 か所。ルート絶対に直す。
  // 併せて Google Fonts の要求を、その言語で使う書体だけに差し替える。
  rw = rw.on('link[href]', {
    element(el) {
      const v = el.getAttribute('href');
      if (isRelative(v)) el.setAttribute('href', '/' + v);
    },
  });
  for (const sel of ['img[src]', 'script[src]', 'video[src]', 'source[src]', 'audio[src]', 'iframe[src]']) {
    rw = rw.on(sel, { element: (el) => { const v = el.getAttribute('src'); if (isRelative(v)) el.setAttribute('src', '/' + v); } });
  }
  rw = rw.on('video[poster]', { element: (el) => { const v = el.getAttribute('poster'); if (isRelative(v)) el.setAttribute('poster', '/' + v); } });
  for (const sel of ['img[srcset]', 'source[srcset]']) {
    rw = rw.on(sel, {
      element(el) {
        const v = el.getAttribute('srcset');
        if (!v) return;
        el.setAttribute('srcset', v.split(',').map((part) => {
          const t = part.trim();
          if (!t) return t;
          const [u, ...d] = t.split(/\s+/);
          return (isRelative(u) ? '/' + u : u) + (d.length ? ' ' + d.join(' ') : '');
        }).join(', '));
      },
    });
  }
  return rw;
}

function withLang(res, lang) {
  const h = new Headers(res.headers);
  // 同じ URL でも言語ごとに別物を返すので、受け手に言語を明示する。
  h.set('Content-Language', lang);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/** ページ。SEO 用の head を足したうえで言語を確定させる。 */
export function localizePage(res, { lang, path, origin, host, enquiry, sitekey }) {
  // ⚠ og / published / journal は **ページの側** に持たせてある。
  //   meta (= 言語ごとの title と desc) から読むと undefined になり、
  //   気付かないまま全ページ同じ og:image に落ちる (2026-09-04 に踏んだ)。
  const pageMeta = PAGES[path];
  const meta = pageMeta[lang];
  const self = origin + langPath(lang, path);
  // 本番以外 (workers.dev 等) は索引に入れない。自己参照 canonical だけだと
  // 検証用ホストが本番と重複して索引されてしまう。
  const isProd = host === PROD_HOST;

  const head =
    // 書体は同じオリジンにある。CSS を読み終えてから取りに行くと本文が
    // 一度フォールバックで描かれて入れ替わるので、その言語のぶんだけ先に取る。
    // ⚠ crossorigin が要る (フォントは無指定でも CORS 扱いで取りに行くので、
    //   付けないと preload が使われず 2 回落とすことになる)。
    FONT_FILES[lang].map((f) =>
      `<link rel="preload" as="font" type="font/woff2" href="${origin}${f}" crossorigin>`).join('') +
    // ロゴはヘッダの一部だが、ヘッダを組み立てるのは body 末尾の site.js。
    // 素だと要求が LCP より後になる (2026-08-25 実測: 2169ms)。先に取りに行かせる。
    `<link rel="preload" as="image" href="${origin}/assets/imgs/logo_gensuirou.png">` +
    `<link rel="canonical" href="${self}">` +
    LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${origin}${langPath(l, path)}">`).join('') +
    `<link rel="alternate" hreflang="x-default" href="${origin}${langPath(DEFAULT_LANG, path)}">` +
    // 面ごとの写真を出す。全ページ同じ絵だと、LINE や Instagram に貼られた
    // ときにどのページも同じ見た目になり、開かれにくい (2026-09-04 まで
    // 23 ページすべて poster.jpg だった)。
    `<meta property="og:type" content="${pageMeta.journal && pageMeta.journal !== 'index' ? 'article' : 'website'}">` +
    `<meta property="og:site_name" content="源翠瓏 Gensuirou">` +
    `<meta property="og:locale" content="${OG_LOCALE[lang]}">` +
    LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`).join('') +
    `<meta property="og:url" content="${self}">` +
    `<meta property="og:title" content="${esc(meta.title)}">` +
    `<meta property="og:description" content="${esc(meta.desc)}">` +
    `<meta property="og:image" content="${origin}${pageMeta.og || '/assets/movie/poster.jpg'}">` +
    `<meta property="og:image:alt" content="${esc(meta.title)}">` +
    (pageMeta.published ? `<meta property="article:published_time" content="${pageMeta.published}">` : '') +
    `<meta name="twitter:card" content="summary_large_image">` +
    (isProd ? '' : `<meta name="robots" content="noindex">`) +
    jsonLdTag(origin, lang, path);

  let rw = buildRewriter(lang)
    .on('title', { element: (el) => el.setInnerContent(meta.title) })
    .on('meta[name="description"]', { element: (el) => el.setAttribute('content', meta.desc) })
    .on('head', { element: (el) => el.append(head, { html: true }) });

  // 予約フォームは宛先 (ENQUIRY_TO) があるときだけ出す。無いまま出すと、
  // 誰も見ない場所に問い合わせが溜まる。出さないときは電話導線を残す。
  if (enquiry) {
    rw = rw
      .on('[data-enquiry="standby"]', { element: (el) => el.remove() })
      .on('[data-enquiry="form"]', { element: (el) => el.removeAttribute('hidden') })
      .on('.cf-turnstile', { element: (el) => el.setAttribute('data-sitekey', sitekey) })
      .on('head', {
        element: (el) => el.append(
          '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>',
          { html: true },
        ),
      });
  } else {
    rw = rw.on('[data-enquiry="form"]', { element: (el) => el.remove() });
  }

  return withLang(rw.transform(res), lang);
}

/** 404 など、SEO の head を持たせないページ。言語だけ合わせる。 */
export function localizeShell(res, { lang }) {
  return withLang(buildRewriter(lang).transform(res), lang);
}

/** sitemap に載せる URL を全部返す (8 ページ × 3 言語)。 */
export function allUrls(origin) {
  const out = [];
  for (const path of Object.keys(PAGES)) {
    for (const lang of LANGS) {
      out.push({
        loc: origin + langPath(lang, path),
        alts: LANGS.map((l) => ({ lang: l, href: origin + langPath(l, path) }))
          .concat([{ lang: 'x-default', href: origin + langPath(DEFAULT_LANG, path) }]),
        // 中身が最後に変わった日 (scripts/gen-lastmod.mjs が git から作る)
        lastmod: LASTMOD[path] || null,
      });
    }
  }
  return out;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
