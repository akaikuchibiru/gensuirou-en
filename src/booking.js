// 予約エンジンの URL は 1 か所にだけ持つ。
//
// 2026-08-24 の移行でここへの導線が消え、お客さまが料金も空室も見られない
// 状態を 4 日間つくった。サイト側 (public/reservation.html など) と
// 構造化データ (src/schema.js の ReserveAction) が同じ値を指していることを
// scripts/check-booking-route.mjs が確かめる。
export const BOOKING_URL = 'https://sec.489.jp/rg2/2316/reserve/plan?op_id=1&adult=2';
