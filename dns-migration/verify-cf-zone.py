#!/usr/bin/env python3
"""NS 切替の「前」に、Cloudflare 側のゾーンが原本と一致しているかを API で突合する。

    python3 verify-cf-zone.py

トークンは環境変数 CF_DNS_TOKEN か、このディレクトリの .cf_token.local (gitignore 済) から読む。
必要な権限は Zone → DNS → Read のみ。書き込み権限は要らない。

なぜ必要か: インポート直後、Cloudflare は A と CNAME を勝手に Proxied に倒す
(2026-08-24 実測: 12 件中 6 件がオレンジ雲だった)。mail / smtp / pop が
プロキシされたまま NS を切り替えると、MX の指す先が anycast IP になり
25 番を受けないので、旅館宛のメールが全部消える。
12 行のトグルを目で数えるのは間違えるので、機械で見る。
"""
import json, os, subprocess, sys, pathlib

ZONE = 'gensuirou.com'
IP = '153.123.7.215'
API = 'https://api.cloudflare.com/client/v4'

# 原本 (zone-before.txt) と同じ 12 件。proxied は全件 False が正。
EXPECT = {
    ('A', ZONE): IP,
    ('A', f'www.{ZONE}'): IP,
    ('A', f'mail.{ZONE}'): IP,
    ('A', f'webmail.{ZONE}'): IP,
    ('CNAME', f'smtp.{ZONE}'): f'mail.{ZONE}',
    ('CNAME', f'pop.{ZONE}'): f'mail.{ZONE}',
    ('MX', ZONE): f'mail.{ZONE}',
    ('TXT', f'_dmarc.{ZONE}'): 'v=DMARC1; p=none',
    ('TXT', f'_domainkey.{ZONE}'): 'o=-',
}
APEX_TXT = {
    'v=spf1 ip4:153.123.7.215 mx a +include:wpmx.wadax.ne.jp +include:_spf-mg.wadax-sv.jp ~all',
    'google-site-verification=Tc1om5xtcZ7atoqKONO0rbhsgxVfIi0Cr36M3hPM8cY',
}
DKIM_HEAD = 'v=DKIM1; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlgi3iCb8v6PDwoyY'
# プロキシされるとメールが死ぬホスト。ここが True なら他が全部合っていても FAIL。
MAIL_HOSTS = {f'mail.{ZONE}', f'smtp.{ZONE}', f'pop.{ZONE}', f'webmail.{ZONE}'}


def token():
    t = os.environ.get('CF_DNS_TOKEN', '').strip()
    if t:
        return t
    f = pathlib.Path(__file__).parent / '.cf_token.local'
    if f.exists():
        return f.read_text().strip()
    sys.exit('トークンが無い。CF_DNS_TOKEN に入れるか dns-migration/.cf_token.local に置く。\n'
             '必要権限: Zone → DNS → Read (gensuirou.com のみ)')


def api(path, tok):
    r = subprocess.run(['curl', '-sS', '--max-time', '25',
                        '-H', f'Authorization: Bearer {tok}', API + path],
                       capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
    except json.JSONDecodeError:
        sys.exit(f'API 応答が JSON でない: {r.stdout[:200]}')
    if not d.get('success'):
        sys.exit(f'API エラー: {d.get("errors")}')
    return d['result']


tok = token()
zones = api(f'/zones?name={ZONE}', tok)
if not zones:
    sys.exit(f'{ZONE} のゾーンが見つからない')
z = zones[0]
print(f'zone {z["name"]}  status={z["status"]}  NS={" ".join(z.get("name_servers", []))}')
print('─' * 78)

recs = api(f'/zones/{z["id"]}/dns_records?per_page=200', tok)
bad, seen = [], set()

for r in sorted(recs, key=lambda x: (x['type'], x['name'])):
    key = (r['type'], r['name'])
    seen.add(key)
    proxied = bool(r.get('proxied'))
    content = r['content'].rstrip('.')
    note = ''

    if r['type'] == 'TXT' and r['name'] == ZONE:
        ok = content.strip('"') in APEX_TXT
    elif r['type'] == 'TXT' and r['name'] == f'default._domainkey.{ZONE}':
        ok = content.strip('"').startswith(DKIM_HEAD)
        note = f'{len(content.strip(chr(34)))} 文字'
    elif key in EXPECT:
        ok = content.strip('"') == EXPECT[key]
    else:
        ok = False
        note = '原本に無いレコード'
        bad.append(f'{r["type"]} {r["name"]} が原本に無い ({content[:40]})')

    if not ok and '原本に無い' not in note:
        bad.append(f'{r["type"]} {r["name"]} の値が違う: {content[:50]}')

    if proxied:
        danger = ' ← メールが止まる' if r['name'] in MAIL_HOSTS else ''
        bad.append(f'{r["type"]} {r["name"]} が Proxied{danger}')

    flag = 'NG' if (not ok or proxied) else 'OK'
    px = 'Proxied' if proxied else 'DNS only'
    print(f'  {flag} {r["type"]:<6} {r["name"]:<30} {px:<9} {content[:34]} {note}')

missing = [k for k in list(EXPECT) + [('TXT', ZONE), ('TXT', f'default._domainkey.{ZONE}')]
           if k not in seen]
for t, n in missing:
    print(f'  NG {t:<6} {n:<30} 欠落')
    bad.append(f'{t} {n} が Cloudflare 側に無い')

print('─' * 78)
print(f'Cloudflare 側 {len(recs)} 件 / 原本 12 件')
if bad:
    print(f'FAIL — {len(bad)} 件。この状態で NS を切り替えないこと。')
    for b in bad:
        print('   ·', b)
    sys.exit(1)
print('PASS — 原本と一致し、全件 DNS only。NS 切替に進んでよい。')
