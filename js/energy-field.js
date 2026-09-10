/* ==========================================================================
   ENERGIEFELD — eine durchgehende Reise über die ganze Seite.

   Ein einziges Partikelsystem (2D-Canvas, kein WebGL) morpht scrollgesteuert
   durch vier Formen. Die Folge ist an Daniels Text entlang gebaut:

       Sog        Spiralscheibe um einen Kern
                  "Where your attention goes, your energy follows."
    -> Aura       aufrechtes Feld aus geschachtelten Schalen
                  "Was du bist, strahlst du aus."
    -> Torus      in sich geschlossener, rotierender Ring
                  Die Kraft, die nicht mehr nach außen abgegeben wird.
    -> Wellenfeld Dreiecksnetz, durch das Ringwellen laufen
                  "Jeder Raum, den du betrittst, verändert sich."

   Jedes Partikel kennt seine Zielkoordinate in JEDER Form gleichzeitig und
   wird zwischen zwei Zielen interpoliert. Die Farbe wandert dabei über acht
   horizontale Bänder vom Orange ins Blau.
   ========================================================================== */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  /* --- Keyframes: Scroll-Fortschritt -> Form. `sc*` sind Streuwolken. ------ */
  var KEYFRAMES = [
    { p: 0.00, k: 'sog'   }, { p: 0.13, k: 'sog'   }, { p: 0.22, k: 'scD' },
    { p: 0.30, k: 'aura'  }, { p: 0.42, k: 'aura'  }, { p: 0.50, k: 'scA' },
    { p: 0.59, k: 'torus' }, { p: 0.69, k: 'torus' }, { p: 0.78, k: 'scB' },
    { p: 0.87, k: 'welle' }, { p: 1.01, k: 'welle' }
  ];

  function smoothstep(x) {
    var t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  }

  /* Wie präsent ist eine Form gerade? Trapez mit weichen Flanken. */
  function presence(p, fadeIn0, full0, full1, fadeOut1) {
    if (p <= fadeIn0 || p >= fadeOut1) return 0;
    if (p < full0) return (p - fadeIn0) / (full0 - fadeIn0);
    if (p <= full1) return 1;
    return 1 - (p - full1) / (fadeOut1 - full1);
  }

  /* ---------------------------------------------------------------------- */

  function init(canvas, options) {
    var ctx = canvas && canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    var opts = options || {};
    var reduce = !!opts.reduce;
    var color = global.DKColor;

    var W = 0, H = 0, DPR = 1, scale = 0, ox = 0, oy = 0;
    var parts = [], welleLinks = [], torusLinks = [];
    var auraBands = [], torusBands = [], welleBands = [];
    /* bandColors wird pro Bild aus diesen beiden Paletten gemischt. */
    var bandCosmic = [], bandBlue = [], bandColors = [];
    var latticeStroke = 'hsl(208,60%,58%)';
    var pointerR = 130, pointerR2 = pointerR * pointerR;
    var builtW = 0, builtH = 0;
    var progress = 0, target = 0, haveProgress = false;

    /* Formabhängige Kennwerte, in build() gesetzt */
    var sogAmp = 0, sogCy = 0;
    var auraRx = 0, auraRy = 0, auraCy = 0;
    var torusR = 0, torusCy = 0, torusTube = 0.36;
    var welleCx = 0, welleCy = 0, welleK = 0, welleAmp = 0;
    var torusMaxLen2 = 0, welleMaxLen2 = 0;
    var hell = 1;

    /* ------------------------------------------------------------------ */
    /* Aufbau: alle Zielformen einmal vorberechnen                         */
    /* ------------------------------------------------------------------ */
    function build() {
      DPR = Math.min(global.devicePixelRatio || 1, 1.5);
      /* Maße vom Element, nicht von innerHeight: innerHeight wandert auf dem
         Handy mit der Adressleiste, das Element steht dank lvh still. */
      W = canvas.clientWidth || global.innerWidth;
      H = canvas.clientHeight || global.innerHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      scale = Math.min(H * 0.80, W * 1.05);
      ox = W * 0.5;
      /* Die Formen sitzen leicht über der Mitte, damit der Text darüber Luft
         hat. Am Bildschirm ausgerichtet, nicht an `scale`: auf schmalen
         Geräten ist scale von der Breite begrenzt, und die Formen würden
         sonst oben kleben. */
      oy = H * 0.45;
      pointerR = (W < 760) ? 90 : 130;
      pointerR2 = pointerR * pointerR;

      var N = (W < 760) ? 780 : 1500;
      /* Additives Blending baut Helligkeit aus Überlappungen auf. Mit halber
         Partikelzahl fehlt sie, also wird sie am Handy nachgegeben. */
      hell = (W < 760) ? 1.3 : 1;
      var i;

      /* grobe Normalverteilung für Streuung und Volumen */
      function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.82; }

      /* ---------------------------------------------------------------
         SOG — Spiralarme auf einer geneigten Scheibe.
         Jedes Partikel merkt sich Radius, Armwinkel und Höhe im Wulst;
         die Bildschirmlage entsteht erst pro Bild in draw().            */
      sogAmp = scale * 0.42;
      sogCy = oy;
      var ARME = 3;

      /* ---------------------------------------------------------------
         AURA — geschachtelte Schalen auf einem aufrechten Ovoid.
         Bewusst keine Gliedmaßen, kein Kopf: nur ein Feld, das strahlt. */
      auraRx = scale * 0.192;
      auraRy = scale * 0.352;
      auraCy = oy + scale * 0.02;
      /* Punkte gleichmäßig auf der Kugel (Fibonacci), später aufs Ovoid gezogen */
      var kugel = [], golden = 2.399963229728653;
      for (i = 0; i < N; i++) {
        var sy = 1 - (i / (N - 1)) * 2;
        var sr = Math.sqrt(Math.max(0, 1 - sy * sy));
        var th = i * golden;
        kugel.push([Math.cos(th) * sr, sy, Math.sin(th) * sr]);
      }

      /* ---------------------------------------------------------------
         TORUS — Gitter aus nu Schritten um den Ring und nv um die Röhre.
         Das Verhältnis folgt den Umfängen, sonst wird die Masche schief. */
      torusR = scale * 0.30;
      torusCy = oy + scale * 0.02;
      var nu = Math.max(12, Math.round(Math.sqrt(N / torusTube)));
      var nv = Math.max(6, Math.ceil(N / nu));

      /* ---------------------------------------------------------------
         WELLENFELD — Dreiecksnetz statt Quadratgitter: versetzte Reihen
         ergeben drei Nachbarn statt zwei und damit eine ganz andere
         Maschenform. Ringwellen laufen später radial hindurch.          */
      /* Dreiecksmaschen haben drei Nachbarn statt zwei und wirken dadurch
         schnell zu dicht. Das Feld greift deshalb etwas über den Rand
         hinaus, was die Dichte auf dem Schirm senkt. */
      var flaeche = (W * 1.3) * (H * 1.3);
      var stepX = Math.sqrt(flaeche / N / 0.866);
      var stepY = stepX * 0.866;
      var cols = Math.max(4, Math.ceil(W * 1.3 / stepX));
      var rows = Math.max(4, Math.ceil(N / cols));
      var wx0 = W * 0.5 - (cols - 1) * stepX * 0.5;
      var wy0 = H * 0.5 - (rows - 1) * stepY * 0.5;
      welleCx = W * 0.5;
      welleCy = H * 0.44;
      welleK = TAU / (scale * 0.34);
      welleAmp = scale * 0.038;

      /* --- Partikel ---------------------------------------------------- */
      parts = [];
      auraBands = [[], [], [], [], [], [], [], []];
      for (i = 0; i < N; i++) {
        var stern = Math.random() < 0.16;
        var sz = stern ? (1.7 + Math.random() * 1.3) : (0.85 + Math.random() * 0.85);

        /* --- Sog: ein Fünftel bildet den leuchtenden Kern, der Rest die
           Arme. Die Streuung wächst nach außen, damit die Arme auffächern
           statt als dünne Linien zu enden. */
        var imKern = Math.random() < 0.20;
        var sogR = imKern ? Math.abs(gauss()) * 0.15
                          : 0.12 + Math.pow(Math.random(), 0.85) * 0.88;
        var sogA = imKern
          ? Math.random() * TAU
          : (Math.floor(Math.random() * ARME) / ARME) * TAU + gauss() * (0.13 + 0.32 * sogR);

        /* --- Aura: Schwerpunkt auf der äußeren Schale. Innen bleibt es
           dünn, damit man hindurchsieht — ein Feld, kein Körper. */
        var u = Math.random();
        var schale = u < 0.74 ? 1.0 : (u < 0.91 ? 0.70 : 0.40);
        schale += gauss() * 0.035;
        var k = kugel[i];
        /* oben etwas schmaler, damit das Feld aufrecht wirkt statt kugelig */
        var taper = 1 - 0.18 * Math.max(0, k[1]);

        /* --- Torus */
        var ui = (i % nu) / nu * TAU;
        var vi = Math.floor(i / nu) / nv * TAU;

        /* --- Wellenfeld: versetzte Reihen */
        var row = Math.floor(i / cols), col = i % cols;
        var wxh = wx0 + (col + (row & 1 ? 0.5 : 0)) * stepX;
        var wyh = wy0 + row * stepY;
        var wdx = wxh - welleCx, wdy = wyh - welleCy;
        var wd = Math.hypot(wdx, wdy) || 1;

        var band = Math.min(7, Math.max(0, ((1 - k[1]) * 0.5 * 8) | 0));

        parts.push({
          /* Sog */
          sogR: sogR, sogA: sogA,
          sogY: gauss() * sogAmp * 0.10 * (1 - 0.55 * sogR),
          /* Aura: `aSch` steuert Größe und Helligkeit, damit die äußere
             Schale die Form zeichnet und die inneren nur dahinter glimmen. */
          aur: [k[0] * schale * taper, k[1] * schale, k[2] * schale * taper],
          aSch: Math.max(0, Math.min(1, schale)),
          /* Torus */
          tu: ui, tv: vi,
          /* Wellenfeld: Ruhelage plus Richtung nach außen */
          wx: wxh, wy: wyh, wd: wd, wnx: wdx / wd, wny: wdy / wd,

          band: band, star: stern, depth: 0, dmul: 1,
          scA: [W * (-0.1 + 1.2 * Math.random()), H * (-0.1 + 1.2 * Math.random())],
          scB: [W * (-0.1 + 1.2 * Math.random()), H * (-0.1 + 1.2 * Math.random())],
          scD: [W * (-0.1 + 1.2 * Math.random()), H * (-0.1 + 1.2 * Math.random())],
          x: ox, y: sogCy,
          vx: 0, vy: 0, sz: sz, halo: sz * 2.2,
          ph: Math.random() * TAU, tw: Math.random() * TAU
        });
        auraBands[band].push(i);
      }

      /* --- Farbbänder: acht Zonen pro Form ------------------------------ */
      bandCosmic = []; bandBlue = []; bandColors = [];
      for (var cb = 0; cb < 8; cb++) {
        bandCosmic.push(color.ramp(color.COSMIC, (cb + 0.5) / 8));
        /* Ziel am Seitenende: durchgehend #309EFF, nur in der Helligkeit
           gestaffelt — sonst wirkte das Netz unten flach statt räumlich. */
        bandBlue.push({ h: color.BLAU.h, s: 100, l: 50 + (cb / 7) * 18 });
        bandColors.push('');
      }
      torusBands = [[], [], [], [], [], [], [], []];
      welleBands = [[], [], [], [], [], [], [], []];
      for (i = 0; i < N; i++) {
        /* Torus: nach der Lage auf der Röhre, ergibt Ringe quer zur Masche */
        var tb = Math.min(7, Math.max(0, ((1 - Math.sin(parts[i].tv)) * 0.5 * 8) | 0));
        torusBands[tb].push(i);
        var wb = Math.min(7, Math.max(0, ((parts[i].wy / H) * 8) | 0));
        welleBands[wb].push(i);
      }

      /* --- Linien ------------------------------------------------------- */
      /* Torus: geschlossene Masche in beide Umlaufrichtungen */
      torusLinks = [];
      for (i = 0; i < N; i++) {
        var c = i % nu, r = Math.floor(i / nu);
        var nachbarU = (c === nu - 1) ? i - nu + 1 : i + 1;   // Ring schließen
        if (nachbarU >= 0 && nachbarU < N) torusLinks.push([i, nachbarU]);
        var nachbarV = i + nu;
        if (nachbarV < N) torusLinks.push([i, nachbarV]);
        else if (r === nv - 1 && c < N) torusLinks.push([i, c]);              // Röhre schließen
      }
      torusMaxLen2 = Math.pow(torusR * 0.55, 2);

      /* Wellenfeld: rechts, unten-links, unten-rechts = Dreiecksmaschen */
      welleLinks = [];
      for (i = 0; i < N; i++) {
        var wr = Math.floor(i / cols), wc = i % cols;
        var gerade = (wr & 1) === 0;
        if (wc + 1 < cols && i + 1 < N) welleLinks.push([i, i + 1]);
        if (wr + 1 < rows) {
          var a = gerade ? (wc - 1) : wc;
          var b = gerade ? wc : (wc + 1);
          if (a >= 0 && a < cols && (wr + 1) * cols + a < N) welleLinks.push([i, (wr + 1) * cols + a]);
          if (b >= 0 && b < cols && (wr + 1) * cols + b < N) welleLinks.push([i, (wr + 1) * cols + b]);
        }
      }
      /* Reserve für die Dehnung durch die Welle, sonst reißen die Maschen auf */
      welleMaxLen2 = Math.pow(Math.max(stepX, stepY) + welleAmp * 2.4, 2);

      builtW = W; builtH = H;
    }

    /* ------------------------------------------------------------------ */
    /* Zeiger — Partikel weichen dem Cursor aus                            */
    /* ------------------------------------------------------------------ */
    var ptr = { x: -9999, y: -9999, on: false };
    function onPointerMove(e) {
      /* Nur die Maus schiebt Partikel. Ein Finger liegt beim Wischen ohnehin
         auf dem Feld und würde es bei jeder Scrollgeste aufwühlen. */
      if (e.pointerType && e.pointerType !== 'mouse') return;
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
    }
    function onPointerLeave() { ptr.on = false; ptr.x = -9999; }

    /* ------------------------------------------------------------------ */
    /* Zeichnen                                                            */
    /* ------------------------------------------------------------------ */
    function draw(staticP) {
      ctx.clearRect(0, 0, W, H);

      /* Scroll-Events kommen auf Touch-Geräten in groben Schüben. Der
         Fortschritt zieht deshalb weich nach, statt sie eins zu eins zu
         übernehmen. */
      if (staticP != null) {
        progress = target = staticP;
      } else if (!reduce) {
        var d = target - progress;
        progress += (Math.abs(d) < 0.0004) ? d : d * 0.2;
      } else {
        progress = target;
      }

      var p = progress;
      var n = parts.length, i;

      /* Das Feld läuft mit der Seite ins Blau, damit Netz und
         Bedienelemente unten dieselbe Farbe sprechen. Der Übergang liegt
         hinter dem Torus, der so seine Magenta-Phase behält. */
      var blueMix = smoothstep((p - 0.55) / 0.35);
      for (i = 0; i < 8; i++) {
        bandColors[i] = color.css(color.mix(bandCosmic[i], bandBlue[i], blueMix));
      }
      latticeStroke = color.css({ h: color.BLAU.h, s: 44 + 32 * blueMix, l: 58 });

      var si = 0;
      while (si < KEYFRAMES.length - 2 && p > KEYFRAMES[si + 1].p) si++;
      var ka = KEYFRAMES[si], kb = KEYFRAMES[si + 1];
      var keyA = ka.k, keyB = kb.k;
      var mix = smoothstep((p - ka.p) / (kb.p - ka.p));

      var sogP   = presence(p, -1,   0,    0.13, 0.22);
      var auraP  = presence(p, 0.22, 0.30, 0.42, 0.50);
      var torusP = presence(p, 0.50, 0.59, 0.69, 0.78);
      var welleP = presence(p, 0.78, 0.87, 1.02, 1.03);
      var maxP = Math.max(sogP, auraP, torusP, welleP);
      var alpha = 0.18 + 0.46 * maxP;

      var breathe = !reduce && maxP > 0.5;
      var breathAmp = scale * 0.0035 * maxP;
      var t = performance.now() * 0.001;

      /* Welche Formen müssen dieses Bild überhaupt gerechnet werden?
         Die Ränder überlappen, damit an den Übergängen beide Ziele da sind. */
      var sogOn   = p < 0.235;
      var auraOn  = p > 0.215 && p < 0.515;
      var torusOn = p > 0.495 && p < 0.795;
      var welleOn = p > 0.775;

      /* Sog: geneigte Scheibe, Arme winden sich leicht gegeneinander */
      var sogTilt = -0.46, sogCT = Math.cos(sogTilt), sogST = Math.sin(sogTilt);
      var sogSpin = t * 0.26, sogShear = 0.16 * Math.sin(t * 0.45);
      /* Aura: langsame Eigendrehung, kaum Neigung */
      var aRot = t * 0.13, aCA = Math.cos(aRot), aSA = Math.sin(aRot);
      var aTilt = -0.10, aCT = Math.cos(aTilt), aST = Math.sin(aTilt);
      var aBreath = 1 + 0.022 * Math.sin(t * 0.55);
      /* Torus: Drehung um die Hochachse plus feste Neigung */
      var tRot = t * 0.17, tCA = Math.cos(tRot), tSA = Math.sin(tRot);
      var tTilt = -0.52, tCT = Math.cos(tTilt), tST = Math.sin(tTilt);
      var tWob = t * 0.85;
      var focal = 3.4;
      /* Wellenfeld: Ringwellen laufen nach außen */
      var wPhase = t * 1.5;

      for (i = 0; i < n; i++) {
        var q = parts[i];
        var ax, ay, bx, by;
        var sgx = 0, sgy = 0, aux = 0, auy = 0, tox = 0, toy = 0, wex = 0, wey = 0;

        if (sogOn) {
          /* Der Faktor vor sogR bestimmt die Windung: knapp 0,7 Umdrehungen
             lassen die Arme als Arme lesen, mehr wird zur Schnecke. */
          var sa = q.sogA + q.sogR * 4.4 + sogSpin + sogShear * (1 - q.sogR);
          var srad = q.sogR * sogAmp;
          var SX = Math.cos(sa) * srad, SZ = Math.sin(sa) * srad, SY = q.sogY;
          var sy2 = SY * sogCT - SZ * sogST;
          var sz2 = SY * sogST + SZ * sogCT;
          var sp = focal / (focal - sz2 / sogAmp);
          sgx = ox + SX * sp;
          sgy = sogCy + sy2 * sp;
          q.depth = sz2 / sogAmp;
        }

        if (auraOn) {
          var AX = q.aur[0] * auraRx * aBreath;
          var AY = q.aur[1] * auraRy * aBreath;
          var AZ = q.aur[2] * auraRx * aBreath;
          var ax1 = AX * aCA + AZ * aSA, az1 = -AX * aSA + AZ * aCA;
          var ay2 = AY * aCT - az1 * aST, az2 = AY * aST + az1 * aCT;
          var apr = focal / (focal - az2 / auraRy);
          aux = ox + ax1 * apr;
          auy = auraCy - ay2 * apr;
        }

        if (torusOn) {
          var cu = Math.cos(q.tu), su = Math.sin(q.tu);
          var cv = Math.cos(q.tv), sv = Math.sin(q.tv);
          /* Die Röhre atmet leicht. Ohne das Wabern sieht der Torus aus wie
             ein Drahtmodell und nicht wie ein Feld. */
          var tube = torusTube * (1 + 0.075 * Math.sin(q.tu * 3 + tWob) * Math.sin(q.tv * 2 - tWob * 0.8));
          var ring = 1 + tube * cv;
          var TX = ring * cu, TY = tube * sv, TZ = ring * su;
          var tx1 = TX * tCA + TZ * tSA, tz1 = -TX * tSA + TZ * tCA;
          var ty2 = TY * tCT - tz1 * tST, tz2 = TY * tST + tz1 * tCT;
          var tpr = focal / (focal - tz2);
          tox = ox + tx1 * torusR * tpr;
          toy = torusCy - ty2 * torusR * tpr;
          q.dmul = 1 + (0.45 + 1.35 * (tz2 + 1) * 0.5 - 1) * torusP;
        } else if (!welleOn) {
          q.dmul = 1;
        }

        if (welleOn) {
          /* Ringwelle: die Ruhelage wird radial verschoben, weiter außen
             flacher — so läuft die Welle sichtbar durch das Netz. */
          var h = Math.sin(q.wd * welleK - wPhase) * welleAmp / (1 + q.wd / (scale * 2.6));
          wex = q.wx + q.wnx * h;
          wey = q.wy + q.wny * h;
          q.dmul = 0.62 + 0.85 * (0.5 + 0.5 * (h / welleAmp));
        }

        if (keyA === 'sog') { ax = sgx; ay = sgy; }
        else if (keyA === 'aura') { ax = aux; ay = auy; }
        else if (keyA === 'torus') { ax = tox; ay = toy; }
        else if (keyA === 'welle') { ax = wex; ay = wey; }
        else { var A = q[keyA]; ax = A[0]; ay = A[1]; }

        if (keyB === 'sog') { bx = sgx; by = sgy; }
        else if (keyB === 'aura') { bx = aux; by = auy; }
        else if (keyB === 'torus') { bx = tox; by = toy; }
        else if (keyB === 'welle') { bx = wex; by = wey; }
        else { var B = q[keyB]; bx = B[0]; by = B[1]; }

        var tx = ax + (bx - ax) * mix, ty = ay + (by - ay) * mix;
        if (breathe && !(keyA === 'torus' && keyB === 'torus')) {
          tx += Math.sin(t * 0.6 + q.ph) * breathAmp;
          ty += Math.cos(t * 0.5 + q.ph) * breathAmp;
        }

        if (reduce) {
          q.x = tx; q.y = ty;
        } else {
          /* Feder zum Ziel plus Dämpfung — das Nachschwingen ist der Look */
          q.vx = (q.vx + (tx - q.x) * 0.08) * 0.84;
          q.vy = (q.vy + (ty - q.y) * 0.08) * 0.84;
          if (ptr.on) {
            var rx = q.x - ptr.x, ry = q.y - ptr.y, d2p = rx * rx + ry * ry;
            if (d2p < pointerR2) {
              var dd = Math.sqrt(d2p) || 1, f = 1 - dd / pointerR;
              q.vx += (rx / dd) * f * 1.3;
              q.vy += (ry / dd) * f * 1.3;
            }
          }
          q.x += q.vx; q.y += q.vy;
        }
      }

      /* Additives Blending: überlappende Punkte addieren Helligkeit.
         Das erzeugt den Glut-Effekt ganz ohne Shader oder Blur.          */
      ctx.globalCompositeOperation = 'lighter';

      var sogDom = sogP >= auraP && sogP >= torusP && sogP >= welleP && sogP > 0.04;
      var auraDom = !sogDom && auraP >= torusP && auraP >= welleP && auraP > 0.04;

      if (sogDom) {
        drawSog(n, alpha, sogP);
      } else if (auraDom) {
        drawAura(auraP, alpha);
      } else {
        drawNetz(torusP, welleP, alpha);
      }

      /* Funkeln — einzelne Knoten pulsieren auf, am stärksten im Netz */
      if (!auraDom && !sogDom && maxP > 0.3) {
        ctx.fillStyle = 'hsl(208,90%,76%)';
        var strength = 0.35 + 0.85 * welleP;
        ctx.globalAlpha = Math.min(0.8, 0.5 * alpha);
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          var w = parts[i], s = Math.sin(t * 1.7 + w.tw);
          if (s > 0) {
            var r2 = w.sz * (0.35 + 2.1 * s * strength);
            ctx.moveTo(w.x + r2, w.y);
            ctx.arc(w.x, w.y, r2, 0, TAU);
          }
        }
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* --- Sog: Spiralscheibe in vier Tiefenschichten -------------------- */
    var SOG_COLORS = ['hsl(208,88%,38%)', 'hsl(208,100%,59%)', 'hsl(206,100%,76%)', 'hsl(204,92%,91%)'];
    function drawSog(n, alpha, sogP) {
      /* Kern: der helle Punkt, in den die Arme laufen */
      var kern = ctx.createRadialGradient(ox, sogCy, 0, ox, sogCy, sogAmp * 0.5);
      kern.addColorStop(0, 'rgba(255,145,48,' + (0.16 * sogP * hell).toFixed(3) + ')');
      kern.addColorStop(0.45, 'rgba(120,120,190,' + (0.05 * sogP).toFixed(3) + ')');
      kern.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = kern;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, W, H);

      var layers = [[], [], [], []], i;
      for (i = 0; i < n; i++) {
        var d = parts[i].depth;
        layers[d < -0.5 ? 0 : (d < 0 ? 1 : (d < 0.5 ? 2 : 3))].push(i);
      }
      for (var li = 0; li < 4; li++) {
        var arr = layers[li], front = (li + 0.5) / 4;
        ctx.fillStyle = SOG_COLORS[li];

        /* Höfe nur auf den größeren Punkten. Die Scheibe deckt eine viel
           größere Fläche ab als eine Helix, und gefüllte Kreise kosten nach
           Pixelfläche — flächendeckende Höfe wären hier vergeudet. */
        ctx.globalAlpha = Math.min(0.5, (0.048 + 0.052 * front) * alpha * hell);
        ctx.beginPath();
        for (i = 0; i < arr.length; i++) {
          var h = parts[arr[i]];
          if (h.sz < 1.2) continue;
          var hr = h.sz * (2.6 + 3.0 * front);
          ctx.moveTo(h.x + hr, h.y); ctx.arc(h.x, h.y, hr, 0, TAU);
        }
        ctx.fill();

        ctx.globalAlpha = Math.min(1, (0.66 + 0.62 * front) * alpha * hell);
        ctx.beginPath();
        for (i = 0; i < arr.length; i++) {
          var c = parts[arr[i]], cr = Math.max(0.7, c.sz * (0.95 + 0.45 * front));
          ctx.moveTo(c.x + cr, c.y); ctx.arc(c.x, c.y, cr, 0, TAU);
        }
        ctx.fill();
      }
    }

    /* --- Aura: geschachtelte Schalen, Orange oben / Blau unten --------- */
    function drawAura(auraP, alpha) {
      var a = Math.min(1, auraP);
      var yTop = auraCy - auraRy * 0.55, yBot = auraCy + auraRy * 0.55, r = auraRy * 1.5;

      var gTop = ctx.createRadialGradient(ox, yTop, 0, ox, yTop, r);
      gTop.addColorStop(0, 'rgba(255,145,48,' + (0.09 * a).toFixed(3) + ')');
      gTop.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gTop; ctx.fillRect(0, 0, W, H);

      var gBot = ctx.createRadialGradient(ox, yBot, 0, ox, yBot, r);
      gBot.addColorStop(0, 'rgba(48,158,255,' + (0.11 * a).toFixed(3) + ')');
      gBot.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gBot; ctx.fillRect(0, 0, W, H);

      var b, k;
      for (b = 0; b < 8; b++) {
        var idx = auraBands[b];
        if (!idx.length) continue;
        ctx.fillStyle = bandColors[b];

        ctx.globalAlpha = 0.05 * alpha;
        ctx.beginPath();
        for (k = 0; k < idx.length; k++) {
          var h = parts[idx[k]], hr = h.sz * 1.9 * h.aSch;
          ctx.moveTo(h.x + hr, h.y); ctx.arc(h.x, h.y, hr, 0, TAU);
        }
        ctx.fill();

        /* Zwei Durchgänge: erst die inneren Schalen matt, dann die äußere
           voll. Das trennt sie sichtbar, statt alles zu einem Klumpen zu
           addieren. */
        ctx.globalAlpha = Math.min(1, 0.34 * alpha);
        ctx.beginPath();
        for (k = 0; k < idx.length; k++) {
          var ci = parts[idx[k]];
          if (ci.aSch > 0.85) continue;
          var cir = Math.max(0.7, ci.sz * 0.72);
          ctx.moveTo(ci.x + cir, ci.y); ctx.arc(ci.x, ci.y, cir, 0, TAU);
        }
        ctx.fill();

        ctx.globalAlpha = Math.min(1, 0.97 * alpha);
        ctx.beginPath();
        for (k = 0; k < idx.length; k++) {
          var c = parts[idx[k]];
          if (c.aSch <= 0.85) continue;
          var cr = c.sz > 0.85 ? c.sz : 0.85;
          ctx.moveTo(c.x + cr, c.y); ctx.arc(c.x, c.y, cr, 0, TAU);
        }
        ctx.fill();
      }

      /* Sterne: die größeren Punkte bekommen einen weiten Hof */
      for (b = 0; b < 8; b++) {
        var ids = auraBands[b];
        if (!ids.length) continue;
        ctx.fillStyle = bandColors[b];
        ctx.globalAlpha = Math.min(0.42, 0.10 * alpha + 0.05);
        ctx.beginPath();
        for (k = 0; k < ids.length; k++) {
          var s = parts[ids[k]];
          if (!s.star) continue;
          var sr = s.sz * 4.0;
          ctx.moveTo(s.x + sr, s.y); ctx.arc(s.x, s.y, sr, 0, TAU);
        }
        ctx.fill();
      }
    }

    /* --- Torus und Wellenfeld: verbundene Knoten ----------------------- */
    function drawNetz(torusP, welleP, alpha) {
      var istTorus = torusP >= welleP;
      var links = istTorus ? torusLinks : welleLinks;
      var lp = istTorus ? torusP : welleP;
      /* Das Wellenfeld liegt unter Fließtext und Fußzeile — die Fäden dort
         bleiben absichtlich zurückhaltend. */
      var strength = istTorus ? 0.70 : 0.34;
      var bands = istTorus ? torusBands : welleBands;
      var maxLen2 = istTorus ? torusMaxLen2 : welleMaxLen2;

      var lineAlpha = lp * strength * alpha;
      if (links && lineAlpha > 0.006) {
        ctx.globalAlpha = Math.min(0.72, lineAlpha);
        ctx.strokeStyle = latticeStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        /* Zu lange Linien überspringen — sonst zieht der Morph Striche
           quer über den Schirm, statt das Netz zusammenzuweben.          */
        for (var k = 0; k < links.length; k++) {
          var u = parts[links[k][0]], v = parts[links[k][1]];
          var dx = u.x - v.x, dy = u.y - v.y;
          if (dx * dx + dy * dy > maxLen2) continue;
          ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y);
        }
        ctx.stroke();
      }

      var glow = Math.max(welleP, torusP * 0.85), b, i;
      for (b = 0; b < 8; b++) {
        var idx = bands[b];
        if (!idx.length) continue;
        ctx.fillStyle = bandColors[b];

        ctx.globalAlpha = 0.055 * alpha;
        ctx.beginPath();
        for (i = 0; i < idx.length; i++) {
          var h = parts[idx[i]], hr = h.halo * h.dmul;
          ctx.moveTo(h.x + hr, h.y); ctx.arc(h.x, h.y, hr, 0, TAU);
        }
        ctx.fill();

        if (glow > 0.12) {
          ctx.globalAlpha = Math.min(0.4, 0.08 * glow * alpha + 0.02 * glow);
          ctx.beginPath();
          for (i = 0; i < idx.length; i++) {
            var g = parts[idx[i]], gr = g.sz * 4.4 * g.dmul;
            ctx.moveTo(g.x + gr, g.y); ctx.arc(g.x, g.y, gr, 0, TAU);
          }
          ctx.fill();
        }

        ctx.globalAlpha = Math.min(1, 0.95 * alpha);
        ctx.beginPath();
        for (i = 0; i < idx.length; i++) {
          var c = parts[idx[i]], cr = Math.max(0.8, c.sz * c.dmul);
          ctx.moveTo(c.x + cr, c.y); ctx.arc(c.x, c.y, cr, 0, TAU);
        }
        ctx.fill();
      }
    }

    /* ------------------------------------------------------------------ */
    /* Schleife                                                            */
    /* ------------------------------------------------------------------ */
    var raf = 0, running = false;
    function loop() { draw(null); if (running) raf = requestAnimationFrame(loop); }
    function start() { if (running || reduce) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    function onVisibility() { if (document.hidden) stop(); else start(); }

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        /* Ein Neuaufbau würfelt alle Partikel neu aus und ist sichtbar.
           Also nur, wenn sich die Bühne wirklich geändert hat. */
        if (canvas.clientWidth === builtW && canvas.clientHeight === builtH) return;
        build();
        if (reduce) draw(0);
      }, 180);
    }

    global.addEventListener('pointermove', onPointerMove, { passive: true });
    global.addEventListener('pointerleave', onPointerLeave, { passive: true });
    global.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    build();
    if (reduce) draw(0); else start();

    return {
      setProgress: function (p) {
        target = p;
        /* Beim ersten Wert nicht animieren — sonst fährt die Seite nach einem
           Reload mit wiederhergestellter Scrollposition durch die ganze Reise. */
        if (!haveProgress) { haveProgress = true; progress = p; }
      },
      start: start,
      stop: stop
    };
  }

  global.EnergyField = { init: init };
})(window);
