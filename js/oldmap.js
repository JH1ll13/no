/* ==========================================================================
   Old World map: how Europeans pictured the world around 1490.
   Western Europe is fairly accurate; Africa and Asia are distorted; the
   Americas are missing. Completed voyages redraw parts of the map correctly.
   ========================================================================== */
'use strict';

const OldMap = (() => {
  const LON0 = -100, LON1 = 205, LAT0 = 76, LAT1 = -56;
  let simplified = null;          // [{lon,lat,area,box}]
  let know = { africaS: 1, africaE: 1, india: 1, asia: 1, caribbean: 0, samerica: 0, pacific: 0, nameri: 0 };

  function prep() {
    if (simplified) return;
    simplified = [];
    for (const r of World.rings) {
      if (r.hole || r.dup) continue;
      const w = r.maxx - r.minx, h = r.maxy - r.miny;
      if (w * h < 2200 && r.n < 30) continue;
      const step = r.n > 3000 ? 6 : r.n > 600 ? 4 : r.n > 120 ? 2 : 1;
      const lon = [], lat = [];
      for (let i = 0; i < r.n; i += step) { lon.push(r.lon[i]); lat.push(r.lat[i]); }
      let cl = 0, ct = 0; for (let i = 0; i < lon.length; i++) { cl += lon[i]; ct += lat[i]; }
      simplified.push({ lon, lat, clon: cl / lon.length, clat: ct / lon.length, size: w * h, minlon: Math.min(...lon), maxlon: Math.max(...lon), minlat: Math.min(...lat), maxlat: Math.max(...lat) });
    }
  }

  /* region membership helpers -------------------------------------------- */
  const isAmericas = (lon, lat) => lon < -30 && lon > -170 && !(lat > 58 && lon > -75) || (lon < -170 && lat > 50);
  const isAustralia = (lon, lat) => lon > 112 && lon < 180 && lat < -10;
  const isGreenlandIce = (lon, lat) => lat > 59 && lon > -75 && lon < -10;
  const isPacificIsland = (lon, lat) => (lon > 160 || lon < -150) && Math.abs(lat) < 35;

  /** maps true lon/lat to the distorted "1490" position */
  function warp(lon, lat) {
    let x = lon, y = lat;
    // Africa south of ~5°N: Martellus-style (stretched south, swept east)
    if (lon > -20 && lon < 55 && lat < 8) {
      const w = U.smooth(8, -2, lat) * (know.africaS * 0.75 + know.africaE * 0.25);
      y = lat + w * (lat * 0.42 - 3);
      x = lon + w * (Math.max(0, -lat) * 0.62 + (lon > 30 ? (lon - 30) * 0.5 : 0));
    }
    // Arabia, India (Ptolemaic: India squashed, Taprobana huge)
    if (lon > 40 && lon < 100 && lat > -5 && lat < 32) {
      const w = know.india * U.smooth(-5, 5, lat);
      if (lon > 68 && lon < 90 && lat < 24) { y = y + w * (20 - lat) * 0.45; x = x + w * (lon - 78) * 0.4; }
      if (lon > 79 && lon < 82.5 && lat > 5.5 && lat < 10.2) { x = 81 + (lon - 81) * (1 + 2.2 * know.india); y = y - w * (8 - lat) * -1.6 - w * 4; }
    }
    // Asia stretched east
    if (lon > 75) {
      const w = know.asia;
      x = x + w * (lon - 75) * 0.42;
      if (lon > 92 && lon < 110 && lat < 16 && lat > -10) { y = y + w * (lat - 16) * 0.6; }
      if (lat > 50) y = y - w * (lat - 50) * 0.25;
    }
    // poorly known far north
    if (lat > 60 && lon > 20) y = y - (lat - 60) * 0.25;
    // wobble everything that is poorly known
    const u = Math.max(lon > -20 && lon < 55 && lat < 8 ? know.africaS * 0.7 : 0, lon > 40 && lon < 100 ? know.india * 0.8 : 0, lon > 95 ? know.asia : 0, lat > 62 ? 0.6 : 0);
    if (u > 0) {
      x += u * (U.noise2(lon * 0.09 + 3, lat * 0.09) - 0.5) * 7;
      y += u * (U.noise2(lon * 0.09, lat * 0.09 + 11) - 0.5) * 5;
    }
    return [x, y];
  }

  function visibleRing(r) {
    if (isAmericas(r.clon, r.clat)) {
      // Caribbean islands after Columbus; South America after Magellan
      if (r.clat > 9 && r.clat < 28 && r.clon > -86 && r.clon < -60 && r.size < 400000) return know.caribbean;
      if (r.clat < 13 && r.clon > -82) return know.samerica;
      if (r.clat < 32 && r.clat > 5 && r.clon > -100) return know.caribbean * 0.35 + know.samerica * 0.4;
      return know.nameri;
    }
    if (isAustralia(r.clon, r.clat)) return 0;
    if (isGreenlandIce(r.clon, r.clat)) return 0.5;
    if (isPacificIsland(r.clon, r.clat)) return know.pacific;
    if (r.clat < -55) return 0;
    if (r.clon > 118 && r.clon < 132 && r.clat > 4 && r.clat < 20) return 0.35 + know.pacific * 0.65; // Philippines
    if (r.clon > 125 && r.clon < 132 && r.clat > -4 && r.clat < 4) return 0.5 + know.pacific * 0.5; // Moluccas
    return 1;
  }

  /* ---------------- Rendering ------------------------------------------- */
  let paperCache = null;
  function render(c, opts = {}) {
    prep();
    if (opts.know) know = Object.assign({}, know, opts.know);
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    // paper
    if (!paperCache || paperCache.width !== W || paperCache.height !== H) paperCache = Art.parchment(W, H, { seed: 3, scale: 0.006, stains: 9 });
    g.drawImage(paperCache, 0, 0);
    // map frame
    const pad = Math.round(Math.min(W, H) * 0.035);
    const fx = pad, fy = pad, fw = W - pad * 2, fh = H - pad * 2;
    const sx = fw / (LON1 - LON0), sy = fh / (LAT0 - LAT1);
    const s = Math.min(sx, sy * 1.15);
    const ox = fx + (fw - (LON1 - LON0) * s) / 2, oy = fy + (fh - (LAT0 - LAT1) * s / 1.15) / 2;
    const P = (lon, lat) => [ox + (lon - LON0) * s, oy + (LAT0 - lat) * s / 1.15];
    const PW = (lon, lat) => { const [a, b] = warp(lon, lat); return P(a, b); };
    const map = { P, PW, warp, s };

    // sea tint
    g.save();
    g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
    g.fillStyle = 'rgba(120,150,130,0.10)'; g.fillRect(fx, fy, fw, fh);

    // rhumb lines from compass roses
    const roses = [[-40, 20, 1], [60, -25, 0.8], [150, 15, 0.8], [-75, -25, 0.7]];
    g.lineWidth = 0.6;
    for (const [rl, rt] of roses) {
      const [cx, cy] = P(rl, rt);
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2;
        g.strokeStyle = i % 4 === 0 ? 'rgba(40,30,20,0.22)' : i % 2 === 0 ? 'rgba(30,110,60,0.18)' : 'rgba(160,40,30,0.16)';
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * W * 1.5, cy + Math.sin(a) * W * 1.5); g.stroke();
      }
    }
    // Ptolemaic southern land bridge (Terra Incognita) — vanishes once Dias rounds Africa
    const tiA = know.africaS * 0.9;
    if (tiA > 0.02) {
      g.save(); g.globalAlpha = tiA;
      const pts = [[30, -38], [50, -40], [75, -36], [100, -28], [125, -18], [150, -10], [160, -2], [155, -30], [130, -46], [90, -52], [40, -52], [20, -46]];
      g.beginPath();
      pts.forEach(([lo, la], i) => { const [x, y] = P(lo + (U.noise2(lo * 0.1, la * 0.1) - 0.5) * 6, la); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath();
      g.fillStyle = 'rgba(170,140,90,0.25)'; g.fill();
      g.setLineDash([5, 4]); g.strokeStyle = 'rgba(70,45,20,0.7)'; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
      const [tx, ty] = P(85, -44);
      g.fillStyle = 'rgba(60,40,20,0.75)'; g.font = `italic ${Math.round(s * 4.2)}px "IM Fell English", Georgia, serif`; g.textAlign = 'center';
      g.fillText('Terra Incognita', tx, ty);
      g.restore();
    }
    // coasts: water-lining, fill, ink
    const paths = [];
    for (const r of simplified) {
      const vis = visibleRing(r);
      if (vis <= 0.01) continue;
      const p = new Path2D();
      for (let i = 0; i < r.lon.length; i++) {
        const [x, y] = PW(r.lon[i], r.lat[i]);
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath();
      paths.push([p, vis, r]);
    }
    g.lineJoin = 'round';
    for (const [p, vis] of paths) {
      g.globalAlpha = vis;
      for (let k = 3; k >= 1; k--) { g.strokeStyle = `rgba(60,100,110,${0.12})`; g.lineWidth = k * s * 1.6; g.stroke(p); }
    }
    for (const [p, vis, r] of paths) {
      g.globalAlpha = vis;
      const gr = g.createLinearGradient(0, oy, 0, oy + fh);
      gr.addColorStop(0, '#d9c08a'); gr.addColorStop(1, '#cfae72');
      g.fillStyle = gr; g.fill(p);
      g.strokeStyle = 'rgba(80,60,20,0.18)'; g.lineWidth = s * 1.6; g.save(); g.clip(p); g.stroke(p); g.restore();
      g.strokeStyle = '#4a3418'; g.lineWidth = Math.max(0.8, s * 0.22); g.stroke(p);
      void r;
    }
    g.globalAlpha = 1;
    // mountains glyphs
    g.fillStyle = 'rgba(90,65,30,0.85)'; g.strokeStyle = 'rgba(60,40,15,0.9)'; g.lineWidth = 0.8;
    for (const rg of World.RANGES) {
      for (let i = 0; i < rg.p.length - 1; i++) {
        const a = rg.p[i], b = rg.p[i + 1];
        if (isAmericas(a[1], a[0]) && know.samerica < 0.5) continue;
        if (isAustralia(a[1], a[0])) continue;
        const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.2));
        for (let k = 0; k < steps; k++) {
          const la = a[0] + (b[0] - a[0]) * k / steps, lo = a[1] + (b[1] - a[1]) * k / steps;
          const [x, y] = PW(lo, la), hh = s * (1.6 + rg.h * 1.1);
          g.beginPath(); g.moveTo(x - hh * 0.7, y + hh * 0.3); g.quadraticCurveTo(x, y - hh * 1.2, x + hh * 0.7, y + hh * 0.3); g.fillStyle = 'rgba(205,180,130,1)'; g.fill(); g.stroke();
          g.beginPath(); g.moveTo(x + hh * 0.05, y - hh * 0.4); g.lineTo(x + hh * 0.45, y + hh * 0.25); g.stroke();
        }
      }
    }
    // rivers
    g.strokeStyle = 'rgba(60,100,120,0.7)'; g.lineWidth = Math.max(0.8, s * 0.3);
    for (const rv of World.RIVERS) {
      if (isAmericas(rv[0][1], rv[0][0]) && know.samerica < 0.5 && know.nameri < 0.5) continue;
      g.beginPath(); rv.forEach(([la, lo], i) => { const [x, y] = PW(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    }
    // mythical islands of the Ocean Sea, fading out after Columbus
    const myth = 1 - know.caribbean * 0.85;
    const MYTH = [['Antillia', -42, 32, 5, 3], ['S. Brandan', -30, 26, 3, 2.2], ['Brasil', -18, 51.5, 2.6, 1.6], ['Cipangu?', -88, 22, 9, 6]];
    for (const [nm, lo, la, rw, rh] of MYTH) {
      if (nm === 'Cipangu?' && know.caribbean > 0.5) continue;
      g.save(); g.globalAlpha = myth;
      const [x, y] = P(lo, la);
      g.beginPath();
      for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; const rr = 1 + (U.noise2(Math.cos(a) * 2 + lo, Math.sin(a) * 2) - 0.5) * 0.5; g.lineTo(x + Math.cos(a) * rw * s * rr, y + Math.sin(a) * rh * s * rr); }
      g.closePath(); g.fillStyle = '#d6bb85'; g.fill(); g.strokeStyle = '#4a3418'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#5a2a14'; g.font = `italic ${Math.round(s * 3.2)}px "IM Fell English", Georgia, serif`; g.textAlign = 'center';
      g.fillText(nm, x, y + rh * s + s * 4);
      g.restore();
    }
    // Real Cipangu (Japan) floating far east (Marco Polo)
    {
      const [x, y] = PW(140, 36);
      g.save(); g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(x + s * 10 * know.asia, y, s * 7, s * 4, -0.3, 0, 7); g.fillStyle = '#d6bb85'; g.fill(); g.strokeStyle = '#4a3418'; g.stroke();
      g.fillStyle = '#5a2a14'; g.font = `italic ${Math.round(s * 3.2)}px "IM Fell English", Georgia, serif`; g.textAlign = 'center';
      g.fillText('Cipangu', x + s * 10 * know.asia, y + s * 8);
      g.restore();
    }
    // labels
    for (const L of OLD_LABELS) {
      const [x, y] = L.sea ? P(L.lon, L.lat) : PW(L.lon, L.lat);
      g.fillStyle = L.sea ? 'rgba(40,70,80,0.75)' : 'rgba(70,35,15,0.85)';
      g.font = `${L.sea ? 'italic ' : ''}${Math.round(s * 4.3 * L.s)}px "IM Fell English${L.sea ? '' : ' SC'}", Georgia, serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (!L.sea) { g.save(); g.translate(x, y); spacedText(g, L.t, 0, 0, s * 1.2 * L.s); g.restore(); }
      else g.fillText(L.t, x, y);
    }
    if (know.caribbean > 0.4) { g.globalAlpha = know.caribbean; label(g, P(-75, 18), 'Indias Occidentales', s * 3.2, true); g.globalAlpha = 1; }
    if (know.samerica > 0.4) { g.globalAlpha = know.samerica; label(g, PW(-60, -12), 'MVNDVS NOVVS', s * 4.6, false); label(g, P(-130, -10), 'Mar Pacífico', s * 4.4, true); g.globalAlpha = 1; }

    // cities as tiny castles
    const CITIES = [['Lisboa', 38.7, -9.1], ['Sevilla', 37.4, -6], ['Venetia', 45.4, 12.3], ['Roma', 41.9, 12.5], ['Constantinopolis', 41, 29], ['Hierusalem', 31.8, 35.2], ['Calicut', 11.25, 75.8], ['Cambaluc', 39.9, 116.4], ['Quinsay', 30.25, 120.2], ['Malacca', 2.2, 102.25], ['Ormuz', 27.1, 56.4], ['Mina', 5.1, -1.4], ['Timbuctu', 16.8, -3.0]];
    for (const [nm, la, lo] of CITIES) {
      const [x, y] = PW(lo, la);
      g.fillStyle = '#9b2d20'; g.strokeStyle = '#3b2a17'; g.lineWidth = 0.8;
      const k = s * 0.9;
      g.fillRect(x - k * 1.6, y - k * 1.8, k * 3.2, k * 1.8); g.strokeRect(x - k * 1.6, y - k * 1.8, k * 3.2, k * 1.8);
      g.fillRect(x - k * 2.2, y - k * 3, k * 1.2, k * 3); g.fillRect(x + k * 1, y - k * 3, k * 1.2, k * 3);
      g.fillStyle = '#3b2a17'; g.font = `italic ${Math.round(s * 2.6)}px "IM Fell English", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(nm, x, y + k * 0.6);
    }
    // compass roses
    for (const [rl, rt, rs] of roses) { const [cx, cy] = P(rl, rt); Art.compassRose(g, cx, cy, s * 9 * rs, { labels: false }); }
    // sea monsters & ships
    seaMonster(g, P(-55, 45), s * 1.1, 1);
    seaMonster(g, P(80, -40), s * 1.0, -1);
    seaMonster(g, P(175, -20), s * 0.9, 1);
    Art.shipSide(g, ...P(-20, 8), s * 0.16, { dir: -1, sails: 'square' });
    Art.shipSide(g, ...P(100, 0), s * 0.14, { dir: 1, sails: 'lateen' });
    // voyage routes
    if (opts.routes) {
      for (const rt of opts.routes) drawRoute(g, map, rt);
    }
    g.restore();
    // frame border with degree ticks
    g.strokeStyle = '#3b2a17'; g.lineWidth = 3; g.strokeRect(fx, fy, fw, fh);
    g.lineWidth = 1; g.strokeRect(fx - 6, fy - 6, fw + 12, fh + 12);
    for (let i = 0; i <= 60; i++) {
      const x = fx + fw * i / 60;
      g.fillStyle = i % 2 ? '#3b2a17' : '#e9d8b0';
      g.fillRect(x, fy - 6, fw / 60, 4); g.fillRect(x, fy + fh + 2, fw / 60, 4);
    }
    for (let i = 0; i <= 30; i++) {
      const y = fy + fh * i / 30;
      g.fillStyle = i % 2 ? '#3b2a17' : '#e9d8b0';
      g.fillRect(fx - 6, y, 4, fh / 30); g.fillRect(fx + fw + 2, y, 4, fh / 30);
    }
    return map;
  }

  function spacedText(g, t, x, y, sp) {
    const chars = t.split(''); let w = 0; const ws = chars.map(ch => g.measureText(ch).width);
    w = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let cx = x - w / 2;
    g.textAlign = 'left';
    chars.forEach((ch, i) => { g.fillText(ch, cx, y); cx += ws[i] + sp; });
    g.textAlign = 'center';
  }
  function label(g, [x, y], t, size, italic) {
    g.fillStyle = italic ? 'rgba(40,70,80,0.8)' : 'rgba(70,35,15,0.85)';
    g.font = `${italic ? 'italic ' : ''}${Math.round(size)}px "IM Fell English${italic ? '' : ' SC'}", Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y);
  }

  function seaMonster(g, [x, y], s, dir) {
    g.save(); g.translate(x, y); g.scale(s * dir, s);
    g.strokeStyle = '#3b2a17'; g.lineWidth = 1.2 / s; g.fillStyle = 'rgba(80,110,90,0.85)';
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(-14 + i * 9, 0); g.quadraticCurveTo(-10 + i * 9, -8 + i, -6 + i * 9, 0); g.fill(); g.stroke();
    }
    g.beginPath(); g.moveTo(14, 0); g.quadraticCurveTo(16, -12, 22, -12); g.quadraticCurveTo(27, -12, 26, -8); g.lineTo(22, -8); g.quadraticCurveTo(19, -6, 18, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#9b2d20'; g.beginPath(); g.moveTo(26, -8); g.lineTo(30, -6); g.lineTo(26, -6); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(23, -10.5, 0.9, 0, 7); g.fill();
    g.strokeStyle = 'rgba(40,70,80,0.6)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-20 + i * 10, 2); g.quadraticCurveTo(-16 + i * 10, 4, -12 + i * 10, 2); g.stroke(); }
    g.restore();
  }

  /** split a route wherever it jumps across the date line (Magellan's Pacific crossing) */
  function splitRoute(points) {
    const out = [[points[0]]];
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i][1] - points[i - 1][1]) > 180) out.push([]);
      out[out.length - 1].push(points[i]);
    }
    return out.filter(s => s.length >= 2);
  }
  function drawRoute(g, map, rt) {
    const parts = splitRoute(rt.points);
    if (parts.length > 1 || parts[0] !== rt.points) { for (const p of parts) drawRoutePart(g, map, Object.assign({}, rt, { points: p })); return; }
    drawRoutePart(g, map, rt);
  }
  function drawRoutePart(g, map, rt) {
    const pts = rt.points.map(([la, lo]) => map.PW(lo, la));
    if (pts.length < 2) return;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    // smooth curve through points
    const path = new Path2D();
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      path.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    g.strokeStyle = 'rgba(255,245,220,0.7)'; g.lineWidth = (rt.width || 3) + 3; g.stroke(path);
    g.strokeStyle = rt.color; g.lineWidth = rt.width || 3;
    if (rt.dashed) g.setLineDash([8, 6]);
    if (rt.dashOffset) g.lineDashOffset = rt.dashOffset;
    g.globalAlpha = rt.alpha ?? 1;
    g.stroke(path);
    g.setLineDash([]);
    if (rt.dots) {
      for (const [x, y] of pts.slice(1)) { g.fillStyle = rt.color; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.strokeStyle = '#fff6dd'; g.lineWidth = 1.2; g.stroke(); }
    }
    g.restore();
  }

  function knowledgeFrom(done) {
    // done = set of explorer ids completed
    const k = { africaS: 1, africaE: 1, india: 1, asia: 1, caribbean: 0, samerica: 0, pacific: 0, nameri: 0 };
    if (done.dias) { k.africaS = 0.15; k.africaE = 0.7; }
    if (done.gama) { k.africaS = 0; k.africaE = 0; k.india = 0; k.asia = Math.min(k.asia, 0.75); }
    if (done.columbus) { k.caribbean = 1; }
    if (done.magellan) { k.samerica = 1; k.pacific = 1; k.asia = 0.1; k.caribbean = Math.max(k.caribbean, 0.6); k.africaS = Math.min(k.africaS, 0.3); }
    return k;
  }

  return { splitRoute, render, knowledgeFrom, setKnow(k) { know = Object.assign({}, know, k); }, get know() { return know; } };
})();
