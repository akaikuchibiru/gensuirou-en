// ════════════════════════════════════════════════════════════════════
//  客室テレビの館内案内 (こちらで用意した代替画面)
//
//  なぜ在るか:
//    本来の館内案内は業者 (ナバック) が旧サーバの /gensuiro/ に置いており、
//    Basic 認証がかかっている。2026-08-25 の DNS 移管で、テレビが保存していた
//    資格情報が使えなくなり (http → https で生成元が変わったため)、
//    全室のテレビが **真っ黒** になった。転送をやめても、テレビ側に残った
//    301 の記憶までは消せない。資格情報が手に入るまでの間、
//    黒い画面の代わりにこの画面を出す。
//
//    Authorization が付いている要求 (スタッフの PC など) は今まで通り
//    旧サーバへ中継するので、本来の画面はそのまま見られる。
//
//  テレビ向けの決めごと:
//    - **外部読み込みゼロ**。書体も画像も QR もこの中に入っている。
//      客室のテレビは回線も描画も遅い。1 ファイルで完結させる。
//    - **oklch() を使わない**。客室テレビの WebView は古く、
//      対応していないと色が全部落ちる。16 進で書く。
//    - **webfont を使わない**。端末の書体で出す。離れて読むので
//      明朝ではなくゴシック系を先に置く。
//    - **操作を要求しない**。リモコンしか無いので、大事なことは
//      1 画面に収める (1280x720 でも 1920x1080 でも収まる)。
//    - **動かさない**。焼き付きと、遅い端末での再描画を避ける。
//    - 時刻は **worker が渡した時刻から進める**。端末の時計は狂っている
//      ことがある。
//
//  ⚠ ここに書いてよいのは旅館の既存ページに載っている事実だけ。
//    Wi-Fi のパスワード・お食事の時間・内線番号は**まだ聞けていない**ので
//    書いていない。もらったらここに足す。
// ════════════════════════════════════════════════════════════════════

const QR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" shape-rendering="crispEdges" aria-hidden="true"><rect width="25" height="25" fill="#fff"/><path d="M0 0h7v1h-7zM10 0h1v1h-1zM13 0h1v1h-1zM18 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM12 1h5v1h-5zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h2v1h-2zM12 2h1v1h-1zM15 2h2v1h-2zM18 2h1v1h-1zM20 2h3v1h-3zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h2v1h-2zM13 3h4v1h-4zM18 3h1v1h-1zM20 3h3v1h-3zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM10 4h2v1h-2zM16 4h1v1h-1zM18 4h1v1h-1zM20 4h3v1h-3zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM10 5h4v1h-4zM15 5h2v1h-2zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h7v1h-7zM8 7h1v1h-1zM12 7h1v1h-1zM14 7h1v1h-1zM16 7h1v1h-1zM0 8h1v1h-1zM2 8h5v1h-5zM13 8h2v1h-2zM18 8h5v1h-5zM1 9h2v1h-2zM4 9h2v1h-2zM7 9h3v1h-3zM11 9h1v1h-1zM13 9h1v1h-1zM16 9h1v1h-1zM19 9h1v1h-1zM23 9h1v1h-1zM3 10h2v1h-2zM6 10h2v1h-2zM9 10h3v1h-3zM13 10h3v1h-3zM17 10h5v1h-5zM23 10h2v1h-2zM1 11h1v1h-1zM5 11h1v1h-1zM8 11h4v1h-4zM14 11h1v1h-1zM17 11h3v1h-3zM24 11h1v1h-1zM1 12h6v1h-6zM9 12h1v1h-1zM11 12h1v1h-1zM13 12h6v1h-6zM20 12h1v1h-1zM22 12h3v1h-3zM0 13h2v1h-2zM3 13h1v1h-1zM7 13h2v1h-2zM12 13h2v1h-2zM16 13h1v1h-1zM19 13h1v1h-1zM21 13h1v1h-1zM23 13h1v1h-1zM0 14h1v1h-1zM2 14h1v1h-1zM4 14h1v1h-1zM6 14h1v1h-1zM8 14h1v1h-1zM10 14h1v1h-1zM14 14h4v1h-4zM19 14h3v1h-3zM23 14h2v1h-2zM0 15h1v1h-1zM3 15h2v1h-2zM7 15h1v1h-1zM10 15h1v1h-1zM12 15h1v1h-1zM14 15h2v1h-2zM19 15h2v1h-2zM24 15h1v1h-1zM0 16h1v1h-1zM3 16h2v1h-2zM6 16h3v1h-3zM10 16h1v1h-1zM12 16h2v1h-2zM16 16h5v1h-5zM22 16h1v1h-1zM8 17h1v1h-1zM10 17h1v1h-1zM13 17h1v1h-1zM15 17h2v1h-2zM20 17h2v1h-2zM0 18h7v1h-7zM9 18h1v1h-1zM11 18h4v1h-4zM16 18h1v1h-1zM18 18h1v1h-1zM20 18h1v1h-1zM22 18h3v1h-3zM0 19h1v1h-1zM6 19h1v1h-1zM8 19h2v1h-2zM11 19h1v1h-1zM14 19h1v1h-1zM16 19h1v1h-1zM20 19h2v1h-2zM0 20h1v1h-1zM2 20h3v1h-3zM6 20h1v1h-1zM8 20h1v1h-1zM11 20h1v1h-1zM15 20h6v1h-6zM22 20h3v1h-3zM0 21h1v1h-1zM2 21h3v1h-3zM6 21h1v1h-1zM8 21h3v1h-3zM12 21h2v1h-2zM17 21h2v1h-2zM20 21h5v1h-5zM0 22h1v1h-1zM2 22h3v1h-3zM6 22h1v1h-1zM8 22h2v1h-2zM13 22h2v1h-2zM17 22h1v1h-1zM21 22h2v1h-2zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM9 23h2v1h-2zM12 23h2v1h-2zM16 23h1v1h-1zM18 23h4v1h-4zM24 23h1v1h-1zM0 24h7v1h-7zM8 24h1v1h-1zM12 24h1v1h-1zM14 24h1v1h-1zM17 24h1v1h-1zM19 24h6v1h-6z" fill="#12100d"/></svg>`;

