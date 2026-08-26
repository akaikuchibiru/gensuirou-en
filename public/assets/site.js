// ============================================================
// Gensuirou · shared JS (i18n + header/footer + gallery + form)
// Chrome archetypes: N9 edge-aligned-minimal nav · Ft1 mast-headed footer
// ============================================================

// 言語は **URL が正**。/ が ja、/en/… が en、/zh/… が zh。
// サーバ側 (src/i18n.js) が html[lang] を立てて他言語の span を落として返すので、
// ここでは決め直さず、その値を読むだけにする。
//
// 以前は localStorage だけで持っていた。それだと共有された URL が相手の言語で
// 開かず、検索エンジンから見ると言語別のページが存在しないことになる。
// localStorage には戻さない (URL と食い違う状態を作らないため)。
var GS_LABEL = { ja: '日本語', en: 'EN', zh: '中文' };
var GS_ORDER = ['ja', 'en', 'zh'];
var GS = { lang: document.documentElement.getAttribute('lang') || 'ja' };
GS.prefix = GS.lang === 'ja' ? '' : '/' + GS.lang;

// クリーンパス → いまの言語での URL。'/' のときだけ接頭辞だけを返す。
function gsHref(path){
  return (GS.prefix + (path === '/' ? '' : path)) || '/';
}
// いまのページの、別言語版の URL。
function gsLangHref(l){
  var rest = location.pathname.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
  var p = (l === 'ja' ? '' : '/' + l) + (rest === '/' ? '' : rest);
  return (p || '/') + location.search + location.hash;
}

