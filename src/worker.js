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

// ── CSP ──
// まだ Report-Only。エッジで注入されるものはローカルに出ないので
// (CF Web Analytics の beacon で実際に踏んだ)、本番で違反を実測してから
// 強制に切り替える。
//
// script は 'self' だけで足りる。全 8 ページを grep して
// インライン <script> が 0 件であることを確認済み (2026-08-25)。
// 一方 style は style="..." が 31 か所あり、Google Fonts も CSS を
// 外から読むので 'unsafe-inline' と fonts.googleapis.com が要る。
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
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

    // ── URL の正規化 (.html と末尾スラッシュを落として 301) ──
    //
    // Static Assets 側も同じ正規化をしてくれるが、返すのが **307 (一時)** で、
    // Pages は **308 (恒久)** だった (2026-08-25 実測)。307 のままだと検索エンジンが
    // 旧 URL の評価を新 URL に統合しない。移行で被リンクを捨てることになるので、
    // アセット側に渡す前にここで 301 を返す。
    const p = url.pathname;
    let canon = null;
    if (p === '/index.html') canon = '/';
    else if (p.endsWith('.html')) canon = p.slice(0, -5);
    else if (p.length > 1 && p.endsWith('/')) canon = p.replace(/\/+$/, '');
    if (canon !== null && canon !== p) {
      return harden(
        new Response(null, {
          status: 301,
          headers: { Location: url.origin + canon + url.search },
        }),
        host,
      );
    }

    // ── 静的アセット ──
    // run_worker_first = true なので、画像も CSS も必ずここを通る。
    // 出口が 1 か所なのでヘッダの付け漏れが起きない。
    const res = await env.ASSETS.fetch(request);
    return harden(res, host);
  },
};
