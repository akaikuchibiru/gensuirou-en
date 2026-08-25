-- 予約・お問い合わせの保存先。
--
-- **メールより先にここへ書く。** env.EMAIL.send() の ok は「Cloudflare が
-- 受け取った」であって「届いた」ではない (存在しないドメイン宛でも ok が返り、
-- 後から bounce する)。送信が失敗しても問い合わせが消えない形にしておく。
--
-- 集めるのは、お客様がフォームに書いた項目と国コードだけ。
-- IP と User-Agent は保存しない (bot 対策は Turnstile の仕事で、
-- 保存しても使い道が無いのに漏えい時の被害だけ増える)。
CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,          -- ISO8601 UTC
  lang        TEXT NOT NULL,          -- 送信時の表示言語。返信の言語を間違えないため
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  country     TEXT,                   -- お客様が書いた国／地域
  checkin     TEXT,
  nights      TEXT,
  guests      TEXT,
  villa       TEXT,                   -- 希望の客室 (slug)
  message     TEXT,
  cf_country  TEXT,                   -- 接続元の国コード。海外からの比率を見るため
  mail_status TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | disabled
  mail_error  TEXT
);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_email   ON enquiries(email, created_at DESC);
