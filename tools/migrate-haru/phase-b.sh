#!/usr/bin/env bash
# 源翠瓏 (gensuirou.com) → Haru Private phase B。本人が `! bash <this> pre` / `! bash <this> post` で実行する。
# 手順の正本は同じディレクトリの PHASE_B.md。旧アカウント (0125d37b) は読むだけ。書き込み先はすべて新 (50595f10)。
#
#   pre  … 新 zone が pending のうちに: D1 差分コピー → 独自ドメイン付きで新 worker を deploy → 付いたことを API で確認
#   post … NS 切替で新 zone が active になった後: Email Sending 有効化 → DNS 全件突合 → サイト・TV・予約導線 → D1 差分 (--no-delete)
#
# 本番の中身は REF (既定 8846021 = 2026-10-02 20:19 MYT の本番 deploy と同じ commit) から作る。
# main にある未出荷の 2 commit (料理ページ 馬刺しの内訳) も一緒に出すなら REF=origin/main を付けて実行する。
#
# メールは送らない (フォームのテスト送信もしない)。Email Routing は触らない (apex の MX を奪う)。
set -euo pipefail

REPO=~/gensuirou-en
BRANCH=migrate-haru-phase-a
OLD=0125d37b087a1ff7525be7cc7cb99f79
NEW=50595f1036818ad7d4e1312c193f1ae8
REF=${REF:-8846021}
OLD_SITEKEY=0x4AAAAAAEa5kQkJe6__etjG     # 旧 worker が出す Turnstile (旧アカウントの widget)
NEW_SITEKEY=0x4AAAAAAFRKBwO2jDfmm3cx     # 新 worker が出す Turnstile (Haru Private の widget)
DB=gensuirou-enquiries
M=~/cosrank/tools/migrate-haru            # d1-delta.py
HERE=$(cd "$(dirname "$0")" && pwd)

T=$(mktemp -d); chmod 700 "$T"
cleanup() { git -C "$REPO" worktree remove --force "$T/src" >/dev/null 2>&1 || true; rm -rf "$T"; }
trap cleanup EXIT
cat > "$T/w.sh" <<'WEOF'
#!/usr/bin/env bash
exec env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN -u CF_API_KEY -u CLOUDFLARE_API_KEY \
  NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" npx -y wrangler@4.129.0 "$@"
WEOF
chmod 700 "$T/w.sh"
W() { "$T/w.sh" "$@"; }
die() { echo "!!!!!! $*" >&2; exit 1; }
cf() {  # cf <path> : OAuth (wrangler のログイン) で API を GET。zone の読み取り・workers・email routing は通る
  local tok; tok=$(grep '^oauth_token' ~/.wrangler/config/default.toml | sed -E 's/.*"(.*)".*/\1/')
  curl -4 -s -H "Authorization: Bearer $tok" "https://api.cloudflare.com/client/v4$1"
}
py() { python3 -I -c "$@"; }

zone() {  # 新アカウントの gensuirou.com zone → "id status ns1,ns2"
  W whoami >/dev/null 2>&1 || true   # OAuth token を更新させる
  cf "/zones?name=gensuirou.com&account.id=$NEW" | py '
import json,sys; r=json.load(sys.stdin)["result"]
print(" ".join([r[0]["id"], r[0]["status"], ",".join(r[0]["name_servers"])]) if r else "")'
}

build_dir() {  # REF の中身 + 新アカウント用設定 (routes を有効化) を $T/src に用意し、設定を構文で検査する
  git -C "$REPO" fetch -q origin
  git -C "$REPO" worktree add -q --detach "$T/src" "$REF"
  local cfg; cfg=$(git -C "$REPO" show "$BRANCH:wrangler.haru.jsonc" 2>/dev/null || git -C "$REPO" show "origin/$BRANCH:wrangler.haru.jsonc")
  printf '%s\n' "$cfg" | sed -E \
      -e 's#^  // "routes": \[#  "routes": [#' \
      -e 's#^  //   \{ "pattern"#    { "pattern"#' \
      -e 's#^  // \],#  ],#' > "$T/src/wrangler.haru.jsonc"
  ln -s "$REPO/node_modules" "$T/src/node_modules"
  # JSONC を自前で解釈し、routes が「トップレベル」に 2 本の custom_domain としてあることを確かめる
  # (rovae では TOML の routes が [observability] の下に入り、警告だけで独自ドメイン無しの deploy になった)
  py '
import json,re,sys
s=open(sys.argv[1],encoding="utf-8").read()
out,i,q=[],0,False
while i<len(s):
    c=s[i]
    if q:
        out.append(c)
        if c=="\\": out.append(s[i+1]); i+=1
        elif c=="\"": q=False
    elif c=="\"": q=True; out.append(c)
    elif s.startswith("//",i):
        while i<len(s) and s[i]!="\n": i+=1
        continue
    else: out.append(c)
    i+=1
txt=re.sub(r",(\s*[}\]])",r"\1","".join(out))
d=json.loads(txt)
r=d.get("routes")
want=[{"pattern":"gensuirou.com","custom_domain":True},{"pattern":"www.gensuirou.com","custom_domain":True}]
assert r==want, f"routes がトップレベルに無い/違う: {r}"
assert d["account_id"]=="'"$NEW"'", d["account_id"]
assert "routes" not in d.get("observability",{}), "routes が observability の中に入っている"
assert d["vars"]["TURNSTILE_SITEKEY"]=="'"$NEW_SITEKEY"'"
print("config OK: account", d["account_id"], "D1", d["d1_databases"][0]["database_id"], "routes", [x["pattern"] for x in r])
' "$T/src/wrangler.haru.jsonc"
  echo "deploy 元: $(git -C "$T/src" log --oneline -1)"
}

