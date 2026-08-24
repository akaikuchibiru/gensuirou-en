#!/usr/bin/env bash
# Worker 版そのものの挙動検査。Pages との差分のうち「意図した改善」を明示的に確認する。
BASE="${BASE:-https://gensuirou.japanese-government-official.workers.dev}"
bad=0
ok(){ printf "  OK   %s\n" "$1"; }
ng(){ printf "  NG   %s\n" "$1"; bad=$((bad+1)); }

echo "── URL 正規化 (301 であること。307 では評価が統合されない)"
for pair in "/index.html:/" "/rooms.html:/rooms" "/wedding.html:/wedding" "/rooms/:/rooms"; do
  src="${pair%%:*}"; want="${pair##*:}"
  read -r code loc < <(curl -sS -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 25 "$BASE$src")
  [ "$code" = "301" ] && [[ "$loc" == *"$want" ]] && ok "$src → 301 $loc" || ng "$src → $code $loc (期待 301 …$want)"
done

echo "── クリーン URL が 200"
for p in / /rooms /cuisine /onsen /facilities /access /faq /wedding; do
  c=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 25 "$BASE$p")
  [ "$c" = "200" ] && ok "$p 200" || ng "$p $c"
done

echo "── 未知 URL は 404 で、404 ページの中身が返る"
for p in /this-does-not-exist /a/b/c/deep; do
  body=$(curl -sS -w "\n%{http_code}" --max-time 25 "$BASE$p")
  code=$(tail -1 <<<"$body")
  if [ "$code" = "404" ] && grep -q "nf-code" <<<"$body"; then ok "$p → 404 + 404 ページ"; else ng "$p → $code (404 ページ検出=$(grep -c nf-code <<<"$body"))"; fi
done
echo "── 404 ページの CSS/JS が絶対パスで解決するか (深い URL で壊れないこと)"
for a in /tokens.css /assets/site.css /assets/site.js; do
  c=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 25 "$BASE$a"); [ "$c" = "200" ] && ok "$a 200" || ng "$a $c"
done

echo "── セキュリティヘッダ (通常 / ナビゲーション / 画像 の 3 経路)"
check_hdr(){
  local label="$1"; shift
  local h; h=$(curl -sSI "$@" --max-time 25 2>/dev/null | tr 'A-Z' 'a-z')
  for k in strict-transport-security x-content-type-options x-frame-options referrer-policy content-security-policy-report-only; do
    grep -q "^$k:" <<<"$h" && ok "$label $k" || ng "$label $k が無い"
  done
}
check_hdr "html"  "$BASE/"
check_hdr "nav "  -H "Sec-Fetch-Mode: navigate" "$BASE/rooms"
check_hdr "img "  "$BASE/assets/imgs/logo_gensuirou.png"

echo "────────────────────────────────────────────"
[ "$bad" -eq 0 ] && echo "WORKER PASS" || echo "FAIL — $bad 件"
exit $((bad>0))