// ---- shared header/footer injection ----
(function(){
  // かつて data-base で相対パスの起点を渡していたが廃止した。
  // 付け忘れたページで静かに壊れるうえ、言語接頭辞と二重管理になる。
  // リンクは gsHref()、アセットはルート絶対で統一する。

  // The eight destinations. One list, used by both the index panel and the
  // footer mast — so a new page can never appear in one and not the other.
  var DESTS = [
    ['/rooms',      'rooms',      'Rooms',      '客房',     '客室'],
    ['/cuisine',    'cuisine',    'Cuisine',    '料理',     '料理'],
    ['/onsen',      'onsen',      'Onsen',      '温泉',     '温泉'],
    ['/facilities', 'facilities', 'Facilities', '设施',     '施設'],
    ['/access',     'access',     'Access',     '交通',     'アクセス'],
    ['/faq',        'faq',        'Questions',  '常见问题', 'よくある質問'],
    ['/wedding',    'wedding',    'Wedding',    '婚礼',     '結婚式'],
    ['/journal',    'journal',    'Journal',    '读物',     '読み物'],
    ['/',           'home',       'Home',       '首页',     'ホーム']
  ];

  function isCurrent(key){
    return (document.body ? document.body.dataset.page : '') === key;
  }
  function langSpans(en, zh, ja){
    return '<span data-en>'+en+'</span><span data-zh>'+zh+'</span><span data-ja>'+ja+'</span>';
  }
  function link(d, extraAttr){
    var cur = isCurrent(d[1]) ? ' aria-current="page"' : '';
    return '<a href="'+gsHref(d[0])+'"'+cur+(extraAttr||'')+'>'+langSpans(d[2], d[3], d[4])+'</a>';
  }

  function langSwitcher(id){
    // button ではなく a。押しても URL が変わらないと、その言語のページを
    // 共有もブックマークもできず、検索エンジンからも到達できない。
    var items = GS_ORDER.map(function(l){
      var on = l === GS.lang;
      return '<a href="'+gsLangHref(l)+'" hreflang="'+l+'" lang="'+l+'" data-lang="'+l+'"'+
             (on ? ' class="active" aria-current="true"' : '')+'>'+GS_LABEL[l]+'</a>';
    }).join('');
    return '<div class="langs"'+(id ? ' id="'+id+'"' : '')+' role="group" aria-label="Language">'+items+'</div>';
  }

  window._gsHeader = function(){
    var items = DESTS.map(function(d, i){
      var n = String(i + 1).padStart(2, '0');
      var cur = isCurrent(d[1]) ? ' aria-current="page"' : '';
      return '<li><a href="'+gsHref(d[0])+'"'+cur+'>'+
               '<span class="idx">'+n+'</span>'+
               '<span>'+langSpans(d[2], d[3], d[4])+'</span>'+
             '</a></li>';
    }).join('');

    return ''+
    '<a class="skip" href="#main"><span data-en>Skip to content</span><span data-zh>跳至正文</span><span data-ja>本文へ</span></a>'+
    '<header class="nav"><div class="nav-inner">'+
      '<a class="brand" href="'+gsHref('/')+'">'+
        // ロゴ画像は 430x80 の組みロゴで、すでに「源翠瓏 -RYOKAN GENSUIROU-」まで
        // 入っている。横に文字の wordmark を並べると **ロゴが 2 つ** 見える。
        // 画像が出ている幅では画像だけ、画像を隠す狭い幅でだけ .txt を出す (site.css)。
        '<img src="/assets/imgs/logo_gensuirou.png" alt="源翠瓏 Gensuirou" width="200" height="88">'+
        // 狭い幅の代替。旅館の名前は漢字が主、ラテンは従。
        '<span class="txt" aria-hidden="true">源翠瓏<small>GENSUIROU</small></span>'+
      '</a>'+
      '<div class="nav-right">'+
        langSwitcher('langSwitcher')+
        '<a class="reserve-btn" href="'+gsHref('/')+'#reserve">'+langSpans('Reserve','预约','ご予約')+'</a>'+
        '<button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="navIndex">'+
          '<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>'+
          langSpans('Menu','目录','目次')+
        '</button>'+
      '</div>'+
    '</div></header>'+
    '<div class="nav-index" id="navIndex" data-open="false" role="dialog" aria-modal="true" aria-label="Site index">'+
      '<ol>'+items+'</ol>'+
      langSwitcher()+
    '</div>';
  };

  window._gsFooter = function(){
    // ホーム以外の全部。件数を直書きすると行き先を足したとき片方だけ増える。
    var fmenu = DESTS.slice(0, -1).map(function(d){ return link(d); }).join('');
    return ''+
    '<footer>'+
      '<div class="foot-mast">'+
        '<div>'+
          '<div class="foot-logo"><img src="/assets/imgs/logo_gensuirou.png" alt="源翠瓏" width="240" height="106" loading="lazy"></div>'+
          '<address class="addr">'+
            '<span data-en>2113-3 Komori, Nishihara-mura, Aso-gun, Kumamoto 861-2402, Japan</span>'+
            '<span data-zh>日本国 熊本县 阿苏郡 西原村 小森 2113-3（〒861-2402）</span>'+
            '<span data-ja>〒861-2402　熊本県阿蘇郡西原村小森 2113-3</span>'+
            '<br>TEL <a href="tel:+81962791800">+81 (0)96-279-1800</a> · 10:00–18:00 JST'+
          '</address>'+
        '</div>'+
        '<div>'+
          '<nav class="fmenu" aria-label="Footer">'+fmenu+'</nav>'+
          '<div class="socials">'+
            '<a href="https://www.instagram.com/ryokan_gensuirou/" rel="noopener">Instagram</a>'+
            '<a href="https://www.youtube.com/@GensuirouWeb/" rel="noopener">YouTube</a>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="fine">© Gensuirou · 源翠瓏 · Aso, Kumamoto, Japan — English / 中文 / 日本語</div>'+
    '</footer>';
  };

  function injectChrome(){
    var h = document.getElementById('siteHeader');
    var f = document.getElementById('siteFooter');
    if(h) h.outerHTML = window._gsHeader();
    if(f) f.outerHTML = window._gsFooter();
    // かつてここで _gsSetLang() を呼んで切替ボタンの active を同期していた。
    // 切替はリンクになり active は生成時に焼き込むので不要。
    // (関数を消したのに呼び出しが残り、全ページで ReferenceError が出ていた)
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectChrome);
  } else {
    injectChrome();
  }
})();

// 言語切替の click ハンドラは廃止。リンクなのでそのまま遷移させる。
// preventDefault して localStorage を書き換えるだけだと、URL が変わらないので
// 共有された先が常に相手の既定言語で開いてしまう。

