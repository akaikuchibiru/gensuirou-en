#!/usr/bin/env python3
"""gensuirou.com の公開 DNS を、取り込み用ゾーンファイルと突き合わせる (読むだけ)。

  python3 -I tools/migrate-haru/verify-dns.py [--after-email-sending]

- 引き方: Google DoH と Cloudflare DoH の 2 系統 (curl -4)。この作業環境は 53 番を横取りするので dig は使わない。
- 期待値: 同じディレクトリの gensuirou.com.haru-import.zone の 11 件 (完全一致。足りなくても余分でも NG)
  + apex / www が Cloudflare (104.21.x / 172.67.x) で応答すること
  + --after-email-sending のとき cf-bounce の MX 3 本・SPF・DKIM があること (DKIM の鍵は新 zone のものなので値は見ない)
- メールの生命線 (apex MX → mail → 153.123.7.215) が崩れていたら最初に大きく出す。
- 2 系統のどちらかでも不一致なら exit 1。切替直後はキャッシュで旧の値が見えることがあるので、
  NG のときは TTL (最大 1 時間) を待って再実行する。
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ZONE = os.path.join(HERE, 'gensuirou.com.haru-import.zone')
ORIGIN = 'gensuirou.com'
DOH = {'google': 'https://dns.google/resolve', 'cloudflare': 'https://1.1.1.1/dns-query'}
TYPES = {'A': 1, 'CNAME': 5, 'MX': 15, 'TXT': 16, 'AAAA': 28}


def parse_zone(path):
    exp = {}
    for line in open(path, encoding='utf-8'):
        # ; はコメント開始。ただし "v=DMARC1; p=none" のように引用符の中の ; は値
        out, q = [], False
        for ch in line:
            if ch == '"':
                q = not q
            elif ch == ';' and not q:
                break
            out.append(ch)
        line = ''.join(out)
        m =re.match(r'^(\S+)\s+\d+\s+IN\s+(A|CNAME|MX|TXT)\s+(.*?)\s*$', line)
        if not m:
            continue
        name, typ, val = m.groups()
        fq = ORIGIN if name == '@' else f'{name}.{ORIGIN}'
        if typ == 'TXT':
            val = ''.join(re.findall(r'"([^"]*)"', val))
        exp.setdefault((fq, typ), set()).add(val.rstrip('.'))
    return exp


def doh(srv, name, typ):
    url = f'{DOH[srv]}?name={name}&type={typ}'
    for _ in range(3):
        r = subprocess.run(['curl', '-4', '-s', '-m', '10', '-H', 'accept: application/dns-json', url],
                           capture_output=True, text=True)
        try:
            d = json.loads(r.stdout)
            break
        except Exception:
            d = None
    if d is None:
        return None
    out = set()
    for a in d.get('Answer', []):
        if a['type'] != TYPES[typ] or a['name'].rstrip('.') != name:
            continue
        v = a['data']
        if typ == 'TXT':
            parts = re.findall(r'"([^"]*)"', v)
            v = ''.join(parts) if parts else v
        out.add(v.rstrip('.'))
    return out


def main():
    after_es = '--after-email-sending' in sys.argv
    exp = parse_zone(ZONE)
    n = sum(len(v) for v in exp.values())
    print(f'期待値: {n} 件 ({ZONE})')
    bad = 0
    for (name, typ), want in sorted(exp.items()):
        for srv in DOH:
            got = doh(srv, name, typ)
            ok = got == want
            if not ok:
                bad += 1
            print(f"{'OK ' if ok else 'NG '} {srv:10} {typ:5} {name:30} {'' if ok else f'want={sorted(want)} got={sorted(got) if got is not None else None}'}")
    # メールの生命線
    for srv in DOH:
        mx = doh(srv, ORIGIN, 'MX')
        a = doh(srv, 'mail.' + ORIGIN, 'A')
        life = mx == {'10 mail.gensuirou.com'} and a == {'153.123.7.215'}
        if not life:
            bad += 1
        print(f"{'OK ' if life else '!!!!!! NG '} {srv:10} メール経路 MX={mx} mail A={a}")
    # サイト (Cloudflare で応答)
    for host in (ORIGIN, 'www.' + ORIGIN):
        for srv in DOH:
            a = doh(srv, host, 'A') or set()
            ok = bool(a) and all(x.startswith(('104.', '172.6')) for x in a)
            if not ok:
                bad += 1
            print(f"{'OK ' if ok else 'NG '} {srv:10} A     {host:30} {sorted(a)}")
    if after_es:
        for srv in DOH:
            mx = doh(srv, 'cf-bounce.' + ORIGIN, 'MX') or set()
            spf = doh(srv, 'cf-bounce.' + ORIGIN, 'TXT') or set()
            dk = doh(srv, 'cf-bounce._domainkey.' + ORIGIN, 'TXT') or set()
            ok = len(mx) == 3 and any('_spf.mx.cloudflare.net' in s for s in spf) and any(s.startswith('v=DKIM1') for s in dk)
            if not ok:
                bad += 1
            print(f"{'OK ' if ok else 'NG '} {srv:10} cf-bounce MX={len(mx)} SPF={bool(spf)} DKIM={bool(dk)}")
        for srv in DOH:
            dm = doh(srv, '_dmarc.' + ORIGIN, 'TXT')
            ok = dm == {'v=DMARC1; p=none'}
            if not ok:
                bad += 1
            print(f"{'OK ' if ok else '!!!!!! NG '} {srv:10} _dmarc={dm} (p=none 据え置きが正)")
    print('RESULT', 'PASS' if bad == 0 else f'FAIL ({bad})')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
