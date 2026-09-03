#!/usr/bin/env bash
# public/assets の写真に .webp の双子を作る。
#
# 画像そのものは差し替えない。Worker が Accept: image/webp を見て
# 同じ URL のまま webp を返す (src/worker.js の webpTwin)。
# markup は 1 行も変えないので、静的ページ・客室ページ・ライトボックスの
# どれも同じ経路で軽くなる。
#
# 使い方: ./scripts/make-webp.sh   (既存の .webp が新しければ飛ばす)
set -euo pipefail
cd "$(dirname "$0")/.."
command -v cwebp >/dev/null || { echo "cwebp がありません (brew install webp)"; exit 1; }

made=0; skipped=0; before=0; after=0
while IFS= read -r -d '' f; do
  out="${f%.*}.webp"
  b=$(stat -f%z "$f")
  if [ -f "$out" ] && [ "$out" -nt "$f" ]; then skipped=$((skipped+1)); after=$((after+$(stat -f%z "$out"))); before=$((before+b)); continue; fi
  cwebp -q 82 -quiet "$f" -o "$out"
  a=$(stat -f%z "$out")
  # webp のほうが大きい画像は twin を置かない (小さい PNG で起こる)
  if [ "$a" -ge "$b" ]; then rm -f "$out"; skipped=$((skipped+1)); after=$((after+b)); before=$((before+b)); continue; fi
  made=$((made+1)); before=$((before+b)); after=$((after+a))
done < <(find public/assets -type f \( -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' \) -print0)

echo "webp 生成 ${made} 枚 / 据置 ${skipped} 枚"
echo "元 $((before/1024))KB → webp $((after/1024))KB ($(( (before-after)*100/before ))% 減)"
