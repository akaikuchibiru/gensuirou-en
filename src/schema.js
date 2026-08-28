// ════════════════════════════════════════════════════════════════════
//  構造化データ (JSON-LD)
//
//  方針: **サイトに書いていない事実は 1 つも出さない。**
//  design.md の非交渉項目に「Real numbers only」がある。埋めるために
//  星の数・客室料金・座標・収容人数を作らない。持っていないものは出さない。
//
//  実際に載せている根拠:
//    住所・電話    フッタの <address> と tel: リンク
//    12 室         「全12室」「twelve villas」(トップと客室ページ)
//    客室名         rooms.html の 12 枚のカード (content-data.js に機械抽出)
//    チェックイン   FAQ「チェックイン 15:30（最終 18:00）／チェックアウト 11:00」
//    設備          施設ページの記載 (貸切露天大浴場・サウナ・ボディケア)
//    SNS           フッタの Instagram / YouTube
//    座標          旅館が自分のサイトに貼っていた Google マップ埋め込みの
//                  ピン (place id 0x3540e70c75a8c961:0x4956ef597574e46a)。
//                  推測ではなく旅館自身が置いた位置。OSM で 小森 の重心から
//                  1.65km と照合済 (小森 は広い大字なので範囲内)。
//    予約導線      予約エンジン sec.489.jp。旧サイトの /reservation から
//                  実際に予約が取られていた URL
//
//  出していないもの:
//    priceRange     料理のメニュー価格はあるが客室料金ではない
//                   (料金は予約エンジン sec.489.jp が唯一の出所。転記しない)
//    starRating     根拠なし
//    aggregateRating レビューを持っていない。作れば規約違反
// ════════════════════════════════════════════════════════════════════

import { LANGS, PAGES, langPath } from './i18n.js';

// 予約エンジン。旧サイトの /reservation にあった URL そのもの。
// サイト上のリンク (public/reservation.html) と同じ値であることを
// scripts/check-booking-route.mjs と check-schema.mjs が突き合わせる。
const BOOKING_URL = 'https://sec.489.jp/rg2/2316/reserve/plan?op_id=1&adult=2';
const RESERVE_NAME = { ja: 'ご予約', en: 'Book a stay', zh: '预约' };
import { FAQ, ROOMS } from './content-data.js';
import { ROOMS as VILLAS, roomImages } from './rooms.js';
import { JOURNAL_BASE, articleBySlug } from './journal.js';

const NAME = { ja: '源翠瓏', en: 'Gensuirou', zh: '源翠瓏' };
const TEL = '+81-96-279-1800';

const ADDRESS = {
  ja: { streetAddress: '小森 2113-3', addressLocality: '阿蘇郡西原村', addressRegion: '熊本県', postalCode: '861-2402', addressCountry: 'JP' },
  en: { streetAddress: '2113-3 Komori', addressLocality: 'Nishihara-mura, Aso-gun', addressRegion: 'Kumamoto', postalCode: '861-2402', addressCountry: 'JP' },
  zh: { streetAddress: '小森 2113-3', addressLocality: '阿苏郡西原村', addressRegion: '熊本县', postalCode: '861-2402', addressCountry: 'JP' },
};

const SAME_AS = [
  'https://www.instagram.com/ryokan_gensuirou/',
  'https://www.youtube.com/@GensuirouWeb/',
];

// 施設ページに書いてあるものだけ。
const AMENITIES = {
  ja: ['全室露天風呂付き', '貸切露天大浴場「月光桜の湯」', 'サウナ', 'ボディケア'],
  en: ['Private open-air onsen in every villa', 'Reservable open-air bath house', 'Sauna', 'Body care'],
  zh: ['每栋皆设专属露天温泉', '可包场的露天大浴场「月光樱之汤」', '桑拿', '身体护理'],
};

const HOTEL_ID = (o) => o + '/#hotel';
const SITE_ID = (o) => o + '/#website';
const ORG_IMAGES = (o) => [
  o + '/assets/movie/poster.jpg',
  o + '/assets/rooms_main.jpg',
  o + '/assets/onsen_main.jpg',
];

function hotel(origin, lang) {
  return {
    '@type': 'Hotel',
    '@id': HOTEL_ID(origin),
    name: NAME[lang],
    alternateName: lang === 'ja' ? 'げんすいろう' : '源翠瓏',
    url: origin + langPath(lang, '/'),
    telephone: TEL,
    image: ORG_IMAGES(origin),
    logo: origin + '/assets/imgs/logo_gensuirou.png',
    address: { '@type': 'PostalAddress', ...ADDRESS[lang] },
    // 座標は旅館自身が旧サイトの地図に置いたピン。上の注記を参照。
    geo: { '@type': 'GeoCoordinates', latitude: 32.846895, longitude: 130.932002 },
    hasMap: 'https://www.google.com/maps?ftid=0x3540e70c75a8c961:0x4956ef597574e46a',
    sameAs: SAME_AS,
    // 「全12室」はトップと客室ページの両方に書いてある。
    numberOfRooms: { '@type': 'QuantitativeValue', value: 12, unitText: lang === 'en' ? 'villas' : '室' },
    // FAQ の記載どおり。
    checkinTime: '15:30',
    checkoutTime: '11:00',
    availableLanguage: LANGS.map((l) => ({ '@type': 'Language', name: l })),
    amenityFeature: AMENITIES[lang].map((n) => ({ '@type': 'LocationFeatureSpecification', name: n, value: true })),
    // 電話でしか受け付けていない間は、これが唯一の連絡手段。
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: TEL,
      contactType: 'reservations',
      availableLanguage: LANGS.map((l) => l),
      hoursAvailable: {
        '@type': 'OpeningHoursSpecification',
        opens: '10:00',
        closes: '18:00',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
    },
    // 予約の入口を検索エンジンに明示する。行き先は予約エンジンそのもの。
    // ここを自前の問い合わせフォームにしてはいけない — 料金も空室も出せない
    // (2026-08-24〜28 に実際にそれをやって予約を止めた)。
    potentialAction: {
      '@type': 'ReserveAction',
      name: RESERVE_NAME[lang],
      target: {
        '@type': 'EntryPoint',
        urlTemplate: BOOKING_URL,
        inLanguage: lang,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: { '@type': 'LodgingReservation', name: NAME[lang] },
    },
  };
}

function website(origin, lang) {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID(origin),
    url: origin + '/',
    name: NAME[lang],
    inLanguage: lang,
    publisher: { '@id': HOTEL_ID(origin) },
  };
}

