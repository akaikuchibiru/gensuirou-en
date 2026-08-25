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
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: 'ホーム', en: 'Home', zh: '首页' },
    ja: {
      title: '源翠瓏 -げんすいろう- ｜ 阿蘇の全室露天風呂付き離れ客室の温泉旅館',
      desc: '源翠瓏 (Gensuirou) — 熊本県阿蘇郡西原村の全12室・全室離れ露天風呂付き温泉旅館。日本語・English・中文でご案内。',
    },
    en: {
      title: 'Gensuirou — Onsen Ryokan in Aso, Kumamoto | Twelve Detached Villas',
      desc: 'Gensuirou is a twelve-villa onsen ryokan in Nishihara, Aso, Kumamoto. Every villa stands on its own, each with a private open-air hot spring bath.',
    },
    zh: {
      title: '源翠瓏 — 熊本阿苏温泉旅馆 ｜ 全 12 栋独立别墅・专属露天温泉',
      desc: '源翠瓏位于熊本县阿苏郡西原村。全 12 栋独立别墅，每栋皆设专属露天温泉。提供日文、English、中文导览。',
    },
  },
  '/rooms': {
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '客室', en: 'Rooms', zh: '客房' },
    ja: {
      title: '客室 Rooms ｜ 源翠瓏 - 全12室の露天風呂付き離れ客室',
      desc: '源翠瓏の全12室・全室離れ露天風呂付き客室のご紹介。紫、葵、華、碧、瑩、結、凛、宙、瑞、皇、禅、想。',
    },
    en: {
      title: 'Villas | Gensuirou — Twelve Detached Villas with Private Onsen',
      desc: 'All twelve villas at Gensuirou stand detached, each with its own open-air onsen: Shiori, Aoi, Hana, Midori, Ei, Yui, Rin, Sora, Zui, Sumeragi, Zen and Sou.',
    },
    zh: {
      title: '客房 ｜ 源翠瓏 — 12 栋独立别墅・专属露天温泉',
      desc: '源翠瓏 12 栋独立别墅介绍，每栋皆附专属露天温泉：紫、葵、華、碧、瑩、結、凛、宙、瑞、皇、禅、想。',
    },
  },
  '/cuisine': {
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '料理', en: 'Cuisine', zh: '料理' },
    ja: {
      title: '料理 Cuisine ｜ 源翠瓏 - 九州山海の幸を厳選した創作フレンチ和食',
      desc: '源翠瓏の創作フレンチ和食。熊本県産を中心に山海の幸を用いたおもてなし料理。',
    },
    en: {
      title: 'Cuisine | Gensuirou — French-Japanese from Kyushu’s Mountains and Seas',
      desc: 'French-Japanese cuisine at Gensuirou, built on produce from Kumamoto and the mountains and seas of Kyushu.',
    },
    zh: {
      title: '料理 ｜ 源翠瓏 — 取材九州山海的和法创作料理',
      desc: '源翠瓏的和法创作料理。以熊本县产食材为中心，取九州山海之幸款待宾客。',
    },
  },
  '/onsen': {
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '温泉', en: 'Onsen', zh: '温泉' },
    ja: {
      title: '温泉 Onsen ｜ 源翠瓏 - 阿蘇の地下1000mから湧く天然温泉',
      desc: '源翠瓏の天然温泉。アルカリ性単純温泉『美肌の湯』、源泉かけ流し。',
    },
    en: {
      title: 'Onsen | Gensuirou — Natural Hot Spring from 1,000 m Below Aso',
      desc: 'Gensuirou’s natural hot spring is drawn from 1,000 m below Aso. An alkaline simple spring, served free-flowing from the source.',
    },
    zh: {
      title: '温泉 ｜ 源翠瓏 — 涌自阿苏地下 1,000 米的天然温泉',
      desc: '源翠瓏的天然温泉，取自阿苏地下 1,000 米。碱性单纯泉「美肌之汤」，源泉放流。',
    },
  },
  '/facilities': {
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '施設', en: 'Facilities', zh: '设施' },
    ja: {
      title: '施設紹介 Facilities ｜ 源翠瓏 - 貸切露天大浴場・サウナ・ボディケア',
      desc: '源翠瓏の館内施設。貸切露天大浴場「月光桜の湯」、檜のサウナルーム、ボディケア。',
    },
    en: {
      title: 'Facilities | Gensuirou — Private Open-Air Bath House, Sauna, Body Care',
      desc: 'Facilities at Gensuirou: the reservable open-air bath house Gekko-Sakura no Yu, a hinoki sauna room, and body care.',
    },
    zh: {
      title: '馆内设施 ｜ 源翠瓏 — 包场露天大浴场・桑拿・身体护理',
      desc: '源翠瓏的馆内设施。可包场的露天大浴场「月光樱之汤」、桧木桑拿房、身体护理。',
    },
  },
  '/access': {
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: 'アクセス', en: 'Access', zh: '交通' },
    ja: {
      title: '交通アクセス Access ｜ 源翠瓏 - 熊本県阿蘇郡西原村',
      desc: '源翠瓏への交通アクセス。熊本空港より車で約15分、JR熊本駅より約1時間15分。',
    },
    en: {
      title: 'Access | Gensuirou — Nishihara, Aso, Kumamoto',
      desc: 'How to reach Gensuirou: about 15 minutes by car from Kumamoto Airport, about 1 hour 15 minutes from JR Kumamoto Station.',
    },
    zh: {
      title: '交通指引 ｜ 源翠瓏 — 熊本县阿苏郡西原村',
      desc: '前往源翠瓏的交通方式。距熊本机场约 15 分钟车程，距 JR 熊本站约 1 小时 15 分。',
    },
  },
  '/faq': {
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: 'よくある質問', en: 'Questions', zh: '常见问题' },
    ja: {
      title: 'よくある質問 FAQ ｜ 源翠瓏',
      desc: '源翠瓏のよくあるご質問。チェックイン・お子様・送迎・お食事など。',
    },
    en: {
      title: 'FAQ | Gensuirou',
      desc: 'Frequently asked questions about Gensuirou — check-in, children, transfers and meals.',
    },
    zh: {
      title: '常见问题 ｜ 源翠瓏',
      desc: '源翠瓏的常见问题。入住时间、儿童同行、接送与餐食等。',
    },
  },
  '/wedding': {
    // パンくず用の短いラベル。site.js の DESTS と同じ語を使う
    // (ズレは scripts/check-schema.mjs が描画結果と突き合わせて検出する)
    nav: { ja: '結婚式', en: 'Wedding', zh: '婚礼' },
    ja: {
      title: '結婚式 Wedding ｜ 源翠瓏 - 森の隠れ家でのプライベートウェディング',
      desc: '森の隠れ家 源翠瓏でのプライベートウェディング。少人数のご結婚式・アニバーサリーステイ。',
    },
    en: {
      title: 'Weddings | Gensuirou — A Private Ceremony in the Forest',
      desc: 'A private wedding at Gensuirou, a hideaway in the forest. Small ceremonies and anniversary stays.',
    },
    zh: {
      title: '婚礼 ｜ 源翠瓏 — 森中隐匿的私人婚礼',
      desc: '在森中隐匿的源翠瓏举办私人婚礼。适合小型仪式与纪念日住宿。',
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
// Sawarabi Mincho が 109KB、Cormorant が 6KB。
// 日本語のページで中国語書体の定義 340KB を読む理由は無い。
//   ja  Sawarabi + Cormorant   115KB
//   en  Cormorant のみ           6KB
//   zh  Noto Serif SC + Cormorant 346KB
// 英語は 455KB → 6KB。訪日客の入口なので、ここが一番効く。
const FONT_CSS = {
  ja: 'https://fonts.googleapis.com/css2?family=Sawarabi+Mincho&family=Cormorant+Garamond:wght@400;500;600&display=swap',
  en: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap',
  zh: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600&family=Cormorant+Garamond:wght@400;500;600&display=swap',
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
  let rw = new HTMLRewriter().on('html', { element: (el) => el.setAttribute('lang', lang) });

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
      if (v && v.includes('fonts.googleapis.com/css2')) { el.setAttribute('href', FONT_CSS[lang]); return; }
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
  const meta = PAGES[path][lang];
  const self = origin + langPath(lang, path);
  // 本番以外 (workers.dev 等) は索引に入れない。自己参照 canonical だけだと
  // 検証用ホストが本番と重複して索引されてしまう。
  const isProd = host === PROD_HOST;

  const head =
    // 書体は別ホストから来る。接続を先に開いておくと、CSS を読み終えてから
    // TCP+TLS を張り直す往復が消える。
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    // ロゴはヘッダの一部だが、ヘッダを組み立てるのは body 末尾の site.js。
    // 素だと要求が LCP より後になる (2026-08-25 実測: 2169ms)。先に取りに行かせる。
    `<link rel="preload" as="image" href="${origin}/assets/imgs/logo_gensuirou.png">` +
    `<link rel="canonical" href="${self}">` +
    LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${origin}${langPath(l, path)}">`).join('') +
    `<link rel="alternate" hreflang="x-default" href="${origin}${langPath(DEFAULT_LANG, path)}">` +
    `<meta property="og:type" content="website">` +
    `<meta property="og:site_name" content="源翠瓏 Gensuirou">` +
    `<meta property="og:locale" content="${OG_LOCALE[lang]}">` +
    LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`).join('') +
    `<meta property="og:url" content="${self}">` +
    `<meta property="og:title" content="${esc(meta.title)}">` +
    `<meta property="og:description" content="${esc(meta.desc)}">` +
    `<meta property="og:image" content="${origin}/assets/movie/poster.jpg">` +
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
      });
    }
  }
  return out;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
