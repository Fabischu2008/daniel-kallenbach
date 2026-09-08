/* ==========================================================================
   Farbverläufe — eine Quelle für Interface und Energiefeld.
   Alle Stops sind HSL. `p` ist immer ein normalisierter Fortschritt 0..1.
   ========================================================================== */
(function (global) {
  "use strict";

  /* Interface-Akzent: Orange #FF9130 -> Blau #309EFF (Buttons, Labels, Linien).
     Der Weg führt bewusst über Rot, Magenta und Violett — die Gegenrichtung
     liefe über Gelb und Grün und passt nicht zum Energiefeld.
     Ab 0.88 steht die Farbe still, damit der Seitenfuß satt im Blau liegt. */
  var UI = [
    { p: 0.00, h:  28.1, s: 100, l: 59.4 },   /* #FF9130 */
    { p: 0.24, h:  16,   s:  92, l: 61   },
    { p: 0.46, h: 344,   s:  80, l: 63   },
    { p: 0.68, h: 292,   s:  72, l: 63   },
    { p: 0.88, h: 208.1, s: 100, l: 59.4 },   /* #309EFF */
    { p: 1.00, h: 208.1, s: 100, l: 59.4 }
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

  global.DKColor = { UI: UI, COSMIC: COSMIC, ramp: ramp, css: css, lerpHue: lerpHue };
})(window);
