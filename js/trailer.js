/* ==========================================================================
   Beyond the Horizon: cinematic trailer.
   Every frame is drawn from the trailer clock (draw(t) is deterministic), and
   the original score is synthesized with the Web Audio API, so the same code
   plays live in the browser and renders frame by frame to a video file.
   ========================================================================== */
'use strict';

const Trailer = (() => {
  const W = 1920, H = 1080, BAR = 0.9, DUR = 80;
  const B = n => n * BAR;                       // bar number -> seconds
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eo = t => 1 - Math.pow(1 - cl(t), 3);
  const eio = t => { t = cl(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const rngf = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  const IDS = ['dias', 'columbus', 'gama', 'magellan'];
  const GOLD = '#f3d58a';
  const A = {};                                  // pre-rendered assets

  /* ======================= Assets ======================= */
  function heroFigure(id, size) {
    // Render the game portrait on a key colour, then lift the figure off its medallion.
    const src = cv(size, size), g = src.getContext('2d');
    Art.portrait(g, id, size, { bg1: '#00ff00', bg2: '#00ff00' });
    const out = cv(size, size), o = out.getContext('2d');
    o.save(); o.beginPath(); o.arc(size / 2, size / 2, size * 0.452, 0, 7); o.clip(); o.drawImage(src, 0, 0); o.restore();
    const im = o.getImageData(0, 0, size, size), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (gg > 120 && gg > r * 1.6 && gg > b * 1.6) d[i + 3] = 0;
      else if (gg > r + 30 && gg > b + 30) { d[i + 1] = Math.max(r, b); d[i + 3] = 150; }
    }
    o.putImageData(im, 0, 0);
    // soften the round bottom edge of the bust
    o.globalCompositeOperation = 'destination-out';
    const fade = o.createLinearGradient(0, size * 0.72, 0, size * 0.96);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    o.fillStyle = fade; o.fillRect(0, 0, size, size);
    // golden rim-light version
    const glow = cv(size, size), q = glow.getContext('2d');
    q.filter = 'blur(14px)'; q.drawImage(out, 0, 0); q.filter = 'none';
    q.globalCompositeOperation = 'source-in'; q.fillStyle = '#ffd88a'; q.fillRect(0, 0, size, size);
    // dark silhouette version
    const sil = cv(size, size), s = sil.getContext('2d');
    s.drawImage(out, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#07090c'; s.fillRect(0, 0, size, size);
    return { fig: out, glow, sil };
  }
  function shipCanvas(opts, fill) {
    const c = cv(900, 760), g = c.getContext('2d');
    Art.shipSide(g, 450, 560, 7.2, opts);
    if (fill) { g.globalCompositeOperation = 'source-in'; g.fillStyle = fill; g.fillRect(0, 0, 900, 760); }
    return c;
  }
  function sceneCanvas(spec, seed) { const c = cv(1200, 520); Art.scene(c, spec, seed); return c; }

  function prep() {
    World.init();
    const MW = 2880, MH = 1620;
    A.mapOld = cv(MW, MH);
    A.proj = OldMap.render(A.mapOld, { know: OldMap.knowledgeFrom({}) });
    A.mapNew = cv(MW, MH);
    OldMap.render(A.mapNew, { know: OldMap.knowledgeFrom({ dias: 1, gama: 1, columbus: 1, magellan: 1 }) });
    A.routes = {};
    for (const ex of EXPLORERS) {
      const ll = [[ex.start.lat, ex.start.lon], ...ex.waypoints.map(p => [p.lat, p.lon])];
      const parts = OldMap.splitRoute(ll).map(part => part.map(([la, lo]) => A.proj.PW(lo, la)));
      let len = 0; const segs = [];
      for (const pp of parts) for (let i = 1; i < pp.length; i++) { const l = Math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1]); segs.push([pp[i - 1], pp[i], len, l]); len += l; }
      A.routes[ex.id] = { segs, len, color: ex.color, start: parts[0][0] };
    }
    A.hero = {}; A.medal = {};
    for (const id of IDS) {
      A.hero[id] = heroFigure(id, 900);
      const m = cv(420, 420); Art.portrait(m.getContext('2d'), id, 420); A.medal[id] = m;
    }
    A.ship = shipCanvas({ sails: 'lateen', hull: '#4a2c16' });
    A.shipSq = shipCanvas({ sails: 'square', hull: '#3e2512' });
    A.shipSil = shipCanvas({ sails: 'lateen' }, '#0b0a0c');
    A.shipSqSil = shipCanvas({ sails: 'square' }, '#0b0a0c');
    A.calicut = sceneCanvas({ sky: 'dusk', land: 'city', items: ['dhows', 'palms', 'ships3'] }, 41);
    A.island = sceneCanvas({ sky: 'dawn', land: 'island', items: ['palms', 'ships3', 'canoes'] }, 17);
    A.strait = sceneCanvas({ sky: 'day', land: 'strait', items: ['ships3', 'mountains'] }, 23);
    A.cape = sceneCanvas({ sky: 'storm', land: 'cliffs', items: ['ships2', 'waves', 'lightning'] }, 9);
    A.grain = [];
    for (let k = 0; k < 6; k++) {
      const c = cv(480, 270), g = c.getContext('2d'), im = g.createImageData(480, 270), r = rngf(k + 3);
      for (let i = 0; i < im.data.length; i += 4) { const v = 110 + r() * 60; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0); A.grain.push(c);
    }
  }

  /* ======================= Drawing kit ======================= */
  function sky(g, top, bot, hz) {
    const gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(-300, -300, W + 600, hz + 302);
  }
  function sun(g, x, y, r, col, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 7);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.08, `rgba(${col},${0.85 * a})`); gr.addColorStop(0.3, `rgba(${col},${0.25 * a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    g.fillStyle = `rgba(255,252,236,${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  function rays(g, x, y, t, col, a, n = 14, len = 1900) {
    g.save(); g.translate(x, y); g.rotate(t * 0.05); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const w = 0.035 + 0.03 * Math.sin(i * 7.3);
      const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.rotate(Math.PI * 2 / n);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(len, -len * w); g.lineTo(len, len * w); g.closePath(); g.fill();
    }
    g.restore();
  }
  function clouds(g, t, seed, n, col, hz, speed = 8) {
    const r = rngf(seed);
    for (let i = 0; i < n; i++) {
      const w = 160 + r() * 360, y = r() * hz * 0.75, x = ((r() * (W + 800) + t * speed * (0.5 + r())) % (W + 800)) - 400;
      Art.cloud(g, x, y, w, col);
    }
  }
  // Layered rolling swells, far to near.
  function sea(g, hz, t, o) {
    const gr = g.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, o.far); gr.addColorStop(1, o.near);
    g.fillStyle = gr; g.fillRect(-300, hz, W + 600, H - hz + 300);
    const rows = 13;
    for (let j = 0; j < rows; j++) {
      const k = j / (rows - 1), y0 = hz + Math.pow(k, 1.7) * (H - hz + 160);
      const amp = (2 + k * k * o.amp), f = 0.004 + (1 - k) * 0.01, sp = o.speed * (0.4 + k);
      g.beginPath(); g.moveTo(-300, H + 300);
      for (let x = -300; x <= W + 300; x += 24) {
        const y = y0 + Math.sin(x * f + t * sp + j * 1.7) * amp + Math.sin(x * f * 2.3 - t * sp * 1.3 + j) * amp * 0.45;
        g.lineTo(x, y);
      }
      g.lineTo(W + 300, H + 300); g.closePath();
      g.fillStyle = o.band(k); g.fill();
      g.strokeStyle = `rgba(${o.foam},${0.08 + 0.4 * k * o.foamA})`; g.lineWidth = 1 + k * 3; g.stroke();
    }
    // glints
    if (o.glint) {
      const r = rngf(5);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 160; i++) {
        const k = r(), y = hz + Math.pow(k, 1.6) * (H - hz), x = o.gx + (r() - 0.5) * (200 + k * 1100) + Math.sin(t * 2 + i) * 6;
        const a = o.glint * (0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 1.7))) * (1 - k * 0.6);
        g.fillStyle = `rgba(255,236,190,${a})`; g.fillRect(x, y, 6 + k * 40, 1.5 + k * 2);
      }
      g.restore();
    }
  }
  const SEA = {
    dawn: { far: '#e2a271', near: '#0e2430', amp: 26, speed: 1.1, foam: '255,236,210', foamA: 0.6, glint: 0.8, band: k => `rgb(${lerp(150, 14, k) | 0},${lerp(102, 38, k) | 0},${lerp(86, 52, k) | 0})` },
    storm: { far: '#4c5658', near: '#06090c', amp: 70, speed: 2.4, foam: '220,235,240', foamA: 1, glint: 0, band: k => `rgb(${lerp(70, 8, k) | 0},${lerp(80, 14, k) | 0},${lerp(84, 18, k) | 0})` },
    night: { far: '#1a2a48', near: '#02060d', amp: 22, speed: 0.9, foam: '170,200,255', foamA: 0.4, glint: 0.35, band: k => `rgb(${lerp(28, 3, k) | 0},${lerp(44, 9, k) | 0},${lerp(78, 20, k) | 0})` },
    gold: { far: '#f0b468', near: '#160d08', amp: 30, speed: 1.3, foam: '255,220,160', foamA: 0.7, glint: 1, band: k => `rgb(${lerp(196, 22, k) | 0},${lerp(122, 14, k) | 0},${lerp(60, 10, k) | 0})` },
  };
  function ship(g, img, x, y, s, t, o = {}) {
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * (o.bobF || 1.3)) * (o.roll || 0.05) + (o.tilt || 0)); g.scale((o.dir || 1) * s, s);
    g.drawImage(img, -450, -560); g.restore();
  }
  function lightning(g, seed, x0, y0, len, a) {
    const r = rngf(seed);
    const pts = [[x0, y0]]; let x = x0, y = y0;
    while (y < y0 + len) { x += (r() - 0.5) * 90; y += 30 + r() * 50; pts.push([x, y]); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
    for (const [w, al] of [[26, 0.08], [10, 0.25], [3, 1]]) {
      g.strokeStyle = `rgba(210,225,255,${al * a})`; g.lineWidth = w; g.beginPath();
      pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
    }
    g.restore();
  }
  function rain(g, t, a) {
    const r = rngf(77); g.save(); g.strokeStyle = `rgba(200,215,230,${0.35 * a})`; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 260; i++) {
      const x = (r() * (W + 400) - t * 900 * (0.8 + r() * 0.4)) % (W + 400), xx = x < -200 ? x + W + 400 : x;
      const y = (r() * H + t * 2400 * (0.8 + r() * 0.5)) % H;
      g.moveTo(xx, y); g.lineTo(xx - 34, y + 90);
    }
    g.stroke(); g.restore();
  }
  function embers(g, t, seed, n, col, a = 1) {
    const r = rngf(seed); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const sp = 40 + r() * 120, x = (r() * W + Math.sin(t * (0.5 + r()) + i) * 60) % W, y = H - ((r() * H + t * sp) % (H + 100));
      const s = 1.5 + r() * 4; g.fillStyle = `rgba(${col},${a * (0.3 + 0.7 * r())})`;
      g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    }
    g.restore();
  }
  function spray(g, t, x, y, a) {
    const r = rngf(31); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 220; i++) {
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.2, v = 300 + r() * 1100, tt = (t + r() * 0.6) % 1.2;
      const px = x + Math.cos(ang) * v * tt, py = y + Math.sin(ang) * v * tt + 900 * tt * tt;
      g.fillStyle = `rgba(235,245,255,${a * (1 - tt / 1.2) * 0.6})`; g.beginPath(); g.arc(px, py, 2 + r() * 7, 0, 7); g.fill();
    }
    g.restore();
  }
  // Camera: push-in / pan around a focus point.
  function cam(g, zoom, fx = W / 2, fy = H / 2, rot = 0, dx = 0, dy = 0) {
    g.translate(W / 2 + dx, H / 2 + dy); g.rotate(rot); g.scale(zoom, zoom); g.translate(-fx, -fy);
  }
  function cover(g, img, zoom, fx, fy) {
    // draw img to cover the frame, zoomed around fx,fy (0..1 of image)
    const s = Math.max(W / img.width, H / img.height) * zoom;
    const w = img.width * s, h = img.height * s;
    g.drawImage(img, W / 2 - fx * w, H / 2 - fy * h, w, h);
  }
  function grade(g, col, a, mode = 'soft-light') { g.save(); g.globalCompositeOperation = mode; g.fillStyle = `rgba(${col},${a})`; g.fillRect(0, 0, W, H); g.restore(); }

  // Low-angle hero shot: the figure is drawn in horizontal strips that widen toward
  // the bottom, so the captain looms over the camera.
  function heroDraw(g, id, lt, o) {
    const F = A.hero[id], S = 900;
    const p = cl(lt / o.d);
    const zoom = lerp(1.0, 1.12, eio(p));
    const cx = W * (o.x || 0.62), top = H * (o.top ?? 0.13) - 24 * p, hgt = 980 * zoom * (o.k || 1), wTop = 700 * zoom * (o.k || 1), wBot = 1030 * zoom * (o.k || 1);
    const strips = 70;
    const drawStrips = img => {
      for (let i = 0; i < strips; i++) {
        const a = i / strips, b = (i + 1) / strips;
        const wa = lerp(wTop, wBot, Math.pow(a, 1.3)), y = top + hgt * a, hh = hgt / strips + 1;
        g.drawImage(img, 0, S * a, S, S / strips + 1, cx - wa / 2, y, wa, hh);
      }
    };
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9; drawStrips(F.glow); g.restore();
    drawStrips(F.fig);
    // under-lighting falloff for drama
    const sh = g.createLinearGradient(0, H * 0.45, 0, H);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
  }

  /* ---------------- Typography ---------------- */
  const FONT = { display: '"Cinzel Decorative", "Cinzel", Georgia, serif', cinzel: '"Cinzel", Georgia, serif', fell: '"IM Fell English", Georgia, serif', sc: '"IM Fell English SC", Georgia, serif' };
  function text(g, s, x, y, o = {}) {
    g.save();
    g.font = `${o.weight || ''} ${o.size || 60}px ${o.font || FONT.cinzel}`;
    g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = (o.track || 0) + 'px';
    g.globalAlpha = o.a ?? 1;
    if (o.scale) { g.translate(x, y); g.scale(o.scale, o.scale); x = 0; y = 0; }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 30; }
    if (o.gold) {
      const w = g.measureText(s).width;
      const x0 = g.textAlign === 'left' ? x : x - w / 2;
      const gr = g.createLinearGradient(x0, y - o.size / 2, x0 + w, y + o.size / 2);
      gr.addColorStop(0, '#8a5a1c'); gr.addColorStop(0.35, '#f7e2a0'); gr.addColorStop(0.5, '#fff8dc'); gr.addColorStop(0.65, '#e9c46a'); gr.addColorStop(1, '#7a4c14');
      g.fillStyle = gr;
    } else g.fillStyle = o.color || '#f4ead2';
    g.fillText(s, x, y);
    if (o.shine !== undefined) {
      g.shadowBlur = 0; g.globalCompositeOperation = 'source-atop';
      const w = g.measureText(s).width, sx = (g.textAlign === 'left' ? x : x - w / 2) + (w + 400) * o.shine - 200;
      const gr = g.createLinearGradient(sx - 120, 0, sx + 120, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillText(s, x, y);
    }
    g.restore();
  }
  // A short text card that fades in, holds and fades out over [t0,t1].
  function cardA(lt, d, inT = 0.35, outT = 0.35) { return cl(lt / inT) * cl((d - lt) / outT); }

  /* ======================= Shots ======================= */
  const shots = [];
  const S = (b0, b1, fn, o = {}) => shots.push(Object.assign({ t0: B(b0), t1: B(b1), fn }, o));

  // ---- Act I: the edge of the map --------------------------------------
  S(0, 4, (g, lt, d) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const a = cardA(lt - 0.9, d - 0.9, 0.8, 0.6);
    text(g, '1487', W / 2, H / 2, { size: 120, font: FONT.cinzel, weight: 700, track: 30, a, color: '#e8d9b4' });
  });
  S(4, 10, (g, lt, d) => {
    const p = lt / d;
    g.save(); cam(g, lerp(2.6, 2.1, eio(p)), lerp(1720, 1880, p), lerp(1180, 1150, p)); g.drawImage(A.mapOld, 0, 0); g.restore();
    // candle light
    const fl = 0.85 + 0.15 * Math.sin(lt * 9) * Math.sin(lt * 3.3);
    const gr = g.createRadialGradient(W * 0.35, H * 0.45, 50, W * 0.4, H * 0.5, 1300);
    gr.addColorStop(0, `rgba(255,170,80,${0.15 * fl})`); gr.addColorStop(0.5, 'rgba(40,20,5,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0.92)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    text(g, 'Once, every map had an edge.', W / 2, H * 0.8, { size: 54, font: FONT.fell, a: cardA(lt - 0.6, 3.2) * 0.95, glow: 'rgba(0,0,0,0.9)' });
    text(g, 'No one knew what lay beyond it.', W / 2, H * 0.8, { size: 54, font: FONT.fell, a: cardA(lt - 3.3, 2.4) * 0.95, glow: 'rgba(0,0,0,0.9)' });
  }, { grade: ['255,140,60', 0.25] });
  S(10, 12, (g, lt, d) => {
    const p = lt / d;
    g.save(); cam(g, lerp(1.25, 1.12, p), W * 0.5, H * 0.5); g.drawImage(A.mapOld, 0, 0, W, H); g.restore();
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, W, H);
    text(g, 'Sailors whispered of sea monsters…', W / 2, H * 0.8, { size: 54, font: FONT.fell, a: cardA(lt, d), glow: 'rgba(0,0,0,0.9)' });
  }, { grade: ['255,140,60', 0.2] });
  S(12, 13, (g, lt, d) => {
    // the serpent rises out of a black sea
    g.fillStyle = '#050608'; g.fillRect(0, 0, W, H);
    sea(g, H * 0.62, lt + 10, SEA.night);
    const rise = eo(lt / 0.6);
    g.save(); g.translate(W * 0.5, H * 0.66 + (1 - rise) * 300); g.scale(4.2, 4.2);
    g.fillStyle = '#0d1a1a'; g.strokeStyle = 'rgba(160,220,200,0.35)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-60, 20); g.bezierCurveTo(-55, -40, -10, -90, 18, -80); g.bezierCurveTo(40, -74, 46, -52, 34, -44); g.bezierCurveTo(22, -38, 10, -50, 4, -40); g.bezierCurveTo(-8, -20, -22, 0, -24, 20); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(24, -66, 3, 0, 7); g.fill();
    for (const hx of [70, 130]) { g.fillStyle = '#0d1a1a'; g.beginPath(); g.ellipse(hx, 18, 26, 22, 0, Math.PI, 0); g.fill(); g.stroke(); }
    g.restore();
    text(g, 'MONSTERS', W / 2, H * 0.22, { size: 110, font: FONT.cinzel, weight: 700, track: 40, a: cardA(lt, d, 0.08, 0.2), color: '#d9e6e0' });
  }, { flash: 0.6, grade: ['40,120,110', 0.35] });
  S(13, 14, (g, lt, d) => {
    sky(g, '#0c1014', '#3a434a', H * 0.6);
    lightning(g, 4, W * 0.62, -20, H * 0.7, lt < 0.25 ? 1 : 0.3);
    if (lt < 0.18) { g.fillStyle = 'rgba(220,230,255,0.5)'; g.fillRect(0, 0, W, H); }
    sea(g, H * 0.6, lt + 3, SEA.storm);
    rain(g, lt, 1);
    text(g, 'STORMS', W / 2, H * 0.22, { size: 110, font: FONT.cinzel, weight: 700, track: 40, a: cardA(lt, d, 0.08, 0.2), color: '#e6eef5' });
  }, { flash: 1 });
  S(14, 16, (g, lt, d) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    text(g, 'THE END OF THE WORLD', W / 2, H / 2, { size: 84, font: FONT.cinzel, weight: 700, track: 30, a: cardA(lt, 0.95, 0.1, 0.3), color: '#e8d9b4' });
  });

  // ---- Act II: setting sail ----------------------------------------------
  S(16, 20, (g, lt, d) => {
    const p = lt / d, hz = H * 0.66;
    g.save(); cam(g, lerp(1.0, 1.08, p), W / 2, H * 0.6);
    sky(g, '#2b3f63', '#f2b27a', hz); sun(g, W * 0.3, hz - 40, 46, '255,214,150'); rays(g, W * 0.3, hz - 40, lt, '255,200,140', 0.06);
    clouds(g, lt, 3, 7, 'rgba(255,190,150,0.35)', hz);
    sea(g, hz, lt, Object.assign({ gx: W * 0.3 }, SEA.dawn));
    ship(g, A.shipSil, W * 0.64, hz + 70, 0.62, lt, { roll: 0.04 });
    g.restore();
    text(g, 'But some sailed anyway.', W / 2, H * 0.8, { size: 58, font: FONT.fell, a: cardA(lt - 0.7, 2.6), glow: 'rgba(0,0,0,0.8)' });
  }, { flash: 0.5, grade: ['255,150,80', 0.3] });
  S(20, 22, (g, lt, d) => {
    g.fillStyle = '#120b06'; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 900); gr.addColorStop(0, '#6a4524'); gr.addColorStop(1, '#0c0703');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const spin = Math.sin(lt * 3) * 0.6 * Math.exp(-lt * 0.8) + lt * 0.15;
    g.save(); cam(g, lerp(1.25, 1.45, lt / d), W / 2, H / 2, 0.12);
    Art.compassRose(g, W / 2, H / 2, 380, { rotate: spin });
    g.restore();
    rays(g, W / 2, H / 2, lt, '255,210,150', 0.035);
  }, { flash: 0.4, grade: ['255,160,80', 0.2] });
  S(22, 24, (g, lt, d) => {
    // night sky: star trails wheel around the pole star (navigating by latitude)
    sky(g, '#02040b', '#13234a', H);
    const r = rngf(12), px = W * 0.5, py = H * 0.3;
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const rad = 40 + r() * 1400, a0 = r() * 7, arc = 0.05 + lt * 0.12;
      g.strokeStyle = `rgba(220,230,255,${0.25 + r() * 0.6})`; g.lineWidth = 1 + r() * 2;
      g.beginPath(); g.arc(px, py, rad, a0, a0 + arc); g.stroke();
    }
    g.fillStyle = '#fffbe8'; g.shadowColor = '#bcd2ff'; g.shadowBlur = 30; g.beginPath(); g.arc(px, py, 7, 0, 7); g.fill();
    g.restore();
    sea(g, H * 0.82, lt, Object.assign({ gx: px }, SEA.night));
    ship(g, A.shipSil, W * 0.3, H * 0.86, 0.55, lt);
  }, { flash: 0.4, grade: ['60,90,200', 0.2] });
  S(24, 26, (g, lt, d) => {
    // a wave breaks over the camera
    const hz = H * 0.42;
    g.save(); cam(g, 1.1, W / 2, H / 2, Math.sin(lt * 2.4) * 0.05);
    sky(g, '#2e3a42', '#90a3a8', hz); clouds(g, lt, 8, 9, 'rgba(60,70,78,0.7)', hz, 30);
    sea(g, hz, lt * 1.3, SEA.storm);
    ship(g, A.ship, W * 0.5, H * 0.66, 0.8, lt, { roll: 0.14, bobF: 2.2, dir: -1 });
    g.restore();
    spray(g, lt, W * 0.5, H * 0.95, 1);
    if (lt > 1.2) { g.fillStyle = `rgba(230,240,245,${cl((lt - 1.2) / 0.5) * 0.9})`; g.fillRect(0, 0, W, H); }
  }, { flash: 0.3 });
  S(26, 30, (g, lt, d) => {
    // the routes draw themselves across the old map
    const p = lt / d;
    g.save(); cam(g, lerp(1.0, 1.22, eio(p)), W * 0.46, H * 0.55);
    g.drawImage(A.mapNew, 0, 0, W, H);
    const s = W / A.mapNew.width;
    IDS.forEach((id, i) => {
      const rt = A.routes[id], k = cl((p - i * 0.12) / 0.55) * rt.len;
      g.save(); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
      const path = new Path2D(); let tip = rt.start;
      for (const [a, b, l0, l] of rt.segs) {
        if (l0 > k) break;
        const f = cl((k - l0) / l), e = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
        path.moveTo(a[0], a[1]); path.lineTo(e[0], e[1]); tip = e;
      }
      g.strokeStyle = 'rgba(255,246,220,0.85)'; g.lineWidth = 12; g.stroke(path);
      g.strokeStyle = rt.color; g.lineWidth = 6; g.stroke(path);
      g.fillStyle = '#fff6dd'; g.shadowColor = '#ffd27a'; g.shadowBlur = 25; g.beginPath(); g.arc(tip[0], tip[1], 9, 0, 7); g.fill();
      g.restore();
    });
    g.restore();
    const vg = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1200); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    text(g, 'Four captains.', W / 2, H * 0.8, { size: 66, font: FONT.cinzel, weight: 700, track: 10, a: cardA(lt - 0.4, 1.6), glow: 'rgba(0,0,0,0.9)' });
    text(g, 'Four voyages into the unknown.', W / 2, H * 0.8, { size: 62, font: FONT.cinzel, weight: 700, track: 6, a: cardA(lt - 2.0, 1.6), glow: 'rgba(0,0,0,0.9)' });
  }, { flash: 0.4, grade: ['255,150,70', 0.2] });
  S(30, 32, (g, lt) => {
    // four silhouettes flash in the dark
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const i = Math.min(3, Math.floor(lt / 0.45)), id = IDS[i], lt2 = lt - i * 0.45;
    const gr = g.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, 700); gr.addColorStop(0, 'rgba(255,190,110,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = cl(1 - lt2 / 0.45); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7; g.drawImage(A.hero[id].glow, W / 2 - 450, H * 0.12, 900, 900); g.restore();
    g.drawImage(A.hero[id].sil, W / 2 - 450, H * 0.12, 900, 900);
  }, { cuts: [0.45, 0.9, 1.35] });

  // ---- Act III: the captains --------------------------------------------
  const HEROES = [
    { id: 'dias', name: 'BARTOLOMEU DIAS', year: '1488', flag: 'portugal', tag: 'He sailed into the storm…', tag2: '…and found the way around Africa.', col: '255,150,90', light: '120,170,220' },
    { id: 'columbus', name: 'CHRISTOPHER COLUMBUS', year: '1492', flag: 'spain', tag: 'He sailed west, toward “Asia”…', tag2: '…and reached lands Europe never knew.', col: '255,170,100', light: '255,190,120' },
    { id: 'gama', name: 'VASCO DA GAMA', year: '1498', flag: 'portugal', tag: 'Three months out of sight of land…', tag2: '…to open the sea road to India.', col: '255,140,70', light: '255,160,90' },
    { id: 'magellan', name: 'FERDINAND MAGELLAN', year: '1519', flag: 'spain', tag: 'All the way around the world.', tag2: 'Not all of them came home.', col: '200,220,255', light: '190,215,255' },
  ];
  HEROES.forEach((h, i) => {
    const b0 = 32 + i * 8;
    // establishing action shot
    S(b0, b0 + 2, (g, lt, d) => {
      const p = lt / d;
      if (h.id === 'dias') {
        g.save(); cam(g, lerp(1.05, 1.18, p), W * 0.55, H * 0.55, -0.02); cover(g, A.cape, 1.0, 0.5, 0.5); g.restore();
        g.fillStyle = 'rgba(10,16,24,0.35)'; g.fillRect(0, 0, W, H);
        lightning(g, 21, W * 0.3, -10, H * 0.6, lt % 0.9 < 0.15 ? 1 : 0.15); rain(g, lt, 1);
        if (lt % 0.9 < 0.1) { g.fillStyle = 'rgba(220,230,255,0.35)'; g.fillRect(0, 0, W, H); }
      } else if (h.id === 'columbus') {
        const hz = H * 0.62; sky(g, '#03060f', '#1b2d55', hz);
        const r = rngf(44); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.7})`; g.fillRect(r() * W, r() * hz, 2, 2); }
        sun(g, W * 0.76, H * 0.2, 30, '220,230,255', 0.8);
        sea(g, hz, lt, Object.assign({ gx: W * 0.76 }, SEA.night));
        [[0.3, 0.72], [0.48, 0.42], [0.66, 0.5]].forEach(([fx, s], k) => ship(g, A.shipSil, W * fx + lt * 25, hz + 40 + s * 90, s, lt + k));
      } else if (h.id === 'gama') {
        g.save(); cam(g, lerp(1.0, 1.14, p), W * 0.5, H * 0.5); cover(g, A.calicut, 1.0, 0.5, 0.5); g.restore();
        embers(g, lt, 8, 40, '255,190,120', 0.6);
      } else {
        g.save(); cam(g, lerp(1.15, 1.02, p), W * 0.5, H * 0.45); cover(g, A.strait, 1.0, 0.5, 0.5); g.restore();
        embers(g, lt, 3, 120, '240,248,255', 0.7);   // snow
      }
    }, { flash: 0.9, grade: [h.col, 0.28] });
    // hero portrait: low angle, rim light, name slam
    S(b0 + 2, b0 + 5, (g, lt, d) => {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a0d14'); bg.addColorStop(0.6, `rgba(${h.col},0.55)`); bg.addColorStop(1, '#08070a');
      g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      sun(g, W * 0.7, H * 0.4, 60, h.light, 0.75);
      rays(g, W * 0.7, H * 0.4, lt + i, h.light, 0.07);
      clouds(g, lt, 50 + i, 6, `rgba(${h.col},0.18)`, H * 0.7, 40);
      heroDraw(g, h.id, lt, { d, x: 0.7 });
      embers(g, lt, 60 + i, 50, h.light, 0.5);
      const slam = eo((lt - 0.25) / 0.35), X = W * 0.08;
      const parts = h.name.split(' '), first = parts.length > 2 ? parts.slice(0, -2).join(' ') : parts[0], last = parts.length > 2 ? parts.slice(-2).join(' ') : parts.slice(1).join(' ');
      text(g, first, X, H * 0.36, { align: 'left', size: 46, font: FONT.cinzel, weight: 700, track: 18, color: '#e9dcc0', a: cl((lt - 0.15) / 0.2), glow: 'rgba(0,0,0,0.9)' });
      g.save(); g.translate(X, H * 0.46); g.scale(lerp(1.25, 1, slam), lerp(1.25, 1, slam));
      text(g, last, 0, 0, { align: 'left', size: 118, font: FONT.cinzel, weight: 700, track: 4, gold: true, a: cl((lt - 0.25) / 0.15), shine: cl((lt - 0.7) / 1.2), glow: 'rgba(0,0,0,0.95)', blur: 40 });
      g.restore();
      text(g, h.year, X, H * 0.57, { align: 'left', size: 50, font: FONT.cinzel, weight: 700, track: 22, color: '#e9dcc0', a: cl((lt - 0.8) / 0.4) });
      if (lt > 0.9) {
        g.save(); g.globalAlpha = cl((lt - 0.9) / 0.4);
        Art.flag(g, h.flag, X, H * 0.63, 78, 52);
        g.strokeStyle = 'rgba(243,213,138,0.8)'; g.lineWidth = 2; g.strokeRect(X, H * 0.63, 78, 52);
        text(g, h.flag === 'spain' ? 'SAILING FOR SPAIN' : 'SAILING FOR PORTUGAL', X + 100, H * 0.63 + 27, { align: 'left', size: 26, font: FONT.cinzel, weight: 700, track: 8, color: '#d8c9a5' });
        g.restore();
      }
    }, { flash: 1, hit: true });
    // second action shot with the tagline
    S(b0 + 5, b0 + 8, (g, lt, d) => {
      const p = lt / d;
      if (h.id === 'dias') {
        const hz = H * 0.55; g.save(); cam(g, 1.05, W / 2, H / 2, Math.sin(lt * 1.7) * 0.04);
        sky(g, '#1d262d', '#6e7c80', hz); clouds(g, lt, 13, 10, 'rgba(40,48,55,0.75)', hz, 50);
        sea(g, hz, lt, SEA.storm); ship(g, A.ship, W * 0.45, hz + 170, 0.72, lt, { roll: 0.16, bobF: 2 });
        g.restore(); rain(g, lt, 0.9); spray(g, lt, W * 0.42, hz + 290, 0.7);
        if (lt > 1.7) { sun(g, W * 0.8, hz - 60, 40, '255,220,160', cl((lt - 1.7) / 0.8) * 0.8); rays(g, W * 0.8, hz - 60, lt, '255,220,160', cl((lt - 1.7) / 0.8) * 0.08); }
      } else if (h.id === 'columbus') {
        g.save(); cam(g, lerp(1.02, 1.16, p), W * 0.5, H * 0.5); cover(g, A.island, 1.0, 0.5, 0.5); g.restore();
        sun(g, W * 0.72, H * 0.52, 30, '255,220,170', 0.5);
      } else if (h.id === 'gama') {
        const hz = H * 0.6; g.save(); cam(g, lerp(1.0, 1.1, p), W * 0.4, H * 0.6);
        sky(g, '#3b2a4a', '#f3a65e', hz); sun(g, W * 0.2, hz - 30, 50, '255,200,130'); rays(g, W * 0.2, hz - 30, lt, '255,190,120', 0.06);
        sea(g, hz, lt, Object.assign({ gx: W * 0.2 }, SEA.gold));
        ship(g, A.shipSqSil, W * 0.55 + lt * 40, hz + 70, 0.5, lt);
        ship(g, A.shipSqSil, W * 0.76 + lt * 30, hz + 30, 0.28, lt + 1);
        g.restore();
      } else {
        // the globe: route wraps the world
        g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
        const R = 430, cx = W / 2, cy = H * 0.5, rot = lt * 0.5;
        const gg = g.createRadialGradient(cx - 120, cy - 140, 30, cx, cy, R); gg.addColorStop(0, '#2c5a7a'); gg.addColorStop(1, '#061424');
        g.fillStyle = gg; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
        g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
        g.strokeStyle = 'rgba(160,210,240,0.25)'; g.lineWidth = 1.5;
        for (let k = 0; k < 12; k++) { const a = rot + k / 12 * Math.PI; const ex = Math.cos(a) * R; g.beginPath(); g.ellipse(cx, cy, Math.abs(ex), R, 0, 0, 7); g.stroke(); }
        for (let k = -3; k <= 3; k++) { g.beginPath(); g.ellipse(cx, cy + k * R / 4, Math.sqrt(R * R - (k * R / 4) ** 2), 26 * Math.cos(k / 4), 0, 0, 7); g.stroke(); }
        // route ring
        g.strokeStyle = '#ffd27a'; g.lineWidth = 7; g.shadowColor = '#ffb34a'; g.shadowBlur = 30; g.beginPath();
        const prog = eio(cl(lt / 2.2)) * Math.PI * 2;
        for (let a = 0; a <= prog; a += 0.03) { const x = cx + Math.cos(a - Math.PI / 2 + 0.3) * R * 0.98, y = cy + Math.sin(a * 1.0 - Math.PI / 2 + 0.3) * R * 0.32 + 60; a ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke(); g.restore();
        g.strokeStyle = 'rgba(180,220,255,0.5)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R + 3, 0, 7); g.stroke();
      }
      text(g, h.tag, W / 2, H * 0.8, { size: 56, font: FONT.fell, a: cardA(lt - 0.15, 1.45), glow: 'rgba(0,0,0,0.95)' });
      text(g, h.tag2, W / 2, H * 0.8, { size: 56, font: FONT.fell, a: cardA(lt - 1.55, 1.15, 0.3, 0.25), glow: 'rgba(0,0,0,0.95)' });
    }, { flash: 0.5, grade: [h.col, 0.22] });
  });

  // ---- Act IV: montage ---------------------------------------------------
  const MONT = [
    (g, lt) => { sky(g, '#222b31', '#7c8b8f', H * 0.5); sea(g, H * 0.5, lt * 1.6 + 7, SEA.storm); ship(g, A.ship, W * 0.5, H * 0.74, 0.9, lt, { roll: 0.2, bobF: 3 }); spray(g, lt, W * 0.5, H, 1); },
    (g, lt) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); heroDraw(g, 'dias', lt + 1, { d: 3, x: 0.5 }); },
    (g, lt) => { g.fillStyle = '#120b06'; g.fillRect(0, 0, W, H); Art.compassRose(g, W / 2, H / 2, 520, { rotate: lt * 3 }); },
    (g, lt) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); heroDraw(g, 'columbus', lt + 1, { d: 3, x: 0.5 }); },
    (g, lt) => { sky(g, '#0c1014', '#3a434a', H * 0.6); lightning(g, 9, W * 0.4, 0, H * 0.7, 1); sea(g, H * 0.6, lt + 2, SEA.storm); rain(g, lt, 1); },
    (g, lt) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); heroDraw(g, 'gama', lt + 1, { d: 3, x: 0.5 }); },
    (g, lt) => { cover(g, A.strait, 1.25 + lt * 0.1, 0.5, 0.45); },
    (g, lt) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); heroDraw(g, 'magellan', lt + 1, { d: 3, x: 0.5 }); },
  ];
  MONT.forEach((fn, k) => S(64 + k, 65 + k, (g, lt) => fn(g, lt), { flash: 0.7, hit: true, grade: ['255,150,80', 0.25] }));
  S(72, 74, (g, lt, d) => {
    // the four captains together
    g.fillStyle = '#07070a'; g.fillRect(0, 0, W, H);
    const sg = g.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, 700); sg.addColorStop(0, 'rgba(255,190,110,0.35)'); sg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = sg; g.fillRect(0, 0, W, H); rays(g, W / 2, H * 0.48, lt, '255,200,130', 0.05);
    IDS.forEach((id, k) => {
      const x = W * (0.2 + k * 0.2), a = cl((lt - k * 0.12) / 0.3), s = lerp(0.6, 0.5, eo(lt / d));
      g.save(); g.globalAlpha = a; g.translate(x, H * 0.48); g.scale(s, s); g.drawImage(A.medal[id], -210, -210); g.restore();
    });
    text(g, 'Choose your captain.', W / 2, H * 0.8, { size: 64, font: FONT.cinzel, weight: 700, track: 8, a: cardA(lt - 0.4, 1.4), gold: true, glow: 'rgba(0,0,0,0.9)' });
  }, { flash: 0.9, hit: true });
  S(74, 76, (g, lt, d) => {
    // sail into the sun
    const hz = H * 0.6, p = lt / d;
    g.save(); cam(g, lerp(1.0, 1.25, eio(p)), W / 2, hz);
    sky(g, '#4a2d3a', '#ffb565', hz); sun(g, W / 2, hz - 30, 70, '255,225,170'); rays(g, W / 2, hz - 30, lt, '255,210,150', 0.09, 18);
    sea(g, hz, lt, Object.assign({ gx: W / 2 }, SEA.gold));
    ship(g, A.shipSil, W / 2, hz + 70 - p * 30, 0.6 - p * 0.15, lt);
    g.restore();
    g.fillStyle = `rgba(255,246,225,${cl((lt - 1.2) / 0.6)})`; g.fillRect(0, 0, W, H);
  }, { flash: 0.5, grade: ['255,160,80', 0.25] });

  // ---- Act V: title ------------------------------------------------------
  S(76, 77, g => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); });
  S(77, DUR / BAR + 1, (g, lt) => {
    g.fillStyle = '#050403'; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, H * 0.48, 40, W / 2, H * 0.48, 1100); gr.addColorStop(0, 'rgba(120,70,25,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = 0.18 * cl(lt / 2); cam(g, 1.0 + lt * 0.01, W / 2, H / 2); g.drawImage(A.mapOld, 0, 0, W, H); g.restore();
    const a = cl(lt / 0.15);
    g.save(); g.globalAlpha = 0.28 * a; Art.compassRose(g, W / 2, H * 0.43, 300, { rotate: lt * 0.04, ink: '#6b4a22', light: '#2a1b0c', red: '#7a2a18', gold: '#9a7330' }); g.restore();
    text(g, 'BEYOND THE HORIZON', W / 2, H * 0.43, { size: 132, font: FONT.display, weight: 700, track: 4, gold: true, a, scale: lerp(1.08, 1, eo(lt / 3)), shine: cl((lt - 0.4) / 1.6), glow: 'rgba(0,0,0,0.95)', blur: 50 });
    text(g, 'VOYAGES OF THE AGE OF EXPLORATION', W / 2, H * 0.56, { size: 34, font: FONT.cinzel, weight: 700, track: 14, color: '#e3d3ac', a: cl((lt - 1.4) / 0.8) });
    text(g, 'Chart the unknown.', W / 2, H * 0.68, { size: 50, font: FONT.fell, color: '#f2e6c8', a: cl((lt - 3.2) / 0.8) });
    embers(g, lt, 99, 60, '255,200,120', 0.5);
    g.fillStyle = `rgba(0,0,0,${cl((lt - (DUR - B(77) - 1.4)) / 1.2)})`; g.fillRect(0, 0, W, H);
  });

  /* ======================= Frame compositor ======================= */
  const hitTimes = [];
  shots.forEach(s => { if (s.hit) hitTimes.push(s.t0); });
  [B(12), B(13), B(32), B(76)].forEach(t => hitTimes.push(t));

  function draw(g, t) {
    g.save();
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const sh = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
    const lt = t - sh.t0, d = sh.t1 - sh.t0;
    // camera shake from recent hits
    let shake = 0; for (const h of hitTimes) if (t >= h && t < h + 0.6) shake += 18 * Math.exp(-(t - h) * 7);
    g.save();
    if (shake > 0.3) g.translate(Math.sin(t * 91) * shake, Math.cos(t * 77) * shake * 0.7);
    sh.fn(g, lt, d, t);
    g.restore();
    if (sh.grade) grade(g, sh.grade[0], sh.grade[1]);
    // cut flash
    const cuts = [0, ...(sh.cuts || [])];
    for (const c of cuts) { const fl = sh.flash && lt >= c ? sh.flash * Math.exp(-(lt - c) * 14) : 0; if (fl > 0.01) { g.fillStyle = `rgba(255,248,235,${fl})`; g.fillRect(0, 0, W, H); } }
    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // film grain
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.22;
    g.drawImage(A.grain[Math.floor(t * 24) % A.grain.length], 0, 0, W, H); g.restore();
    // letterbox (2.39:1)
    const lb = Math.round((H - W / 2.39) / 2);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, lb); g.fillRect(0, H - lb, W, lb);
    g.restore();
  }

  /* ======================= Original score ======================= */
  // D minor swashbuckler in 6/8: galloping low strings, horn theme, taiko, braams.
  function score(ac, out, T0) {
    const r = rngf(2024);
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const E = BAR / 6;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    const trim = ac.createGain(); trim.gain.value = 0.7;
    const master = ac.createGain(); master.gain.value = 0.55; master.connect(comp); comp.connect(lim); lim.connect(trim); trim.connect(out);
    const verb = ac.createConvolver();
    { const len = ac.sampleRate * 3.2, b = ac.createBuffer(2, len, ac.sampleRate); for (let c = 0; c < 2; c++) { const dd = b.getChannelData(c); for (let i = 0; i < len; i++) dd[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.4); } verb.buffer = b; }
    const vg = ac.createGain(); vg.gain.value = 0.35; verb.connect(vg); vg.connect(master);
    const send = (node, wet = 0.4) => { node.connect(master); const s = ac.createGain(); s.gain.value = wet; node.connect(s); s.connect(verb); };
    let noise; { const len = ac.sampleRate * 2; noise = ac.createBuffer(1, len, ac.sampleRate); const dd = noise.getChannelData(0); for (let i = 0; i < len; i++) dd[i] = r() * 2 - 1; }
    const env = (gn, t, a, peak, hold, rel) => { gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(peak, t + a); gn.gain.setValueAtTime(peak, t + a + hold); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); };
    const osc = (type, f, t, stop, det = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.start(t); o.stop(stop); return o; };
    const noiseSrc = (t, stop) => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, r() * 1.5); s.stop(stop); return s; };

    function strings(t, m, dur, vel, o = {}) {
      const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cut || 2200; f.Q.value = 0.7;
      for (const dt of [-9, 0, 8]) osc('sawtooth', mtof(m), t, t + dur + (o.rel || 0.12) + 0.05, dt).connect(f);
      f.connect(g); env(g, t, o.a || 0.015, vel * 0.12, Math.max(0, dur - (o.a || 0.015)), o.rel || 0.12); send(g, o.wet ?? 0.25);
    }
    function horn(t, m, dur, vel) {
      const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1900, t + 0.12); f.frequency.linearRampToValueAtTime(1300, t + dur);
      const lfo = osc('sine', 5.2, t, t + dur + 0.35); const lg = ac.createGain(); lg.gain.value = 6; lfo.connect(lg);
      for (const [type, dt] of [['sawtooth', -6], ['sawtooth', 6], ['square', 0]]) { const o = osc(type, mtof(m), t, t + dur + 0.35, dt); lg.connect(o.detune); o.connect(f); }
      f.connect(g); env(g, t, 0.06, vel * 0.1, Math.max(0, dur - 0.06), 0.25); send(g, 0.45);
    }
    function brass(t, ms, dur, vel) {      // stab / braam
      for (const m of ms) {
        const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(m < 45 ? 1100 : 2600, t + 0.08); f.frequency.exponentialRampToValueAtTime(600, t + dur + 0.3);
        for (const dt of [-12, 0, 12]) osc('sawtooth', mtof(m), t, t + dur + 0.5, dt).connect(f);
        f.connect(g); env(g, t, 0.02, vel * 0.09, dur, 0.4); send(g, 0.5);
      }
    }
    function choir(t, ms, dur, vel) {
      for (const m of ms) {
        const g = ac.createGain(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter();
        f1.type = 'bandpass'; f1.frequency.value = 760; f1.Q.value = 3; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 4;
        for (const dt of [-14, -4, 5, 15]) { const o = osc('sawtooth', mtof(m), t, t + dur + 1.7, dt); o.connect(f1); o.connect(f2); }
        f1.connect(g); f2.connect(g); env(g, t, 0.7, vel * 0.16, Math.max(0, dur - 0.7), 1.6); send(g, 0.7);
      }
    }
    function taiko(t, vel, pitch = 58) {
      const o = osc('sine', pitch, t, t + 1.2), g = ac.createGain();
      o.frequency.setValueAtTime(pitch * 1.6, t); o.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + 0.35);
      o.connect(g); env(g, t, 0.003, vel * 0.9, 0.02, 0.5); send(g, 0.3);
      const n = noiseSrc(t, t + 0.3), f = ac.createBiquadFilter(), ng = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 900; n.connect(f); f.connect(ng); env(ng, t, 0.002, vel * 0.35, 0, 0.12); send(ng, 0.3);
    }
    function snare(t, vel) {
      const n = noiseSrc(t, t + 0.3), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.8;
      n.connect(f); f.connect(g); env(g, t, 0.002, vel * 0.3, 0, 0.09); send(g, 0.35);
    }
    function timp(t, m, vel) {
      const o = osc('sine', mtof(m), t, t + 2), o2 = osc('triangle', mtof(m) * 1.5, t, t + 2), g = ac.createGain();
      o.frequency.setValueAtTime(mtof(m) * 1.04, t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.1);
      o.connect(g); o2.connect(g); env(g, t, 0.004, vel * 0.5, 0.05, 1.1); send(g, 0.4);
    }
    function boom(t, vel) {
      const o = osc('sine', 52, t, t + 4), g = ac.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.6);
      o.connect(g); env(g, t, 0.005, vel, 0.1, 2.8); send(g, 0.25);
      const n = noiseSrc(t, t + 2), f = ac.createBiquadFilter(), ng = ac.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(120, t + 1);
      n.connect(f); f.connect(ng); env(ng, t, 0.003, vel * 0.5, 0, 1.2); send(ng, 0.6);
    }
    function swell(t, dur, vel) {          // reverse cymbal
      const n = noiseSrc(t, t + dur + 0.1), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 4500;
      n.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.35, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05); send(g, 0.5);
    }
    function riser(t, dur, vel) {
      const n = noiseSrc(t, t + dur + 0.1), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
      n.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.5, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.03); send(g, 0.4);
      const o = osc('sawtooth', 80, t, t + dur + 0.05), og = ac.createGain(), of = ac.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 1500;
      o.frequency.exponentialRampToValueAtTime(640, t + dur); o.connect(of); of.connect(og); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vel * 0.06, t + dur); og.gain.linearRampToValueAtTime(0, t + dur + 0.03); send(og, 0.3);
    }
    function whoosh(t, vel) {
      const n = noiseSrc(t, t + 0.6), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
      n.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.25, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); send(g, 0.3);
    }

    const at = b => T0 + B(b);
    // chords: [bass root, chord tones]
    const CH = { Dm: [38, [62, 65, 69]], Bb: [34, [58, 62, 65]], C: [36, [60, 64, 67]], Gm: [31, [55, 58, 62]], A: [33, [57, 61, 64]], F: [41, [60, 65, 69]] };

    // ---- Act I (bars 0-15): drone, choir, hits
    strings(at(0.5), 38, B(15.5), 0.9, { a: 4, cut: 700, rel: 0.5, wet: 0.5 }); strings(at(0.5), 45, B(15.5), 0.6, { a: 5, cut: 800, rel: 0.5, wet: 0.5 });
    choir(at(4), [62, 65], B(8), 0.6); choir(at(10), [62, 65, 69], B(4), 0.8);
    boom(at(1), 0.8); timp(at(1), 38, 0.6);
    boom(at(4), 0.7); brass(at(4), [26, 38, 45], 1.6, 0.8);
    for (let k = 0; k < 6; k++) timp(at(9) + k * 0.15 * (1 - k * 0.08), 38, 0.25 + k * 0.08);
    brass(at(12), [26, 38, 44], 0.7, 1); boom(at(12), 0.9); taiko(at(12), 1, 50);
    brass(at(13), [25, 37, 44], 0.7, 1); boom(at(13), 0.9); taiko(at(13), 1, 48);
    brass(at(14), [26, 38, 41, 45], 0.9, 1.1); boom(at(14), 1);
    riser(at(15), BAR, 1); swell(at(15), BAR, 1);

    // ---- Act II (bars 16-31): the gallop begins
    const prog2 = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Bb', 'Gm', 'A'];
    for (let b = 16; b < 32; b++) {
      const [root, tones] = CH[prog2[(b - 16) % 8]];
      const t = at(b), build = (b - 16) / 16;
      for (let e = 0; e < 6; e++) {
        const acc = e === 0 || e === 3;
        strings(t + e * E, root + 12 + (e === 2 || e === 5 ? 12 : 0), E * 0.55, acc ? 1 : 0.65, { cut: 1400 + build * 1200 });
        if (b >= 20) strings(t + e * E, root, E * 0.6, acc ? 0.9 : 0.5, { cut: 600 });
        if (b >= 24) strings(t + e * E, tones[e % 3] + 12, E * 0.5, 0.35, { cut: 3000 });
      }
      taiko(t, 0.8); taiko(t + 3 * E, 0.6); if (b % 2) taiko(t + 5 * E, 0.45);
      if (b >= 20) { snare(t + 2 * E, 0.35); snare(t + 5 * E, 0.45); }
      if (b >= 24 && b % 2 === 0) horn(t, tones[0] - 12, B(2) - 0.1, 0.7);
      if ((b - 16) % 4 === 0) timp(t, root + 12, 0.6);
    }
    brass(at(16), [26, 38, 45, 50], 1.0, 1); boom(at(16), 0.9);
    swell(at(30), B(2), 1); riser(at(30), B(2), 0.9);
    for (let k = 0; k < 4; k++) { boom(at(30) + k * 0.45, 0.5); whoosh(at(30) + k * 0.45, 0.8); }

    // ---- Act III (bars 32-63): the theme, once per captain
    const prog3 = ['Dm', 'Dm', 'Bb', 'C', 'Gm', 'Dm', 'A', 'A'];
    const MEL = [[69, 3], [74, 2], [76, 1], [77, 3], [76, 2], [74, 1], [74, 2], [72, 1], [70, 3], [72, 2], [74, 1], [76, 3], [79, 3], [77, 2], [76, 1], [77, 2], [76, 1], [74, 3], [76, 2], [73, 1], [69, 3], [76, 4], [69, 2]];
    for (let ph = 0; ph < 4; ph++) {
      const b0 = 32 + ph * 8;
      let e = 0;
      for (const [m, len] of MEL) {
        const t = at(b0) + e * E, dur = len * E - 0.03;
        horn(t, m - 12, dur, 0.9);
        if (ph >= 1) strings(t, m, dur, 0.55, { a: 0.03, cut: 3200, wet: 0.4 });
        if (ph >= 3) strings(t, m + 12, dur, 0.35, { a: 0.03, cut: 4200, wet: 0.45 });
        e += len;
      }
      for (let b = b0; b < b0 + 8; b++) {
        const [root, tones] = CH[prog3[b - b0]], t = at(b);
        for (let k = 0; k < 6; k++) {
          strings(t + k * E, root + 12 + (k === 2 || k === 5 ? 12 : 0), E * 0.55, k % 3 === 0 ? 1 : 0.6, { cut: 2000 });
          strings(t + k * E, root, E * 0.6, k % 3 === 0 ? 0.9 : 0.45, { cut: 650 });
        }
        strings(t, tones[0], BAR, 0.4, { a: 0.2, cut: 1800, wet: 0.5 }); strings(t, tones[1], BAR, 0.35, { a: 0.2, cut: 1800, wet: 0.5 }); strings(t, tones[2], BAR, 0.35, { a: 0.2, cut: 1800, wet: 0.5 });
        taiko(t, 0.9); taiko(t + 3 * E, 0.7); taiko(t + 5 * E, 0.4); snare(t + 2 * E, 0.4); snare(t + 5 * E, 0.5);
        if (ph >= 2) choir(t, tones.map(x => x), BAR, 0.35);
      }
      brass(at(b0 + 2), [CH.Dm[0], 50, 57, 62], 0.5, 0.9); boom(at(b0 + 2), 0.8); timp(at(b0 + 2), 38, 0.8);
      brass(at(b0), [CH.Dm[0] - 12, 38, 50], 0.4, 0.7);
      whoosh(at(b0) - 0.35, 0.8); whoosh(at(b0 + 5) - 0.3, 0.6);
    }

    // ---- Act IV (bars 64-75): montage climax
    const prog4 = ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A', 'Dm', 'Dm', 'Gm', 'A'];
    for (let b = 64; b < 76; b++) {
      const [root, tones] = CH[prog4[b - 64]], t = at(b);
      brass(t, [root, root + 12, ...tones], 0.28, 1); brass(t + 3 * E, [root + 12, ...tones], 0.4, 0.8);
      boom(t, 0.65); whoosh(t - 0.3, 0.7);
      for (let k = 0; k < 6; k++) strings(t + k * E, root + 24 + (k % 2 ? 7 : 0), E * 0.5, 0.7, { cut: 3200 });
      taiko(t, 1); taiko(t + E, 0.5); taiko(t + 3 * E, 0.8); taiko(t + 4 * E, 0.5); snare(t + 2 * E, 0.5); snare(t + 5 * E, 0.6);
      if (b < 72) horn(t, tones[2], BAR - 0.05, 0.9);
      choir(t, tones, BAR, 0.5);
    }
    for (let k = 0; k < 16; k++) snare(at(74) + k * (B(2) / 16), 0.3 + k * 0.04);
    riser(at(74), B(2), 1.2); swell(at(74), B(2), 1.3);
    // the hit, then silence
    brass(at(76), [26, 38, 45, 50, 53], 0.6, 1.3); boom(at(76), 1.1); taiko(at(76), 1.2, 44);

    // ---- Act V: title (bar 77 onward)
    boom(at(77), 1.2); brass(at(77), [26, 38, 45, 50], 2.2, 1.0); timp(at(77), 38, 1);
    choir(at(77), [62, 65, 69], 3.2, 0.9); strings(at(77), 50, 3.4, 0.6, { a: 0.4, cut: 1800, rel: 1.5, wet: 0.6 });
    choir(at(77) + 3.4, [62, 66, 69, 74], 5, 1.0);        // D major: the horizon opens
    strings(at(77) + 3.4, 50, 5, 0.7, { a: 0.6, cut: 2400, rel: 2, wet: 0.6 }); strings(at(77) + 3.4, 57, 5, 0.5, { a: 0.6, cut: 2400, rel: 2, wet: 0.6 }); strings(at(77) + 3.4, 66, 5, 0.5, { a: 0.6, cut: 2400, rel: 2, wet: 0.6 });
    horn(at(77) + 3.4, 62, 2, 0.8); horn(at(77) + 5.4, 69, 3.2, 0.8);
    timp(at(77) + 3.4, 38, 0.8); boom(at(77) + 3.4, 0.5);
    return master;
  }

  /* ======================= Playback & export ======================= */
  let readyP = null;
  function ready() {
    if (readyP) return readyP;
    const fonts = document.fonts ? Promise.race([Promise.all(['700 40px "Cinzel"', '700 40px "Cinzel Decorative"', '40px "IM Fell English"', '40px "IM Fell English SC"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 4000))]) : Promise.resolve();
    readyP = fonts.then(() => { prep(); });
    return readyP;
  }
  async function renderAudio(sr = 48000) {
    const oac = new OfflineAudioContext(2, Math.ceil(sr * DUR), sr);
    score(oac, oac.destination, 0.05);
    return oac.startRendering();
  }
  function wavBase64(buf) {
    const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, bytes = 44 + n * ch * 2;
    const dv = new DataView(new ArrayBuffer(bytes));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { dv.setInt16(o, Math.max(-1, Math.min(1, chans[c][i])) * 32767, true); o += 2; }
    const u8 = new Uint8Array(dv.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  return { W, H, DUR, ready, draw, score, renderAudio, wavBase64 };
})();
