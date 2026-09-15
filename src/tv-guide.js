// ════════════════════════════════════════════════════════════════════
//  客室テレビの館内案内 (こちらで用意した画面)
//
//  なぜ在るか:
//    本来の館内案内は業者 (ナバック) が旧サーバの /gensuiro/ に置いており、
//    Basic 認証がかかっている。2026-08-25 の DNS 移管でテレビの保存済み
//    資格情報が使えなくなり (http → https で生成元が変わった)、全室の
//    テレビが真っ黒になった。資格情報が手に入るまでこの画面を出す。
//    Authorization を持つ要求 (スタッフの PC) は旧サーバの本物へ中継される。
//
//  テレビ向けの決めごと:
//    - 読み込みは **同じオリジンだけ** (写真・ロゴ・書体・QR)。外部ホスト 0。
//    - 書体はサイトと同じ明朝の部分集合 (font-display:swap)。読めない端末は
//      端末のゴシックで出る — 崩れない。
//    - **古い WebView を想定した防御**: font-size は px を書いてから clamp で
//      上書き / flex の gap は使わない (margin で組む) / URLSearchParams は
//      使わない / oklch は使わない / JS は var と function だけ。
//    - **操作を要求しない**。1280x720 でも 1920x1080 でも 1 画面に収まる。
//    - 背景は旅館の写真 10 枚。昼 (JST 5〜17 時) は明るい 5 枚、夜は暗い 5 枚を
//      45 秒ごとにフェードで入れ替える (起動メニューが明るい昼写真なので、
//      来た直後の明→暗の落差をなくす)。次の 1 枚を
//      読み終えてから切り替える (遅い回線で白抜けしない)。読めなければ飛ばす。
//      静止画の据え置きより焼き付きに優しく、3 分ごとの 2px ドリフトも入れる。
//    - 時刻は worker が渡した日本時間から進める (端末の時計は狂っていることが
//      ある)。分表示なので 5 秒ごとに見直し、画面復帰でも直す。
//    - **毎日 04:30 (日本時間) に自分で読み直す**。fetch が 200 のときだけ
//      reload するので、ネットが落ちていても白画面にはならない。これで
//      こちらの更新 (Wi-Fi 情報の追記など) が翌朝には全テレビに届く。
//    - `?bg=N` で背景を固定できる (検査と、旅館さんのプレビュー用)。
//      固定中はローテとドリフトを止め、画素が決定的になる。
//
//  ⚠ ここに書いてよいのは旅館の既存ページに載っている事実だけ。
//    Wi-Fi・お食事の時間・内線番号は **まだ聞けていない** ので書いていない。
//    もらったらここに足す (翌朝 04:30 に全テレビへ自動反映)。
// ════════════════════════════════════════════════════════════════════

