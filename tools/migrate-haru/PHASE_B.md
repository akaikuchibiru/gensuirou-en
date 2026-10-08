# 源翠瓏 (gensuirou.com): 個人アカウント → Haru Private 移行 phase B 手順

旧 0125d37b (個人。他人も Super admin) → 新 50595f10 (Haru Private、本人だけ)。上から順に 1 段ずつ。無人で流さない。
phase A (2026-10-08) で済んでいるのは「複製と workers.dev 公開」まで。zone・DNS・NS・custom domain は未着手。

**このサイトは実予約・実問い合わせを受けている。最大のリスクはサイトではなくメール** (apex の MX が WADAX の Plesk
153.123.7.215 を指し、旅館の受信箱がそこにある)。DNS は旧 zone と 1 本も違わない状態で切り替える。巻き戻しは即時ではない
(ゾーン NS TTL 6 時間 + .com 委任 最大 48 時間) ので「壊れたら戻す」ではなく「同一にしてから切り替える」。

## phase A で作ったもの

| 種類 | 旧 (0125d37b) | 新 (50595f10 Haru Private) |
|---|---|---|
| Worker | `gensuirou` (gensuirou.com + www の Custom Domain、本番 deploy 2026-10-02 12:19Z = commit `8846021`) | `gensuirou` → https://gensuirou.hp-works.workers.dev のみ (`8846021` を deploy、version c18236c5) |
| 設定 | `wrangler.jsonc` | `wrangler.haru.jsonc` (routes はコメントアウト) |
| D1 `gensuirou-enquiries` | `fc8b9465-ad22-4162-872f-18073138cc62` | `dd1660f9-b745-4136-9e12-bc748867c5a0` |
| Turnstile | widget `0x4AAAAAAEa5kQkJe6__etjG` (gensuirou.com / www / 旧 workers.dev) | widget `0x4AAAAAAFRKBwO2jDfmm3cx` (gensuirou.com / www / gensuirou.hp-works.workers.dev)。旧の secret は読めないので新規 |
| Secret | `ENQUIRY_TO` / `TURNSTILE_SECRET` | 同名で投入済。`ENQUIRY_TO` = `reception@gensuirou.com` (2026-09-04 の記録の値。**本人確認**)、`TURNSTILE_SECRET` = 新 widget のもの |
| send_email | Email Sending 有効 (selector `cf-bounce`) | binding だけ。zone 側の有効化は active 後 (pending では 2009 で拒否) |
| Zone gensuirou.com | `95b38dc90848b24d37f5356215f4cf98` active (NS angela / stan) | **未作成** (手順 1 で本人が作る) |
| Pages `gensuirou-en` | gensuirou-en.pages.dev → 全部 gensuirou.com へ 301 するだけ | 移さない (pages.dev の名前はアカウント間で移せない。下の「決めること」) |
| KV / R2 / cron / 他 worker | 無し | — |

検証 (phase A, 2026-10-08):
- D1: 18 件 (最新 2026-10-06T18:41Z、全件 mail_status=sent)。旧新の `.dump enquiries` の md5 一致
- 本番 gensuirou.com と新 workers.dev を sitemap の 75 URL で比較 → 75/75 一致 (差はホスト名・Turnstile sitekey・非正規ホストに付く `noindex` のみ)
- 静的資産・旧 URL の 301・404・旧サーバ中継 (jQuery / 旧画像 / /m/style_m.css)・acme-challenge 中継・IndexNow キー 57 本 → 53 本バイト一致、残り 4 本は robots.txt (非正規ホストは Disallow)・/gensuiro (時計の時刻)・sitemap (ホスト名) で想定どおり
- `scripts/check-worker.sh` (BASE=新) 58 項目 PASS、`scripts/check-legacy.mjs` (SITE=新) 全項目 PASS = 新アカウントからも `cloudflare:sockets` で旧サーバ (TV 館内案内) に届く
- **origin/main には未出荷の 2 commit がある** (`8391a67` / `eb0aca8`、料理ページ 馬刺しの内訳)。phase B は既定で本番と同じ `8846021` を出す

## 旧 zone の DNS (全 18 件、2026-10-08 旧ダッシュボードの一覧 + DoH 2 系統で一致を確認)

| 名前 | 種類 | 値 | Proxy | 新 zone での作り方 |
|---|---|---|---|---|
| mail | A | 153.123.7.215 | DNS only | **Import** |
| webmail | A | 153.123.7.215 | DNS only | Import |
| pop | CNAME | mail.gensuirou.com | DNS only | Import |
| smtp | CNAME | mail.gensuirou.com | DNS only | Import |
| @ | MX 10 | mail.gensuirou.com | — | Import (**メールの生命線**) |
| @ | TXT | v=spf1 ip4:153.123.7.215 mx include:wpmx.wadax.ne.jp include:_pmg.wadax-sv.jp include:_spf.mx.cloudflare.net ~all | — | Import |
| @ | TXT | google-site-verification=Tc1om5… | — | Import |
| @ | TXT | google-site-verification=gWOYBh… (GSC sc-domain) | — | Import |
| _dmarc | TXT | v=DMARC1; p=none | — | Import (**p=none 据え置き**) |
| _domainkey | TXT | o=- | — | Import |
| default._domainkey | TXT | Plesk の DKIM (2048bit) | — | Import |
| cf-bounce | MX 23/42/43 ×3 | route1/2/3.mx.cloudflare.net | — | Email Sending enable が自動で作る |
| cf-bounce | TXT | v=spf1 include:_spf.mx.cloudflare.net ~all | — | 同上 |
| cf-bounce._domainkey | TXT | Cloudflare の DKIM | — | 同上 (**新 zone では鍵が変わる。旧の値を写さない**) |
| @ / www | Worker | gensuirou | Proxied | pre の deploy (custom domain) が自動で作る。**手で作らない** |

