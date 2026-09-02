// 旧サーバに残っている資産が新サイト越しに届くかを実測する。
//
// なぜ要るか:
//   客室のテレビは gensuirou.com/gensuiro/ を開いている。中身は旅館のサイトでは
//   なく、館内案内システムの業者 (ナバック) が旧サーバに置いた Basic 認証つきの
//   ディレクトリで、こちらは中身を持っていない。2026-08-25 の DNS 切替で
//   ここへ届かなくなり、テレビに新サイトの 404 が 8 日間出続けた。
//   **サイトの検査は全部通っていた** — 新サイトに無い URL を誰も数えていなかった。
//
// 使い方:
//   node scripts/check-legacy.mjs            # 定点 (速い)
//   node scripts/check-legacy.mjs --full     # 旧サイトを丸ごと巡回して突合
//
// ⚠ 旧サーバへの問い合わせは **curl で行う**。node の fetch は Host ヘッダを
//   無視するので、Host: gensuirou.com を名乗ったつもりで既定 vhost の 301 を
//   受け取り、比較が「旧サーバにも無い」で全部 PASS する (2026-09-02 に踏んだ)。
//   旧サーバは Host が一致したときだけ該当 vhost を返す。

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SITE = process.env.SITE || 'https://gensuirou.com';
const ORIGIN = 'http://153.123.7.215';
const FULL = process.argv.includes('--full');

let failed = 0;
const ok = (name, extra = '') => console.log(`  PASS  ${name}${extra ? '  ' + extra : ''}`);
const bad = (name, why) => { failed++; console.log(`  FAIL  ${name}  ${why}`); };

