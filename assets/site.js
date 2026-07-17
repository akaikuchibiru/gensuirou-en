// ============================================================
// Gensuirou · shared JS (i18n + header/footer + gallery + form)
// ============================================================

var GS = { lang: localStorage.getItem('gs_lang') || 'ja' };

function _gsSetLang(l){
  GS.lang = l;
  document.documentElement.setAttribute('lang', l);
  document.querySelectorAll('#langSwitcher [data-lang]').forEach(function(b){
    b.classList.toggle('active', b.dataset.lang === l);
  });
  try { localStorage.setItem('gs_lang', l); } catch(e){}
}

// Apply lang attribute immediately so CSS hides other-lang spans before paint
_gsSetLang(GS.lang);

// ---- shared header/footer injection ----
(function(){
  var base = document.currentScript && document.currentScript.dataset.base ? document.currentScript.dataset.base : '';
  function nav(href, key, en, zh, ja){
    var page = document.body ? document.body.dataset.page : '';
    var cls = (page === key) ? ' class="on"' : '';
    return '<a href="'+base+href+'"'+cls+'><span data-en>'+en+'</span><span data-zh>'+zh+'</span><span data-ja>'+ja+'</span></a>';
  }
  window._gsHeader = function(){
    return ''+
    '<header class="nav"><div class="nav-inner">'+
      '<a class="brand" href="'+base+'index.html">'+
        '<img src="'+base+'assets/imgs/logo_gensuirou.png" alt="源翠瓏 Gensuirou">'+
        '<span class="txt">GENSUIROU<small>源 翠 瓏</small></span>'+
      '</a>'+
      '<nav class="menu">'+
        nav('rooms.html','rooms','Rooms','客房','客室')+
        nav('cuisine.html','cuisine','Cuisine','料理','料理')+
        nav('onsen.html','onsen','Onsen','温泉','温泉')+
        nav('facilities.html','facilities','Facilities','设施','施設')+
        nav('access.html','access','Access','交通','アクセス')+
      '</nav>'+
      '<div class="nav-right">'+
        '<div class="langs" id="langSwitcher" role="group" aria-label="Language">'+
          '<button data-lang="ja" aria-label="日本語">日本語</button>'+
          '<button data-lang="en" aria-label="English">EN</button>'+
          '<button data-lang="zh" aria-label="中文">中文</button>'+
        '</div>'+
        '<a class="reserve-btn" href="'+base+'index.html#reserve"><span data-en>Reserve</span><span data-zh>预约</span><span data-ja>ご予約</span></a>'+
      '</div>'+
    '</div></header>';
  };
  window._gsFooter = function(){
    return ''+
    '<footer>'+
      '<div class="foot-logo"><img src="'+base+'assets/imgs/logo_gensuirou.png" alt="源翠瓏"></div>'+
      '<div class="addr">'+
        '<span data-en>2113-3 Komori, Nishihara-mura, Aso-gun, Kumamoto 861-2402, Japan</span>'+
        '<span data-zh>日本国 熊本县 阿苏郡 西原村 小森 2113-3（〒861-2402）</span>'+
        '<span data-ja>〒861-2402　熊本県阿蘇郡西原村小森 2113-3</span>'+
        '<br>TEL +81 (0)96-279-1800 &nbsp;·&nbsp; 10:00–18:00 JST'+
      '</div>'+
      '<nav class="fmenu">'+
        nav('rooms.html','rooms','Rooms','客房','客室')+
        nav('cuisine.html','cuisine','Cuisine','料理','料理')+
        nav('onsen.html','onsen','Onsen','温泉','温泉')+
        nav('facilities.html','facilities','Facilities','设施','施設')+
        nav('access.html','access','Access','交通','アクセス')+
        '<a href="'+base+'faq.html"><span data-en>FAQ</span><span data-zh>常见问题</span><span data-ja>よくある質問</span></a>'+
        '<a href="'+base+'wedding.html"><span data-en>Wedding</span><span data-zh>婚礼</span><span data-ja>結婚式</span></a>'+
      '</nav>'+
      '<div class="socials">'+
        '<a href="https://www.instagram.com/ryokan_gensuirou/">Instagram</a>'+
        '<a href="https://www.youtube.com/@GensuirouWeb/">YouTube</a>'+
      '</div>'+
      '<div class="fine">© Gensuirou · 源翠瓏 · Aso, Kumamoto, Japan &nbsp;— English / 中文 / 日本語</div>'+
    '</footer>';
  };
  function injectChrome(){
    var h = document.getElementById('siteHeader');
    var f = document.getElementById('siteFooter');
    if(h) h.outerHTML = window._gsHeader();
    if(f) f.outerHTML = window._gsFooter();
    _gsSetLang(GS.lang); // sync button active state after injection
    // splash out
    var sp = document.getElementById('gsSplash');
    if(sp){ setTimeout(function(){ sp.classList.add('out'); setTimeout(function(){ sp.remove(); }, 800); }, 350); }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectChrome);
  } else {
    injectChrome();
  }
})();

// ---- lang switcher (event delegation) ----
document.addEventListener('click', function(e){
  var b = e.target.closest('#langSwitcher [data-lang]');
  if(b){ e.preventDefault(); _gsSetLang(b.dataset.lang); }
});

// ---- scroll fade-in ----
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
  lb.className = 'lb';
  lb.innerHTML = '<span class="close" aria-label="close">×</span><img alt="">';
  function attach(){ document.body.appendChild(lb); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
  document.addEventListener('click', function(e){
    var g = e.target.closest('.gallery a[data-full], #mainImg');
    if(g){
      e.preventDefault();
      var src = g.dataset && g.dataset.full ? g.dataset.full : g.src;
      lb.querySelector('img').src = src;
      lb.classList.add('on');
    } else if(e.target.closest('.lb')){
      lb.classList.remove('on');
    }
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') lb.classList.remove('on'); });
})();

// ---- sticky nav shrink on scroll ----
window.addEventListener('scroll', function(){
  var n = document.querySelector('.nav');
  if(!n) return;
  n.classList.toggle('scrolled', window.scrollY > 40);
}, {passive:true});

// ---- mobile menu toggle ----
document.addEventListener('click', function(e){
  var b = e.target.closest('#navToggle');
  if(b){ document.querySelector('.nav .menu').classList.toggle('open'); }
});

// ---- mock enquiry form ----
function _submitEnquiry(e){
  e.preventDefault();
  var fd = new FormData(e.target);
  var data = {}; fd.forEach(function(v,k){ data[k]=v; });
  console.log('[Gensuirou enquiry]', data);
  var note = document.getElementById('formNote');
  var msg = GS.lang === 'zh'
    ? '✓ 咨询已接收。工作人员将于一个工作日内回复。'
    : GS.lang === 'ja'
      ? '✓ お問い合わせを受け付けました。担当より1営業日以内にご返信いたします。'
      : '✓ Enquiry received. Our staff will reply within one business day.';
  note.innerHTML = '<span style="color:#f2d999">'+msg+'</span>';
  e.target.reset();
  return false;
}
