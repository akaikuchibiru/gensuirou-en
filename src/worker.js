// ════════════════════════════════════════════════════════════════════
//  源翠瓏 — gensuirou.com
//
//  CF Pages + tasquest からの reverse proxy をやめ、単一 Worker + Static
//  Assets に寄せたもの。Worker にする理由は、この先に必要なものが全部
//  Worker 専用だから:
//    - 予約フォームの受け口 (Turnstile 検証 / D1 保存)
//    - Cloudflare Email Sending の send_email binding
//      (Pages Functions では使えない。2026-08-24 に docs で確認)
//    - 言語別 URL の出し分け、動的 sitemap、読み物ページ
//
//  この版は「Pages と同じものを返す」ことだけを目的にしている。
//  i18n・構造化データ・フォームは、URL の同一性を実測で確認してから足す。
//  二つ同時に変えると、壊れたときに切り分けができない。
// ════════════════════════════════════════════════════════════════════

import {
  PAGES, PROD_HOST, allUrls, localizePage, localizeShell, parsePath,
} from './i18n.js';
import { renderRoomPage } from './room-page.js';
import { renderArticle, renderJournalIndex } from './journal.js';
import { enquiryEnabled, handleEnquiry } from './enquiry.js';
import { fetchLegacy, isLegacyAsset, isLegacyGuide } from './legacy.js';

// ── CSP ──
// まだ Report-Only。エッジで注入されるものはローカルに出ないので
// (CF Web Analytics の beacon で実際に踏んだ)、本番で違反を実測してから
// 強制に切り替える。
//
// script は 'self' だけで足りる。全 8 ページを grep して
// インライン <script> が 0 件であることを確認済み (2026-08-25)。
// 一方 style は style="..." が 31 か所あるので 'unsafe-inline' が要る。
// 書体は 2026-09-03 から自前ホストなので、外部ホストの許可は無くなった。
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Turnstile。api.js を読み、検証は iframe で描画される。
  "script-src 'self' https://challenges.cloudflare.com",
  // 2026-09-03: フォントを自前ホストの部分集合に移したので、
  // Google のホストは style-src / font-src から外した。
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // /access の Google マップ埋め込み。default-src 'self' のままだと、
  // CSP を強制に切り替えた瞬間に地図が消える (2026-08-25 に iframe を棚卸し)。
  "frame-src https://maps.google.com https://www.google.com https://challenges.cloudflare.com https://www.youtube-nocookie.com",
];
const CSP_REPORT_PATH = '/_csp-report';

function securityHeaders(host) {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Content-Security-Policy-Report-Only':
      CSP_DIRECTIVES.join('; ') + '; report-uri https://' + host + CSP_REPORT_PATH,
  };
}