wildcard 無し・CAA 無し・SRV 無し・DNSSEC 無し (whois `DNSSEC: unsigned`)。Rules の一覧にルール無し (テンプレートのみ)・Workers Routes 0 本 (API)。
旧 zone は Always Use HTTPS = Off (http://gensuirou.com/gensuiro/ が 200 で返る = 客室 TV の保存済み Basic 認証のため。https 化は worker が /gensuiro 以外でだけ行う)。

取り込み用ファイル: `tools/migrate-haru/gensuirou.com.haru-import.zone` (11 件、全部 DNS only)。突合: `python3 -I tools/migrate-haru/verify-dns.py` (いまの本番に当てて PASS 済み = ファイルは本番と同一)。

## 0. 前提の確認 (読むだけ)

- 登録業者は **GMO Internet (お名前.com)**、管理は WADAX 経由 (whois `Registrar: GMO Internet Group, Inc. d/b/a Onamae.com`、期限 2027-07-10、`clientTransferProhibited`)。Cloudflare Registrar ではないので **レジストラ移動は無い。NS を書き換えるだけ**
- 2026-08-24 の NS 変更は WADAX のアカウントマネージャー (`secure.gmocloud.com/customerjpn3`、ID WA555082649) の「各種手続き → DNSサーバー変更申し込み」で行った (オーダー 000018803207)。**同じアカウントに nishinihon-ls.com もあるので行を間違えない**。申し込み制なので即時ではない (前回はその日のうちに承認)
- 10 月中旬に Plesk の Let's Encrypt 自動更新がある (gensuirou.com/.well-known/acme-challenge/ を worker が旧サーバへ中継して成立している)。新 worker でも中継は phase A で実測済み。切替日が重なっても問題ないが、**11 月上旬に `openssl s_client -connect 153.123.7.215:443` で notAfter が延びたか確認**

## 1. 新 zone を Haru Private に追加 (本人)

Haru Private → Domains → Onboard a domain → `gensuirou.com` → Free。
- DNS は「**Manually enter**」(空で始める)。自動スキャンを選ぶと Cloudflare 自身の IP の A/AAAA が入る (削除はブラウザでは分類器が止める)
- 「Bot Preference Sync」等の追加設定はオフ
- 表示された NS (Haru Private の他 zone は **dawn / duke**) を控える
- NS を書き換えるよう促されても **まだ書き換えない** (手順 4)

## 2. DNS を Import (本人)

新 zone → DNS → Records → Import and Export → Import に `gensuirou.com.haru-import.zone` を渡す。
- **「Proxy imported DNS records」のチェックを外す**
- 取り込み後、一覧が **11 件**で、mail / webmail / pop / smtp が **DNS only (グレー雲)** であることを目視 (前回 8/25 は CF が勝手に Proxied にした)
- SSL/TLS → Edge Certificates で **Always Use HTTPS = Off、HSTS = 無効** を確認 (旧と同じ。On だと客室 TV が真っ黒になる)
- Email → Email Routing は **開かない・有効化しない**

## 3. pre (本人が実行)

```bash
! bash ~/gensuirou-en/tools/migrate-haru/phase-b.sh pre            # 本番と同じ 8846021 を出す
! REF=origin/main bash ~/gensuirou-en/tools/migrate-haru/phase-b.sh pre   # 未出荷の馬刺し内訳も一緒に出す場合
```

(branch merge 前なら `~/gensuirou-en` の代わりに worktree / branch の checkout のパスで。スクリプトは branch `migrate-haru-phase-a` から設定を読む)

やること: 新 zone が pending であることの確認 → 新 worker の secret 2 本の確認 → D1 差分 (旧→新) →
routes を有効にした設定を JSONC として解析し **トップレベルに custom domain 2 本**あるか検査 → deploy
(`Unexpected fields` が出たら停止、`(custom domain)` が 2 本でなければ停止) → API で新アカウントに custom domain 2 本を確認 →
本番がまだ旧で応答していることを確認 (トップの Turnstile sitekey で判定)。
NS が旧のうちは利用者は旧に行くので、この時点では何も切り替わらない。

## 4. NS 書き換え (本人、WADAX の管理画面)

WADAX アカウントマネージャー (`secure.gmocloud.com/customerjpn3`) → 各種手続き → **DNSサーバー変更申し込み** →
**gensuirou.com** の行 (nishinihon-ls.com ではない) → 現在の `angela.ns.cloudflare.com` / `stan.ns.cloudflare.com` を
手順 1 で控えた新 NS 2 本 (dawn / duke の見込み) に書き換えて申し込む。パスワード入力は本人。
- 送信後、履歴に承認記録が出て、申し込み対象一覧から gensuirou.com が消える (処理中は選べない) ことを確認。成功画面だけを根拠にしない
- 反映を `whois gensuirou.com | grep -i 'name server'` で見る。変わったら **すぐ新 zone の Overview で「Check nameservers now」**を押す (押さないと active 化まで約 7 分、名前解決が空振りする。バズミルで実測)
- 切替中は旧 NS と新 NS のどちらが答えても同じ値が返る (同一 zone を用意してあるため)。メールは止まらない

## 5. post (新 zone が active になってから、本人が実行)

```bash
! bash ~/gensuirou-en/tools/migrate-haru/phase-b.sh post
```

やること: zone active / 公開 DNS の NS / whois → 本番が新で応答しているか → **Email Sending を新 zone で有効化** (active 直後は
2009 が出るので 30 秒おきに 3 回) → **Email Routing が無効のまま**か → DNS 全件突合 (`verify-dns.py --after-email-sending`:
取り込み 11 件・apex MX → mail → 153.123.7.215・apex/www が Cloudflare・cf-bounce の MX/SPF/DKIM・`_dmarc` が p=none のまま) →
`check-worker.sh` / `check-legacy.mjs` (TV 館内案内・旧サーバ中継・acme) → http://gensuirou.com/gensuiro/ が 301 も HSTS も無しで 200 →
/reservation に予約エンジン (sec.489.jp/rg2/2316) の導線 → gensuirou.tas-quest.com が gensuirou.com へ 301 →
D1 差分 (`--no-delete`) → 新で `mail_status<>'sent'` の行を id と時刻だけ表示。

- **Email Sending が有効になるまでの数分、新 worker の通知メールは送れない** (問い合わせ自体は D1 に保存され、画面は失敗を正しく出す)。
  post の最後に出る未送信の行は、本人が旅館 (reception@) へ転送する。お客様には何も送らない
- 切替の前後数分は、旧 worker で開いたページ (旧 sitekey) から新 worker へ送信すると Turnstile 検証で 1 回失敗し得る (再読込で直る)
- **フォームのテスト送信はしない** (旅館に届く)。`scripts/check-enquiry.mjs` も実送信するので回さない
- 公開 DNS がまだ旧を返す場合 (キャッシュ) は 1 時間おいて `verify-dns.py --after-email-sending` だけ再実行

## 6. 設定の一本化 (post の後、commit)

- `wrangler.jsonc` を新アカウントの値に置き換える (account_id `50595f10…`、D1 `dd1660f9…`、TURNSTILE_SITEKEY `0x4AAAAAAFRKBwO2jDfmm3cx`、routes 有効) → `wrangler.haru.jsonc` を削除
- `scripts/check-worker.sh` の既定 BASE (旧 `gensuirou.japanese-government-official.workers.dev`) を `https://gensuirou.hp-works.workers.dev` に
- 計測: Web Analytics の siteTag と zone id が変わる (旧 siteTag `f40bef8f…` / zone `95b38dc9…`)。新 zone で Web Analytics が自動で有効か確認し、rum.mjs 等の値を差し替え。CSP は本番で securitypolicyviolation を実測
- Google Search Console は DNS TXT 2 本を運んだので所有確認は継続するはず (Settings → Ownership で確認)

**済 (2026-10-09)**: `wrangler.jsonc` を新アカウントの値に一本化し `wrangler.haru.jsonc` を削除。scripts/*.mjs と
`check-worker.sh` の既定 BASE を `https://gensuirou.hp-works.workers.dev` に。repo には siteTag / zone id を持つファイルが無い
(ビーコンは edge 挿入)。切替直後の https://gensuirou.com/ の HTML にはビーコンが出ておらず、wrangler の OAuth では
`rum/site_info/list` が 10000 で読めないため、新 zone の Web Analytics の有効化と siteTag はダッシュボードで本人が確認する。
この手順書と `phase-b.sh` は `wrangler.haru.jsonc` を前提にした当時の記録として残す (再実行しない)。

## 7. 旧の後片付け (1 週間後、本人判断。分類器が削除を止めるので本人が押す)

旧アカウント 0125d37b: worker `gensuirou`、D1 `gensuirou-enquiries` (fc8b9465)、Turnstile widget `0x4AAAAAAEa5kQkJe6__etjG`、
zone gensuirou.com (95b38dc9。NS 切替後は Moved になる)、Pages `gensuirou-en` (下の判断次第)。
削除前に D1 差分をもう一度 (`--no-delete`) 流し、旧にしか無い行が 0 であることを確認する。

**WADAX は解約しない** (メール・webmail・客室 TV の館内案内 /gensuiro/ の実体がそこにある)。