const QR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" shape-rendering="crispEdges" aria-hidden="true"><rect width="25" height="25" fill="#fff"/><path d="M0 0h7v1h-7zM10 0h1v1h-1zM13 0h1v1h-1zM18 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM12 1h5v1h-5zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h2v1h-2zM12 2h1v1h-1zM15 2h2v1h-2zM18 2h1v1h-1zM20 2h3v1h-3zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h2v1h-2zM13 3h4v1h-4zM18 3h1v1h-1zM20 3h3v1h-3zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM10 4h2v1h-2zM16 4h1v1h-1zM18 4h1v1h-1zM20 4h3v1h-3zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM10 5h4v1h-4zM15 5h2v1h-2zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h7v1h-7zM8 7h1v1h-1zM12 7h1v1h-1zM14 7h1v1h-1zM16 7h1v1h-1zM0 8h1v1h-1zM2 8h5v1h-5zM13 8h2v1h-2zM18 8h5v1h-5zM1 9h2v1h-2zM4 9h2v1h-2zM7 9h3v1h-3zM11 9h1v1h-1zM13 9h1v1h-1zM16 9h1v1h-1zM19 9h1v1h-1zM23 9h1v1h-1zM3 10h2v1h-2zM6 10h2v1h-2zM9 10h3v1h-3zM13 10h3v1h-3zM17 10h5v1h-5zM23 10h2v1h-2zM1 11h1v1h-1zM5 11h1v1h-1zM8 11h4v1h-4zM14 11h1v1h-1zM17 11h3v1h-3zM24 11h1v1h-1zM1 12h6v1h-6zM9 12h1v1h-1zM11 12h1v1h-1zM13 12h6v1h-6zM20 12h1v1h-1zM22 12h3v1h-3zM0 13h2v1h-2zM3 13h1v1h-1zM7 13h2v1h-2zM12 13h2v1h-2zM16 13h1v1h-1zM19 13h1v1h-1zM21 13h1v1h-1zM23 13h1v1h-1zM0 14h1v1h-1zM2 14h1v1h-1zM4 14h1v1h-1zM6 14h1v1h-1zM8 14h1v1h-1zM10 14h1v1h-1zM14 14h4v1h-4zM19 14h3v1h-3zM23 14h2v1h-2zM0 15h1v1h-1zM3 15h2v1h-2zM7 15h1v1h-1zM10 15h1v1h-1zM12 15h1v1h-1zM14 15h2v1h-2zM19 15h2v1h-2zM24 15h1v1h-1zM0 16h1v1h-1zM3 16h2v1h-2zM6 16h3v1h-3zM10 16h1v1h-1zM12 16h2v1h-2zM16 16h5v1h-5zM22 16h1v1h-1zM8 17h1v1h-1zM10 17h1v1h-1zM13 17h1v1h-1zM15 17h2v1h-2zM20 17h2v1h-2zM0 18h7v1h-7zM9 18h1v1h-1zM11 18h4v1h-4zM16 18h1v1h-1zM18 18h1v1h-1zM20 18h1v1h-1zM22 18h3v1h-3zM0 19h1v1h-1zM6 19h1v1h-1zM8 19h2v1h-2zM11 19h1v1h-1zM14 19h1v1h-1zM16 19h1v1h-1zM20 19h2v1h-2zM0 20h1v1h-1zM2 20h3v1h-3zM6 20h1v1h-1zM8 20h1v1h-1zM11 20h1v1h-1zM15 20h6v1h-6zM22 20h3v1h-3zM0 21h1v1h-1zM2 21h3v1h-3zM6 21h1v1h-1zM8 21h3v1h-3zM12 21h2v1h-2zM17 21h2v1h-2zM20 21h5v1h-5zM0 22h1v1h-1zM2 22h3v1h-3zM6 22h1v1h-1zM8 22h2v1h-2zM13 22h2v1h-2zM17 22h1v1h-1zM21 22h2v1h-2zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM9 23h2v1h-2zM12 23h2v1h-2zM16 23h1v1h-1zM18 23h4v1h-4zM24 23h1v1h-1zM0 24h7v1h-7zM8 24h1v1h-1zM12 24h1v1h-1zM14 24h1v1h-1zM17 24h1v1h-1zM19 24h6v1h-6z" fill="#12100d"/></svg>`;

// 背景。旅館の実写真。worker が Accept を見て webp に出し分けるので、
// 古い端末には JPEG が返る。
//
// 2026-09-06: 昼 (JST 5〜17 時、挨拶と同じ境界) は明るい写真、それ以外は
// 夜の写真を出す。テレビの起動メニュー (ナバック) が明るい昼の写真なので、
// そこからこの画面に来たときの明→暗の落差をなくすため。夜は従来どおり。
// 0〜5 は旧トップの回転画像 (1080x570)、6〜9 は旧モバイルのギャラリーと
// 温泉ページから (980x980 / 1080x570)。?bg=N はこの並びの通し番号。
const PHOTOS = [
  '/assets/imgs_1080_570/01.jpg',   // 0 夕の門
  '/assets/imgs_1080_570/05.jpg',   // 1 夜の湯屋
  '/assets/imgs_1080_570/02.jpg',   // 2 門の回廊
  '/assets/imgs_1080_570/04.jpg',   // 3 昼の露天
  '/assets/imgs_1080_570/06.jpg',   // 4 華の湯
  '/assets/imgs_1080_570/03.jpg',   // 5 灯籠の参道
  '/assets/tv_bg/day_gate.jpg',     // 6 門と阿蘇の緑
  '/assets/tv_bg/day_forest.jpg',   // 7 新緑の窓
  '/assets/tv_bg/day_hana.jpg',     // 8 華の湯 (昼)
  '/assets/tv_bg/day_rockbath.jpg', // 9 岩の露天 (昼)
];
// ローテはこの 2 組から時間帯で選ぶ。組替えは 45 秒周期の次の入れ替わりで
// 自然に混ざる (急に切り替えない)。
const DAY_SET = [3, 6, 7, 8, 9];
const NIGHT_SET = [0, 1, 2, 4, 5];
const LOGO = '/assets/imgs/logo_gensuirou.png';

