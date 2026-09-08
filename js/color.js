/* ==========================================================================
   Farbe — eine Quelle für Interface und Energiefeld.

   Die Seite kennt genau zwei Farben. Alles andere sind Mischungen aus
   diesen beiden, plus Schwarz und die gebrochene Schriftfarbe.
   `p` ist immer ein normalisierter Fortschritt 0..1.
   ========================================================================== */
(function (global) {
  "use strict";

  var ORANGE = { h:  28.1, s: 100, l: 59.4 };   /* #FF9130 */
  var BLAU   = { h: 208.1, s: 100, l: 59.4 };   /* #309EFF */

  /* Interface-Akzent: oben Orange, unten Blau. Buttons, Labels, Linien,
     Fortschrittsbalken und das Hintergrundleuchten hängen alle hier dran.
     Der Wechsel liegt eng um die Seitenmitte: unterwegs ist die Farbe kurz
     neutral, und in dieser blassen Zone soll man nicht lange scrollen. */
  var UI = [
    { p: 0.00, h: ORANGE.h, s: ORANGE.s, l: ORANGE.l },
    { p: 0.45, h: ORANGE.h, s: ORANGE.s, l: ORANGE.l },
    { p: 0.57, h: BLAU.h,   s: BLAU.s,   l: BLAU.l },
    { p: 1.00, h: BLAU.h,   s: BLAU.s,   l: BLAU.l }
  ];

  /* Energiefeld: dieselben zwei Farben, hier über die Höhe einer Form
     verteilt — Orange am Kopf, Blau an den Füßen. */
  var COSMIC = [
    { p: 0.00, h: ORANGE.h, s: 96, l: 62 },
    { p: 1.00, h: BLAU.h,   s: 96, l: 62 }
  ];

  function toRGB(c) {
    var h = c.h, s = c.s / 100, l = c.l / 100;
    var a = s * Math.min(l, 1 - l);
    function f(n) {
      var k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    }
    return [f(0), f(8), f(4)];
  }

  function toHSL(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var l = (mx + mn) / 2, h = 0, s = 0;
    if (d > 1e-6) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === r) h = ((g - b) / d + 6) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s * 100, l: l * 100 };
  }

  /* Gemischt wird über RGB, nicht über den Farbkreis. Orange und Blau liegen
     sich exakt gegenüber — eine Drehung um den Kreis würde unterwegs Magenta
     oder Grün erfinden. Über RGB nimmt der Übergang stattdessen kurz die
     Sättigung heraus und setzt jenseits der Mitte in der zweiten Farbe an. */
  function mix(a, b, t) {
    var ca = toRGB(a), cb = toRGB(b);
    return toHSL(ca[0] + (cb[0] - ca[0]) * t,
                 ca[1] + (cb[1] - ca[1]) * t,
                 ca[2] + (cb[2] - ca[2]) * t);
  }

  function ramp(stops, p) {
    p = Math.max(0, Math.min(1, p));
    var i = 0;
    while (i < stops.length - 2 && p > stops[i + 1].p) i++;
    var a = stops[i], b = stops[i + 1];
    var t = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
    return mix(a, b, t);
  }

  function css(c) {
    return 'hsl(' + c.h.toFixed(0) + ',' + c.s.toFixed(0) + '%,' + c.l.toFixed(0) + '%)';
  }

  global.DKColor = {
    UI: UI, COSMIC: COSMIC, ORANGE: ORANGE, BLAU: BLAU,
    ramp: ramp, mix: mix, css: css
  };
})(window);
