/* ==========================================================================
   ENERGIEFELD — eine durchgehende Reise über die ganze Seite.

   Ein einziges Partikelsystem (2D-Canvas, kein WebGL) morpht scrollgesteuert:

       DNA-Doppelhelix  ->  löst sich auf
    -> Energiekörper    ->  löst sich auf
    -> Stein / Sphäre   ->  löst sich auf
    -> Gitternetz

   Jedes Partikel kennt seine Zielkoordinate in JEDER Form gleichzeitig und
   wird zwischen zwei Zielen interpoliert. Die Farbe wandert dabei über acht
   horizontale Bänder von Rot nach Blau.
   ========================================================================== */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  /* --- Keyframes: Scroll-Fortschritt -> Form. `sc*` sind Streuwolken. ------ */
  var KEYFRAMES = [
    { p: 0.00, k: 'dna'   }, { p: 0.13, k: 'dna'   }, { p: 0.22, k: 'scD' },
    { p: 0.30, k: 'body'  }, { p: 0.42, k: 'body'  }, { p: 0.50, k: 'scA' },
    { p: 0.59, k: 'stone' }, { p: 0.69, k: 'stone' }, { p: 0.78, k: 'scB' },
    { p: 0.87, k: 'grid'  }, { p: 1.01, k: 'grid'  }
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
  /* Silhouette: der Körper ist nicht gesampelt, sondern aus Ellipsen und    */
  /* Kapseln zusammengesetzt. Koordinaten sind normalisiert (0..1).          */
  /* ---------------------------------------------------------------------- */

  function inEllipse(px, py, cx, cy, rx, ry) {
    var a = (px - cx) / rx, b = (py - cy) / ry;
    return a * a + b * b < 1;
  }

  /* Kapsel zwischen zwei Punkten, Breite läuft von wa nach wb */
  function inCapsule(px, py, ax, ay, bx, by, wa, wb) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var qx = ax + dx * t, qy = ay + dy * t, w = wa + (wb - wa) * t;
    return Math.hypot(px - qx, py - qy) < w;
  }

  /* Halbe Torso-Breite auf Höhe y — Schulter, Taille, Hüfte */
  var TORSO = [[0.214, 0.082], [0.265, 0.088], [0.345, 0.072], [0.430, 0.084], [0.520, 0.088]];
  function torsoHalfWidth(y) {
    if (y < TORSO[0][0] || y > TORSO[TORSO.length - 1][0]) return 0;
    for (var i = 0; i < TORSO.length - 1; i++) {
      if (y >= TORSO[i][0] && y <= TORSO[i + 1][0]) {
        var t = (y - TORSO[i][0]) / (TORSO[i + 1][0] - TORSO[i][0]);
        return TORSO[i][1] + (TORSO[i + 1][1] - TORSO[i][1]) * t;
      }
    }
    return 0;
  }

  function inBody(x, y) {
    if (inEllipse(x, y, 0.5, 0.100, 0.050, 0.054)) return true;             // Schädel
    if (inEllipse(x, y, 0.5, 0.133, 0.035, 0.028)) return true;             // Kiefer
    if (inCapsule(x, y, 0.5, 0.155, 0.5, 0.202, 0.026, 0.031)) return true; // Hals
    if (inCapsule(x, y, 0.50, 0.214, 0.620, 0.256, 0.052, 0.040)) return true; // Schulter r
    if (inCapsule(x, y, 0.50, 0.214, 0.380, 0.256, 0.052, 0.040)) return true; // Schulter l
    if (y >= 0.214 && y <= 0.520 && Math.abs(x - 0.5) < torsoHalfWidth(y)) return true;
    if (inCapsule(x, y, 0.636, 0.272, 0.646, 0.452, 0.036, 0.028)) return true; // Oberarm r
    if (inCapsule(x, y, 0.646, 0.452, 0.640, 0.600, 0.028, 0.021)) return true; // Unterarm r
    if (inEllipse(x, y, 0.638, 0.644, 0.034, 0.046)) return true;               // Hand r
    if (inCapsule(x, y, 0.364, 0.272, 0.354, 0.452, 0.036, 0.028)) return true; // Oberarm l
    if (inCapsule(x, y, 0.354, 0.452, 0.360, 0.600, 0.028, 0.021)) return true; // Unterarm l
    if (inEllipse(x, y, 0.362, 0.644, 0.034, 0.046)) return true;               // Hand l
    if (inCapsule(x, y, 0.556, 0.515, 0.550, 0.715, 0.066, 0.045)) return true; // Oberschenkel r
    if (inCapsule(x, y, 0.550, 0.715, 0.546, 0.928, 0.045, 0.026)) return true; // Wade r
    if (inEllipse(x, y, 0.560, 0.950, 0.048, 0.021)) return true;               // Fuß r
    if (inCapsule(x, y, 0.444, 0.515, 0.450, 0.715, 0.066, 0.045)) return true; // Oberschenkel l
    if (inCapsule(x, y, 0.450, 0.715, 0.454, 0.928, 0.045, 0.026)) return true; // Wade l
    if (inEllipse(x, y, 0.440, 0.950, 0.048, 0.021)) return true;               // Fuß l
    return false;
  }

  /* ---------------------------------------------------------------------- */

  function init(canvas, options) {
    var ctx = canvas && canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    var opts = options || {};
    var reduce = !!opts.reduce;
    var color = global.DKColor;

    var W = 0, H = 0, DPR = 1, scale = 0, ox = 0, oy = 0;
    var parts = [], gridLinks = [], stoneLinks = [];
    var bodyBands = [], sphereBands = [], gridBands = [];
    /* bandColors wird pro Bild aus diesen beiden Paletten gemischt. */
    var bandCosmic = [], bandBlue = [], bandColors = [];
    var latticeStroke = 'hsl(256,56%,60%)';
    var gridCols = 0;
    var pointerR = 130, pointerR2 = pointerR * pointerR;
    var builtW = 0, builtH = 0;
    var progress = 0, target = 0, haveProgress = false;

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
      oy = H * 0.10;
      pointerR = (W < 760) ? 90 : 130;
      pointerR2 = pointerR * pointerR;

      var N = (W < 760) ? 780 : 1500;

      /* --- Körper: Kante zuerst ---------------------------------------
         Erst das Raster abtasten und Rand- von Innenzellen trennen. 60 %
         der Partikel landen später auf der Kante — das ist der Grund,
         warum die Figur überhaupt als Figur lesbar ist.                  */
      var edgeCells = [], innerCells = [];
      var GX = 140, GY = 250, offX = 0.18, spanX = 0.64;
      for (var gy = 0; gy < GY; gy++) {
        for (var gx = 0; gx < GX; gx++) {
          var cx = offX + (gx + 0.5) / GX * spanX;
          var cy = (gy + 0.5) / GY;
          if (!inBody(cx, cy)) continue;
          var isEdge = !inBody(cx + 0.0055, cy) || !inBody(cx - 0.0055, cy) ||
                       !inBody(cx, cy + 0.0042) || !inBody(cx, cy - 0.0042);
          (isEdge ? edgeCells : innerCells).push([cx, cy]);
        }
      }

      var body = [], bodyBand = [], bodyRim = [];
      var rimCount = Math.round(N * 0.60);
      function pushBody(nx, ny, rim) {
        body.push([ox + (nx - 0.5) * scale, oy + ny * scale]);
        bodyBand.push(ny < 0.999 ? (ny * 8 | 0) : 7);
        bodyRim.push(rim ? 1 : 0);
      }
      for (var bi = 0; bi < N; bi++) {
        if (bi < rimCount && edgeCells.length) {
          var e = edgeCells[(Math.random() * edgeCells.length) | 0];
          pushBody(e[0] + (Math.random() - 0.5) * 0.006,
                   e[1] + (Math.random() - 0.5) * 0.005, true);
        } else if (innerCells.length) {
          var c = innerCells[(Math.random() * innerCells.length) | 0];
          pushBody(c[0], c[1], false);
        } else {
          pushBody(0.5, 0.5, false);
        }
      }

      /* --- Sphäre: Fibonacci-Verteilung auf der Einheitskugel ---------- */
      var sphere = [], golden = 2.399963229728653;
      for (var qi = 0; qi < N; qi++) {
        var sy = 1 - (qi / (N - 1)) * 2;
        var sr = Math.sqrt(Math.max(0, 1 - sy * sy));
        var th = qi * golden;
        sphere.push([Math.cos(th) * sr, sy, Math.sin(th) * sr]);
      }

      /* --- Gitternetz -------------------------------------------------- */
      var Gw = W * 1.06, Gh = H * 1.06;
      var gx0 = W * 0.5 - Gw / 2, gy0 = H * 0.5 - Gh / 2;
      gridCols = Math.max(4, Math.round(Math.sqrt(N * Gw / Gh)));
      var stepX = Gw / (gridCols - 1);
      var gridRows = Math.ceil(N / gridCols);
      var stepY = Gh / Math.max(1, gridRows - 1);
      var grid = [];
      for (var gi = 0; gi < N; gi++) {
        grid.push([gx0 + (gi % gridCols) * stepX, gy0 + Math.floor(gi / gridCols) * stepY]);
      }

      /* --- DNA-Helix: Parameter ---------------------------------------- */
      var dnaAmp = scale * 0.158, dnaTube = scale * 0.0316;
      var rungs = 13;
      var perRung = Math.max(3, Math.round(N * 0.16 / rungs));
      var rungTotal = perRung * rungs;
      var ambient = Math.round(N * 0.06);
      var strandTotal = N - rungTotal - ambient;
      var perStrand = strandTotal >> 1;
      /* grobe Normalverteilung, damit die Stränge Volumen bekommen */
      function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.82; }

      /* --- Partikel ---------------------------------------------------- */
      parts = [];
      bodyBands = [[], [], [], [], [], [], [], []];
      for (var pi = 0; pi < N; pi++) {
        var rim = bodyRim[pi];
        var star = !rim && Math.random() < 0.14;
        var sz = star ? (1.8 + Math.random() * 1.3)
                      : (rim ? (1.0 + Math.random() * 0.7) : (0.8 + Math.random() * 0.8));

        var role, phase = 0, t, jitter = 0, u = 0, offX2, offY2;
        if (pi < strandTotal) {                       // Strang
          var si = (pi < perStrand) ? pi : (pi - perStrand);
          role = 0;
          phase = (pi < perStrand) ? 0 : Math.PI;
          t = (si + Math.random()) / perStrand;
          jitter = (Math.random() - 0.5) * 0.14;
          offX2 = gauss() * dnaTube;
          offY2 = gauss() * dnaTube * 1.05;
        } else if (pi < strandTotal + rungTotal) {    // Sprosse
          var ri = pi - strandTotal;
          role = 2;
          t = (Math.floor(ri / perRung) + 0.5) / rungs + (Math.random() - 0.5) * 0.02;
          u = (perRung > 1) ? ((ri % perRung) / (perRung - 1)) : 0.5;
          offX2 = gauss() * dnaTube * 0.5;
          offY2 = gauss() * dnaTube * 0.5;
        } else {                                      // Plasma drumherum
          role = 1;
          phase = Math.random() * TAU;
          t = Math.random();
          jitter = (Math.random() - 0.5) * 0.5;
          offX2 = gauss() * dnaAmp * 1.5;
          offY2 = gauss() * dnaAmp * 1.5;
        }

        parts.push({
          body: body[pi], sphere: sphere[pi], grid: grid[pi],
          band: bodyBand[pi], star: star, rim: rim,
          dnaT: t, dnaPhase: phase, dnaJitter: jitter, dnaU: u,
          dnaOX: offX2, dnaOY: offY2, dnaRole: role, depth: 0,
          scA: [W * (-0.1 + 1.2 * Math.random()), H * (-0.1 + 1.2 * Math.random())],
          scB: [W * (-0.1 + 1.2 * Math.random()), H * (-0.1 + 1.2 * Math.random())],
          scD: [W * (-0.1 + 1.2 * Math.random()), H * (-0.1 + 1.2 * Math.random())],
          x: ox, y: oy + t * scale * 0.70,
          vx: 0, vy: 0, sz: sz, halo: sz * 2.2, dmul: 1,
          ph: Math.random() * TAU, tw: Math.random() * TAU
        });
        bodyBands[bodyBand[pi]].push(pi);
      }

      /* --- Farbbänder: acht horizontale Zonen pro Form ------------------ */
      bandCosmic = []; bandBlue = []; bandColors = [];
      for (var cb = 0; cb < 8; cb++) {
        bandCosmic.push(color.ramp(color.COSMIC, (cb + 0.5) / 8));
        /* Ziel am Seitenende: rings um #309EFF, nur leicht gestaffelt — sonst
           wäre das Gitternetz unten flächig einfarbig statt räumlich. */
        bandBlue.push({ h: 222 - (cb / 7) * 28, s: 100, l: 59.4 });
        bandColors.push('');
      }
      sphereBands = [[], [], [], [], [], [], [], []];
      gridBands = [[], [], [], [], [], [], [], []];
      for (var si2 = 0; si2 < N; si2++) {
        var sb = ((1 - sphere[si2][1]) * 0.5 * 8) | 0;
        sphereBands[sb < 0 ? 0 : (sb > 7 ? 7 : sb)].push(si2);
        var gb = (((grid[si2][1] - gy0) / Gh) * 8) | 0;
        gridBands[gb < 0 ? 0 : (gb > 7 ? 7 : gb)].push(si2);
      }

      /* --- Linien ------------------------------------------------------- */
      gridLinks = [];
      for (var g = 0; g < N; g++) {
        if (g % gridCols < gridCols - 1 && g + 1 < N) gridLinks.push([g, g + 1]);
        if (g + gridCols < N) gridLinks.push([g, g + gridCols]);
      }

      /* Stein: die sechs nächsten Nachbarn in 3D, einmal vorberechnet */
      stoneLinks = [];
      var seen = {}, thr = 2.0 * Math.sqrt(4 / N), thr2 = thr * thr;
      for (var a = 0; a < N; a++) {
        var pa = sphere[a], cand = [];
        for (var b = 0; b < N; b++) {
          if (b === a) continue;
          var pb = sphere[b];
          var dx = pa[0] - pb[0], dy = pa[1] - pb[1], dz = pa[2] - pb[2];
          var d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < thr2) cand.push([d2, b]);
        }
        cand.sort(function (m, n) { return m[0] - n[0]; });
        var kk = Math.min(6, cand.length);
        for (var ci = 0; ci < kk; ci++) {
          var nb = cand[ci][1];
          var key = a < nb ? (a * 100003 + nb) : (nb * 100003 + a);
          if (!seen[key]) { seen[key] = 1; stoneLinks.push([a, nb]); }
        }
      }

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

      /* Das Feld läuft mit der Seite ins Blau, damit Gitternetz und
         Bedienelemente unten dieselbe Farbe sprechen. Der Übergang liegt
         hinter dem Stein, der so seine magentafarbene Phase behält. */
      var blueMix = smoothstep((p - 0.55) / 0.35);
      for (i = 0; i < 8; i++) {
        var bc = bandCosmic[i], bb = bandBlue[i];
        bandColors[i] = color.css({
          h: color.lerpHue(bc.h, bb.h, blueMix),
          s: bc.s + (bb.s - bc.s) * blueMix,
          l: bc.l + (bb.l - bc.l) * blueMix
        });
      }
      latticeStroke = color.css({
        h: color.lerpHue(256, 212, blueMix),
        s: 56 + 18 * blueMix,
        l: 60 - 2 * blueMix
      });

      var si = 0;
      while (si < KEYFRAMES.length - 2 && p > KEYFRAMES[si + 1].p) si++;
      var ka = KEYFRAMES[si], kb = KEYFRAMES[si + 1];
      var keyA = ka.k, keyB = kb.k;
      var mix = smoothstep((p - ka.p) / (kb.p - ka.p));

      var dnaP   = presence(p, -1,   0,    0.13, 0.22);
      var bodyP  = presence(p, 0.22, 0.30, 0.42, 0.50);
      var stoneP = presence(p, 0.50, 0.59, 0.69, 0.78);
      var gridP  = presence(p, 0.78, 0.87, 1.02, 1.03);
      var maxP = Math.max(dnaP, bodyP, stoneP, gridP);
      var alpha = 0.18 + 0.46 * maxP;

      var breathe = !reduce && maxP > 0.5;
      var breathAmp = scale * 0.0035 * maxP;
      var t = performance.now() * 0.001;

      /* Sphäre: Rotation, Neigung, Atmung, Perspektive */
      var sphereOn = p > 0.50 && p < 0.785;
      var dnaOn = p < 0.225;
      var dnaRot = t * 0.30;
      var dnaTopY = oy + scale * 0.14, dnaSpan = scale * 0.70;
      var dnaAmp = scale * 0.158, dnaTurns = 1.9;
      var ca = Math.cos(t * 0.16), sa = Math.sin(t * 0.16);
      var ct = Math.cos(-0.18), st = Math.sin(-0.18);
      var sBreath = 1 + 0.02 * Math.sin(t * 0.6), focal = 3.4;
      var sCx = W * 0.5, sCy = oy + scale * 0.50, sR = scale * 0.27;

      for (i = 0; i < n; i++) {
        var q = parts[i];
        var ax, ay, bx, by, sxS = 0, syS = 0, dxS = 0, dyS = 0;

        if (sphereOn) {
          var SX = q.sphere[0], SY = q.sphere[1], SZ = q.sphere[2];
          /* weiche Rausch-Deformation, damit die Kugel wie ein Stein atmet */
          var noise = Math.sin(SX * 2.7 + t * 0.9) * 0.5 +
                      Math.sin(SY * 3.1 - t * 0.7) * 0.3 +
                      Math.sin(SZ * 2.3 + t * 1.1) * 0.4 +
                      Math.sin((SX + SY + SZ) * 1.7 + t) * 0.3;
          var rr = (1 + 0.075 * noise) * sBreath;
          var X = SX * rr, Y = SY * rr, Z = SZ * rr;
          var X1 = X * ca + Z * sa, Z1 = -X * sa + Z * ca;   // Drehung um Y
          var Y2 = Y * ct - Z1 * st, Z2 = Y * st + Z1 * ct;  // Neigung
          var persp = focal / (focal - Z2);
          sxS = sCx + X1 * sR * persp;
          syS = sCy - Y2 * sR * persp;
          q.dmul = 1 + (0.45 + 1.35 * (Z2 + 1) * 0.5 - 1) * stoneP;
        } else {
          q.dmul = 1;
        }

        if (dnaOn) {
          if (q.dnaRole === 2) {                       // Sprosse quer zur Helix
            var ar = q.dnaT * dnaTurns * TAU + dnaRot;
            var xA = ox + dnaAmp * Math.cos(ar), xB = ox - dnaAmp * Math.cos(ar);
            dxS = xA + (xB - xA) * q.dnaU + q.dnaOX;
            dyS = dnaTopY + q.dnaT * dnaSpan + q.dnaOY;
            q.depth = Math.sin(ar) * (1 - 2 * q.dnaU);
          } else {
            var ang = q.dnaT * dnaTurns * TAU + q.dnaPhase + dnaRot;
            var rad = dnaAmp * (1 + q.dnaJitter);
            dxS = ox + rad * Math.cos(ang) + q.dnaOX;
            dyS = dnaTopY + q.dnaT * dnaSpan + q.dnaOY;
            q.depth = Math.sin(ang);
          }
        }

        if (keyA === 'stone') { ax = sxS; ay = syS; }
        else if (keyA === 'dna') { ax = dxS; ay = dyS; }
        else { var A = q[keyA]; ax = A[0]; ay = A[1]; }

        if (keyB === 'stone') { bx = sxS; by = syS; }
        else if (keyB === 'dna') { bx = dxS; by = dyS; }
        else { var B = q[keyB]; bx = B[0]; by = B[1]; }

        var tx = ax + (bx - ax) * mix, ty = ay + (by - ay) * mix;
        if (breathe && !(keyA === 'stone' && keyB === 'stone')) {
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
              var d = Math.sqrt(d2p) || 1, f = 1 - d / pointerR;
              q.vx += (rx / d) * f * 1.3;
              q.vy += (ry / d) * f * 1.3;
            }
          }
          q.x += q.vx; q.y += q.vy;
        }
      }

      /* Additives Blending: überlappende Punkte addieren Helligkeit.
         Das erzeugt den Glut-Effekt ganz ohne Shader oder Blur.          */
      ctx.globalCompositeOperation = 'lighter';

      var dnaDom = dnaP >= bodyP && dnaP >= stoneP && dnaP >= gridP && dnaP > 0.04;
      var bodyDom = !dnaDom && bodyP >= stoneP && bodyP >= gridP && bodyP > 0.04;

      if (dnaDom) {
        drawDNA(n, alpha);
      } else if (bodyDom) {
        drawBody(bodyP, alpha);
      } else {
        drawLattice(stoneP, gridP, alpha);
      }

      /* Funkeln — einzelne Knoten pulsieren auf, am stärksten im Gitter */
      if (!bodyDom && !dnaDom && maxP > 0.3) {
        ctx.fillStyle = 'hsl(205,82%,74%)';
        var strength = 0.35 + 0.85 * gridP;
        ctx.globalAlpha = Math.min(0.8, 0.5 * alpha);
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          var w = parts[i], s = Math.sin(t * 1.7 + w.tw);
          if (s > 0) {
            var r = w.sz * (0.35 + 2.1 * s * strength);
            ctx.moveTo(w.x + r, w.y);
            ctx.arc(w.x, w.y, r, 0, TAU);
          }
        }
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* --- DNA: rotierende Plasma-Doppelhelix in vier Tiefenschichten ----- */
    var DNA_COLORS = ['hsl(224,84%,50%)', 'hsl(206,88%,62%)', 'hsl(194,94%,76%)', 'hsl(190,78%,90%)'];
    function drawDNA(n, alpha) {
      var layers = [[], [], [], []], i;
      for (i = 0; i < n; i++) {
        var d = parts[i].depth;
        layers[d < -0.5 ? 0 : (d < 0 ? 1 : (d < 0.5 ? 2 : 3))].push(i);
      }
      for (var li = 0; li < 4; li++) {
        var arr = layers[li], front = (li + 0.5) / 4;
        ctx.fillStyle = DNA_COLORS[li];

        ctx.globalAlpha = Math.min(0.5, (0.032 + 0.038 * front) * alpha);
        ctx.beginPath();
        for (i = 0; i < arr.length; i++) {
          var h = parts[arr[i]], hr = h.sz * (3.0 + 3.4 * front);
          ctx.moveTo(h.x + hr, h.y); ctx.arc(h.x, h.y, hr, 0, TAU);
        }
        ctx.fill();

        ctx.globalAlpha = Math.min(1, (0.5 + 0.55 * front) * alpha);
        ctx.beginPath();
        for (i = 0; i < arr.length; i++) {
          var c = parts[arr[i]], cr = Math.max(0.7, c.sz * (0.95 + 0.45 * front));
          ctx.moveTo(c.x + cr, c.y); ctx.arc(c.x, c.y, cr, 0, TAU);
        }
        ctx.fill();
      }
    }

    /* --- Körper: Sternenfeld in Menschform, Rot oben / Blau unten ------- */
    function drawBody(bodyP, alpha) {
      var a = Math.min(1, bodyP);
      var yTop = oy + scale * 0.26, yBot = oy + scale * 0.74, r = scale * 0.42;

      var gTop = ctx.createRadialGradient(ox, yTop, 0, ox, yTop, r);
      gTop.addColorStop(0, 'rgba(196,52,92,' + (0.11 * a).toFixed(3) + ')');
      gTop.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gTop; ctx.fillRect(0, 0, W, H);

      var gBot = ctx.createRadialGradient(ox, yBot, 0, ox, yBot, r);
      gBot.addColorStop(0, 'rgba(54,104,205,' + (0.11 * a).toFixed(3) + ')');
      gBot.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gBot; ctx.fillRect(0, 0, W, H);

      var b, k;
      for (b = 0; b < 8; b++) {
        var idx = bodyBands[b];
        if (!idx.length) continue;
        ctx.fillStyle = bandColors[b];

        ctx.globalAlpha = 0.05 * alpha;
        ctx.beginPath();
        for (k = 0; k < idx.length; k++) {
          var h = parts[idx[k]], hr = h.sz * 1.9;
          ctx.moveTo(h.x + hr, h.y); ctx.arc(h.x, h.y, hr, 0, TAU);
        }
        ctx.fill();

        ctx.globalAlpha = Math.min(1, 0.97 * alpha);
        ctx.beginPath();
        for (k = 0; k < idx.length; k++) {
          var c = parts[idx[k]], cr = c.sz > 0.8 ? c.sz : 0.8;
          ctx.moveTo(c.x + cr, c.y); ctx.arc(c.x, c.y, cr, 0, TAU);
        }
        ctx.fill();
      }

      /* Sterne: die größeren Innenpunkte bekommen einen weiten Hof */
      for (b = 0; b < 8; b++) {
        var ids = bodyBands[b];
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

    /* --- Sphäre und Gitternetz: verbundene Knoten ----------------------- */
    function drawLattice(stoneP, gridP, alpha) {
      var isSphere = stoneP >= gridP;
      var links = isSphere ? stoneLinks : gridLinks;
      var lp = isSphere ? stoneP : gridP;
      var strength = isSphere ? 0.92 : 0.5;
      var bands = isSphere ? sphereBands : gridBands;

      var lineAlpha = lp * strength * alpha;
      if (links && lineAlpha > 0.006) {
        ctx.globalAlpha = Math.min(0.72, lineAlpha);
        ctx.strokeStyle = latticeStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        /* Zu lange Linien überspringen — sonst zieht der Morph Striche
           quer über den Schirm, statt das Netz zusammenzuweben.          */
        var maxLen2 = (scale * 0.10) * (scale * 0.10);
        for (var k = 0; k < links.length; k++) {
          var u = parts[links[k][0]], v = parts[links[k][1]];
          var dx = u.x - v.x, dy = u.y - v.y;
          if (dx * dx + dy * dy > maxLen2) continue;
          ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y);
        }
        ctx.stroke();
      }

      var glow = Math.max(gridP, stoneP * 0.85), b, i;
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

  global.EnergyField = { init: init, inBody: inBody };
})(window);
