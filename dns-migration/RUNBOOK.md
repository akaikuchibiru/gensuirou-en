# gensuirou.com 移管手順書

WADAX から Cloudflare へネームサーバを移し、この 3 言語サイトを本体に据えるまでの手順。

**この作業の最大のリスクは、サイトが落ちることではなくメールが止まることです。**
apex の MX が `mail.gensuirou.com` → `153.123.7.215` を指しており、サイトと同じ
WADAX サーバで @gensuirou.com の受信をしています（`webmail` も生きている）。
旅館の予約のやり取りがこの箱に入っているので、ここを落とすと直接の損害になります。

---

## 前提として決まっていること

| 項目 | 決定 |
|---|---|
| 置き場所 | gensuirou.com 本体を置き換える（NS を Cloudflare へ） |
| 既存メール | **触らない**。MX / mail / webmail / smtp / pop はそのまま WADAX に残す |
| Cloudflare Email Routing | **使わない**。apex の MX を奪うので既存メールボックスが全滅する |
| Cloudflare Email Sending | 使う。追加レコードは `cf-bounce.` 配下に隔離される |
| DMARC | `p=none` のまま据え置く。Email Sending が勧める `p=reject` は入れない |

`p=reject` を入れない理由: 旅館は Plesk 側からもメールを出しています。そちらの
DKIM 署名や SPF の整合が完全でない場合、`p=reject` にした瞬間に旅館の正規メールが
受信側で捨てられます。落ち着いてから `p=quarantine` を経由して上げるべき項目です。

---

## このディレクトリの中身

| ファイル | 用途 |
|---|---|
| `zone-before.txt` | 移管前の生スナップショット。原本 |
| `gensuirou.com.zone` | Cloudflare の「DNS レコードをインポート」に食わせる BIND 形式 |
| `verify-zone.py` | 原本との突合。DoH 2 系統で引いて相互一致も見る。不一致なら exit 1 |

`verify-zone.py` は `dig` を使いません。**この作業環境は 53/udp を横取りしており、
`dig @<NS>` を指定しても応答に `aa` が立たず SERVER 欄に別のリゾルバが出ます**
（2026-08-24 実測）。権威そのものを見たいときは、Claude Code の外のシェルから
`dig @<NS>` を実行してください。

---

## 移管前のゾーン（全 12 レコード）

```
@                   A      153.123.7.215
www                 A      153.123.7.215
mail                A      153.123.7.215      ← メール。絶対に消さない
webmail             A      153.123.7.215      ← メール
smtp                CNAME  mail.gensuirou.com.
pop                 CNAME  mail.gensuirou.com.
@                   MX  10 mail.gensuirou.com. ← メール。最重要
@                   TXT    v=spf1 ip4:153.123.7.215 mx a +include:wpmx.wadax.ne.jp
                           +include:_spf-mg.wadax-sv.jp ~all
@                   TXT    google-site-verification=Tc1om5xtcZ7...
_dmarc              TXT    v=DMARC1; p=none
_domainkey          TXT    o=-                ← 廃止済の ADSP。無害なので一応運ぶ
default._domainkey  TXT    v=DKIM1; p=MIIBIj... (404 文字 / 2048bit RSA・復号確認済)
```

ワイルドカードなし。CAA なし。SRV なし。DKIM は `default` セレクタのみ。

Cloudflare Email Sending は `cf-bounce` セレクタを使うので、既存の `default` とは
衝突しません。

---

## 手順

### Phase 1 — Cloudflare にゾーンを作る（NS はまだ切り替えない）

1. Cloudflare に `gensuirou.com` をサイト追加（Free で足りる）。
2. 自動スキャンの結果を**信用しない**。スキャンは DKIM のような TXT を取りこぼします。
   `gensuirou.com.zone` を「DNS レコードをインポート」で流し込む。
3. **全レコードを DNS only（グレー雲）にする。** ここが一番の事故ポイントです。
   `mail` / `webmail` をプロキシすると SMTP・POP・IMAP が通らなくなります。
4. apex と www も**この時点では 153.123.7.215 のまま**。サイトの向き先変更は
   Phase 4 で別々にやります。同時にやると、何かが壊れたときに DNS のせいか
   サイトのせいか切り分けられません。
5. Cloudflare が割り当てた 2 本のネームサーバを控える。

この時点では公開状態は何も変わっていません。**ここで止めても無害です。**

### Phase 2 — ネームサーバを切り替える

