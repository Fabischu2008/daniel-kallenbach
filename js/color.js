/* ==========================================================================
   Farbverläufe — eine Quelle für Interface und Energiefeld.
   Alle Stops sind HSL. `p` ist immer ein normalisierter Fortschritt 0..1.
   ========================================================================== */
(function (global) {
  "use strict";

  /* Interface-Akzent: ruhiger Pfad Orange -> Violett (Buttons, Labels, Linien) */
  var UI = [
    { p: 0.00, h:  24, s: 90, l: 56 },
    { p: 0.30, h:  36, s: 84, l: 60 },
    { p: 0.55, h:  12, s: 74, l: 64 },
    { p: 0.78, h: 320, s: 60, l: 64 },
    { p: 1.00, h: 272, s: 62, l: 62 }
  ];

  /* Energiefeld: kosmisch — Rot oben, Magenta in der Mitte, Blau unten */
  var COSMIC = [
    { p: 0.00, h:   4, s: 88, l: 64 },
    { p: 0.50, h: 312, s: 78, l: 62 },
    { p: 1.00, h: 210, s: 86, l: 64 }
  ];

  /* Kürzester Weg um den Farbkreis, damit Rot->Violett nicht durch Grün läuft */
  function lerpHue(a, b, t) {
    var d = ((b - a + 540) % 360) - 180;
    return (a + d * t + 360) % 360;
  }

  function ramp(stops, p) {
    p = Math.max(0, Math.min(1, p));
    var i = 0;
    while (i < stops.length - 2 && p > stops[i + 1].p) i++;
    var a = stops[i], b = stops[i + 1];
    var t = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
    return {
      h: lerpHue(a.h, b.h, t),
      s: a.s + (b.s - a.s) * t,
      l: a.l + (b.l - a.l) * t
    };
  }

  function css(c) {
    return 'hsl(' + c.h.toFixed(0) + ',' + c.s.toFixed(0) + '%,' + c.l.toFixed(0) + '%)';
  }

  global.DKColor = { UI: UI, COSMIC: COSMIC, ramp: ramp, css: css };
})(window);