snap() {  # 旧新の D1 を手元の sqlite に落として件数を並べる
  W d1 export "$DB" --remote -c "$REPO/wrangler.jsonc"          --output "$T/old.sql" >/dev/null
  W d1 export "$DB" --remote -c "$T/src/wrangler.haru.jsonc"    --output "$T/new.sql" >/dev/null
  for s in old new; do rm -f "$T/$s.db"; (echo 'BEGIN;'; cat "$T/$s.sql"; echo 'COMMIT;') | sqlite3 "$T/$s.db"; done
  for s in old new; do echo "  $s: $(sqlite3 "$T/$s.db" "SELECT count(*)||' 件, 最新 '||ifnull(max(created_at),'-')||', 未送信 '||sum(mail_status<>'sent') FROM enquiries")"; done
}
apply_delta() {
  # id は crypto.randomUUID() (TEXT 主キー) なので旧新で衝突しない
  python3 "$M/d1-delta.py" "$T/new.db" "$T/old.db" --split "$T/delta" "$@"
  for f in "$T"/delta-*.sql; do [ -e "$f" ] && W d1 execute "$DB" --remote -y -c "$T/src/wrangler.haru.jsonc" --file "$f" | grep -E "Executed|rror" || true; done
}
marker() {  # 本番が旧/新どちらの worker で応答しているか (トップに出る Turnstile sitekey で判定)
  local b; b=$(curl -4 -s -m 20 https://gensuirou.com/)
  case "$b" in *"$NEW_SITEKEY"*) echo NEW;; *"$OLD_SITEKEY"*) echo OLD;; *) echo UNKNOWN;; esac
}

case "${1:-}" in
pre)
  echo "== 1. 新 zone (Haru Private) が pending で存在するか"
  read -r NZ NST NNS <<<"$(zone)" || true
  [ -n "${NZ:-}" ] || die "新アカウントに gensuirou.com の zone が無い。PHASE_B.md 手順 1 (本人がダッシュボードで追加) が先"
  echo "  zone $NZ status=$NST NS=$NNS"
  [ "$NST" = pending ] || echo "  (注意) status が pending ではない: $NST"
  echo "== 2. 本番はまだ旧で応答しているか: $(marker)"
  echo "== 3. deploy 元の用意 (REF=$REF)"
  build_dir
  echo "== 4. 新 worker の secret"
  names=$(W secret list --name gensuirou -c "$T/src/wrangler.haru.jsonc" 2>/dev/null | py 'import json,sys; print(" ".join(sorted(x["name"] for x in json.load(sys.stdin))))')
  echo "  $names"; [ "$names" = "ENQUIRY_TO TURNSTILE_SECRET" ] || die "secret が揃っていない"
  echo "== 5. D1 差分コピー (旧 → 新)"
  snap; apply_delta
  echo "== 6. 独自ドメイン付きで新アカウントに deploy (pending の zone にも付く。NS が旧のうちは利用者は旧に行く)"
  (cd "$T/src" && W deploy -c wrangler.haru.jsonc) 2>&1 | tee "$T/deploy.log" | grep -vE '^\s+\+ /|^\s*$' | tail -15
  grep -q "Unexpected fields" "$T/deploy.log" && die "wrangler が設定の一部を無視した (Unexpected fields)"
  n=$(grep -c "(custom domain)" "$T/deploy.log" || true); [ "$n" = 2 ] || die "custom domain が 2 本付いていない ($n)"
  echo "== 7. 新アカウント側の custom domain を API で確認"
  cf "/accounts/$NEW/workers/domains?zone_id=$NZ" | py '
import json,sys; r=json.load(sys.stdin)["result"]
got=sorted((x["hostname"],x["service"]) for x in r); print(" ", got)
assert got==[("gensuirou.com","gensuirou"),("www.gensuirou.com","gensuirou")], "custom domain が想定と違う"'
  echo "== 8. 本番はまだ旧のはず: $(marker)"
  echo "== 9. Email Sending (pending だと 2009 で拒否される → post で再実行)"
  W email sending enable gensuirou.com -c "$T/src/wrangler.haru.jsonc" 2>&1 | tail -2 || true
  echo; echo "pre 完了。次は PHASE_B.md 手順 4 (WADAX で NS を書き換え)。"
  ;;