// Response は immutable なので包み直してから足す。
function harden(res, host) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(securityHeaders(host))) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;

    // ── HTTPS 強制 (何よりも先) ──
    //
    // ⚠ `url.protocol = 'https:'` は workerd では黙って無効になり、Location が
    //   http のまま自分自身を指す無限リダイレクトになる。Node の URL では効くので
    //   ローカルでは再現しない。文字列で組み立てること。
    //   ループ回避のため cf-visitor も見る二重条件にする。
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
    let visitorScheme = '';
    try {
      visitorScheme = JSON.parse(request.headers.get('cf-visitor') || '{}').scheme || '';
    } catch { /* ヘッダが無い / 壊れている場合は無視 */ }
    if (url.protocol === 'http:' && visitorScheme !== 'https' && !isLocal) {
      return new Response(null, {
        status: 301,
        headers: {
          Location: 'https://' + host + url.pathname + url.search,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── CSP 違反の受け口 ──
    // ここに来た内容を見てから CSP を強制に切り替える。
    // 応答を返す前に body を読み切る。waitUntil の中で後から request.text()
    // を呼ぶと、client が切れた瞬間に黙って空になる。
    if (url.pathname === CSP_REPORT_PATH) {
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      let body = '';
      try { body = (await request.text()).slice(0, 4000); } catch { /* 読めなければ空 */ }
      console.log('[csp]', body);
      return new Response(null, { status: 204 });
    }

    // ── www → apex に 301 ──
    // 重複コンテンツを作らない。gensuirou.com 系のときだけ効かせる
    // (workers.dev では www が存在しないので条件に入れない)。
    if (host === 'www.gensuirou.com') {
      return harden(
        new Response(null, {
          status: 301,
          headers: { Location: 'https://gensuirou.com' + url.pathname + url.search },
        }),
        host,
      );
    }

    // ── 旧 URL の正規化 (すべて 301) ──
    //
    // 移行前の gensuirou.com は約 42 URL あった (PC 21 + /m/ 配下のモバイル版 21)。
    // 全部を新 URL に恒久で寄せる。落とすと被リンクと索引を捨てることになる。
    //
    // Static Assets 側も .html の正規化をしてくれるが、返すのが **307 (一時)** で
    // Pages は 308 だった (2026-08-25 実測)。307 だと評価が統合されないので、
    // アセットに渡す前にここで 301 にする。
    const p = url.pathname;

    // ── 客室テレビの館内案内 (ナバック) ──
    //
    // /gensuiro/ は **旧サーバにしか無い**。館内案内システムの業者が
    // 置いた Basic 認証付きのディレクトリで、客室のテレビがこの URL を開いている。
    // 2026-08-25 の DNS 切替でここへ届かなくなり、テレビに 404 が出ていた。
    //
    // 正規化も i18n もセキュリティヘッダもかけない。
    // 末尾スラッシュを落とすだけで相対リンクが全部外れるし、
    // X-Frame-Options や CSP を後から被せると業者の画面の振る舞いを変えてしまう。
    if (isLegacyGuide(p)) {
      const relayed = await fetchLegacy(request, p + url.search);
      if (relayed) {
        relayed.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        return relayed;
      }
      // 旧サーバが答えない。404 を返すと「ページが無い」と見えるので 502 にする。
      console.log('[legacy] unreachable ' + p);
      return new Response('館内案内を取得できませんでした。しばらくしてからお試しください。\n', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
      });
    }

    const canon = canonicalPath(p);
    if (canon !== p) {
      return harden(
        new Response(null, { status: 301, headers: { Location: url.origin + canon + url.search } }),
        host,
      );
    }

    // ── 予約・お問い合わせの受け口 ──
    if (p === '/api/enquiry') return harden(await handleEnquiry(request, env, ctx), host);

    // ── /favicon.ico ──
    // ブラウザは <link rel=icon> があっても /favicon.ico を取りに来る。
    // 無いとタブ・ブックマーク・検索結果が白紙アイコンになる。
    // 実体は PNG なので、拡張子ではなく Content-Type で正しく名乗る。
    // ── /apple-touch-icon*.png ──
    // iOS はホーム画面に追加するときやブックマークで、<link> の有無に関係なく
    // /apple-touch-icon.png と -precomposed 版を直接取りに来る。
    // 無いと画面の写しが使われる。実測 (2026-09-02): 日本から 1 日 12 件が 404。
    if (/^\/apple-touch-icon(-\d+x\d+)?(-precomposed)?\.png$/.test(p)) {
      const png = await env.ASSETS.fetch(new URL('/favicon-180.png', url.origin));
      const h = new Headers(png.headers);
      h.set('Content-Type', 'image/png');
      h.set('Cache-Control', 'public, max-age=86400');
      return harden(new Response(png.body, { status: png.status, headers: h }), host);
    }

    if (p === '/favicon.ico') {
      const ico = await env.ASSETS.fetch(new URL('/favicon-32.png', url.origin));
      const h = new Headers(ico.headers);
      h.set('Content-Type', 'image/png');
      h.set('Cache-Control', 'public, max-age=86400');
      return harden(new Response(ico.body, { status: ico.status, headers: h }), host);
    }

    // ── robots.txt / sitemap.xml ──
    if (p === '/robots.txt') return harden(robots(url.origin, host), host);
    if (p === '/sitemap.xml') return harden(sitemap(url.origin), host);

    // ── 言語別ページ ──
    const route = parsePath(p);
    if (route && route.strip) {
      // /en/assets/… のような紛れ。言語接頭辞を外して 301。
      return harden(
        new Response(null, { status: 301, headers: { Location: url.origin + route.strip + url.search } }),
        host,
      );
    }
    if (route && route.notFound) {
      // /en/なにか。英語で見ていた人に日本語の 404 を出さない。
      return harden(await serve404(env, url.origin, route.lang), host);
    }
    if (route && route.path) {
      const meta = PAGES[route.path];
      let res;
      if (meta.journal) {
        // 読み物。一覧も記事もデータから組み立てる。
        res = new Response(
          meta.journal === 'index' ? renderJournalIndex() : renderArticle(meta.journal),
          { headers: { 'Content-Type': 'text/html; charset=UTF-8' } },
        );
      } else if (meta.room) {
        // 客室 12 室は静的ファイルではなくデータから組み立てる。
        // 3 言語入りで返し、この後 localizePage が言語ごとに削る。
        res = new Response(renderRoomPage(meta.room), {
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
      } else {
        // クリーンパスのまま取りに行く。html_handling がファイルに対応付ける。
        // ⚠ '/index.html' のような実ファイル名で ASSETS を叩くと、アセット側が
        //   クリーン URL へリダイレクトを返して 200 にならず、全ページが 404 になる
        //   (2026-08-25 実測。deploy は成功するので気付きにくい)。
        res = await env.ASSETS.fetch(new Request(new URL(route.path, url.origin), request));
      }
      if (res.status !== 200) return harden(await serve404(env, url.origin, route.lang), host);
      return harden(localizePage(res, {
        lang: route.lang, path: route.path, origin: url.origin, host,
        enquiry: enquiryEnabled(env), sitekey: env.TURNSTILE_SITEKEY,
      }), host);
    }

    // ── 拡張子の無い未知パスはページのつもりの誤りとみなす ──
    // アセット (拡張子つき) は下の ASSETS に任せる。
    if (!p.split('/').pop().includes('.')) {
      return harden(await serve404(env, url.origin, 'ja'), host);
    }

    // ── 静的アセット ──
    // run_worker_first = true なので、画像も CSS も必ずここを通る。
    // 出口が 1 か所なのでヘッダの付け漏れが起きない。
    // ── 写真は WebP で返す (URL は同じまま) ──
    //
    // 客室の写真は 600x460 なのに 1 枚 110KB あり、客室ページはモバイルで
    // 1.8MB あった (2026-09-03 実測)。同じ絵の .webp を隣に置いてあるので、
    // Accept が webp を受けるブラウザにはそちらを返す。
    // markup を書き換えないので、静的ページ・客室ページ・ライトボックスの
    // どの経路も同じだけ軽くなる。twin が無ければ普通に元の画像を返す。
    if (/\.(jpe?g|png)$/i.test(p) && (request.headers.get('Accept') || '').includes('image/webp')) {
      const twin = await env.ASSETS.fetch(new URL(p.replace(/\.[^.]+$/, '.webp'), url.origin));
      if (twin.status === 200) {
        const h = new Headers(twin.headers);
        h.set('Content-Type', 'image/webp');
        // 同じ URL で 2 種類返すので、キャッシュに区別させる。
        h.set('Vary', 'Accept');
        return harden(new Response(twin.body, { status: 200, headers: h }), host);
      }
    }

    const res = await env.ASSETS.fetch(request);
    if (res.status === 404 && isLegacyAsset(p)) {
      // 旧サイトのページから参照が残っている画像・CSS・JS。
      // ページ自体は 301 で新 URL に寄せるが、アセットは新サイトには無いので
      // 旧サーバから取って返す。200 以外は普通の 404 に落とす。
      let legacy = await fetchLegacy(request, p + url.search);
      // 旧モバイルサイトのアセットは `/m/` の下にしか無い (例: /m/style_m.css)。
      // 旧ページを開いた人のブラウザは相対解決の結果ルート直下を取りに来るので、
      // 根元で外したら /m/ 側も見る。実測: /style_m.css は旧サーバでも
      // ルートは 404、/m/style_m.css だけ 200 (2026-09-02)。
      if ((!legacy || legacy.status !== 200) && !p.startsWith('/m/')) {
        legacy = await fetchLegacy(request, '/m' + p + url.search);
      }
      if (legacy && legacy.status === 200) return harden(legacy, host);
    }
    return harden(res, host);
  },
};

/**
 * 旧サイトの URL を新 URL に寄せる。返り値が引数と違えば 301 する。
 *
 * 旧サイトの形:
 *   /access/index.html          セクションは全部 <名前>/index.html
 *   /rooms/aoi/index.html       客室詳細 12 本
 *   /reservation/index.html     予約案内。新サイトではトップの予約枠に集約
 *   /m/**                       まるごと別のモバイルサイト。新サイトはレスポンシブ
 */
function canonicalPath(p) {
  let out = p;
  // 旧モバイルサイト。/m と /m/... を PC 側の同じページへ。
  if (out === '/m' || out.startsWith('/m/')) out = out.slice(2) || '/';
  // <名前>/index.html → /<名前>
  if (out.endsWith('/index.html')) out = out.slice(0, -'/index.html'.length) || '/';
  else if (out === '/index.html') out = '/';
  else if (out.endsWith('.html')) out = out.slice(0, -5);
  // 末尾スラッシュを落とす
  if (out.length > 1 && out.endsWith('/')) out = out.replace(/\/+$/, '') || '/';
  // ⚠ ここで /reservation を /#reserve に飛ばしていた (2026-08-24〜28)。
  //   旧サイトの /reservation には **予約エンジン (sec.489.jp)** への導線があり、
  //   お客さまはそこで料金と空室を見て予約していた。飛ばした結果、
  //   「金額の確認と予約ができない」状態を 4 日間つくった。飛ばさない。
  return out || '/';
}

/** 404。ステータスは必ず 404 にする。
 *  ASSETS から 200 で取った 404.html をそのまま返すと soft-404 になる。 */
async function serve404(env, origin, lang) {
  const res = await env.ASSETS.fetch(new URL('/404.html', origin));
  const out = localizeShell(res, { lang });
  return new Response(out.body, {
    status: 404,
    headers: new Headers(out.headers),
  });
}

function robots(origin, host) {
  // 本番以外 (workers.dev 等) は丸ごと拒否する。索引が二重になるのを防ぐ。
  const body = host === PROD_HOST
    ? `User-agent: *\nAllow: /\nDisallow: /_csp-report\n\nSitemap: ${origin}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

function sitemap(origin) {
  // 言語別 URL を全部載せ、各 URL に相互の hreflang を付ける。
  // 片方向だけだと Google は言語クラスタとして扱わない。
  const urls = allUrls(origin).map(({ loc, alts }) =>
    `  <url>\n    <loc>${loc}</loc>\n` +
    alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>`).join('\n') +
    `\n  </url>`,
  ).join('\n');
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    urls + `\n</urlset>\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
