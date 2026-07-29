// ============================================================
// Gensuirou · shared JS (i18n + header/footer + gallery + form)
// Chrome archetypes: N9 edge-aligned-minimal nav · Ft1 mast-headed footer
// ============================================================

var GS = { lang: localStorage.getItem('gs_lang') || 'ja' };

function _gsSetLang(l){
  GS.lang = l;
  document.documentElement.setAttribute('lang', l);
  // Two switchers exist (bar + index panel); only one is visible per width.
  document.querySelectorAll('.langs [data-lang]').forEach(function(b){
    var on = b.dataset.lang === l;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  try { localStorage.setItem('gs_lang', l); } catch(e){}
}

// Apply lang attribute immediately so CSS hides other-lang spans before paint
_gsSetLang(GS.lang);

// ---- shared header/footer injection ----
(function(){
  var base = document.currentScript && document.currentScript.dataset.base ? document.currentScript.dataset.base : '';

  // The eight destinations. One list, used by both the index panel and the
  // footer mast — so a new page can never appear in one and not the other.
  var DESTS = [
    ['rooms.html',      'rooms',      'Rooms',      '客房',     '客室'],
    ['cuisine.html',    'cuisine',    'Cuisine',    '料理',     '料理'],
    ['onsen.html',      'onsen',      'Onsen',      '温泉',     '温泉'],
    ['facilities.html', 'facilities', 'Facilities', '设施',     '施設'],
    ['access.html',     'access',     'Access',     '交通',     'アクセス'],
    ['faq.html',        'faq',        'Questions',  '常见问题', 'よくある質問'],
    ['wedding.html',    'wedding',    'Wedding',    '婚礼',     '結婚式'],
    ['index.html',      'home',       'Home',       '首页',     'ホーム']
  ];

  function isCurrent(key){
    return (document.body ? document.body.dataset.page : '') === key;
  }
  function langSpans(en, zh, ja){
    return '<span data-en>'+en+'</span><span data-zh>'+zh+'</span><span data-ja>'+ja+'</span>';
  }
  function link(d, extraAttr){
    var cur = isCurrent(d[1]) ? ' aria-current="page"' : '';
    return '<a href="'+base+d[0]+'"'+cur+(extraAttr||'')+'>'+langSpans(d[2], d[3], d[4])+'</a>';
  }

  function langSwitcher(id){
    return '<div class="langs"'+(id ? ' id="'+id+'"' : '')+' role="group" aria-label="Language">'+
      '<button type="button" data-lang="ja" lang="ja">日本語</button>'+
      '<button type="button" data-lang="en" lang="en">EN</button>'+
      '<button type="button" data-lang="zh" lang="zh">中文</button>'+
    '</div>';
  }

  window._gsHeader = function(){
    var items = DESTS.map(function(d, i){
      var n = String(i + 1).padStart(2, '0');
      var cur = isCurrent(d[1]) ? ' aria-current="page"' : '';
      return '<li><a href="'+base+d[0]+'"'+cur+'>'+
               '<span class="idx">'+n+'</span>'+
               '<span>'+langSpans(d[2], d[3], d[4])+'</span>'+
             '</a></li>';
    }).join('');

    return ''+
    '<a class="skip" href="#main"><span data-en>Skip to content</span><span data-zh>跳至正文</span><span data-ja>本文へ</span></a>'+
    '<header class="nav"><div class="nav-inner">'+
      '<a class="brand" href="'+base+'index.html">'+
        '<img src="'+base+'assets/imgs/logo_gensuirou.png" alt="源翠瓏 Gensuirou" width="200" height="88">'+
        '<span class="txt">GENSUIROU<small>源 翠 瓏</small></span>'+
      '</a>'+
      '<div class="nav-right">'+
        langSwitcher('langSwitcher')+
        '<a class="reserve-btn" href="'+base+'index.html#reserve">'+langSpans('Reserve','预约','ご予約')+'</a>'+
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
    var fmenu = DESTS.slice(0, 7).map(function(d){ return link(d); }).join('');
    return ''+
    '<footer>'+
      '<div class="foot-mast">'+
        '<div>'+
          '<div class="foot-logo"><img src="'+base+'assets/imgs/logo_gensuirou.png" alt="源翠瓏" width="240" height="106" loading="lazy"></div>'+
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
    _gsSetLang(GS.lang); // sync button active state after injection
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectChrome);
  } else {
    injectChrome();
  }
})();

// ---- lang switcher (event delegation) ----
document.addEventListener('click', function(e){
  var b = e.target.closest('.langs [data-lang]');
  if(b){ e.preventDefault(); _gsSetLang(b.dataset.lang); }
});

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

// ---- lightbox ----
(function(){
  var lb = document.createElement('div');
  var lastFocus = null;
  lb.className = 'lb';
  lb.innerHTML = '<button type="button" class="close" aria-label="Close">×</button><img alt="">';
  function attach(){ document.body.appendChild(lb); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();

  function close(){
    lb.classList.remove('on');
    if(lastFocus){ lastFocus.focus({ preventScroll: true }); lastFocus = null; }
  }
  document.addEventListener('click', function(e){
    var g = e.target.closest('.gallery a[data-full], #mainImg');
    if(g){
      e.preventDefault();
      lastFocus = g;
      lb.querySelector('img').src = (g.dataset && g.dataset.full) ? g.dataset.full : g.src;
      lb.classList.add('on');
      lb.querySelector('.close').focus({ preventScroll: true });
    } else if(e.target.closest('.lb')){
      close();
    }
  });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
})();

// ---- sticky nav state on scroll ----
window.addEventListener('scroll', function(){
  var n = document.querySelector('.nav');
  if(!n) return;
  n.classList.toggle('scrolled', window.scrollY > 40);
}, {passive:true});

// ---- enquiry form ----
function _submitEnquiry(e){
  e.preventDefault();
  var fd = new FormData(e.target);
  var data = {}; fd.forEach(function(v,k){ data[k]=v; });
  console.log('[Gensuirou enquiry]', data);
  var note = document.getElementById('formNote');
  // No turnaround promise — the site can't commit staff to a reply window.
  var msg = GS.lang === 'zh'
    ? '✓ 咨询已送出。稍后将由工作人员与您联络。'
    : GS.lang === 'ja'
      ? '✓ お問い合わせを送信しました。担当者よりご連絡いたします。'
      : '✓ Enquiry sent. A member of our staff will be in touch.';
  if(note){
    note.textContent = msg;
    note.dataset.state = 'sent';
  }
  e.target.reset();
  return false;
}
