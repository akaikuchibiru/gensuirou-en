// IndexNow — Bing / Naver / Seznam 等へ URL を直接通知する。
//   node scripts/indexnow.mjs
//
// なぜ要るか:
//   Bing Webmaster Tools は Microsoft アカウントでのログインが要り、
//   まだ接続できていない (2026-09-08 時点)。IndexNow はログイン不要で、
//   キーの所有確認は https://gensuirou.com/<key>.txt の応答だけで済む
//   (キーの配信は src/worker.js)。Google は IndexNow 非対応なので、
//   Google 側は GSC の sitemap 送信 (済) が担当。
//
// いつ回すか: 中身を変えて deploy したあと。毎 deploy で全 URL を送っても
// ペナルティは無いが、変わっていない URL を送り続けるのは行儀が悪い。
//
// 送信は「受理された」だけで「索引された」ではない。202 が正常応答。

const HOST = 'gensuirou.com';
const KEY = '10673798367d7df03fc9c3df29cef4cd';

// sitemap から現物の URL 一覧を取る (手で列挙すると必ずズレる)
const sm = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length < 60) {
  console.error(`sitemap の URL が ${urls.length} 件しかない — 送信を中止`);
  process.exit(1);
}

// キーファイルが本当に配信できているかを先に見る (できていないと全部無効)
const keyRes = await fetch(`https://${HOST}/${KEY}.txt`);
const keyBody = (await keyRes.text()).trim();
if (keyRes.status !== 200 || keyBody !== KEY) {
  console.error(`キーファイルが配信できていない: status=${keyRes.status} body=${keyBody.slice(0, 40)}`);
  process.exit(1);
}
console.log(`キーファイル OK / sitemap ${urls.length} URL`);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow 送信: ${res.status} ${res.statusText} (200/202 が受理)`);
process.exit([200, 202].includes(res.status) ? 0 : 1);
