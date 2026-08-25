// 予約フォームの通し検査。
//   node scripts/check-enquiry.mjs [base-url]
//
// 実際にブラウザで入力して送信し、**画面に出る文言がサーバの結果と
// 一致しているか**を見る。元のフォームは何も送らずに必ず成功を表示していた
// ので、ここは「送信できた」ではなく「表示が嘘でない」を検査する。
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'https://gensuirou.japanese-government-official.workers.dev';
let bad = 0;
const ok = (m) => console.log('  OK  ' + m);
const ng = (m) => { console.log('  NG  ' + m); bad++; };

const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));

await page.goto(BASE + '/', { waitUntil: 'load' });

// フォームは宛先 (ENQUIRY_TO) があるときだけ出る。無いときは電話導線が出る。
// **どちらの状態でも契約を検査する。** 「フォームが無いので検査なし」で
// 素通しすると、無効化の事故 (出したままの宛先漏れ、出ないままの公開) を見逃す。
const state = await page.evaluate(() => ({
  form: !!document.getElementById('enquiryForm'),
  standby: !!document.querySelector('[data-enquiry="standby"]'),
  turnstileScript: !!document.querySelector('script[src*="challenges.cloudflare.com"]'),
}));
const post = await page.evaluate(async (url) => {
  const fd = new FormData(); fd.append('name', 'x'); fd.append('email', 'x@y.zz');
  const r = await fetch(url, { method: 'POST', body: fd });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}, BASE + '/api/enquiry');

if (!state.form) {
  console.log('  -- 宛先が未設定なので、フォームを出さない状態を検査する');
  state.standby ? ok('電話導線が出ている') : ng('フォームも電話導線も無い — 予約導線が消えている');
  !state.turnstileScript ? ok('Turnstile を読み込んでいない') : ng('フォームが無いのに Turnstile を読んでいる');
  post.status === 503 ? ok('POST /api/enquiry → 503 (無効を明示)') : ng(`POST → ${post.status} (503 であるべき)`);
  errs.length === 0 ? ok('JS エラーなし') : ng(`JS エラー: ${[...new Set(errs)].slice(0, 3).join(' / ')}`);
  await b.close();
  console.log('────────────────────────────────────────────');
  console.log(bad === 0 ? 'ENQUIRY PASS (fail-closed)' : `FAIL — ${bad} 件`);
  process.exit(bad ? 1 : 0);
}
state.standby ? ng('フォームと電話導線が両方出ている') : ok('フォーム有効時は電話導線を出さない');
await page.locator('#enquiryForm').scrollIntoViewIfNeeded();

// Turnstile が実際に描画され、token を作るところまで待つ。
let token = '';
try {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return el && el.value && el.value.length > 20;
    },
    { timeout: 45000 },
  );
  token = await page.inputValue('input[name="cf-turnstile-response"]');
  ok(`Turnstile が token を発行 (${token.length} 文字)`);
} catch {
  ng('Turnstile が token を出さない (対話型チャレンジが出ている可能性)');
}

// 必須項目の検証がサーバ側で効くか (name 空)
const api = async (fields) => {
  return page.evaluate(async ({ url, fields }) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(url, { method: 'POST', body: fd });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { url: BASE + '/api/enquiry', fields });
};
if (token) {
  const r = await api({ 'cf-turnstile-response': token, name: '', email: 'a@b.co', lang: 'en' });
  r.status === 400 && r.body.code === 'invalid'
    ? ok('名前が空だとサーバが弾く (400 invalid)')
    : ng(`名前が空でも通った: ${r.status} ${JSON.stringify(r.body)}`);
}

// 本番と同じ経路で送信する。
const stamp = Date.now();
await page.fill('#f-name', `検査 ${stamp}`);
await page.fill('#f-email', `check-${stamp}@example.com`);
await page.fill('#f-message', '自動検査です。返信は不要です。');
await page.selectOption('#f-villa', 'zui');

const [resp] = await Promise.all([
  page.waitForResponse((r) => r.url().endsWith('/api/enquiry') && r.request().method() === 'POST', { timeout: 45000 }),
  page.click('#enquiryForm button[type=submit]'),
]);
const body = await resp.json().catch(() => ({}));
await page.waitForFunction(() => {
  const n = document.getElementById('formNote');
  return n && n.textContent.trim().length > 0;
}, { timeout: 15000 }).catch(() => {});
const shown = await page.evaluate(() => {
  const n = document.getElementById('formNote');
  return { text: n?.textContent.trim(), state: n?.dataset.state };
});

console.log(`  -- サーバ: ok=${body.ok} notified=${body.notified} code=${body.code || '-'}`);
console.log(`  -- 画面  : [${shown.state}] ${shown.text}`);

// ここが本題。サーバが「通知できていない」と言っているのに
// 画面が成功を出していたら、直したはずの嘘が戻っている。
if (body.ok && body.notified === true) {
  shown.state === 'sent' ? ok('通知成功 → 画面も成功') : ng(`通知成功なのに画面が ${shown.state}`);
} else if (body.ok && body.notified === false) {
  shown.state === 'warn' && /電話|call|致电/.test(shown.text)
    ? ok('通知失敗 → 画面は成功と書かず、電話に誘導している')
    : ng(`通知失敗なのに画面が [${shown.state}] "${shown.text}"`);
} else {
  shown.state === 'error' ? ok('受付失敗 → 画面もエラー') : ng(`受付失敗なのに画面が ${shown.state}`);
}
if (body.id) ok(`保存 ID ${body.id}`);
else ng('保存 ID が返っていない (D1 に入っていない可能性)');

errs.length === 0 ? ok('JS エラーなし') : ng(`JS エラー: ${[...new Set(errs)].slice(0, 3).join(' / ')}`);

await b.close();
console.log('────────────────────────────────────────────');
console.log(bad === 0 ? 'ENQUIRY PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
