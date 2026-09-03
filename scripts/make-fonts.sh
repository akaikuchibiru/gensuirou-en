#!/usr/bin/env bash
# 書体を「このサイトで実際に使う文字だけ」に絞って作り直す。
#
#   ./scripts/make-fonts.sh [base-url]      # 既定 https://gensuirou.com
#
# なぜ自前ホストか:
#   Google Fonts は言語ぶんの分割ファイルを取りに行くので、実測
#   (2026-09-03・モバイル・キャッシュ空) で
#     日本語 39 本 479KB / 中国語 20 本 1,380KB / 英語も 479KB
#   だった。字面は変えずに、下の 4 本に置き換える。
#     gensuirou-ja.woff2       和文の読み書体 (Sawarabi Mincho)
#     gensuirou-zh.woff2       中文の読み書体 (Noto Serif SC)
#     gensuirou-latin.woff2    欧文・ロゴ (Cormorant Garamond)
#     gensuirou-ja-mini.woff2  客室名の漢字だけ (英語・中国語の面用)
#     gensuirou-ja-extra.woff2 Sawarabi に無い字の補い (Noto Serif JP)
#
# 文章を足したら **必ずこれを回す**。入っていない字はシステムの書体で
# 静かに出る (ページは 200 のまま)。回し忘れは
#   node scripts/check-fonts.mjs
# が全ページの実文字と下で書き出す一覧を突き合わせて落とす。
#
# ライセンス: 3 本とも SIL Open Font License 1.1。Reserved Font Name の
# 宣言は無いので部分集合を同じ名前で配れる。全文を assets/fonts に同梱。
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${1:-https://gensuirou.com}"
WORK=".fontwork"          # .gitignore 済み。venv と原本を置く
OUT="public/assets/fonts"
mkdir -p "$WORK/src" "$OUT"

# ── 1. 道具 ──
if [ ! -x "$WORK/venv/bin/python" ]; then
  echo "── fontTools を用意"
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" install -q "fonttools[woff]" brotli
fi
PY="$WORK/venv/bin/python"

# ── 2. 原本 (Google Fonts の github から) ──
fetch() {  # fetch <url> <out>
  [ -s "$2" ] && return 0
  echo "── 原本を取得 $(basename "$2")"
  curl -sL -m 300 "$1" -o "$2"
}
fetch "https://raw.githubusercontent.com/google/fonts/main/ofl/sawarabimincho/SawarabiMincho-Regular.ttf" "$WORK/src/SawarabiMincho.ttf"
fetch "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"      "$WORK/src/NotoSerifSC.ttf"
fetch "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf" "$WORK/src/CormorantGaramond.ttf"
# Sawarabi Mincho に無い客室名の漢字 (凛・瑩) を補うためだけの原本。
fetch "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf" "$WORK/src/NotoSerifJP.ttf"
for f in sawarabimincho notoserifsc cormorantgaramond notoserifjp; do
  fetch "https://raw.githubusercontent.com/google/fonts/main/ofl/$f/OFL.txt" "$WORK/src/OFL-$f.txt"
done
cp "$WORK/src/OFL-sawarabimincho.txt"    "$OUT/OFL-SawarabiMincho.txt"
cp "$WORK/src/OFL-notoserifsc.txt"       "$OUT/OFL-NotoSerifSC.txt"
cp "$WORK/src/OFL-cormorantgaramond.txt" "$OUT/OFL-CormorantGaramond.txt"
cp "$WORK/src/OFL-notoserifjp.txt"       "$OUT/OFL-NotoSerifJP.txt"

# ── 3. 出ている字を数える ──
# 本番の全 URL を実ブラウザで開き、**その要素が実際に使う書体ごとに**
# 文字を集める。HTML を読むだけでは、言語で畳んだ span や JS が後から
# 入れる文字 (件数表示・フォームのエラー文) を取りこぼす。
echo "── 出ている字を走査 ($BASE)"
node scripts/_font-inventory.mjs "$BASE" > "$WORK/inventory.json"

# ── 4. 部分集合を作る ──
"$PY" scripts/_font-subset.py "$WORK" "$OUT"

echo
echo "できあがり:"
ls -l "$OUT"/*.woff2 | awk '{printf "  %-42s %6.1fKB\n", $9, $5/1024}'
echo
echo "次にすること:  npx wrangler deploy && node scripts/check-fonts.mjs"
