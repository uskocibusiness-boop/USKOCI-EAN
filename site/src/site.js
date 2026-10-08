/* USKOČI — jedina skripta sajta. Sadržaj radi i bez nje; ona samo dodaje pokret i pomoć pri pisanju imejla. */
(function () {
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Zaglavlje i meni
  var top = document.querySelector('.top');
  var onScroll = function () { if (top) top.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? 'Zatvori' : 'Meni';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'Meni'; btn.focus(); }
    });
  }

  // Otkrivanje sekcija pri skrolu
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce.matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add('in'); });

  // Prikaz aplikacije: korak na skrolu menja ekran telefona
  var steps = document.querySelectorAll('.step[data-screen]');
  var screens = document.querySelectorAll('.phone-col .scr');
  if (steps.length && screens.length && 'IntersectionObserver' in window) {
    var show = function (id) {
      screens.forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-screen') === id); });
      steps.forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-screen') === id); });
    };
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) show(e.target.getAttribute('data-screen')); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { so.observe(s); });
    show(steps[0].getAttribute('data-screen'));
  }

  // Scena maskota: osoba sa zadatkom → robot bez šlema → robot sa šlemom → Dogovor → znak
  var stage = document.querySelector('.stage');
  if (stage) {
    var q = function (s) { return stage.querySelector(s); };
    var parts = {
      person: q('.st-person'), rtask: q('.st-rtask'), rwork: q('.st-rwork'),
      b1: q('.bubble.l'), b2: q('.bubble.r'), deal: q('.st-deal'), finale: q('.st-finale')
    };
    var running = [], timers = [];
    var stopAll = function () {
      running.forEach(function (a) { try { a.cancel(); } catch (e) {} }); running = [];
      timers.forEach(clearTimeout); timers = [];
    };
    var anim = function (el, frames, opt) {
      if (!el || !el.animate) return null;
      var a = el.animate(frames, Object.assign({ fill: 'forwards', easing: 'cubic-bezier(.22,1,.36,1)' }, opt));
      running.push(a); return a;
    };
    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    var blink = function (robot, both) {
      var eyes = robot ? robot.querySelectorAll('.blink') : [];
      eyes.forEach(function (eye, i) {
        if (!both && i === 0) return; // namig: samo jedno oko
        anim(eye, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.08)' }, { transform: 'scaleY(1)' }], { duration: both ? 220 : 420, easing: 'ease-in-out', fill: 'none' });
      });
    };
    var finalFrame = function () {
      stopAll();
      stage.classList.add('static');
    };
    var play = function () {
      stopAll();
      stage.classList.remove('static');
      [parts.person, parts.rtask, parts.rwork, parts.b1, parts.b2, parts.deal, parts.finale].forEach(function (el) { if (el) { el.style.opacity = 0; } });
      var dealX = 'translateX(-50%)';
      at(150, function () { anim(parts.person, [{ opacity: 0, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 800 }); });
      at(1200, function () { anim(parts.rtask, [{ opacity: 0, transform: 'translate(-30px,40px) rotate(-6deg)' }, { opacity: 1, transform: 'none' }], { duration: 900 }); });
      at(2000, function () { blink(parts.rtask, true); anim(parts.b1, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420 }); });
      at(3300, function () {
        anim(parts.b1, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        anim(parts.rwork, [{ opacity: 0, transform: 'translate(60px,10px) rotate(8deg)' }, { opacity: 1, transform: 'translate(-6px,0) rotate(-2deg)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 1000 });
      });
      at(4200, function () { anim(parts.b2, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420 }); blink(parts.rwork, true); });
      at(5400, function () { blink(parts.rtask, false); });
      at(5900, function () {
        anim(parts.b2, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        anim(parts.deal, [{ opacity: 0, transform: dealX + ' scale(.8)' }, { opacity: 1, transform: dealX + ' scale(1.04)', offset: .6 }, { opacity: 1, transform: dealX + ' scale(1)' }], { duration: 700 });
      });
      at(7600, function () { anim(parts.finale, [{ opacity: 0 }, { opacity: 1 }], { duration: 700 }); });
      at(10800, function () { anim(parts.finale, [{ opacity: 1 }, { opacity: 0 }], { duration: 600 }); });
    };
    var replay = document.getElementById('replay');
    var pause = document.getElementById('still');
    var canPlay = function () { return !reduce.matches && !!Element.prototype.animate; };
    if (canPlay()) {
      // Pokreni kad je scena vidljiva; jednom, bez beskonačne petlje.
      var started = false;
      var go = function () { if (!started) { started = true; play(); } };
      if ('IntersectionObserver' in window) {
        var vo = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { go(); vo.disconnect(); } }, { threshold: .35 });
        vo.observe(stage);
      } else go();
    } else finalFrame();
    if (replay) replay.addEventListener('click', function () { if (canPlay()) play(); else finalFrame(); });
    if (pause) pause.addEventListener('click', finalFrame);
    document.addEventListener('visibilitychange', function () { if (document.hidden) finalFrame(); });
    reduce.addEventListener && reduce.addEventListener('change', function () { if (reduce.matches) finalFrame(); });
  }

  // Kopiranje adrese
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var out = document.getElementById(b.getAttribute('aria-describedby') || '');
      var done = function (ok) { if (out) out.textContent = ok ? 'Adresa je kopirana.' : 'Označi adresu i kopiraj je ručno.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  });

  // Sastavljanje imejla (brisanje naloga, podrška): ništa se ne šalje sa sajta.
  document.querySelectorAll('form[data-mailto]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var to = f.getAttribute('data-mailto');
      var subj = f.getAttribute('data-subject') || 'USKOČI';
      var kind = f.querySelector('[name=kind]');
      if (kind) subj = subj + ' — ' + kind.value;
      var id = (f.querySelector('[name=id]') || {}).value || '';
      var body = (f.querySelector('[name=body]') || {}).value || '';
      var text = (id ? 'Nalog (imejl, telefon ili ID): ' + id + '\n\n' : '') + body;
      var out = f.querySelector('.status-line');
      if (out) out.textContent = 'Otvaramo tvoj program za poštu. Poruka nije poslata dok je tamo ne pošalješ.';
      window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(text);
    });
  });
})();
