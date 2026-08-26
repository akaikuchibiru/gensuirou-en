# 予約フォームを有効にする手順

宛先が 1 つ入れば終わりです。ほかは実装・検証済み。

## 事前に確認済みのこと（2026-08-26 時点）

| 項目 | 状態 |
|---|---|
| D1 `enquiries` テーブル | あり（列: id, created_at, lang, name, email, phone, country, checkin, nights, guests, villa, message, cf_country, **mail_status, mail_error**） |
| Cloudflare Email Sending | `gensuirou.com` 登録済み・有効 |
| Turnstile | `TURNSTILE_SITEKEY`（vars）/ `TURNSTILE_SECRET`（secret）とも設定済み |
| `ENQUIRY_TO` | **設定済み（暫定）** — `Haru@bangga-inc.com` |

`enquiryEnabled(env) = !!(env.ENQUIRY_TO && env.TURNSTILE_SITEKEY)` なので、
`ENQUIRY_TO` が入った瞬間にフォームが出て、電話案内の文面と入れ替わる。

## ⚠ いまは暫定の宛先で動いている（2026-08-26〜）

オーナー判断で、旅館さんの回答を待たずに `Haru@bangga-inc.com` へ流している。
**お客さまの実際の予約問い合わせがここに届く。** 旅館さんのアドレスが決まったら
上の手順で差し替えること。

指定は `Haru@bannga-inc.com`（n が 2 つ）だったが、
その綴りは **NXDOMAIN** でドメイン自体が存在せず、全部バウンドする。
`bangga-inc.com` は MX = `smtp.google.com` で生きているので、そちらに直した。

## 手順

```bash
cd ~/gensuirou-en
unset CLOUDFLARE_API_TOKEN CF_API_TOKEN     # env var は OAuth を上書きして code 10000 で落ちる
npx wrangler secret put ENQUIRY_TO          # 旅館さんの受信先を貼る
npx wrangler deploy                         # secret だけでは反映されない
```

deploy 直後 20〜30 秒は旧バージョンが応答するので、待ってから確認する。

```bash
until curl -s https://gensuirou.com/ | grep -q 'name="checkin"'; do sleep 4; done
node scripts/check-form-align.mjs           # 8 幅で崩れていないか
```

## 送信の流れ（この順序が肝）

1. Turnstile 検証
2. **D1 に保存**
3. メール送信
4. 結果を正直に返す

保存をメールより先にやるのは、メールが落ちても問い合わせを失わないため。
画面の出し分けも 3 通りある。**送っていないのに「送信しました」とは出さない**。

| 保存 | 通知 | 画面 |
|---|---|---|
| ○ | ○ | 受付完了 |
| ○ | × | 「受け付けましたが係へのお知らせに失敗しました。お急ぎの場合はお電話を」 |
| × | — | エラー |

## 有効化したあとの確認

**本物のお客さまに届く経路なので、実在の宛先へのテスト送信は必ず許可を取ってから。**
届いたかどうかは、メールを送らずに DB を直接見れば分かる。

```bash
npx wrangler d1 execute gensuirou-enquiries --remote --json \
  --command "SELECT id, created_at, name, mail_status, mail_error FROM enquiries ORDER BY id DESC LIMIT 5;"
```

`mail_status` が `ok` 以外なら、画面には成功と出ていない（上の表のとおり）。


## 本番に触らずに、フォームを通しで試す

Turnstile は人が解くもので、迂回はしない。代わりに **Cloudflare 公式の
テスト鍵**を `.dev.vars` に置き、`wrangler dev --remote` で動かす。
リモート実行なので D1 もメール送信も **本物の binding** を使い、
それでいて本番の鍵・本番の worker には一切触れない。

```bash
cat > .dev.vars <<'EOT'
TURNSTILE_SITEKEY = "1x00000000000000000000AA"          # 常に成功する公式テスト鍵
TURNSTILE_SECRET  = "1x0000000000000000000000000000000AA"
ENQUIRY_TO        = "<受け取れるアドレス>"
EOT
npx wrangler dev --remote --port 8788
```

`.dev.vars` は .gitignore 済み。試したら消すこと。

**宛先は必ず自分が受け取れるアドレスにする。** 実在のお客さまや
旅館さんのスタッフに、検証のメールを送らない。

### 2026-08-26 の実施結果

| | |
|---|---|
| API 応答 | `{"ok":true,"notified":true,"id":"…"}` |
| 画面 | `data-state="sent"` /「お問い合わせを受け付けました。担当者よりご連絡いたします。」 |
| D1 | 1 行保存・`mail_status = sent` / `mail_error` なし・`cf_country = JP` |
| 後片付け | テスト行を削除し、**全走査して 0 行**を確認 |
| 本番 | sitekey は実鍵のまま。トークン無し POST は 400 で拒否。保存 0 件 |
