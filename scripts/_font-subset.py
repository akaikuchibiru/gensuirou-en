# 原本のフォントを、走査で出た文字だけに絞って woff2 にする。
# make-fonts.sh から呼ばれる。単体では使わない。
#
#   python _font-subset.py <workdir> <outdir>
#
# 仕分けの決め方:
#   走査は「書体スタックと、そこに出ている文字」しか記録しない。
#   どの書体がその字を受け持つかは、**原本の cmap を見て**ここで決める。
#   スタックの先頭から順に、その字を持っている最初の書体に入れる。
#   誰も持っていなければ Noto Serif JP から作る補い (Extra) に回す。
#
#   先頭の書体で機械的に仕分けると必ず外す:
#     - 欧文書体が先頭の要素にも和文は出る (「ご予約」「目次」)
#     - 和文書体しか無いスタックにもダッシュや矢印は出る (— → ※)
#     - Sawarabi Mincho には屋号の「瓏」も客室名の「凛・瑩」も入っていない
#
# 併せて scripts/fonts-coverage.json を書く。chars は **実際に入った字 (cmap)**。
# 要求した字ではない (pyftsubset は原本に無い字を黙って捨てるので、
# 要求を載せると「入っている」と嘘をつく)。
import hashlib, io, json, os, subprocess, sys
from fontTools.ttLib import TTFont

work, out = sys.argv[1], sys.argv[2]
inv = json.load(io.open(work + "/inventory.json", encoding="utf-8"))

# 配る書体 → (原本, 出力名, 可変軸の固定, 保険に足す字)
PLAN = {
    "Sawarabi Mincho":     ("SawarabiMincho.ttf",    "gensuirou-ja.woff2",      None,       "ja"),
    "Noto Serif SC":       ("NotoSerifSC.ttf",       "gensuirou-zh.woff2",      "wght=400", "zh"),
    "Cormorant Garamond":  ("CormorantGaramond.ttf", "gensuirou-latin.woff2",   "wght=400", "latin"),
    # 英語・中国語の面に出る和文は客室名と言語切替だけ。そこだけこの小さい方に差し替える。
    "Gensuirou Kanji":     ("SawarabiMincho.ttf",    "gensuirou-ja-mini.woff2", None,       None),
    # どの原本にも無いぶんの補い。屋号の「瓏」もここに入る。
    "Gensuirou Kanji Extra": ("NotoSerifJP.ttf",     "gensuirou-ja-extra.woff2", "wght=400", None),
}

# 原本の cmap を先に読む (どの書体がその字を持てるかの判断に使う)
src_cmap = {}
for family, (src, _n, _p, _pad) in PLAN.items():
    if src not in src_cmap:
        with TTFont(f"{work}/src/{src}", fontNumber=0, lazy=True) as f:
            src_cmap[src] = set(f.getBestCmap().keys())
have = {fam: src_cmap[PLAN[fam][0]] for fam in PLAN}

# ── 仕分け ──
want = {fam: set() for fam in PLAN}
orphan = {}
for stack, chars in inv["stacks"]:
    shipped = [f for f in stack if f in PLAN]
    # 自前の書体が 1 つも無いスタック (端末のゴシックだけ) は対象外。
    # ⚠ ここを飛ばさないと、その字が全部 Extra へ「救済」されて 40KB 膨らむ
    #   (2026-09-04 に TV ページのゴシック本文で露呈)。
    if not shipped:
        continue
    for ch in chars:
        cp = ord(ch)
        target = next((f for f in shipped if cp in have[f]), None)
        if target is None:
            # スタックの誰も持っていない。補いに回す (そこにも無ければ記録して知らせる)
            if cp in have["Gensuirou Kanji Extra"]:
                want["Gensuirou Kanji Extra"].add(ch)
            elif shipped:
                orphan.setdefault(ch, stack[0])
            continue
        want[target].add(ch)

# 保険 (原本にあるものだけ足す)
for family, (_s, _n, _p, padkey) in PLAN.items():
    if not padkey:
        continue
    for ch in inv["pad"][padkey]:
        if ord(ch) in have[family]:
            want[family].add(ch)


def build(family, chars):
    src, name, pin, _pad = PLAN[family]
    inp = f"{work}/src/{src}"
    if pin:
        pinned = f"{work}/pinned-{src}"
        if not os.path.exists(pinned):
            subprocess.run([sys.executable, "-m", "fontTools.varLib.instancer", inp, pin, "-o", pinned],
                           check=True, capture_output=True)
        inp = pinned
    tf = f"{work}/_text.txt"
    io.open(tf, "w", encoding="utf-8").write("".join(sorted(chars)))
    dst = f"{out}/{name}"
    subprocess.run([
        sys.executable, "-m", "fontTools.subset", inp,
        "--text-file=" + tf, "--output-file=" + dst, "--flavor=woff2",
        # vert / vrt2 は縦組みの字形。和文の見出しで使っている。
        "--layout-features=kern,liga,palt,vert,vrt2,ccmp,locl",
        "--no-hinting", "--desubroutinize",
        "--name-IDs=0,1,2,3,4,5,6,13,14", "--notdef-outline",
    ], check=True)
    with TTFont(dst) as f:
        real = "".join(sorted(chr(c) for c in f.getBestCmap().keys()))
    sha = hashlib.sha256(open(dst, "rb").read()).hexdigest()
    print(f"  {name:26s} {os.path.getsize(dst)/1024:6.1f}KB  ({len(real)} 文字)", file=sys.stderr)
    return {"file": "/assets/fonts/" + name, "sha256": sha, "chars": real}


manifest = {}
for family in PLAN:
    if not want[family]:
        print(f"  ! {family} に回る字が無かった — 前回の物を残す", file=sys.stderr)
        continue
    manifest[family] = build(family, want[family])

if orphan:
    print(f"  ! どの原本にも無い字 {len(orphan)} 文字: {''.join(orphan)}", file=sys.stderr)
    print("    (端末まかせの書体で出る。原稿を直すか、原本を足すこと)", file=sys.stderr)

io.open("scripts/fonts-coverage.json", "w", encoding="utf-8").write(
    json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
