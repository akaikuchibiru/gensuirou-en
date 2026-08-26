// 予約通知メールが飛ぶための DNS が生きているかを確かめる。
//   node scripts/check-mail-dns.mjs
//
// なぜ要るか: これが 1 本欠けても **サイトは正常に見える**。壊れるのは
// 「お客さまの予約問い合わせが届かない」ことだけで、気づく手段が無い。
// しかも Cloudflare の設定は宣言的で、別作業の deploy で DNS ごと消えうる。
//
// 設計上ここが肝: 送信は apex ではなく **cf-bounce.gensuirou.com** から出す。
// 旅館さんの既存メール (WADAX / mail.gensuirou.com) の SPF に一切触らずに
// 済ませるため。DKIM が d=gensuirou.com で署名するので DMARC も揃う。
//
// DMARC を p=none のままにしているのは意図的。Cloudflare は p=reject を
// 勧めるが、旅館さん側が WADAX から出す既存のメールが弾かれる恐れがある。
// 同居している間は p=none が安全。**「推奨と違う」で直さないこと。**

const DOH = 'https://cloudflare-dns.com/dns-query';
const q = async (name, type) => {
  const r = await fetch(`${DOH}?name=${name}&type=${type}`, { headers: { accept: 'application/dns-json' } });
  const d = await r.json();
  return (d.Answer || []).filter((a) => [1, 15, 16].includes(a.type)).map((a) => a.data);
};

const CHECKS = [
  ['cf-bounce.gensuirou.com', 'MX', (v) => v.filter((x) => /route\d\.mx\.cloudflare\.net/.test(x)).length === 3, '3 本すべて'],
  ['cf-bounce.gensuirou.com', 'TXT', (v) => v.some((x) => x.includes('include:_spf.mx.cloudflare.net')), 'Cloudflare の SPF'],
  ['cf-bounce._domainkey.gensuirou.com', 'TXT', (v) => v.some((x) => x.includes('v=DKIM1') && x.includes('p=MI')), 'DKIM 公開鍵'],
  ['_dmarc.gensuirou.com', 'TXT', (v) => v.some((x) => /v=DMARC1/.test(x)), 'DMARC あり'],
  // 旅館さんの既存メールを壊していないこと。ここが変わったら宿の業務が止まる。
  ['gensuirou.com', 'MX', (v) => v.some((x) => /mail\.gensuirou\.com/.test(x)), '旅館の既存 MX'],
  ['mail.gensuirou.com', 'A', (v) => v.includes('153.123.7.215'), '旧サーバを指したまま'],
];

let bad = 0;
for (const [name, type, ok, what] of CHECKS) {
  const v = await q(name, type);
  const pass = v.length > 0 && ok(v);
  if (!pass) bad++;
  console.log(`  ${pass ? 'OK' : 'NG'}  ${(name + ' ' + type).padEnd(40)} ${what.padEnd(18)} ${v.length ? String(v).slice(0, 58) : '★レコードなし'}`);
}
const dmarc = await q('_dmarc.gensuirou.com', 'TXT');
if (dmarc.some((x) => /p=reject/.test(x))) {
  console.log('  注意  DMARC が p=reject になっている。旅館さんが WADAX から出す');
  console.log('        既存のメールが弾かれる恐れがある。意図した変更か確認すること。');
}
console.log('─'.repeat(62));
console.log(bad === 0 ? 'MAIL DNS PASS' : `FAIL — ${bad} 件`);
process.exit(bad ? 1 : 0);