// ---- site index disclosure (N9's single middle element) ----
(function(){
  function panel(){ return document.getElementById('navIndex'); }
  function toggleBtn(){ return document.getElementById('navToggle'); }

  function setOpen(open){
    var p = panel(), b = toggleBtn();
    if(!p || !b) return;
    p.dataset.open = open ? 'true' : 'false';
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.dataset.navOpen = open ? 'true' : 'false';
    if(open){
      var first = p.querySelector('a');
      if(first) first.focus({ preventScroll: true });
    } else {
      b.focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('#navToggle')){
      e.preventDefault();
      setOpen(panel() && panel().dataset.open !== 'true');
      return;
    }
    // A link inside the panel navigates — close first so the state is clean
    if(e.target.closest('#navIndex a')) setOpen(false);
  });

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    if(panel() && panel().dataset.open === 'true') setOpen(false);
  });
})();

// ---- one quiet settle on first view ----
document.addEventListener('DOMContentLoaded', function(){
  var els = document.querySelectorAll('.anim');
  if(!('IntersectionObserver' in window)){ els.forEach(function(el){el.classList.add('on');}); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('on'); io.unobserve(en.target); } });
  }, {threshold:.12});
  els.forEach(function(el){ io.observe(el); });
});

// ---- thumbnail gallery: swap main image ----
document.addEventListener('click', function(e){
  var t = e.target.closest('.thumbs a[data-full]');
  if(t){ e.preventDefault(); var main = document.getElementById('mainImg'); if(main) main.src = t.dataset.full; }
});

