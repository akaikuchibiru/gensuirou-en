// ════════════════════════════════════════════════════════════════════
//  旧サーバ (WADAX / Plesk 153.123.7.215) に残っている資産の中継
//
//  なぜ要るか:
//    客室のテレビに出している館内案内は、旅館のサイトではなく
//    **ナバック** (館内案内システムの業者) が旧サーバの /gensuiro/ に
//    置いたもので、Basic 認証がかかっている。こちらは中身を持っていない。
//    2026-08-25 に apex を Cloudflare へ移した時点で、この URL は
//    新サイトの 404 になった (2026-09-02 に旅館から連絡があって発覚)。
//
//  なぜ fetch() でなく生の TCP か:
//    旧サーバの nginx は **Host: gensuirou.com** のときだけ該当 vhost を
//    返す (他の Host は既定 vhost の 301 → 404。2026-09-02 実測)。
//    ところが Workers の fetch() は Host ヘッダで宛先を決めるので、
//    IP を URL にして Host を名乗り直すと Cloudflare 自身に戻ってしまい
//    `error code: 1003` (Direct IP access not allowed) になる。
//    cloudflare:sockets で HTTP/1.1 を自分で書けば、宛先は IP のまま
//    Host だけを正しく名乗れる。edge で実測して 401 (realm ナバック) を確認済み。
//
//  ⚠ 旧サーバはいずれ止まる。これは延命であって移行ではない。
//    Plesk の Let's Encrypt は HTTP-01 で更新しており apex はもう
//    Cloudflare にあるので、2026-10 中旬の更新は失敗する見込み
//    (現行証明書は 2026-11-15 まで)。ここは **http (80) で取りに行く**ので
//    証明書切れでは壊れないが、サーバごと止まればテレビも止まる。
//    恒久策は「ナバックの中身を旅館から受け取ってこちら側に置く」。
// ════════════════════════════════════════════════════════════════════

import { connect } from 'cloudflare:sockets';

const ORIGIN_IP = '153.123.7.215';
const ORIGIN_PORT = 80;
const ORIGIN_HOST = 'gensuirou.com'; // この Host でないと該当 vhost が出ない
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 16 * 1024 * 1024;

/** テレビの館内案内。ここだけは新サイトの正規化を一切かけず、
 *  受け取った path をそのまま旧サーバへ渡す (相対リンクが末尾スラッシュに依存する)。 */
export function isLegacyGuide(p) {
  return p === '/gensuiro' || p.startsWith('/gensuiro/');
}

// 旧サイトのページから参照が残っているアセットだけを拾う。
// 拡張子を限定するのは、存在しない URL を何でも旧サーバに転送しないため
// (bot の /wp-json/... を中継すると旧サイトを生き返らせることになる)。
const ASSET_EXT = new Set([
  'css', 'js', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'mp4', 'pdf',
]);

export function isLegacyAsset(p) {
  const ext = p.split('/').pop().split('.').pop().toLowerCase();
  return ASSET_EXT.has(ext);
}

// 転送するリクエストヘッダ。
// accept-encoding は **渡さない** — identity で受けて、こちらで解く手間を無くす。
const REQ_PASS = [
  'authorization', 'accept', 'accept-language', 'user-agent', 'referer',
  'cookie', 'if-modified-since', 'if-none-match', 'range', 'content-type',
];

// 返さないレスポンスヘッダ (hop-by-hop と、こちらで組み直すもの)。
const RES_DROP = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'content-length',
  'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'upgrade',
  'server', 'x-powered-by',
]);

/**
 * 旧サーバへ HTTP/1.1 を直接しゃべって中継する。
 * 失敗しても例外は投げず null を返す (呼び側が通常の 404 に落とす)。
 *
 * 本文は **溜め込まずに流す**。旧サイトには 32MB の紹介動画があり、
 * 一度メモリに載せる実装では上限に当たって 404 になっていた (2026-09-02 実測)。
 */
export async function fetchLegacy(request, path) {
  const method = request.method;
  if (!['GET', 'HEAD', 'POST'].includes(method)) return null;

  let body = null;
  if (method === 'POST') {
    try { body = new Uint8Array(await request.arrayBuffer()); } catch { return null; }
  }

  let sock = null;
  try {
    sock = connect({ hostname: ORIGIN_IP, port: ORIGIN_PORT });

    const lines = [`${method} ${path} HTTP/1.1`, `Host: ${ORIGIN_HOST}`];
    for (const name of REQ_PASS) {
      const v = request.headers.get(name);
      if (v) lines.push(`${name}: ${v}`);
    }
    lines.push('Accept-Encoding: identity');
    if (body) lines.push(`Content-Length: ${body.length}`);
    lines.push('Connection: close', '', '');

    const w = sock.writable.getWriter();
    await w.write(new TextEncoder().encode(lines.join('\r\n')));
    if (body) await w.write(body);
    w.releaseLock();

    const reader = sock.readable.getReader();
    const head = await withTimeout(readHead(reader));
    if (!head) { closeQuietly(sock); return null; }

    const { status, headers, chunked, contentLength, leftover } = head;
    const bodyless = method === 'HEAD' || status === 204 || status === 304 || contentLength === 0;
    if (bodyless) {
      closeQuietly(sock);
      return new Response(null, { status, headers });
    }

    if (chunked) {
      // 動的ページ。まとめて受けてから解く (小さいものしか来ない)。
      const rest = await withTimeout(drain(reader, leftover));
      closeQuietly(sock);
      if (!rest) return null;
      return new Response(dechunk(rest), { status, headers });
    }

    // 静的ファイル。長さが分かっているのでそのまま流す。
    if (contentLength !== null) headers.set('Content-Length', String(contentLength));
    return new Response(passthrough(reader, sock, leftover, contentLength), { status, headers });
  } catch (e) {
    console.log('[legacy] ' + path + ' ' + e);
    closeQuietly(sock);
    return null;
  }
}

