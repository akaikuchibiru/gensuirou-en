# Gensuirou · Multilingual Mirror (JA / EN / 中文)

高級温泉旅館「源翠瓏」(https://gensuirou.com/) の 3 言語ミラーサイト。

Static HTML + CSS + JS, no build step. Served by a single **Cloudflare Worker**
with Static Assets (`public/`). Pages はまだ残してあるが、DNS 切替後に畳む。

## Structure

| Page | Route |
|------|-------|
| Home (hero video, 12 rooms, reservation form) | `/` |
| Rooms — 12 villas + 紫 Shiori detail | `/rooms.html` |
| Cuisine — French–Japanese menu + prices | `/cuisine.html` |
| Onsen — mineral analysis + effects | `/onsen.html` |
| Facilities — sauna, body care | `/facilities.html` |
| Access — routes + map | `/access.html` |
| FAQ | `/faq.html` |
| Wedding | `/wedding.html` |

## Layout

| Path | 中身 |
|---|---|
| `public/` | 配信されるもの全部。ここが Static Assets の directory |
| `src/worker.js` | HTTPS 強制 / URL 正規化 (301) / セキュリティヘッダ / CSP レポート受け口 |
| `scripts/` | 検証。`public/` から `python3 -m http.server 8793` を上げてから実行 |
| `dns-migration/` | WADAX → Cloudflare の原本・取り込みファイル・突合スクリプト |

## Shared components

- `assets/site.css` — full styling (palette, typography, layout, animations)
- `assets/site.js` — i18n switcher, header/footer injection, lightbox, form
- `assets/imgs/`, `assets/imgs_rooms/`, `assets/imgs_1080_570/`, `assets/movie/` — mirrored source assets

## Local preview

```bash
cd public && python3 -m http.server 8793
```

## Verify

本番 (workers.dev / gensuirou.com) に対して:

```bash
./scripts/check-worker.sh              # 旧 URL の 301 / 客室 36 URL / ヘッダ 3 経路 / 404
node scripts/check-i18n.mjs            # 22 ページ × 3 言語の lang/meta/canonical/hreflang
                                       # + 内部 URL を全部叩く + sitemap 全件 200
node scripts/check-schema.mjs          # JSON-LD の構造・本文とのズレ・schema.org 語彙
node scripts/check-ux.mjs              # ライトボックス / 当たり判定 44px / reveal 固着
node scripts/check-chrome-widths.mjs   # 18 幅の溢れ + 箱の上に本物のホイールを投げる
node scripts/check-enquiry.mjs         # 予約フォーム (有効時・fail-closed 時の両方)
node scripts/check-vitals.mjs          # LCP/CLS/FCP/TBT と転送量。キャッシュ空・4G 相当で測る
node scripts/check-originality.mjs     # 旧サイトとの一致率。ALLOW 以外の一致が出たら落ちる
node scripts/check-css-vars.mjs        # var(--x) が解決するか / ルール外に落ちた宣言
node scripts/check-images.mjs          # 表示中なのに読めていない画像。人の速度でスクロールして測る
node scripts/check-hero-contrast.mjs   # 映像の上の文字。合成後の画素を 8 フレーム見る
node scripts/check-mail-dns.mjs        # 予約通知が飛ぶ DNS。欠けても画面は正常に見える
node scripts/check-type-size.mjs       # 文字の「見かけの大きさ」。指定 px では判断できない
node scripts/check-header.mjs          # 320〜480px を 10px 刻み。宿名が折れる帯を捕まえる
node scripts/check-booking-route.mjs   # 「予約」ラベルが予約先へ行くか。全ページ×3言語
node scripts/check-seo.mjs             # title/desc の幅と重複・h1・alt・到達クリック数・旧URL の 301
node scripts/check-legacy.mjs          # 旧サーバにしか無い資産 (客室テレビの館内案内 /gensuiro/)
node scripts/check-fonts.mjs           # 出ている字が部分集合に入っているか + 配信物の sha256
                                       # --full を付けると旧サイトを巡回して全 URL を突合
node scripts/gen-content-data.mjs      # 構造化データの材料を本文から作り直す (FAQ を足したら必ず)
./scripts/check-parity.sh              # Pages 版と本文が一致するか。Pages を畳んだら消す
```

ローカル (`cd public && python3 -m http.server 8793` を上げてから):

```bash
node scripts/check-gates.mjs        # 8 ページ × 5 幅
node scripts/check-nav.mjs
node scripts/check-contrast.mjs
node scripts/check-form-align.mjs
```

## 書体

Google Fonts をやめ、**このサイトで実際に使う文字だけ**に絞った woff2 を
同じオリジンから配っている (`public/assets/fonts/`)。字面は変えていない。

| 面 | 前 | 後 |
|---|---|---|
| 日本語 | 39 本 479KB | 3 本 169KB |
| 英語 | 39 本 479KB | 3 本 19KB |
| 中国語 | 20 本 1,380KB | 4 本 222KB |

```bash
./scripts/make-fonts.sh          # 文章を足したら必ず回す (本番を走査して作り直す)
npx wrangler deploy
node scripts/check-fonts.mjs     # 出ている字が全部入っているか + sha256 の照合
```

⚠ 入っていない字は **システムの書体で静かに出る**。ページは 200 のままで、
目視ではまず気付かない。実際、移行前は屋号の「瓏」と客室名の「凛・瑩」、
それに — → ※ が端末まかせで出ていた (Apple は明朝、Android はゴシック)。
`check-fonts.mjs` は全 69 ページの実文字を `scripts/fonts-coverage.json`
(作成時に書き出す cmap) と突き合わせて落とす。

書体は 4 本 + 補い 1 本:

| ファイル | 中身 |
|---|---|
| `gensuirou-ja.woff2` | 和文の読み書体 (Sawarabi Mincho) |
| `gensuirou-zh.woff2` | 中文の読み書体 (Noto Serif SC) |
| `gensuirou-latin.woff2` | 欧文・ロゴ (Cormorant Garamond) |
| `gensuirou-ja-mini.woff2` | 客室名と言語切替の 19 字 (英語・中国語の面用) |
| `gensuirou-ja-extra.woff2` | どの原本にも無い 10 字の補い (Noto Serif JP) |

ライセンスは 4 本とも SIL Open Font License 1.1 (Reserved Font Name の宣言なし)。
全文を `public/assets/fonts/OFL-*.txt` に同梱している。

## 画像

写真は JPEG のまま置き、**同じ名前の `.webp` を隣に生成**して置いてある。
Worker が `Accept: image/webp` を見て同じ URL で webp を返す (`src/worker.js`)。
markup は 1 行も変えないので、静的ページ・客室ページ・ライトボックスの
どの経路も同じだけ軽くなる。twin が無ければ元の画像を返すだけ。

```bash
./scripts/make-webp.sh      # 写真を足したら実行する (既存の twin は飛ばす)
```

実測 (2026-09-03、モバイル・キャッシュ空):
`/rooms/zui` LCP 3,528ms → 1,428ms / 転送 1,807KB → 1,378KB。

## Deploy

```bash
unset CF_API_TOKEN CLOUDFLARE_API_TOKEN   # env の token が OAuth を上書きして code 10000 で落ちる
npx wrangler deploy
```

## Status

Commissioned by the ryokan — this site takes **real reservation enquiries**.
予約フォームは本番で稼働している (Turnstile + D1 保存 + Email Sending)。
通知先は `ENQUIRY_TO` (secret)。旅館の予約担当アドレスに差し替えるのが残件。

### 旧サーバ (WADAX / Plesk 153.123.7.215) にまだ依存しているもの

- **客室テレビの館内案内 `/gensuiro/`** — 館内案内システムの業者 (ナバック) が
  旧サーバに置いた Basic 認証つきのディレクトリ。中身はこちらに無い。
  Worker が `cloudflare:sockets` で旧サーバへ中継している (`src/legacy.js`)。
- **旧ページから参照が残っているアセット** — 新サイトに無い画像・CSS・JS・
  32MB の紹介動画。404 のときだけ旧サーバへ取りに行く (拡張子で限定)。
- 旧サーバのメール (`mail` / `webmail` / `smtp` / `pop`) は DNS only のまま。

⚠ これは延命であって移行ではない。旧サーバが止まればテレビも止まる。
恒久策は「ナバックの中身を旅館経由で受け取り、こちら側に置く」こと。