function breadcrumb(origin, lang, path) {
  if (path === '/') return null;
  // 客室詳細と読み物の記事は 2 階層下にある。親を飛ばすと
  // 「ホーム > 紫 Shiori」になり、客室一覧がどこにあるか伝わらない。
  const trail = ['/'];
  const seg = path.split('/').filter(Boolean);
  if (seg.length > 1) {
    const parent = '/' + seg[0];
    if (PAGES[parent]) trail.push(parent);
  }
  trail.push(path);
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: PAGES[p].nav[lang],
      item: origin + langPath(lang, p),
    })),
  };
}

function faqPage(lang) {
  return FAQ.map((x) => ({
    '@type': 'Question',
    name: x.q[lang],
    acceptedAnswer: { '@type': 'Answer', text: x.a[lang] },
  }));
}

function roomList(origin, lang) {
  return {
    '@type': 'ItemList',
    name: PAGES['/rooms'].nav[lang],
    numberOfItems: ROOMS.length,
    itemListElement: ROOMS.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'HotelRoom',
        // 表記はページのラベルどおり。広さや定員は書かれていないので出さない。
        name: lang === 'ja' ? `${r.kanji} ${r.roman}` : `${r.roman} ${r.kanji}`,
        image: origin + r.img,
        containedInPlace: { '@id': HOTEL_ID(origin) },
      },
    })),
  };
}

/** 客室 1 室。面積・定員・構成・お風呂はすべてページに書いてあるものだけ。 */
function villaNode(origin, lang, path, slug) {
  const r = VILLAS[slug];
  const node = {
    '@type': 'HotelRoom',
    '@id': origin + langPath(lang, path) + '#room',
    name: lang === 'ja' ? `${r.kanji} ${r.roman}` : `${r.roman} ${r.kanji}`,
    description: r.desc[lang],
    image: roomImages(slug).slice(0, 6).map((u) => origin + u),
    url: origin + langPath(lang, path),
    containedInPlace: { '@id': HOTEL_ID(origin) },
    occupancy: { '@type': 'QuantitativeValue', maxValue: r.capacity, unitText: 'person' },
    amenityFeature: [{ '@type': 'LocationFeatureSpecification', name: r.bath[lang], value: true }],
  };
  // 碧と凛は 2 階建てで、掲載も階別。合計を勝手に作らないので floorSize は出さない。
  const m = /^([0-9.]+) m²$/.exec(r.area.en);
  if (m) node.floorSize = { '@type': 'QuantitativeValue', value: Number(m[1]), unitCode: 'MTK' };
  return node;
}

/** 読み物の記事。datePublished は記事側の日付をそのまま使う。 */
function articleNode(origin, lang, path, slug) {
  const a = articleBySlug(slug);
  return {
    '@type': 'Article',
    '@id': origin + langPath(lang, path) + '#article',
    headline: a.title[lang],
    description: a.lead[lang],
    inLanguage: lang,
    datePublished: a.date,
    dateModified: a.date,
    mainEntityOfPage: { '@id': origin + langPath(lang, path) + '#webpage' },
    author: { '@id': HOTEL_ID(origin) },
    publisher: { '@id': HOTEL_ID(origin) },
    image: origin + '/assets/onsen_main.jpg',
  };
}

/** そのページの JSON-LD を 1 つの @graph にまとめて返す。 */
export function jsonLd(origin, lang, path) {
  const meta = PAGES[path][lang];
  const self = origin + langPath(lang, path);

  const page = {
    // FAQ ページはページ自体を FAQPage として名乗る。
    '@type': path === '/faq' ? 'FAQPage'
      : (PAGES[path].journal === 'index' ? 'CollectionPage' : 'WebPage'),
    '@id': self + '#webpage',
    url: self,
    name: meta.title,
    description: meta.desc,
    inLanguage: lang,
    isPartOf: { '@id': SITE_ID(origin) },
    about: { '@id': HOTEL_ID(origin) },
    primaryImageOfPage: origin + '/assets/movie/poster.jpg',
  };
  if (path === '/faq') page.mainEntity = faqPage(lang);

  const graph = [hotel(origin, lang), website(origin, lang), page];
  if (PAGES[path].room) graph.push(villaNode(origin, lang, path, PAGES[path].room));
  const j = PAGES[path].journal;
  if (j && j !== 'index') graph.push(articleNode(origin, lang, path, j));
  const bc = breadcrumb(origin, lang, path);
  if (bc) graph.push(bc);
  if (path === '/rooms') graph.push(roomList(origin, lang));

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

/**
 * <script type="application/ld+json"> に入れる形にする。
 *
 * ⚠ JSON.stringify は "</script>" を潰さない。本文に混ざると script が
 *   そこで閉じてしまう。JSON としては "<\/script>" も同じ値なのでエスケープする。
 *   承認画面や目視では気付けない種類の穴。
 */
export function jsonLdTag(origin, lang, path) {
  const s = jsonLd(origin, lang, path)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${s}</script>`;
}
