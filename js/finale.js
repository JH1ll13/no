/* ==========================================================================
   Grand Finale: the reward for completing all four voyages.
   A short cinematic (the map of the world redrawn, the routes traced on a
   spinning globe, fireworks over the harbor) followed by a royal decree
   naming the student Admiral of the Ocean Sea, with a downloadable
   certificate and a golden caravel for every future voyage.
   ========================================================================== */
'use strict';

const Finale = (() => {
  const $ = id => document.getElementById(id);
  const ORDER = ['dias', 'columbus', 'gama', 'magellan'];
  const CAPTIONS = {
    dias: ['1488', 'Bartolomeu Dias sails around the southern tip of Africa'],
    columbus: ['1492', 'Christopher Columbus crosses the Ocean Sea to the Americas'],
    gama: ['1498', 'Vasco da Gama reaches India by sea'],
    magellan: ['1522', 'Magellan’s fleet, led home by Elcano, sails around the world'],
  };
  let canvas, ctx, W = 0, H = 0, dpr = 1, frame = null, t = 0, last = 0, onDone = null;
  let oldMapC = null, oldMapProj = null, mapRenderT = -1, landTex = null, globeImg = null, globeData = null;
  let sparks = [], rockets = [], confetti = [], phaseFlags = {};

  /* ---------------- Stats ------------------------------------------------ */
  function stats() {
    const S = Save.data, v = S.voyages;
    const stars = ORDER.reduce((a, id) => a + ((v[id] && v[id].stars) || 0), 0);
    return { stars, codex: Object.keys(S.codex).length, totalCodex: Object.keys(TERMS).length, ducats: S.ducats, rank: UI.rankFor(S.xp).r.t };
  }

  /* ---------------- Globe ------------------------------------------------ */
  function buildLandTexture() {
    if (landTex) return;
    const TW = 720, TH = 360, c = U.canvas(TW, TH), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH);
    g.fillStyle = '#fff';
    const p = new Path2D();
    for (const r of World.rings) {
      if (r.dup) continue;
      for (let i = 0; i < r.n; i++) { const x = (r.lon[i] + 180) / 360 * TW, y = (90 - r.lat[i]) / 180 * TH; i ? p.lineTo(x, y) : p.moveTo(x, y); }
      p.closePath();
    }
    g.fill(p, 'evenodd');
    // Antarctica is not in the game data; paint an ice cap
    g.fillRect(0, TH * (154 / 180), TW, TH);
    const d = g.getImageData(0, 0, TW, TH).data;
    landTex = { w: TW, h: TH, a: new Uint8Array(TW * TH) };
    for (let i = 0; i < TW * TH; i++) landTex.a[i] = d[i * 4] > 127 ? 1 : 0;
  }
  function drawGlobe(g, cx, cy, R, lon0, lat0, alpha) {
    const N = Math.round(R);           // render at half resolution, then scale up
    if (!globeImg || globeImg.width !== N * 2) { globeImg = U.canvas(N * 2, N * 2); globeData = globeImg.getContext('2d').createImageData(N * 2, N * 2); }
    const d = globeData.data, phi0 = U.rad(lat0), sp0 = Math.sin(phi0), cp0 = Math.cos(phi0);
    const L = [-0.55, -0.45, 0.7]; // light from upper left, towards viewer
    for (let j = 0; j < N * 2; j++) {
      const y = (N - j - 0.5) / N;
      for (let i = 0; i < N * 2; i++) {
        const x = (i + 0.5 - N) / N, rr = x * x + y * y, o = (j * N * 2 + i) * 4;
        if (rr > 1) { d[o + 3] = 0; continue; }
        const z = Math.sqrt(1 - rr);
        const lat = Math.asin(z * sp0 + y * cp0);
        const lon = lon0 + Math.atan2(x, z * cp0 - y * sp0) * 180 / Math.PI;
        let tx = Math.floor((((lon + 180) % 360 + 360) % 360) / 360 * landTex.w), ty = Math.floor((90 - U.deg(lat)) / 180 * landTex.h);
        ty = U.clamp(ty, 0, landTex.h - 1);
        const land = landTex.a[ty * landTex.w + tx];
        const shade = U.clamp(0.35 + 0.75 * (x * L[0] * -1 + y * -L[1] * -1 + z * L[2]), 0.25, 1.15);
        const rim = Math.pow(1 - z, 3);
        let r, gg, b;
        if (land) { const ice = Math.abs(U.deg(lat)) > 66; r = ice ? 235 : 214; gg = ice ? 238 : 190; b = ice ? 240 : 130; }
        else { r = 30; gg = 92; b = 128; }
        d[o] = U.clamp(r * shade + rim * 80, 0, 255); d[o + 1] = U.clamp(gg * shade + rim * 120, 0, 255); d[o + 2] = U.clamp(b * shade + rim * 160, 0, 255); d[o + 3] = 255;
      }
    }
    globeImg.getContext('2d').putImageData(globeData, 0, 0);
    g.save(); g.globalAlpha = alpha;
    // glow
    const glow = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35);
    glow.addColorStop(0, 'rgba(255,220,140,0.35)'); glow.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, R * 1.35, 0, 7); g.fill();
    g.imageSmoothingEnabled = true;
    g.drawImage(globeImg, cx - R, cy - R, R * 2, R * 2);
    // graticule
    const projP = (la, lo) => {
      const phi = U.rad(la), lam = U.rad(lo - lon0);
      const cz = sp0 * Math.sin(phi) + cp0 * Math.cos(phi) * Math.cos(lam);
      return [cx + R * Math.cos(phi) * Math.sin(lam), cy - R * (cp0 * Math.sin(phi) - sp0 * Math.cos(phi) * Math.cos(lam)), cz];
    };
    g.strokeStyle = 'rgba(255,240,200,0.18)'; g.lineWidth = 1;
    for (let la = -60; la <= 60; la += 30) { g.beginPath(); let on = false; for (let lo = -180; lo <= 180; lo += 4) { const [x, y, z] = projP(la, lo); if (z > 0) { on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } else on = false; } g.stroke(); }
    for (let lo = -180; lo < 180; lo += 30) { g.beginPath(); let on = false; for (let la = -85; la <= 85; la += 4) { const [x, y, z] = projP(la, lo); if (z > 0) { on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } else on = false; } g.stroke(); }
    // routes
    for (const id of ORDER) {
      const ex = EXPLORERS.find(e => e.id === id);
      const pts = [[ex.start.lat, ex.start.lon], ...ex.waypoints.map(w => [w.lat, w.lon])];
      g.strokeStyle = ex.color; g.lineWidth = Math.max(2.5, R / 70); g.lineCap = 'round'; g.lineJoin = 'round';
      g.shadowColor = '#fff3c4'; g.shadowBlur = 8;
      g.beginPath(); let on = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const [a1, o1] = pts[i], [a2, o2] = pts[i + 1];
        let d2 = o2 - o1; if (d2 > 180) d2 -= 360; if (d2 < -180) d2 += 360;
        const steps = Math.max(2, Math.ceil(Math.hypot(a2 - a1, d2) / 2));
        for (let s = 0; s <= steps; s++) {
          const [x, y, z] = projP(a1 + (a2 - a1) * s / steps, o1 + d2 * s / steps);
          if (z > 0.02) { on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } else on = false;
        }
      }
      g.stroke(); g.shadowBlur = 0;
    }
    g.restore();
  }

  /* ---------------- Fireworks -------------------------------------------- */
  const FW_COLORS = ['#ffd56a', '#ff7a5a', '#8fe3ff', '#c9a2ff', '#a6ff9e', '#ffffff'];
  function launch() {
    rockets.push({ x: W * (0.15 + Math.random() * 0.7), y: H, vx: (Math.random() - 0.5) * 60, vy: -(H * 0.75 + Math.random() * H * 0.35), fuse: 0.9 + Math.random() * 0.5, col: U.pick(FW_COLORS) });
  }
  function burst(x, y, col) {
    const n = 70 + (Math.random() * 40 | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 200;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + Math.random() * 0.8, col: Math.random() < 0.2 ? '#fff' : col });
    }
    Sound.play('firework');
  }
  function stepFireworks(g, dt) {
    for (const r of rockets) {
      r.fuse -= dt; r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 260 * dt;
      g.fillStyle = '#fff1c4'; g.beginPath(); g.arc(r.x, r.y, 2.5, 0, 7); g.fill();
      if (r.fuse <= 0) { burst(r.x, r.y, r.col); r.dead = true; }
    }
    rockets = rockets.filter(r => !r.dead);
    g.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.985; s.vy = s.vy * 0.985 + 60 * dt;
      g.globalAlpha = U.clamp(s.life, 0, 1); g.fillStyle = s.col;
      g.beginPath(); g.arc(s.x, s.y, 2.2, 0, 7); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    sparks = sparks.filter(s => s.life > 0);
  }
  function stepConfetti(g, dt) {
    for (const c of confetti) {
      c.y += c.vy * dt; c.x += Math.sin(t * 2 + c.ph) * 30 * dt; c.rot += c.vr * dt;
      g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.fillStyle = c.col; g.fillRect(-5, -2.5, 10, 5); g.restore();
    }
    confetti = confetti.filter(c => c.y < H + 20);
  }
  function addConfetti(n) {
    for (let i = 0; i < n; i++) confetti.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vy: 60 + Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, ph: Math.random() * 6, col: U.pick(['#f2d58a', '#c9973e', '#ffe9a0', '#9b2d20', '#1f7a5a', '#fff']) });
  }

  /* ---------------- Cinematic -------------------------------------------- */
  const T_MAP = 3, T_GLOBE = 17, T_FIRE = 29, T_END = 33;
  function caption(html, cls) {
    const el = $('finaleCaption');
    el.className = 'finale-caption ' + (cls || '');
    el.innerHTML = html;
    void el.offsetWidth; el.classList.add('show');
  }
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    oldMapC = U.canvas(Math.round(W * dpr), Math.round(H * dpr)); mapRenderT = -1;
  }
  function play(done) {
    onDone = done;
    canvas = $('finaleCanvas'); ctx = canvas.getContext('2d');
    $('finale').classList.remove('hidden');
    layout();
    buildLandTexture();
    t = 0; sparks = []; rockets = []; confetti = []; phaseFlags = {};
    $('finaleCaption').innerHTML = ''; $('finaleCaption').className = 'finale-caption';
    $('finaleAward').classList.add('hidden');
    $('finaleSkip').classList.remove('hidden');
    Sound.init(); Sound.music('grand');
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = null; }
  function skip() { if (t < T_FIRE) { t = T_FIRE; phaseFlags = { title: 1, dias: 1, columbus: 1, gama: 1, magellan: 1, globe: 1 }; } }
  function loop(now) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    t += dt;
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // night-sea backdrop
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#060b1c'); bg.addColorStop(0.6, '#12223f'); bg.addColorStop(1, '#1d2a3a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,248,225,${0.3 + 0.7 * Math.abs(Math.sin(i * 12.9 + t * (0.5 + (i % 5) * 0.2)))})`; g.fillRect((i * 97.3) % W, (i * 57.1) % (H * 0.7), 1.6, 1.6); }

    if (!phaseFlags.title) { phaseFlags.title = 1; caption('<small>You have completed every voyage</small>Four Voyages · One World', 'big'); Sound.play('bell'); }
    // ---- Map phase: the 1490 map is redrawn and the routes are traced
    if (t >= T_MAP && t < T_GLOBE + 1) {
      const k = U.clamp((t - T_MAP) / (T_GLOBE - T_MAP - 2), 0, 1);
      const alpha = U.clamp((t - T_MAP) / 1, 0, 1) * (t > T_GLOBE ? U.clamp(1 - (t - T_GLOBE), 0, 1) : 1);
      if (mapRenderT < 0 || t - mapRenderT > 0.12) {
        mapRenderT = t;
        const from = OldMap.knowledgeFrom({}), to = OldMap.knowledgeFrom({ dias: 1, columbus: 1, gama: 1, magellan: 1 }), mix = {};
        for (const key of Object.keys(to)) mix[key] = U.lerp(from[key], to[key], U.easeInOut(k));
        const routes = [];
        ORDER.forEach((id, i) => {
          const rk = U.clamp(k * 4.2 - i, 0, 1);
          if (rk <= 0) return;
          const ex = EXPLORERS.find(e => e.id === id);
          const pts = [[ex.start.lat, ex.start.lon], ...ex.waypoints.map(w => [w.lat, w.lon])];
          routes.push({ points: pts.slice(0, Math.max(2, Math.ceil(pts.length * rk))), color: ex.color, width: 4 * dpr });
        });
        oldMapProj = OldMap.render(oldMapC, { know: mix, routes });
      }
      g.globalAlpha = alpha; g.drawImage(oldMapC, 0, 0, W, H); g.globalAlpha = 1;
      ORDER.forEach((id, i) => {
        const at = T_MAP + 1 + i * 3;
        if (t >= at && !phaseFlags[id]) {
          phaseFlags[id] = 1;
          const ex = EXPLORERS.find(e => e.id === id);
          const pc = U.canvas(160, 160); Art.portrait(pc.getContext('2d'), id, 160);
          caption(`<span class="fc-port"><img src="${pc.toDataURL()}" alt=""></span><span><b style="color:${ex.color}">${CAPTIONS[id][0]}</b> ${CAPTIONS[id][1]}</span>`, 'row');
          Sound.play('ship');
        }
      });
    }
    // ---- Globe phase
    if (t >= T_GLOBE - 0.5 && t < T_FIRE + 1.5) {
      if (!phaseFlags.globe && t >= T_GLOBE) { phaseFlags.globe = 1; caption('<small>Between 1487 and 1522</small>The oceans are connected — and the world is far larger than anyone imagined', 'big top'); Sound.play('unlock'); }
      const a = U.clamp((t - (T_GLOBE - 0.5)) / 1.2, 0, 1) * U.clamp(1 - (t - T_FIRE - 0.3), 0, 1);
      const R = Math.min(W, H * 0.9) * 0.3 * (0.85 + 0.15 * U.easeOut(U.clamp((t - T_GLOBE) / 2, 0, 1)));
      drawGlobe(g, W / 2, H * 0.58, R, -40 + (t - T_GLOBE) * 28, 12, a);
    }
    // ---- Fireworks and the award
    if (t >= T_FIRE) {
      if (!phaseFlags.fire) { phaseFlags.fire = 1; caption('', ''); addConfetti(160); Sound.play('rankup'); for (let i = 0; i < 4; i++) setTimeout(launch, i * 250); }
      // harbor silhouette
      g.fillStyle = '#0b1220';
      g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.86);
      for (let x = 0; x <= W; x += 24) { const tower = (Math.floor(x / 24) * 37) % 11 === 0; g.lineTo(x, H * (0.86 - (tower ? 0.07 : 0.02 + ((x * 13) % 7) * 0.004))); g.lineTo(x + 24, H * (0.86 - (tower ? 0.07 : 0.02))); }
      g.lineTo(W, H); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,210,120,0.6)';
      for (let x = 30; x < W; x += 53) g.fillRect(x, H * 0.885, 3, 4);
      if (Math.random() < dt * 1.8) launch();
      stepFireworks(g, dt);
      if (Math.random() < dt * 0.6) addConfetti(25);
      if (t >= T_FIRE + 1.2 && !phaseFlags.award) { phaseFlags.award = 1; showAward(); }
    }
    stepConfetti(g, dt);
  }

  /* ---------------- Award & certificate ---------------------------------- */
  function showAward() {
    const S = stats();
    $('faStats').innerHTML = `<div><b>4/4</b>voyages</div><div><b>${S.stars}/12</b>stars</div><div><b>${S.codex}/${S.totalCodex}</b>Codex terms</div><div><b>+500</b>royal ducats</div>`;
    const fc = $('faShip'); const g = fc.getContext('2d'); g.clearRect(0, 0, fc.width, fc.height);
    Art.shipSide(g, fc.width / 2, fc.height * 0.82, 1.55, { sails: 'lateen', sail: '#f6dc8a', hull: '#8a5a1a', flag: '#c9973e' });
    $('finaleAward').classList.remove('hidden');
    $('finaleSkip').classList.add('hidden');
    if (!Save.data.admiral) { Save.data.admiral = true; Save.data.ducats += 500; }
    Save.data.finaleSeen = true;
    Save.write();
    $('faName').value = Save.data.admiralName || '';
  }
  function drawCertificate(name) {
    const c = $('certCanvas'), g = c.getContext('2d'), Wc = c.width, Hc = c.height;
    g.drawImage(Art.parchment(Wc, Hc, { seed: 21, scale: 0.006, stains: 5 }), 0, 0);
    // borders
    g.strokeStyle = '#6b4a24'; g.lineWidth = 6; g.strokeRect(30, 30, Wc - 60, Hc - 60);
    g.strokeStyle = '#c9973e'; g.lineWidth = 3; g.strokeRect(44, 44, Wc - 88, Hc - 88);
    g.strokeStyle = '#6b4a24'; g.lineWidth = 1.5; g.strokeRect(54, 54, Wc - 108, Hc - 108);
    for (const [x, y] of [[54, 54], [Wc - 54, 54], [54, Hc - 54], [Wc - 54, Hc - 54]]) Art.compassRose(g, x, y, 34, { labels: false, fleur: false });
    g.textAlign = 'center'; g.fillStyle = '#2b1d10';
    g.font = '600 30px "IM Fell English SC", Georgia, serif'; g.fillStyle = '#9b2d20';
    g.fillText('By Royal Decree of the Crowns of Portugal and Spain', Wc / 2, 130);
    g.font = '700 64px "Cinzel Decorative", "IM Fell English SC", Georgia, serif'; g.fillStyle = '#5a2a14';
    g.fillText('Admiral of the Ocean Sea', Wc / 2, 215);
    g.font = 'italic 28px "IM Fell English", Georgia, serif'; g.fillStyle = '#2b1d10';
    g.fillText('Let it be known throughout every kingdom and every sea that', Wc / 2, 280);
    g.font = '600 72px "IM Fell English", Georgia, serif'; g.fillStyle = '#1f3d55';
    g.fillText(name || 'A Bold Captain', Wc / 2, 370);
    g.strokeStyle = '#6b4a24'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(Wc / 2 - 380, 392); g.lineTo(Wc / 2 + 380, 392); g.stroke();
    g.font = 'italic 27px "IM Fell English", Georgia, serif'; g.fillStyle = '#2b1d10';
    const lines = ['sailed with Bartolomeu Dias around the Cape of Good Hope, with Christopher Columbus across the Ocean Sea,', 'with Vasco da Gama to the spice markets of India, and with Ferdinand Magellan and Juan Sebastián Elcano', 'all the way around the world, and is hereby named Admiral of the Ocean Sea.'];
    lines.forEach((l, i) => g.fillText(l, Wc / 2, 445 + i * 38));
    // portraits
    ORDER.forEach((id, i) => {
      const x = Wc / 2 + (i - 1.5) * 230;
      const pc = U.canvas(150, 150); Art.portrait(pc.getContext('2d'), id, 150);
      g.drawImage(pc, x - 75, 585, 150, 150);
      const ex = EXPLORERS.find(e => e.id === id);
      g.font = '600 20px "IM Fell English SC", Georgia, serif'; g.fillStyle = ex.color; g.fillText(ex.short + ' · ' + CAPTIONS[id][0], x, 760);
    });
    const S = stats();
    g.font = '22px "IM Fell English", Georgia, serif'; g.fillStyle = '#5a4126';
    g.fillText(`${S.stars} of 12 stars  ·  ${S.codex} of ${S.totalCodex} Codex terms  ·  Rank: ${S.rank}`, Wc / 2, 815);
    const d = new Date();
    g.font = 'italic 22px "IM Fell English", Georgia, serif';
    g.fillText(`Given this ${d.getDate()} day of ${d.toLocaleString('en-US', { month: 'long' })}, in the year ${d.getFullYear()}`, Wc / 2, 852);
    // seals and flags
    const seal = (x, y, kind) => {
      const sg = g.createRadialGradient(x - 15, y - 15, 5, x, y, 62);
      sg.addColorStop(0, '#d0533a'); sg.addColorStop(0.7, '#8a1e10'); sg.addColorStop(1, '#5a1008');
      g.fillStyle = sg; g.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, r = 58 + (i % 2) * 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.fill();
      Art.flag(g, kind, x - 30, y - 20, 60, 40);
    };
    seal(150, Hc - 150, 'portugal'); seal(Wc - 150, Hc - 150, 'spain');
    Art.shipSide(g, Wc / 2, Hc - 80, 0.55, { sails: 'lateen', sail: '#f6dc8a', hull: '#8a5a1a' });
  }
  function openCertificate() {
    const name = $('faName').value.trim().slice(0, 40);
    Save.data.admiralName = name; Save.write();
    drawCertificate(name);
    $('certificate').classList.remove('hidden');
    Sound.play('paper');
  }
  function bind() {
    $('finaleSkip').onclick = () => { Sound.play('click'); skip(); };
    $('faCert').onclick = () => { Sound.play('click'); openCertificate(); };
    $('faDone').onclick = () => { Sound.play('click'); finish(); };
    $('certDownload').onclick = () => {
      const a = document.createElement('a');
      a.download = 'Admiral-of-the-Ocean-Sea.png';
      a.href = $('certCanvas').toDataURL('image/png');
      document.body.appendChild(a); a.click(); a.remove();
    };
    $('certPrint').onclick = () => {
      const url = $('certCanvas').toDataURL('image/png');
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<html><head><title>Admiral of the Ocean Sea</title><style>@page{size:landscape;margin:0}body{margin:0}img{width:100%}</style></head><body><img src="${url}" onload="setTimeout(()=>print(),200)"></body></html>`);
      w.document.close();
    };
    $('certClose').onclick = () => { $('certificate').classList.add('hidden'); Sound.play('click'); };
    window.addEventListener('resize', () => { if (frame) layout(); });
  }
  function finish() {
    stop();
    $('finale').classList.add('hidden'); $('certificate').classList.add('hidden');
    if (onDone) onDone();
  }

  return { play, bind, openCertificate: () => { $('faName').value = Save.data.admiralName || ''; openCertificate(); }, get playing() { return !!frame; } };
})();