WADAX の アカウントマネージャー → 各種手続き → **DNSサーバー変更申し込み** から、
Cloudflare の 2 本に変更を申し込む。

- WADAX は申し込みフォーム経由なので即時ではありません。**リードタイムを見込むこと。**
- TTL を事前に下げる作業は不要です。Phase 1 でゾーンを**同一に**作ってあるので、
  切替中にどちらの NS が答えても結果が変わりません。
- 巻き戻しは NS を WADAX に戻すだけですが、**即座ではありません。** ゾーンの NS TTL が
  21600 秒（6 時間）、`.com` の委任 TTL は最大 48 時間です。だから「壊れたら戻す」
  ではなく「壊れない状態で切り替える」が唯一の正解になります。

### Phase 3 — 検証（メールが生きていること）

```bash
python3 dns-migration/verify-zone.py
```

- 12 件すべて OK、`NS: ... → Cloudflare 移管済`、`mail / webmail は DNS only` を確認。
- 加えて**必ず人間の目で確認すること**: 旅館のスタッフに、webmail にログインできるか、
  外部から届いたメールを 1 通受け取れるかを確認してもらう。
  DNS が合っていても届くとは限りません。
- 送信テストを実在のお客様宛にやらないこと。自分が管理しているアドレスで完結させる。

**ここが緑になるまで Phase 4 に進まない。**

### Phase 4 — サイトを新サイトに向ける

1. `gensuirou-en` を Worker + Static Assets に移す（44MB / 106 ファイル、
   最大 `hero.mp4` 18.8MB。Workers Static Assets の 20,000 ファイル・25MiB/ファイルに収まる）。
   Worker にする理由は、`send_email` binding が Workers 専用で Pages Functions では
   使えないため。
2. Custom Domain として `gensuirou.com` と `www.gensuirou.com` を設定。
   ⚠ Custom Domain は宣言的管理。wrangler の config に書き漏らすと deploy で DNS ごと
   消えます（過去に 7 分の停止事故あり）。
3. `/rooms.html` ↔ `/rooms` の扱いを `html_handling` で実測して合わせる。
   現状は Pages 側が吸収しているので、移行で URL が変わると被リンクが切れます。
4. 旧 Plesk サイトをどうするか判断する。ドメインが外れても WADAX の契約自体は
   メールで使い続けるので、**解約しない**こと。
5. `verify-zone.py --site-moved` で、apex/www 以外が動いていないことを確認。

### Phase 5 — Email Sending（送信）

```bash
npx wrangler email sending enable gensuirou.com
```

追加されるのは `cf-bounce.` 配下（MX / SPF / DKIM）と `_dmarc`。
**`_dmarc` を `p=reject` に書き換える提案は拒否し、`p=none` のまま残すこと。**

送信の設計:

| 送るもの | from | Reply-To |
|---|---|---|
| 旅館への通知 | `noreply@gensuirou.com` | お客様のメールアドレス（返信ボタンでそのまま返せる） |
| お客様への自動返信 | `reservation@gensuirou.com`（表示名 源翠瓏） | 旅館の実アドレス |

`from` をお客様のアドレスにすると SPF/DKIM で落ちます。
`env.EMAIL.send()` の `ok` は「Cloudflare が受け取った」であって「届いた」ではない
（存在しないドメイン宛でも ok が返り、後から bounce する）ので、**送信より先に
D1 に保存**します。実装のひな型は `~/birth-moon-cf/src/mail.js`。

### Phase 6 — フォームを戻す

`git show 70174bb:index.html` からフォーム markup を復元し、
Turnstile → D1 保存 → メール送信 の順で繋ぐ。

- 保存が成功してメールが失敗したケースを、画面に正しく出し分ける。
  「送信しました」を無条件に出すのは、今回外したモックと同じ過ちです。
- 返信速度を約束する文言は入れない（`design.md` の非交渉項目）。
- `scripts/check-form-align.mjs` はフォーム状態でも電話状態でも測れるようにしてあるので、
  戻したあとそのまま走らせれば edges と centring を検証できます。

---

## 併せて片付けるもの（ドメイン移管とは独立）

現状 8 ページすべてで **canonical 0 件 / hreflang 0 件**、言語切替は `localStorage` のみで
**言語別 URL が存在しません**。3 言語ぶんの本文が 1 枚の HTML に入っていて、
表示されていない言語は CSS で隠されている状態です。このままだと EN / ZH は
検索に載りません。ドメインが確定した時点で canonical と同時に入れます。