/** 客室テレビに出す 1 画面。 */
export function tvGuide() {
  // 端末の時計は当てにならないので、こちらの時刻 (日本時間) を埋めて渡す。
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const iso = now.toISOString();
  const wd = ['日', '月', '火', '水', '木', '金', '土'][now.getUTCDay()];

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>館内のご案内 ｜ 源翠瓏</title>
<style>
  :root{
    --paper:#12100d; --paper2:#1b1815; --ink:#f2ece1; --ink2:#cfc6b6;
    --gold:#d9ae5f; --rule:#3a342c;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    background:var(--paper); color:var(--ink);
    font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif;
    /* テレビは画面の端が切れることがある。安全域を取る。 */
    padding:2.6vh 3.4vw;
    display:flex; flex-direction:column; gap:1.9vh;
    -webkit-font-smoothing:antialiased;
  }
  .top{display:flex;align-items:baseline;justify-content:space-between;gap:2vw;
       border-bottom:1px solid var(--rule);padding-bottom:1.3vh}
  .brand{font-size:clamp(22px,2.7vw,46px);letter-spacing:.16em;color:var(--ink)}
  .brand small{display:block;font-size:clamp(10px,.95vw,17px);letter-spacing:.4em;color:var(--gold);margin-top:.5vh}
  .clock{font-size:clamp(20px,2.4vw,42px);color:var(--ink2);letter-spacing:.06em;white-space:nowrap}
  .clock b{color:var(--ink);font-weight:600}

  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:1.6vw;flex:1 1 auto}
  /* 注記を下端に落として、3 枚の高さの差を意図した余白に見せる */
  .card{background:var(--paper2);border:1px solid var(--rule);border-radius:.6vw;
        padding:2.0vh 1.6vw;display:flex;flex-direction:column;gap:1.2vh;justify-content:space-between}
  .card h2{font-size:clamp(17px,1.85vw,32px);color:var(--gold);letter-spacing:.1em;font-weight:600}
  .card h2 span{display:block;font-size:clamp(9px,.8vw,14px);letter-spacing:.24em;color:var(--ink2);
                font-weight:400;margin-top:.4vh}
  .row{display:flex;align-items:baseline;justify-content:space-between;gap:1vw;
       border-top:1px solid var(--rule);padding-top:1.1vh}
  .row:first-of-type{border-top:0;padding-top:0}
  .row .k{font-size:clamp(14px,1.35vw,24px);color:var(--ink2);white-space:nowrap}
  .row .v{font-size:clamp(18px,1.9vw,34px);color:var(--ink);text-align:right;font-weight:600}
  .row .v small{display:block;font-size:clamp(11px,1vw,18px);color:var(--ink2);font-weight:400;margin-top:.3vh}
  .tel{font-size:clamp(26px,3.4vw,60px);color:var(--gold);letter-spacing:.04em;font-weight:600;line-height:1.1}
  .note{font-size:clamp(11px,1.02vw,19px);color:var(--ink2);line-height:1.7}

  .strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1.6vw;
         border-top:1px solid var(--rule);padding-top:1.4vh}
  .fact .n{font-size:clamp(16px,1.7vw,30px);color:var(--ink);font-weight:600}
  .fact .l{font-size:clamp(10px,.95vw,17px);color:var(--ink2);margin-top:.4vh;line-height:1.6}

  .foot{display:flex;align-items:center;gap:1.6vw;border-top:1px solid var(--rule);padding-top:1.4vh}
  .qr{width:clamp(70px,7.6vw,132px);height:clamp(70px,7.6vw,132px);flex:0 0 auto;
      background:#fff;padding:.5vw;border-radius:.4vw}
  .qr svg{width:100%;height:100%;display:block}
  .foot .t{font-size:clamp(14px,1.45vw,26px);color:var(--ink);line-height:1.6}
  .foot .t b{color:var(--gold)}
  .foot .t span{display:block;font-size:clamp(10px,.95vw,17px);color:var(--ink2);margin-top:.6vh;letter-spacing:.04em}

  /* 縦画面のテレビ・タブレットでも読めるように畳む */
  @media (max-aspect-ratio:1/1){
    .cards{grid-template-columns:1fr}
    .strip{grid-template-columns:repeat(2,1fr)}
  }
</style>
</head>
<body>

  <div class="top">
    <div class="brand">源翠瓏<small>GENSUIROU</small></div>
    <div class="clock" id="clock" data-now="${iso}"><b>--:--</b></div>
  </div>

  <div class="cards">

    <section class="card">
      <h2>お風呂とサウナ<span>BATHS &amp; SAUNA</span></h2>
      <div class="row"><div class="k">貸切露天大浴場<br>「月光桜の湯」</div>
        <div class="v">7:30 – 21:00<small>貸切・予約優先／最終 21:00</small></div></div>
      <div class="row"><div class="k">檜のサウナ</div>
        <div class="v">1 回 40 分<small>無料</small></div></div>
      <p class="note">月光桜の湯のご利用期間は 3 月〜11 月末です。天候によりご利用いただけない場合がございます。<br>
        Private open-air bath 07:30–21:00 · Hinoki sauna 40 min, free.</p>
    </section>

    <section class="card">
      <h2>ご出発<span>CHECK-OUT</span></h2>
      <div class="row"><div class="k">チェックアウト</div><div class="v">11:00</div></div>
      <div class="row"><div class="k">ご延長</div>
        <div class="v">1 時間 ¥10,000<small>最長 13:00・予約状況によります</small></div></div>
      <p class="note">お荷物のことなど、ご遠慮なくお申しつけくださいませ。<br>
        Check-out 11:00. Late check-out ¥10,000 per hour, until 13:00.</p>
    </section>

    <section class="card">
      <h2>ご用命<span>FRONT DESK</span></h2>
      <p class="note">ご不明な点、ご要望がございましたらお電話くださいませ。</p>
      <div class="tel">096-279-1800</div>
      <p class="note">受付 10:00 – 18:00<br>
        Wi-Fi・お食事のお時間など、詳しくはフロントへお尋ねください。<br>
        Please call us for Wi-Fi, meal times and anything else.</p>
    </section>

  </div>

  <div class="strip">
    <div class="fact"><div class="n">全 12 棟</div><div class="l">すべて離れ・源泉かけ流しの<br>露天風呂付き</div></div>
    <div class="fact"><div class="n">pH 8.0</div><div class="l">阿蘇の地下 1,000m から湧く<br>アルカリ性単純温泉</div></div>
    <div class="fact"><div class="n">4,000 坪</div><div class="l">阿蘇の森に佇む<br>広大な敷地</div></div>
    <div class="fact"><div class="n">¥3,300</div><div class="l">夕食時のお飲み物の<br>お持ち込み 1 点につき</div></div>
  </div>

  <div class="foot">
    <div class="qr">${QR}</div>
    <div class="t">客室・お料理・温泉・周辺のご案内は <b>gensuirou.com</b><br>
      <span>お手元のスマートフォンで読み取っていただけます ／ Scan for rooms, cuisine, onsen and access</span></div>
  </div>

<script>
(function(){
  var el = document.getElementById('clock');
  var base = new Date(el.getAttribute('data-now')).getTime();
  var t0 = Date.now();
  var wd = ['日','月','火','水','木','金','土'];
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function tick(){
    var d = new Date(base + (Date.now() - t0));
    el.innerHTML = d.getUTCMonth() + 1 + '月' + d.getUTCDate() + '日(' + wd[d.getUTCDay()] + ') <b>'
      + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + '</b>';
  }
  tick();
  setInterval(tick, 20000);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      // 客室のテレビは一度読んだら置きっぱなしになる。長く持たせない。
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