// ---- ライトボックス ----
//
// 客室によっては写真が 12 枚ある。1 枚開いて閉じるだけだと、
// 全部見るのに 12 回 開閉することになる。同じギャラリーの中を
// 送れるようにして、キーボードでも操作できるようにする。
//
// 動きは opacity のフェードだけ。design.md のモーション 3 原則を増やさない。
// prefers-reduced-motion では全部畳まれる (共通ルール側で処理)。
(function(){
  var lb = document.createElement('div');
  var lastFocus = null, items = [], idx = 0;

  lb.className = 'lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.hidden = true;
  lb.innerHTML =
    '<button type="button" class="lb-close" aria-label="閉じる Close">×</button>' +
    '<button type="button" class="lb-nav lb-prev" aria-label="前の写真 Previous">‹</button>' +
    '<figure class="lb-fig"><img alt=""><figcaption class="lb-count"></figcaption></figure>' +
    '<button type="button" class="lb-nav lb-next" aria-label="次の写真 Next">›</button>';

  function attach(){ document.body.appendChild(lb); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();

  var img = function(){ return lb.querySelector('img'); };

  function show(i){
    if(!items.length) return;
    idx = (i + items.length) % items.length;          // 端で止めず一巡させる
    var src = items[idx].dataset.full || items[idx].querySelector('img').src;
    img().src = src;
    img().alt = items[idx].querySelector('img') ? items[idx].querySelector('img').alt : '';
    lb.querySelector('.lb-count').textContent = (idx + 1) + ' / ' + items.length;
    var many = items.length > 1;
    lb.querySelector('.lb-prev').hidden = !many;
    lb.querySelector('.lb-next').hidden = !many;
  }

  function open(a){
    var box = a.closest('.gallery, .thumbs') || document;
    items = [].slice.call(box.querySelectorAll('a[data-full]'));
    if(items.indexOf(a) < 0) items = [a];
    lastFocus = a;
    lb.hidden = false;
    lb.classList.add('on');
    // 背面のスクロールを止める。⚠ body ではなく html に付ける
    // (body に付けると sticky なヘッダが横にずれる)。
    document.documentElement.classList.add('lb-open');
    show(items.indexOf(a));
    lb.querySelector('.lb-close').focus({ preventScroll: true });
  }

  function close(){
    lb.classList.remove('on');
    lb.hidden = true;
    document.documentElement.classList.remove('lb-open');
    if(lastFocus){ lastFocus.focus({ preventScroll: true }); lastFocus = null; }
  }

  document.addEventListener('click', function(e){
    var a = e.target.closest('.gallery a[data-full], .thumbs a[data-full]');
    if(a){ e.preventDefault(); open(a); return; }
    if(!lb.classList.contains('on')) return;
    if(e.target.closest('.lb-prev')){ show(idx - 1); return; }
    if(e.target.closest('.lb-next')){ show(idx + 1); return; }
    // 背景・写真そのもののクリックで閉じる (cursor:zoom-out の見た目どおり)
    if(e.target.closest('.lb')) close();
  });

  document.addEventListener('keydown', function(e){
    if(!lb.classList.contains('on')) return;
    if(e.key === 'Escape'){ close(); return; }
    if(e.key === 'ArrowLeft'){ e.preventDefault(); show(idx - 1); return; }
    if(e.key === 'ArrowRight'){ e.preventDefault(); show(idx + 1); return; }
    // Tab を外に出さない。開いている間は 3 つのボタンの中で回す。
    if(e.key === 'Tab'){
      var f = [].slice.call(lb.querySelectorAll('button:not([hidden])'));
      if(!f.length) return;
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
})();

// ---- sticky nav state on scroll ----
window.addEventListener('scroll', function(){
  var n = document.querySelector('.nav');
  if(!n) return;
  n.classList.toggle('scrolled', window.scrollY > 40);
}, {passive:true});

// ---- ヒーロー動画の読み込み判断 ----
//
// hero.mp4 は 18.8MB。モバイル 4G で自動再生させると、通信量を食ったうえで
// LCP のポスター画像と帯域を奪い合う。次のいずれかなら **読み込まない**:
//   - 通信量の節約が有効
//   - 動きを減らす設定
//   - 画面が狭い (スマホは従量課金のことが多い)
//   - 回線が遅いと申告している
// 読み込まない場合はポスター画像がそのまま見える。静止画でも成立する構図なので、
// 「動かないと壊れて見える」にはならない。
(function(){
  var v = document.querySelector('video[data-src]');
  if(!v) return;
  var c = navigator.connection || {};
  var slow = ['slow-2g','2g','3g'].indexOf(c.effectiveType) >= 0;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = window.matchMedia('(max-width: 48rem)').matches;
  if(c.saveData || reduce || narrow || slow) return;   // ポスターのまま

  // ページの他の読み込みが落ち着いてから入れる。最初の描画と競合させない。
  var start = function(){
    v.src = v.dataset.src;
    v.autoplay = true;
    var p = v.play();
    if(p && p.catch) p.catch(function(){ /* 自動再生を拒否されてもポスターが残る */ });
  };
  if(document.readyState === 'complete') start();
  else window.addEventListener('load', function(){ setTimeout(start, 150); });
})();

// ---- 予約・お問い合わせフォーム ----
//
// 2026-08-24 まで、このフォームは console.log するだけで **必ず**
// 「✓ お問い合わせを送信しました」を出していた。実予約を受けるサイトで
// それをやると、お客様が予約が通ったと信じて待つ。
// いまは /api/enquiry の結果をそのまま画面に出す。無条件の成功表示はしない。
//
// サーバは 3 通りを返す:
//   ok=true,  notified=true   受け付けて、旅館にも通知できた
//   ok=true,  notified=false  受け付けたが通知に失敗。**成功とは書かない**
//   ok=false                  受け付けられなかった
(function(){
  var form = document.getElementById('enquiryForm');
  if(!form) return;                       // フォームが出ていない (電話導線のとき)
  var note = document.getElementById('formNote');
  var btn  = form.querySelector('button[type=submit]');

  function say(msg, state){
    if(!note) return;
    note.textContent = msg;
    note.dataset.state = state;           // sent | warn | error
  }
  function busy(on){
    if(!btn) return;
    btn.disabled = on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  // 失敗したら Turnstile を必ず作り直す。token は使い捨てなので、
  // 作り直さないと 2 回目以降が必ず検証に落ちる。
  function resetTurnstile(){
    try { if(window.turnstile) window.turnstile.reset(); } catch(e){}
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    busy(true);
    say('', '');
    var fd = new FormData(form);
    fd.append('lang', GS.lang);
    fetch('/api/enquiry', { method:'POST', body: fd, headers:{ 'Accept':'application/json' } })
      .then(function(r){ return r.json().catch(function(){ return { ok:false }; }); })
      .then(function(d){
        if(d.ok && d.notified){
          say(d.message, 'sent');
          form.reset();
        } else {
          // 受け付けたが通知できていない場合も含めて、成功の見た目にはしない。
          say(d.message || '送信できませんでした。お手数ですが、お電話にてご連絡くださいませ。',
              d.ok ? 'warn' : 'error');
        }
        resetTurnstile();
      })
      .catch(function(){
        say('通信に失敗しました。お手数ですが、お電話にてご連絡くださいませ。', 'error');
        resetTurnstile();
      })
      .finally(function(){ busy(false); });
  });
})();
