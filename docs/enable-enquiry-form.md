# 予約フォームを有効にする手順

宛先が 1 つ入れば終わりです。ほかは実装・検証済み。

## 事前に確認済みのこと（2026-08-26 時点）

| 項目 | 状態 |
|---|---|
| D1 `enquiries` テーブル | あり（列: id, created_at, lang, name, email, phone, country, checkin, nights, guests, villa, message, cf_country, **mail_status, mail_error**） |
| Cloudflare Email Sending | `gensuirou.com` 登録済み・有効 |
| Turnstile | `TURNSTILE_SITEKEY`（vars）/ `TURNSTILE_SECRET`（secret）とも設定済み |
| `ENQUIRY_TO` | **未設定 — これだけが残り** |

`enquiryEnabled(env) = !!(env.ENQUIRY_TO && env.TURNSTILE_SITEKEY)` なので、
`ENQUIRY_TO` が入った瞬間にフォームが出て、電話案内の文面と入れ替わる。

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