function closeQuietly(sock) {
  try { sock?.close(); } catch { /* 相手が先に閉じていれば投げる */ }
}

// 時間切れの無い読み書きは永久に固まる。必ず外から切る。
function withTimeout(p) {
  return Promise.race([
    p,
    new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ]);
}

/** ヘッダ部だけを読み切って解釈し、読み過ぎた分 (leftover) を返す。 */
async function readHead(reader) {
  let buf = new Uint8Array(0);
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf = concat(buf, value);
    const sep = indexOfCRLFCRLF(buf);
    if (sep >= 0) {
      const parsed = parseHead(buf.subarray(0, sep));
      if (!parsed) return null;
      return { ...parsed, leftover: buf.subarray(sep + 4) };
    }
    if (done) return null;
    if (buf.length > 64 * 1024) return null; // ヘッダがこの大きさになるのは異常
  }
}

/** 残り全部を読む (chunked 用)。上限を超えたら諦める。 */
async function drain(reader, leftover) {
  const parts = [leftover];
  let total = leftover.length;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) { parts.push(value); total += value.length; }
    if (total > MAX_BYTES) return null;
    if (done) break;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of parts) { out.set(c, off); off += c.length; }
  return out;
}

/** 受け取ったそばから流す。閲覧側が切ったら socket も閉じる。 */
function passthrough(reader, sock, leftover, contentLength) {
  let sent = 0;
  return new ReadableStream({
    start(controller) {
      if (leftover.length) { controller.enqueue(leftover); sent += leftover.length; }
    },
    async pull(controller) {
      if (contentLength !== null && sent >= contentLength) {
        controller.close();
        closeQuietly(sock);
        return;
      }
      try {
        const { value, done } = await reader.read();
        if (value) {
          // Content-Length を名乗った以上、それ以上は送らない。
          const room = contentLength === null ? value.length : contentLength - sent;
          controller.enqueue(room < value.length ? value.subarray(0, room) : value);
          sent += Math.min(room, value.length);
        }
        if (done) { controller.close(); closeQuietly(sock); }
      } catch (e) {
        controller.error(e);
        closeQuietly(sock);
      }
    },
    cancel() { closeQuietly(sock); },
  });
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function indexOfCRLFCRLF(buf) {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

function parseHead(buf) {
  // ヘッダはバイトのまま (1 バイト = 1 文字) で読む。
  // ⚠ workerd の TextDecoder は 'iso-8859-1' を渡しても **UTF-8 として解く**。
  //   それに気付かず二重に解いて WWW-Authenticate を壊し、応答が 520 になった
  //   (2026-09-02 実測)。自前で組み立てて取り違えを無くす。
  const [statusLine, ...headerLines] = latin1(buf).split('\r\n');
  const m = /^HTTP\/1\.[01] (\d{3})/.exec(statusLine);
  if (!m) return null;
  const status = Number(m[1]);

  const headers = new Headers();
  let chunked = false;
  let contentLength = null;
  for (const line of headerLines) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (name === 'transfer-encoding') { chunked = /chunked/i.test(value); continue; }
    if (name === 'content-length') { contentLength = Number(value); continue; }
    if (RES_DROP.has(name)) continue;
    try {
      // realm="ナバック" のように非 ASCII が入る。読んだバイト列を UTF-8 として
      // 解き直してから載せる (workerd はヘッダ値を UTF-8 で書き出すので、
      // これで旧サーバが送ったのと同じバイト列に戻る)。
      headers.append(name, sanitize(utf8(value)));
    } catch { /* 名前が不正なヘッダは落とす */ }
  }

  // これはお客様向けの公開ページではない。索引には絶対に入れない。
  headers.set('X-Robots-Tag', 'noindex, nofollow');

  if (!Number.isFinite(contentLength)) contentLength = null;
  return { status, headers, chunked, contentLength };
}

function latin1(bytes) {
  let out = '';
  // 一度に渡すと引数の数で落ちるので刻む。
  for (let i = 0; i < bytes.length; i += 4096) {
    out += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return out;
}

function utf8(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return new TextDecoder().decode(bytes);
}

// 制御文字が 1 つでも混じるとヘッダ全体が不正になり、応答が 520 で落ちる。
function sanitize(v) {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000a-\u001f\u007f]/g, '');
}

function dechunk(buf) {
  const out = [];
  let i = 0;
  let total = 0;
  while (i < buf.length) {
    let j = i;
    while (j + 1 < buf.length && !(buf[j] === 13 && buf[j + 1] === 10)) j++;
    const size = parseInt(latin1(buf.subarray(i, j)).split(';')[0].trim(), 16);
    if (!Number.isFinite(size)) break;
    if (size === 0) break;
    const start = j + 2;
    const end = Math.min(start + size, buf.length);
    out.push(buf.subarray(start, end));
    total += end - start;
    i = end + 2;
  }
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of out) { merged.set(c, off); off += c.length; }
  return merged;
}
