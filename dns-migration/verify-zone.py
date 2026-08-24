#!/usr/bin/env python3
"""gensuirou.com の DNS を、移管前に採った原本と突合する。

    python3 verify-zone.py                # 通常
    python3 verify-zone.py --site-moved   # apex/www をサイト側に向けた後

DoH (Cloudflare 1.1.1.1 と Google 8.8.8.8) の 2 系統に同じ質問を投げ、
両者が一致することを確認したうえで原本と比べる。

なぜ dig を使わないか: この環境は 53/udp を横取りしていて、`dig @<NS>` を
指定しても応答に aa が立たず、SERVER 欄には別のリゾルバが出る (2026-08-24 実測)。
つまり「権威に直接聞いたつもり」が成立しない。DoH は 443 なので素通りする。
権威そのものを見たいときは、この環境の外のシェルから dig @<NS> を実行すること。
"""
import json, subprocess, sys, ipaddress

ORIGIN = 'gensuirou.com'
SITE_IP = '153.123.7.215'
RESOLVERS = {
    'cloudflare': 'https://cloudflare-dns.com/dns-query?name={n}&type={t}',
    'google':     'https://dns.google/resolve?name={n}&type={t}',
}

EXPECT = [
    ('',                  'A',     {SITE_IP}),
    ('www',               'A',     {SITE_IP}),
    ('mail',              'A',     {SITE_IP}),
    ('webmail',           'A',     {SITE_IP}),
    ('smtp',              'CNAME', {'mail.gensuirou.com.'}),
    ('pop',               'CNAME', {'mail.gensuirou.com.'}),
    ('',                  'MX',    {'10 mail.gensuirou.com.'}),
    ('',                  'TXT',   {
        'v=spf1 ip4:153.123.7.215 mx a +include:wpmx.wadax.ne.jp +include:_spf-mg.wadax-sv.jp ~all',
        'google-site-verification=Tc1om5xtcZ7atoqKONO0rbhsgxVfIi0Cr36M3hPM8cY'}),
    ('_dmarc',            'TXT',   {'v=DMARC1; p=none'}),
    ('_domainkey',        'TXT',   {'o=-'}),
]
DKIM_HEAD = 'v=DKIM1; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlgi3iCb8v6PDwoyY'
DKIM_LEN = 404

SITE_MOVED = '--site-moved' in sys.argv


def query(name, rtype, who):
    n = f'{name}.{ORIGIN}' if name else ORIGIN
    url = RESOLVERS[who].format(n=n, t=rtype)
    r = subprocess.run(['curl', '-sS', '--max-time', '15',
                        '-H', 'accept: application/dns-json', url],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return None                      # 引けなかった。空集合と区別する。
    try:
        d = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None
    out = set()
    for a in d.get('Answer', []):
        v = a['data'].strip()
        if a.get('type') == 16:          # TXT: 引用符とチャンク境界を外して実値にする
            v = ''.join(p.strip('"') for p in v.split('" "'))
            v = v.strip('"')
        out.add(v)
    return out


bad, warn = [], []
print(f'突合: {ORIGIN}  (DoH 2 系統 / 原本は移管前スナップショット)')
print('─' * 80)

for name, rtype, want in EXPECT:
    got = {w: query(name, rtype, w) for w in RESOLVERS}
    label = f'{name or "@":<11} {rtype:<5}'
    if any(v is None for v in got.values()):
        print(f'  ?? {label} リゾルバに届かない — 判定不能')
        bad.append(f'{label} 問い合わせ失敗')
        continue
    if got['cloudflare'] != got['google']:
        print(f'  !! {label} リゾルバ間で不一致 cf={sorted(got["cloudflare"])} g={sorted(got["google"])}')
        warn.append(f'{label} 伝播途中の可能性')
    v = got['cloudflare']
    if SITE_MOVED and name in ('', 'www') and rtype == 'A':
        ok, note = bool(v), ' '.join(sorted(v)) + '  (移転後モード: 値は問わない)'
    else:
        ok, note = v == want, (' '.join(sorted(v)) if v else '(応答なし)')
    print(f'  {"OK" if ok else "NG"} {label} {note[:78]}')
    if not ok:
        bad.append(f'{label} 期待 {sorted(want)} / 実際 {sorted(v)}')

d = query('default._domainkey', 'TXT', 'cloudflare')
if d is None:
    bad.append('DKIM 問い合わせ失敗')
    print('  ?? default._domainkey TXT   リゾルバに届かない')
else:
    val = next(iter(d), '')
    ok = val.startswith(DKIM_HEAD) and len(val) == DKIM_LEN
    print(f'  {"OK" if ok else "NG"} {"default._domainkey":<11} TXT   {len(val)} 文字 (原本 {DKIM_LEN}) 先頭一致={val.startswith(DKIM_HEAD)}')
    if not ok:
        bad.append(f'DKIM 不一致: {len(val)} 文字 / 先頭一致 {val.startswith(DKIM_HEAD)}')

print('─' * 80)
ns = query('', 'NS', 'cloudflare') or set()
on_cf = any('ns.cloudflare.com' in n for n in ns)
print(f'  -- NS: {" ".join(sorted(ns))}  → {"Cloudflare 移管済" if on_cf else "まだ WADAX"}')

for h in ('mail', 'webmail'):
    v = query(h, 'A', 'cloudflare') or set()
    proxied = [ip for ip in v if ip != SITE_IP and not ipaddress.ip_address(ip).is_private]
    if proxied:
        m = f'{h}.{ORIGIN} が {proxied} を返している — プロキシするとメールが止まる'
        print(f'  NG {m}'); bad.append(m)
    else:
        print(f'  OK {h:<11} DNS only のまま ({" ".join(sorted(v))})')

print('─' * 80)
for w in warn:
    print('  警告:', w)
if bad:
    print(f'FAIL — {len(bad)} 件')
    for b in bad:
        print('   ·', b)
    sys.exit(1)
print('PASS — 原本と一致。メール系はプロキシされていない。')