/** ヘッダとステータスだけ取る。返り値の headers は小文字キー。 */
async function head(url, { host, auth, follow = false } = {}) {
  const args = ['-s', '-m', '60', '-D', '-', '-o', '/dev/null', '-w', '\\n__CODE__%{http_code}'];
  if (follow) args.push('-L');
  if (host) args.push('-H', `Host: ${host}`);
  if (auth) args.push('-H', `Authorization: ${auth}`);
  args.push(url);
  const { stdout } = await run('curl', args, { maxBuffer: 8 << 20 });
  const code = Number(stdout.slice(stdout.lastIndexOf('__CODE__') + 8).trim());
  const headers = {};
  let status = 0;
  for (const line of stdout.split('\n')) {
    const m = /^HTTP\/[\d.]+ (\d{3})/.exec(line);
    if (m) { status = Number(m[1]); continue; }
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return { status: follow ? code : status, code, headers };
}

/** 本文を取って sha256 と長さを返す (バイト一致を見るため)。 */
async function digest(url, { host } = {}) {
  const args = ['-s', '-m', '180', '-o', '-', '-w', ''];
  if (host) args.push('-H', `Host: ${host}`);
  args.push(url);
  const { stdout } = await run('curl', args, { maxBuffer: 64 << 20, encoding: 'buffer' });
  const { createHash } = await import('node:crypto');
  return { bytes: stdout.length, sha: createHash('sha256').update(stdout).digest('hex') };
}

console.log(`\n旧資産の中継  ${SITE}\n`);

// ── 1. テレビの館内案内 ──────────────────────────────────────
// 新サイトの 404 でも、こちらが作った 502 でもいけない。
// 業者のサーバが出す 401 (realm つき) がそのまま返ってくるのが正。
for (const path of ['/gensuiro/', '/gensuiro']) {
  const res = await head(SITE + path);
  const auth = res.headers['www-authenticate'] || '';
  if (res.status === 404) bad(`${path} が 404`, 'テレビの館内案内が出ていない');
  else if (res.status === 502) bad(`${path} が 502`, '旧サーバに届いていない');
  else if (res.status >= 300 && res.status < 400) bad(`${path} が ${res.status}`, `正規化してはいけない → ${res.headers.location}`);
  else if (res.status !== 401 || !/^Basic/i.test(auth)) bad(path, `status=${res.status} www-authenticate=${JSON.stringify(auth)}`);
  else ok(`${path} → 401 ${auth}`);
}

// realm のバイト列が旧サーバのものと一致すること。
// 非 ASCII (ナバック) なので、途中で解き直すと壊れる。
{
  const [now, was] = await Promise.all([
    head(SITE + '/gensuiro/'),
    head(ORIGIN + '/gensuiro/', { host: 'gensuirou.com' }),
  ]);
  const a = now.headers['www-authenticate'] || '';
  const b = was.headers['www-authenticate'] || '';
  a === b && b ? ok('WWW-Authenticate が旧サーバと同一', JSON.stringify(b)) : bad('WWW-Authenticate', `new=${JSON.stringify(a)} old=${JSON.stringify(b)}`);
}

// 索引に入れない (認証の向こうは公開物ではない)。
{
  const res = await head(SITE + '/gensuiro/');
  /noindex/.test(res.headers['x-robots-tag'] || '')
    ? ok('/gensuiro/ に noindex')
    : bad('/gensuiro/ の noindex', `x-robots-tag=${JSON.stringify(res.headers['x-robots-tag'])}`);
}

// Authorization を握りつぶしていないか (握りつぶすと 401 のループになる)。
{
  const res = await head(SITE + '/gensuiro/', { auth: 'Basic ' + Buffer.from('probe:probe').toString('base64') });
  res.status === 401
    ? ok('誤った資格情報 → 401 (中継されている)')
    : bad('誤った資格情報', `status=${res.status} — 旧サーバの判定が返っていない`);
}

// ── 2. 旧ページから参照が残っているアセット ──────────────────
// 新サイトには無い。旧サーバから取れていないと、旧 URL を開いた人の画面が崩れる。
const ASSETS = [
  '/js/jquery-1.11.3.min.js',
  '/imgs_1080_570/04.jpg',
  '/apple-touch-icon.png',
  '/movie/imagevideo202408_pc2500.mp4', // 32MB。溜め込む実装だと落ちる
];
for (const path of ASSETS) {
  const was = await head(ORIGIN + path, { host: 'gensuirou.com' });
  if (was.status !== 200) { bad(path, `旧サーバが ${was.status} — 検査対象の前提が崩れている`); continue; }
  const now = await head(SITE + path);
  if (now.status !== 200) { bad(path, `新サイト ${now.status} / 旧サーバ 200`); continue; }
  const [x, y] = await Promise.all([
    digest(SITE + path),
    digest(ORIGIN + path, { host: 'gensuirou.com' }),
  ]);
  x.sha === y.sha && x.bytes > 0
    ? ok(path, `${x.bytes} bytes 一致`)
    : bad(path, `中身が違う ${x.bytes}/${x.sha.slice(0, 12)} != ${y.bytes}/${y.sha.slice(0, 12)}`);
}

// ── 3. 何でも中継していないこと ──────────────────────────────
// 旧サーバに無い URL まで中継すると、旧サイトを索引に戻すことになる。
// 301 を挟む URL があるので **追いかけた先** を見る。
for (const path of ['/nope-zzz.jpg', '/wp-json/batch/v1', '/wordpress/', '/assets/does-not-exist.css']) {
  const res = await head(SITE + path, { follow: true });
  res.code === 404 ? ok(`${path} → 404`) : bad(path, `status=${res.code} — 無い URL を中継している`);
}

// ── 4. 本来のページに影響していないこと ──────────────────────
for (const path of ['/', '/rooms', '/reservation', '/en', '/zh', '/sitemap.xml']) {
  const res = await head(SITE + path, { follow: true });
  res.code === 200 ? ok(`${path} → 200`) : bad(path, `status=${res.code}`);
}

// ── 5. --full: 旧サイトを丸ごと巡回して突合 ──────────────────
if (FULL) {
  console.log('\n旧サイトを巡回して全 URL を突合\n');
  const body = async (path) => {
    const { stdout } = await run('curl', ['-s', '-m', '30', '-H', 'Host: gensuirou.com', ORIGIN + path], { maxBuffer: 64 << 20 });
    return stdout;
  };
  const seen = new Set();
  const assets = new Set();
  const queue = ['/'];
  while (queue.length && seen.size < 150) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await head(ORIGIN + path, { host: 'gensuirou.com' });
    if (res.status !== 200 || !/html/.test(res.headers['content-type'] || '')) continue;
    const html = await body(path);
    for (const m of html.matchAll(/(?:href|src|data-src)="([^"#]+)"/g)) {
      const raw = m[1];
      if (/^(https?:|mailto:|tel:|javascript:)/.test(raw)) continue;
      let full;
      try { full = new URL(raw, 'http://x' + path).pathname; } catch { continue; }
      const last = full.split('/').pop();
      if (last.includes('.') && !/\.html?$/.test(last)) assets.add(full);
      else if (!seen.has(full)) queue.push(full);
    }
  }
  const all = [...new Set([...seen, ...assets])];
  console.log(`  旧サイト ${all.length} URL を検査`);
  let missing = 0;
  for (let i = 0; i < all.length; i += 8) {
    const results = await Promise.all(all.slice(i, i + 8).map(async (p) => {
      const [now, was] = await Promise.all([
        head(SITE + p, { follow: true }),
        head(ORIGIN + p, { host: 'gensuirou.com' }),
      ]);
      return { p, now: now.code, was: was.status };
    }));
    for (const r of results) {
      if (r.was === 200 && r.now === 404) { missing++; bad(r.p, '旧サイトにあって新サイトで 404'); }
    }
  }
  if (missing === 0) ok(`旧サイトの ${all.length} URL すべて到達できる`);
}

console.log(failed === 0 ? '\n全項目 PASS\n' : `\n${failed} 件 FAIL\n`);
process.exit(failed === 0 ? 0 : 1);
