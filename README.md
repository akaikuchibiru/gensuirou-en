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
./scripts/check-parity.sh              # Pages 版と本文が一致するか。Pages を畳んだら消す
```

ローカル (`cd public && python3 -m http.server 8793` を上げてから):

```bash
node scripts/check-gates.mjs        # 8 ページ × 5 幅
node scripts/check-nav.mjs
node scripts/check-contrast.mjs
node scripts/check-form-align.mjs
```

## Deploy

```bash
unset CF_API_TOKEN CLOUDFLARE_API_TOKEN   # env の token が OAuth を上書きして code 10000 で落ちる
npx wrangler deploy
```

## Status

Commissioned by the ryokan — this site takes **real reservation enquiries**.

The enquiry form is **not wired yet**. Until `/api/enquiry` exists, the `#reserve`
band on `index.html` shows the telephone instead of a form: a form that accepts
input it cannot deliver loses real bookings. Restore the form markup from
`git show 70174bb:index.html` when the endpoint is live.

Outstanding before launch: own domain, Email Routing (`info@`), Email Sending
(SPF/DKIM), Turnstile, D1 storage, per-language URLs + hreflang, 301 from
`gensuirou.tas-quest.com`.
