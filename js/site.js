/* ==========================================================================
   Seitenlogik — Scroll-Fortschritt, Farbwanderung, Reveals, Formular.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- Hier eintragen, sobald vorhanden ------------------------------- */
  var CONFIG = {
    /* Ziel für das Kontaktformular. Leer lassen = E-Mail-Fallback.
       Beispiele: 'kontakt.php'  |  'https://formspree.io/f/xxxxxxx'      */
    formEndpoint: (window.DK_WP && window.DK_WP.form) || '',
    /* Empfängeradresse für den Fallback und den Direktkontakt.            */
    email: 'kontakt@daniel-kallenbach.de',
    /* Calendly-Link. Leer lassen = Platzhalter im Buchungs-Tab.           */
    calendly: 'https://calendly.com/daniel_kallenbach',
    /* Google Analytics 4 Mess-ID. Leer = kein Tracking. */
    gaId: (window.DK_WP && window.DK_WP.gaId) || 'G-L9E1F6FEBW',
    /* Contentsquare Tag-ID */
    csId: 'f685a3651e094'
  };

  var CONSENT_KEY = 'dk_cookie_consent';

  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY) || ''; } catch (e) { return ''; }
  }
  function setConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {}
  }
  function privacyHref() {
    var a = document.querySelector('a[href*="datenschutz"]');
    return (a && a.getAttribute('href')) || 'datenschutz/';
  }

  function loadAnalytics() {
    var id = CONFIG.gaId;
    if (!id || document.getElementById('dk-ga')) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
    var s = document.createElement('script');
    s.id = 'dk-ga';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  function loadContentsquare() {
    var id = CONFIG.csId;
    if (!id || document.getElementById('dk-cs')) return;
    (function (c, s, q, u, a, r, e) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      e = s.createElement(q);
      e.id = 'dk-cs';
      e.async = 1;
      e.src = u;
      r = s.getElementsByTagName(q)[0];
      if (r && r.parentNode) r.parentNode.insertBefore(e, r);
      else s.head.appendChild(e);
    })(window, document, 'script', 'https://t.contentsquare.net/uxa/' + id + '.js', '_uxa');
  }

  var calendlyLoaded = false;
  function calendlyEmbedUrl() {
    return CONFIG.calendly.split('?')[0] +
      '?hide_gdpr_banner=1' +
      '&embed_domain=' + encodeURIComponent(window.location.hostname) +
      '&embed_type=Inline' +
      '&background_color=0c0c0f&text_color=efece6';
  }
  function loadCalendly() {
    var mount = document.getElementById('cal-widget');
    if (!mount || !CONFIG.calendly || calendlyLoaded) return;
    calendlyLoaded = true;
    var url = calendlyEmbedUrl();
    mount.innerHTML = '';
    mount.removeAttribute('data-url');
    mount.className = 'calendly-inline-widget';
    mount.style.minWidth = '320px';
    mount.style.height = '700px';
    function init() {
      if (!window.Calendly || !window.Calendly.initInlineWidget) return;
      window.Calendly.initInlineWidget({
        url: url,
        parentElement: mount
      });
    }
    if (window.Calendly && window.Calendly.initInlineWidget) {
      init();
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    s.onload = init;
    document.body.appendChild(s);
  }

  function applyConsent(value) {
    if (value === 'all') {
      loadAnalytics();
      loadContentsquare();
      loadCalendly();
    }
  }

  function mountCookieBar() {
    if (document.getElementById('cookie-bar')) return;
    var bar = document.createElement('aside');
    bar.id = 'cookie-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-labelledby', 'cookie-bar-title');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML =
      '<div class="cookie-inner">' +
        '<p id="cookie-bar-title">Diese Seite verwendet Cookies.</p>' +
        '<p class="cookie-copy">Technisch nötige Cookies halten die Seite lauffähig. Statistik (Google Analytics, Contentsquare) und der Terminkalender von Calendly werden nur gesetzt, wenn du zustimmst. So sehe ich, welche Seiten wirken — ohne Tracking gegen deinen Willen. <a href="' + privacyHref() + '">Datenschutz</a></p>' +
        '<div class="cookie-actions">' +
          '<button type="button" class="btn" data-cookie="all">Alle akzeptieren</button>' +
          '<button type="button" class="btn btn-ghost" data-cookie="needed">Nur notwendige</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bar);
    bar.querySelector('[data-cookie="all"]').addEventListener('click', function () {
      setConsent('all');
      bar.remove();
      applyConsent('all');
    });
    bar.querySelector('[data-cookie="needed"]').addEventListener('click', function () {
      setConsent('needed');
      bar.remove();
    });
  }

  if (getConsent()) {
    applyConsent(getConsent());
  } else {
    mountCookieBar();
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var color = window.DKColor;

  /* ---- Interface-Akzent aus dem Scroll-Fortschritt --------------------- */
  function setAccent(p) {
    var c = color.ramp(color.UI, p);
    root.style.setProperty('--eh', c.h.toFixed(1));
    root.style.setProperty('--es', c.s.toFixed(1) + '%');
    root.style.setProperty('--el', c.l.toFixed(1) + '%');
  }

  /* ---- Energiefeld: Startseite volle Reise, Kontakt nur das Ende -------- */
  var canvas = document.getElementById('energyField');
  var field = (canvas && window.EnergyField) ? window.EnergyField.init(canvas, { reduce: reduce }) : null;

  /* ---- Scroll ---------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var bar = document.getElementById('progress');
  var hero = document.getElementById('hero');
  var fieldEnd = !hero && !!canvas;
  var pending = false;

  /* Ruhige Bezugshöhe: innerHeight wächst und schrumpft auf dem Handy mit der
     Adressleiste, und jede Änderung würde den Fortschritt verschieben. */
  function viewportHeight() {
    return (canvas && canvas.clientHeight) || window.innerHeight;
  }
  var viewH = viewportHeight();

  function onScroll() {
    var max = document.documentElement.scrollHeight - viewH;
    var p = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;

    if (field && fieldEnd) {
      /* Gleicher Zustand wie ganz unten auf der Startseite: Wellenfeld. */
      field.setProgress(max > 0 ? 0.86 + p * 0.14 : 0.94);
    } else if (field) {
      /* Das Energiefeld startet erst nach dem Hero und bekommt dann den
         gesamten Rest der Seite als Bühne.                               */
      var heroH = hero ? hero.offsetHeight : viewH;
      var fieldMax = max - heroH;
      var fieldP = fieldMax > 0
        ? Math.max(0, Math.min(1, (window.scrollY - heroH) / fieldMax))
        : 0;
      field.setProgress(fieldP);
    }

    if (canvas && !fieldEnd) {
      var fadeH = hero ? hero.offsetHeight : viewH;
      var fade = (window.scrollY - fadeH * 0.72) / (fadeH * 0.28);
      canvas.style.opacity = Math.max(0, Math.min(1, fade)).toFixed(3);
    }

    setAccent(p);
    bar.style.width = (p * 100).toFixed(2) + '%';
    nav.classList.toggle('scrolled', window.scrollY > 36);
    pending = false;
  }

  window.addEventListener('scroll', function () {
    if (!pending) { pending = true; requestAnimationFrame(onScroll); }
  }, { passive: true });

  window.addEventListener('resize', function () {
    viewH = viewportHeight();
    onScroll();
  }, { passive: true });

  /* ---- Rotierendes Wort im Hero ---------------------------------------- */
  (function () {
    var el = document.getElementById('rotor');
    if (!el || reduce) return;
    var words = ['Bewusstsein', 'Verantwortung', 'Klarheit', 'Wirkung', 'Selbsterkenntnis', 'Freiheit'];
    var i = 0;
    setInterval(function () {
      el.classList.add('out');
      setTimeout(function () {
        i = (i + 1) % words.length;
        el.textContent = words[i];
        el.classList.remove('out');
      }, 500);
    }, 2600);
  })();

  /* ---- Reveals --------------------------------------------------------- */
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Buchungs-Umschalter --------------------------------------------- */
  (function () {
    var bCal = document.getElementById('bsw-cal');
    var bMsg = document.getElementById('bsw-msg');
    var pCal = document.getElementById('pane-cal');
    var pMsg = document.getElementById('pane-msg');
    if (!bCal || !bMsg) return;

    function show(calendar) {
      bCal.classList.toggle('is-on', calendar);
      bMsg.classList.toggle('is-on', !calendar);
      bCal.setAttribute('aria-selected', String(calendar));
      bMsg.setAttribute('aria-selected', String(!calendar));
      pCal.hidden = !calendar;
      pMsg.hidden = calendar;
    }
    bCal.addEventListener('click', function () { show(true); });
    bMsg.addEventListener('click', function () { show(false); });

    /* Ohne konfigurierten Kalender direkt das Formular zeigen */
    if (!CONFIG.calendly) show(false);

    bCal.addEventListener('click', function () {
      if (getConsent() === 'all') loadCalendly();
      else if (!getConsent()) mountCookieBar();
    });
  })();

  /* ---- Kontaktformular -------------------------------------------------- */
  (function () {
    var form = document.getElementById('callForm');
    if (!form) return;

    var statusEl = document.getElementById('f-status');
    var submit = document.getElementById('f-submit');
    var nameEl = document.getElementById('f-name');
    var mailEl = document.getElementById('f-email');
    var msgEl = document.getElementById('f-msg');

    function setInvalid(id, bad) {
      var w = document.getElementById(id);
      if (w) w.classList.toggle('invalid', bad);
    }
    function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    function mailtoLink() {
      var subject = encodeURIComponent('Kostenloses Gespräch');
      var body = encodeURIComponent(
        'Name: ' + nameEl.value + '\nE-Mail: ' + mailEl.value + '\n\n' + (msgEl.value || '')
      );
      return 'mailto:' + CONFIG.email + '?subject=' + subject + '&body=' + body;
    }

    function showDone() {
      var card = document.getElementById('formCard');
      card.innerHTML =
        '<div class="done"><div class="mark">' +
        '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6"/></svg></div>' +
        '<h3>Danke. Deine Anfrage ist da.</h3>' +
        '<p>Ich melde mich persönlich bei dir — meist innerhalb weniger Tage.</p></div>';
    }

    function fallback() {
      submit.removeAttribute('disabled');
      submit.innerHTML = originalLabel;
      statusEl.classList.add('err');
      statusEl.innerHTML = 'Der Versand ist noch nicht eingerichtet. ' +
        '<a href="' + mailtoLink() + '">Per E-Mail senden</a>.';
    }

    var originalLabel = submit.innerHTML;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      statusEl.textContent = '';
      statusEl.classList.remove('err');
      if (form.website.value) return;   // Honeypot

      var ok = true;
      if (!nameEl.value.trim()) { setInvalid('wrap-name', true); ok = false; }
      else setInvalid('wrap-name', false);
      if (!validEmail(mailEl.value.trim())) { setInvalid('wrap-email', true); ok = false; }
      else setInvalid('wrap-email', false);
      if (!ok) {
        statusEl.classList.add('err');
        statusEl.textContent = 'Bitte Name und eine gültige E-Mail angeben.';
        return;
      }

      submit.setAttribute('disabled', 'true');
      submit.textContent = 'Wird gesendet …';

      if (!CONFIG.formEndpoint) { fallback(); return; }

      var payload = new FormData(form);
      if (window.DK_WP && window.DK_WP.action) payload.append('action', window.DK_WP.action);

      fetch(CONFIG.formEndpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' }
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (res) {
          if (res && (res.ok || res.next)) showDone(); else throw new Error('server');
        })
        .catch(fallback);
    });
  })();

  /* ---- E-Mail-Adresse an allen markierten Stellen einsetzen ------------- */
  document.querySelectorAll('[data-mail]').forEach(function (el) {
    el.textContent = CONFIG.email;
    if (el.tagName === 'A') el.href = 'mailto:' + CONFIG.email;
  });

  /* ---- Navigation: Mobilmenü und Themen-Klappe ------------------------- */
  (function () {
    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    var drop = document.querySelector('.nav-drop');
    var dropBtn = document.querySelector('.nav-drop-btn');

    function setDrop(open) {
      if (!drop || !dropBtn) return;
      drop.classList.toggle('is-open', open);
      dropBtn.setAttribute('aria-expanded', String(open));
    }

    if (toggle && links) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('nav-open', open);
        if (!open) setDrop(false);
      });
      links.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          toggle.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('nav-open');
        });
      });
    }

    if (drop && dropBtn) {
      dropBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setDrop(!drop.classList.contains('is-open'));
      });
      document.addEventListener('click', function (e) {
        if (!drop.contains(e.target)) setDrop(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setDrop(false);
      });
    }
  })();

  onScroll();
})();