post)
  echo "== 1. NS と zone の状態"
  read -r NZ NST NNS <<<"$(zone)" || true
  echo "  新 zone $NZ status=$NST NS=$NNS"
  echo "  公開 DNS の NS: $(curl -4 -s -H 'accept: application/dns-json' 'https://1.1.1.1/dns-query?name=gensuirou.com&type=NS' | py 'import json,sys; print(sorted(a["data"] for a in json.load(sys.stdin).get("Answer",[])))')"
  echo "  whois: $(whois gensuirou.com 2>/dev/null | grep -i 'Name Server' | sort -u | tr -s ' ' | tr '\n' ' ')"
  [ "$NST" = active ] || die "新 zone がまだ active ではない。Overview の「Check nameservers now」を押して数分待ってから再実行"
  echo "  本番の応答: $(marker)   (NEW になるまで待つ。OLD のままなら数分おいて再実行)"
  build_dir
  echo "== 2. Email Sending を新 zone で有効化 (cf-bounce の MX/SPF/DKIM が自動で入る。_dmarc は p=none のまま残るはず)"
  for i in 1 2 3; do
    if W email sending enable gensuirou.com -c "$T/src/wrangler.haru.jsonc" 2>&1 | tail -3; then break; fi
    echo "  再試行 $i (zone の active 化直後は 2009 が出る)"; sleep 30
  done
  W email sending dns get gensuirou.com -c "$T/src/wrangler.haru.jsonc" 2>&1 | tail -20 || true
  echo "== 3. Email Routing が無効のままか (有効だと apex の MX が奪われる)"
  cf "/zones/$NZ/email/routing" | py 'import json,sys; r=json.load(sys.stdin).get("result") or {}; print("  enabled =", r.get("enabled"), r.get("status")); assert not r.get("enabled"), "!!!!!! Email Routing が有効。直ちに Disable"'
  echo "== 4. DNS 全件突合 (取り込み 11 件 + メール経路 + apex/www + cf-bounce + _dmarc p=none)"
  python3 -I "$HERE/verify-dns.py" --after-email-sending | grep -vE '^OK ' || echo "  !! DNS に NG がある (キャッシュなら最大 1 時間で揃う。メール経路の NG は即対応)"
  echo "== 5. サイト"
  (cd "$T/src" && BASE=https://gensuirou.com bash scripts/check-worker.sh 2>&1 | tail -2) || echo "  !! check-worker 失敗"
  (cd "$T/src" && node scripts/check-legacy.mjs 2>&1 | tail -3) || echo "  !! check-legacy 失敗 (TV 館内案内 / 旧サーバ中継 / acme)"
  h=$(curl -4 -s -m 20 -D - -o /dev/null http://gensuirou.com/gensuiro/)
  echo "  客室 TV  http://gensuirou.com/gensuiro/ → $(printf '%s' "$h" | head -1 | tr -d '\r')"
  printf '%s' "$h" | grep -qiE '^(location|strict-transport-security):' \
    && echo "  !!!!!! /gensuiro が https に飛ばされているか HSTS が付いた → 新 zone の Always Use HTTPS / HSTS を Off に" || echo "  OK (301 も HSTS も無し)"
  curl -4 -s -m 20 https://gensuirou.com/reservation | grep -q 'sec.489.jp/rg2/2316' && echo "  OK 予約エンジン (sec.489.jp) への導線あり" || echo "  !!!!!! /reservation に予約エンジンへの導線が無い"
  echo "  gensuirou.tas-quest.com/rooms → $(curl -4 -s -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' https://gensuirou.tas-quest.com/rooms)"
  echo "== 6. D1 差分コピー (--no-delete。切替中に旧へ入った問い合わせを新へ)"
  snap; apply_delta --no-delete
  echo "  新だけにある行: $(sqlite3 "$T/new.db" "ATTACH '$T/old.db' AS o; SELECT count(*) FROM enquiries WHERE id NOT IN (SELECT id FROM o.enquiries)")"
  echo "  新で mail_status<>'sent' の行 (切替〜Email Sending 有効化の間は送れない。旅館へは本人が転送):"
  sqlite3 "$T/new.db" "SELECT '    '||id||' '||created_at||' '||mail_status FROM enquiries WHERE mail_status<>'sent' ORDER BY created_at" || true
  echo; echo "post 完了。PHASE_B.md 手順 6 以降 (設定の一本化 commit・旧の後片付けは 1 週間後)。"
  ;;
*) echo "usage: [REF=<commit>] $0 pre|post"; exit 1 ;;
esac