/** 客室テレビに出す 1 画面。日英併記。 */
export function tvGuide() {
  // 端末の時計は当てにならないので、こちらの時刻 (日本時間) を埋めて渡す。
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const h = now.getUTCHours();
  const greet = h >= 5 && h < 11 ? ['おはようございます', 'Good morning']
    : h >= 11 && h < 17 ? ['こんにちは', 'Good afternoon']
    : ['こんばんは', 'Good evening'];

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>館内のご案内 ｜ 源翠瓏</title>
<style>
  /* サイトと同じ書体の部分集合。読めない端末はゴシックで出る (swap)。 */
  @font-face{font-family:'Sawarabi Mincho';src:url('/assets/fonts/gensuirou-ja.woff2') format('woff2');
    font-weight:400;font-style:normal;font-display:swap}
  @font-face{font-family:'Gensuirou Kanji Extra';src:url('/assets/fonts/gensuirou-ja-extra.woff2') format('woff2');
    font-weight:400;font-style:normal;font-display:swap}
  :root{
    --paper:#0b0908; --ink:#f5efe4; --ink2:#cfc6b5; --ink3:#a89d8a;
    --gold:#dcb264; --rule:rgba(220,178,100,.30);
    --serif:'Sawarabi Mincho','Gensuirou Kanji Extra','Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif;
    --gothic:'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP','Yu Gothic',Meiryo,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{background:var(--paper);color:var(--ink);font-family:var(--gothic);
       -webkit-font-smoothing:antialiased;overflow:hidden}

  /* 背景の写真 2 層。読み終えてから opacity で入れ替える。 */
  .bg{position:fixed;top:0;right:0;bottom:0;left:0;z-index:0;
      background-position:center;background-size:cover;background-repeat:no-repeat;
      opacity:0;transition:opacity 2.8s ease}
  /* 写真がゆっくり寄る (40 秒で 5%、往復)。2 層で位相をずらすので、
     入れ替わるたびに違う寄り方に見える。?bg=N 固定 (検査・プレビュー) では
     body.pin が付き、画素が決定的になるよう止める。 */
  @keyframes kb{from{transform:scale(1)}to{transform:scale(1.05)}}
  body:not(.pin) .bg{animation:kb 40s ease-in-out alternate infinite}
  body:not(.pin) #bgB{animation-delay:-20s}
  /* 幕。上下の帯に文字が載るので濃く、中央は写真を見せる。 */
  .veil{position:fixed;top:0;right:0;bottom:0;left:0;z-index:1;background:
    linear-gradient(180deg, rgba(8,7,6,.94) 0%, rgba(8,7,6,.52) 15%, rgba(8,7,6,0) 30%),
    linear-gradient(0deg, rgba(8,7,6,.96) 0%, rgba(8,7,6,.84) 22%, rgba(8,7,6,0) 44%),
    /* 斜めの幕は薄めに。文字は帯とカード (rgba .84) の上にしか載らないので、
       ここを濃くしても可読性は上がらず、昼の写真が夜に見えるだけ (2026-09-06)。 */
    linear-gradient(100deg, rgba(8,7,6,.34) 0%, rgba(8,7,6,.14) 52%, rgba(8,7,6,.04) 100%)}

  .wrap{position:relative;z-index:2;height:100%;padding:2.6vh 3.2vw;
        display:flex;flex-direction:column;transition:transform 2s ease}

  /* ── 上帯: ロゴ / 見出し / 時刻と挨拶 ── */
  .top{display:flex;align-items:center;justify-content:space-between;
       border-bottom:1px solid var(--rule);padding-bottom:1.4vh}
  .id{display:flex;align-items:center;min-width:0}
  .id img{height:44px;height:clamp(30px,4.4vh,64px);width:auto;display:block;margin-right:1.4vw}
  .id .t{border-left:1px solid var(--rule);padding-left:1.4vw}
  .id .t b{display:block;font-family:var(--serif);font-weight:400;color:var(--ink);
           letter-spacing:.14em;font-size:20px;font-size:clamp(16px,1.7vw,30px)}
  .id .t span{display:block;letter-spacing:.32em;color:var(--gold);margin-top:.5vh;
              font-size:11px;font-size:clamp(9px,.8vw,14px)}
  .tr{text-align:right;white-space:nowrap}
  .clock{color:var(--ink2);letter-spacing:.05em;font-size:26px;font-size:clamp(19px,2.2vw,38px)}
  .clock b{color:var(--ink);font-weight:600}
  .greet{color:var(--gold);margin-top:.5vh;letter-spacing:.1em;
         font-family:var(--serif);font-size:14px;font-size:clamp(11px,1.15vw,21px)}
  .greet span{color:var(--ink3);letter-spacing:.05em}

  /* ── 札 ── */
  .cards{display:grid;grid-template-columns:repeat(3,1fr);grid-gap:1.5vw;gap:1.5vw;
         align-items:start;margin-top:2vh}
  .card{background:rgba(9,8,7,.84);border:1px solid var(--rule);border-radius:.5vw;
        padding:2vh 1.5vw}
  .card h2{font-family:var(--serif);font-weight:400;color:var(--gold);letter-spacing:.1em;
           line-height:1.25;border-left:2px solid var(--gold);padding-left:.9vw;
           font-size:21px;font-size:clamp(17px,1.8vw,31px)}
  .card h2 span{display:block;font-family:var(--gothic);letter-spacing:.26em;color:var(--ink3);
                margin-top:.5vh;font-size:11px;font-size:clamp(9px,.78vw,14px)}
  .row{display:flex;align-items:baseline;justify-content:space-between;
       border-top:1px solid rgba(220,178,100,.16);padding-top:1.1vh;margin-top:1.1vh}
  .row .k{color:var(--ink2);line-height:1.5;padding-right:.8vw;
          font-size:16px;font-size:clamp(13px,1.28vw,23px)}
  .row .k span{display:block;color:var(--ink3);letter-spacing:.08em;margin-top:.25vh;
               font-size:11px;font-size:clamp(9px,.76vw,14px)}
  .row .v{font-family:var(--serif);color:var(--ink);text-align:right;white-space:nowrap;
          line-height:1.25;font-size:23px;font-size:clamp(18px,1.9vw,34px)}
  .row .v span{display:block;font-family:var(--gothic);color:var(--ink3);white-space:normal;
               margin-top:.35vh;font-size:12px;font-size:clamp(10px,.88vw,16px)}
  .tel{font-family:var(--serif);color:var(--gold);letter-spacing:.02em;white-space:nowrap;
       margin-top:1vh;line-height:1.1;font-size:33px;font-size:clamp(24px,2.8vw,50px)}
  .note{color:var(--ink3);line-height:1.7;margin-top:1.2vh;
        font-size:12px;font-size:clamp(10px,.95vw,17px)}
  .note em{display:block;font-style:normal;opacity:.88}

  /* ── 下帯: 数字 / QR ── */
  .strip{display:grid;grid-template-columns:repeat(4,1fr);grid-gap:1.5vw;gap:1.5vw;
         border-top:1px solid var(--rule);padding-top:1.4vh;margin-top:auto}
  .fact .n{font-family:var(--serif);color:var(--ink);white-space:nowrap;
           font-size:20px;font-size:clamp(16px,1.7vw,30px)}
  .fact .n em{font-style:normal;font-family:var(--gothic);color:var(--ink3);
              font-size:.58em;margin-left:.5em;letter-spacing:.12em}
  .fact .l{color:#b7ad9b;margin-top:.4vh;line-height:1.55;
           font-size:11px;font-size:clamp(9px,.86vw,15px)}
  .foot{display:flex;align-items:center;border-top:1px solid var(--rule);
        padding-top:1.4vh;margin-top:1.4vh}
  .qr{width:88px;width:clamp(64px,7vw,120px);height:88px;height:clamp(64px,7vw,120px);
      flex:0 0 auto;background:#fff;padding:.45vw;border-radius:.35vw;margin-right:1.5vw}
  .qr svg{width:100%;height:100%;display:block}
  .foot .t{color:var(--ink);line-height:1.55;font-size:17px;font-size:clamp(13px,1.35vw,24px)}
  .foot .t b{font-family:var(--serif);font-weight:400;color:var(--gold);letter-spacing:.03em}
  .foot .t span{display:block;color:var(--ink3);margin-top:.5vh;letter-spacing:.03em;
                font-size:12px;font-size:clamp(9px,.86vw,16px)}

  @media (max-aspect-ratio:1/1){
    body{overflow:auto}
    .cards{grid-template-columns:1fr}
    .strip{grid-template-columns:repeat(2,1fr)}
    .tr{display:none}
  }
</style>
</head>
<body>
<div class="bg" id="bgA"></div>
<div class="bg" id="bgB"></div>
<div class="veil"></div>
<div class="wrap" id="wrap">

  <div class="top">
    <div class="id">
      <img src="${LOGO}" alt="阿蘇旅館 源翠瓏 RYOKAN GENSUIROU">
      <div class="t"><b>館内のご案内</b><span>IN-ROOM GUIDE</span></div>
    </div>
    <div class="tr">
      <div class="clock" id="clock" data-now="${now.toISOString()}"><b>--:--</b></div>
      <div class="greet" id="greet">${greet[0]}<span> — ${greet[1]}</span></div>
    </div>
  </div>

  <div class="cards">

    <section class="card">
      <h2>お風呂とサウナ<span>BATHS &amp; SAUNA</span></h2>
      <div class="row">
        <div class="k">サウナ付き<br>貸切露天風呂<span>PRIVATE OPEN-AIR BATH WITH SAUNA</span></div>
        <div class="v">15:30 – 21:00<span>1 回 40 分・予約優先／最終案内 21:00<br>40 min per session / last entry 21:00</span></div>
      </div>
      <p class="note">貸切露天岩風呂「月光桜の湯」のご利用期間は 3 月〜11 月末です。天候によりご利用いただけない場合がございます。
        <em>The open-air rock bath is available March to late November.</em></p>
    </section>

    <section class="card">
      <h2>ご出発<span>DEPARTURE</span></h2>
      <div class="row">
        <div class="k">チェックアウト<span>CHECK-OUT</span></div>
        <div class="v">11:00</div>
      </div>
      <div class="row">
        <div class="k">ご延長<span>LATE CHECK-OUT</span></div>
        <div class="v">1 時間 ¥10,000<span>最長 13:00・予約状況によります<br>Per hour, until 13:00</span></div>
      </div>
      <p class="note">お荷物のことなど、ご遠慮なくお申しつけくださいませ。
        <em>Please let us know if we can help with your luggage.</em></p>
    </section>

    <section class="card">
      <h2>ご用命<span>FRONT DESK</span></h2>
      <p class="note" style="margin-top:1.1vh">ご不明な点、ご要望がございましたらお電話くださいませ。
        <em>Please call us for anything you need.</em></p>
      <div class="tel">096-279-1800</div>
      <p class="note">受付 10:00 – 18:00 ／ Reception 10:00 – 18:00<br>
        Wi-Fi・お食事のお時間はフロントへお尋ねください。
        <em>Please ask us for Wi-Fi and meal times.</em></p>
    </section>

  </div>

  <div class="strip">
    <div class="fact"><div class="n">全 12 棟<em>12 VILLAS</em></div>
      <div class="l">すべて離れ・源泉かけ流しの露天風呂付き<br>All detached, each with its own bath</div></div>
    <div class="fact"><div class="n">pH 8.0<em>ALKALINE</em></div>
      <div class="l">阿蘇の地下 1,000m から湧く天然温泉<br>Spring drawn from 1,000 m below Aso</div></div>
    <div class="fact"><div class="n">4,000 坪<em>13,000 m²</em></div>
      <div class="l">阿蘇の森に佇む広大な敷地<br>An estate in the Aso forest</div></div>
    <div class="fact"><div class="n">¥3,300<em>CORKAGE</em></div>
      <div class="l">夕食時のお飲み物のお持ち込み 1 点につき<br>Per bottle brought to dinner</div></div>
  </div>

  <div class="foot">
    <div class="qr">${QR}</div>
    <div class="t">客室・お料理・温泉・周辺のご案内は <b>gensuirou.com</b><br>
      <span>お手元のスマートフォンで読み取っていただけます ／ Scan for rooms, cuisine, onsen and access</span></div>
  </div>

</div>
<script>
(function(){
  'use strict';
  var PHOTOS = ${JSON.stringify(PHOTOS)};
  var DAY_SET = ${JSON.stringify(DAY_SET)};
  var NIGHT_SET = ${JSON.stringify(NIGHT_SET)};
  var pin = (location.search.match(/[?&]bg=(\\d+)/) || [])[1];

  // ── 時計と挨拶。worker が渡した日本時間から進める ──
  var clock = document.getElementById('clock');
  var greet = document.getElementById('greet');
  var base = new Date(clock.getAttribute('data-now')).getTime();
  var t0 = Date.now();
  var wd = ['日','月','火','水','木','金','土'];
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function jst(){ return new Date(base + (Date.now() - t0)); }
  function tick(){
    var d = jst();
    clock.innerHTML = (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日(' + wd[d.getUTCDay()] + ') '
      + '<b>' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + '</b>';
    var h = d.getUTCHours();
    var g = (h >= 5 && h < 11) ? ['おはようございます','Good morning']
          : (h >= 11 && h < 17) ? ['こんにちは','Good afternoon']
          : ['こんばんは','Good evening'];
    greet.innerHTML = g[0] + '<span>\\u2009\\u2014\\u2009' + g[1] + '</span>';
  }
  tick();
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);

  // ── 背景。読み終えてから入れ替える。?bg=N で固定 ──
  var A = document.getElementById('bgA'), B = document.getElementById('bgB');
  var cur = 0, front = A;
  function load(el, src, done){
    var im = new Image();
    im.onload = function(){ el.style.backgroundImage = 'url("' + src + '")'; done(false); };
    im.onerror = function(){ done(true); };
    im.src = src;
  }
  function mark(i){ document.body.setAttribute('data-bg', String(i)); document.body.setAttribute('data-ready', '1'); }
  if (pin !== undefined) {
    document.body.className += ' pin';
    var i = Math.min(parseInt(pin, 10) || 0, PHOTOS.length - 1);
    A.style.transition = 'none';
    load(A, PHOTOS[i], function(err){ if (!err) A.style.opacity = 1; mark(i); });
  } else {
    // 時間帯で組を選ぶ (挨拶と同じ境界)。境界をまたいだら次の入れ替わりで
    // 新しい組に移る。
    function activeSet(){
      var h = jst().getUTCHours();
      return (h >= 5 && h < 17) ? DAY_SET : NIGHT_SET;
    }
    var set = activeSet();
    load(A, PHOTOS[set[0]], function(err){ if (!err) A.style.opacity = 1; mark(set[0]); });
    setInterval(function(){
      var s = activeSet();
      if (s !== set) { set = s; cur = 0; } else { cur = (cur + 1) % set.length; }
      var next = set[cur];
      var back = (front === A) ? B : A;
      load(back, PHOTOS[next], function(err){
        if (err) return;                           // 読めない写真は飛ばす (次の周期で先へ)
        back.style.opacity = 1;
        front.style.opacity = 0;
        front = back; mark(next);
      });
    }, 45000);

    // ── 焼き付き対策。3 分ごとに 2px だけ動かす (気付かれない) ──
    var wrap = document.getElementById('wrap');
    var step = 0, PT = [[0,0],[1,1],[2,0],[1,2]];
    setInterval(function(){
      step = (step + 1) % PT.length;
      wrap.style.transform = 'translate(' + PT[step][0] + 'px,' + PT[step][1] + 'px)';
    }, 180000);
  }

  // ── 毎日 04:30 (日本時間) に読み直す。取得できたときだけ reload ──
  // これで、こちらの更新 (Wi-Fi 情報の追記など) が翌朝には全テレビに届く。
  if (typeof fetch === 'function') {
    var reloaded = false;
    setInterval(function(){
      var d = jst();
      if (d.getUTCHours() === 4 && d.getUTCMinutes() >= 30 && !reloaded) {
        reloaded = true;
        fetch(location.pathname, { cache: 'no-store' })
          .then(function(r){ if (r.ok) location.reload(); })
          .catch(function(){ reloaded = false; });   // ネット断なら次の周期でまた試す
      }
    }, 300000);
  }
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      // 一度読んだら置きっぱなしになる。長く持たせない。
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
