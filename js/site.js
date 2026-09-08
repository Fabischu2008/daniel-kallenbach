/* ==========================================================================
   Seitenlogik — Scroll-Fortschritt, Farbwanderung, Reveals, Formular.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- Hier eintragen, sobald vorhanden ------------------------------- */
  var CONFIG = {
    /* Ziel für das Kontaktformular. Leer lassen = E-Mail-Fallback.
       Beispiele: 'kontakt.php'  |  'https://formspree.io/f/xxxxxxx'      */
    formEndpoint: '',
    /* Empfängeradresse für den Fallback und den Direktkontakt.            */
    email: 'kontakt@daniel-kallenbach.de',
    /* Calendly-Link. Leer lassen = Platzhalter im Buchungs-Tab.           */
    calendly: ''
  };

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

  /* ---- Energiefeld ----------------------------------------------------- */
  var canvas = document.getElementById('energyField');
  var field = window.EnergyField.init(canvas, { reduce: reduce });

  /* ---- Scroll ---------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var bar = document.getElementById('progress');
  var hero = document.getElementById('hero');
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

    /* Das Energiefeld startet erst nach dem Hero und bekommt dann den
       gesamten Rest der Seite als Bühne.                                 */
    var heroH = hero ? hero.offsetHeight : window.innerHeight;
    var fieldMax = max - heroH;
    var fieldP = fieldMax > 0
      ? Math.max(0, Math.min(1, (window.scrollY - heroH) / fieldMax))
      : 0;
    if (field) field.setProgress(fieldP);

    if (canvas) {
      var fade = (window.scrollY - heroH * 0.72) / (heroH * 0.28);
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
  })();

  /* ---- Calendly nur laden, wenn ein Link hinterlegt ist ----------------- */
  (function () {
    var mount = document.getElementById('cal-widget');
    if (!mount || !CONFIG.calendly) return;
    mount.innerHTML = '';
    mount.setAttribute('data-url', CONFIG.calendly +
      '?hide_gdpr_banner=1&background_color=0c0c0f&text_color=efece6');
    mount.className = 'calendly-inline-widget';
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    document.body.appendChild(s);
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

      fetch(CONFIG.formEndpoint, {
        method: 'POST',
        body: new FormData(form),
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

  onScroll();
})();
