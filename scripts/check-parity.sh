#!/usr/bin/env bash
# Pages 版 → Worker 版 の移行が「URL を壊していない」ことを確認する。
#
# 単純比較ではなく、意図した差分を明示する。全部を一致で見ると常時赤になり、
# 本物の退行を見落とす。Pages を畳んだらこのスクリプトは消すこと。
#
# 実測で確認した意図した差分 (2026-08-25):
#   .html / 末尾スラッシュ  Pages=308, Worker=301 … どちらも恒久。301 に統一した
#   /assets/site.css        Worker 側に 404 ページ用のスタイルを足したぶん増える
#   未知の URL              Pages=200 でトップページ (soft-404)、Worker=404 + 404 ページ
OLD="${OLD:-https://gensuirou-en.pages.dev}"
NEW="${NEW:-https://gensuirou.japanese-government-official.workers.dev}"
bad=0
ok(){ printf "  OK   %s\n" "$1"; }
ng(){ printf "  NG   %s\n" "$1"; bad=$((bad+1)); }

echo "── 本文が 1 バイトも変わっていないこと (ここが崩れたら移行失敗)"
for p in / /rooms /cuisine /onsen /facilities /access /faq /wedding /tokens.css /assets/site.js \
         /assets/imgs/logo_gensuirou.png /assets/movie/poster.jpg; do
  curl -sS -o /tmp/_o --max-time 30 "$OLD$p"; o=$(shasum -a1 /tmp/_o | cut -c1-12)
  curl -sS -o /tmp/_n --max-time 30 "$NEW$p"; n=$(shasum -a1 /tmp/_n | cut -c1-12)
  [ "$o" = "$n" ] && ok "$p 一致 ($o)" || ng "$p 不一致 old=$o new=$n"
done

echo "── 旧 URL が恒久リダイレクトで生きていること (被リンクを捨てない)"
for p in /index.html /rooms.html /cuisine.html /onsen.html /facilities.html /access.html /faq.html /wedding.html /rooms/; do
  o=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 "$OLD$p")
  n=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 "$NEW$p")
  case "$o$n" in
    308301|301301|308308) ok "$p old=$o new=$n (どちらも恒久)" ;;
    *) ng "$p old=$o new=$n — 恒久リダイレクトでない" ;;
  esac
done

echo "── site.css は 404 用スタイルぶんだけ増える (減っていたら退行)"
oc=$(curl -sS --max-time 30 "$OLD/assets/site.css" | wc -c | tr -d ' ')
nc=$(curl -sS --max-time 30 "$NEW/assets/site.css" | wc -c | tr -d ' ')
if [ "$nc" -gt "$oc" ] && curl -sS --max-time 30 "$NEW/assets/site.css" | grep -q '\.nf-code'; then
  ok "site.css $oc → $nc バイト (.nf-code あり)"
else ng "site.css $oc → $nc バイト — 404 用スタイルが無いか、減っている"; fi

echo "── soft-404 が直っていること"
o=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 "$OLD/no-such-page")
n=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 "$NEW/no-such-page")
[ "$n" = "404" ] && ok "未知 URL: Pages=$o → Worker=$n" || ng "未知 URL が $n (404 であるべき)"

echo "────────────────────────────────────────────"
[ "$bad" -eq 0 ] && echo "PARITY PASS — 本文は同一、旧 URL は恒久で生存、soft-404 は解消" || echo "FAIL — $bad 件"
exit $((bad>0))
