/* ==========================================================================
   Art: procedural drawings — ships, portraits, compass roses, journal scenes,
   parchment textures and sea creatures. Everything is drawn with Canvas 2D.
   ========================================================================== */
'use strict';

const Art = (() => {

  /* ---------------- Parchment ------------------------------------------ */
  function parchment(w, h, opts = {}) {
    const c = U.canvas(w, h), g = c.getContext('2d');
    const base = opts.base || [233, 215, 172];
    const img = g.createImageData(w, h), d = img.data;
    const sx = opts.scale || 0.012;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n1 = U.fbm(x * sx, y * sx, 4), n2 = U.noise2(x * 0.15, y * 0.6), n3 = U.hash2(x, y);
      const f = 0.86 + n1 * 0.22 + (n2 - 0.5) * 0.03 + (n3 - 0.5) * 0.05;
      const o = (y * w + x) * 4;
      d[o] = base[0] * f; d[o + 1] = base[1] * f; d[o + 2] = base[2] * f * 0.97; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // stains
    const r = U.rng(opts.seed || 7);
    for (let i = 0; i < (opts.stains ?? 6); i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * Math.min(w, h) * 0.18;
      const gr = g.createRadialGradient(x, y, rad * 0.6, x, y, rad);
      gr.addColorStop(0, 'rgba(150,110,60,0)'); gr.addColorStop(0.85, 'rgba(150,105,55,0.10)'); gr.addColorStop(1, 'rgba(150,105,55,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // fibres
    g.strokeStyle = 'rgba(120,90,50,0.05)'; g.lineWidth = 1;
    for (let i = 0; i < w * h / 900; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.stroke();
    }
    if (opts.vignette !== false) {
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(90,55,20,0)'); vg.addColorStop(1, 'rgba(90,55,20,0.45)');
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }
    return c;
  }

  /* ---------------- Compass rose --------------------------------------- */
  function compassRose(g, x, y, r, o = {}) {
    const ink = o.ink || '#3b2a17', light = o.light || '#f3e6c4', red = o.red || '#9b2d20', gold = o.gold || '#b8893a';
    g.save(); g.translate(x, y);
    if (o.rotate) g.rotate(o.rotate);
    // rings
    g.lineWidth = Math.max(1, r * 0.02);
    g.strokeStyle = ink;
    g.fillStyle = o.ringFill || 'rgba(243,230,196,0.85)';
    g.beginPath(); g.arc(0, 0, r * 0.98, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, 0, r * 0.86, 0, 7); g.stroke();
    // ticks
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2, l = i % 4 === 0 ? 0.1 : 0.05;
      g.beginPath(); g.moveTo(Math.sin(a) * r * 0.86, -Math.cos(a) * r * 0.86); g.lineTo(Math.sin(a) * r * (0.86 + l), -Math.cos(a) * r * (0.86 + l)); g.stroke();
    }
    const point = (a, len, wdt, c1, c2) => {
      g.save(); g.rotate(a);
      g.fillStyle = c1; g.beginPath(); g.moveTo(0, -len); g.lineTo(wdt, 0); g.lineTo(0, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = c2; g.beginPath(); g.moveTo(0, -len); g.lineTo(-wdt, 0); g.lineTo(0, 0); g.closePath(); g.fill(); g.stroke();
      g.restore();
    };
    g.lineWidth = Math.max(0.6, r * 0.012);
    for (let i = 0; i < 16; i++) if (i % 2) point(i * Math.PI / 8, r * 0.52, r * 0.06, gold, light);
    for (let i = 0; i < 8; i++) if (i % 2) point(i * Math.PI / 4, r * 0.7, r * 0.1, red, light);
    for (let i = 0; i < 4; i++) point(i * Math.PI / 2, r * 0.84, r * 0.13, ink, light);
    g.fillStyle = gold; g.beginPath(); g.arc(0, 0, r * 0.07, 0, 7); g.fill(); g.stroke();
    // fleur-de-lis at north
    if (o.fleur !== false) {
      g.save(); g.translate(0, -r * 0.98 - r * 0.08); g.scale(r / 100, r / 100);
      g.fillStyle = red; g.strokeStyle = ink; g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -26); g.bezierCurveTo(9, -16, 8, -6, 2, 2); g.lineTo(-2, 2); g.bezierCurveTo(-8, -6, -9, -16, 0, -26);
      g.moveTo(3, 0); g.bezierCurveTo(14, -14, 26, -6, 16, 4); g.bezierCurveTo(12, -2, 8, -1, 4, 4);
      g.moveTo(-3, 0); g.bezierCurveTo(-14, -14, -26, -6, -16, 4); g.bezierCurveTo(-12, -2, -8, -1, -4, 4);
      g.fill(); g.stroke();
      g.fillRect(-10, 3, 20, 4); g.strokeRect(-10, 3, 20, 4);
      g.restore();
    }
    if (o.labels) {
      g.fillStyle = ink; g.font = `bold ${Math.round(r * 0.16)}px "IM Fell English SC", Georgia, serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const L = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
      for (const [t, a] of L) if (!(t === 'N' && o.fleur !== false)) g.fillText(t, Math.sin(U.rad(a)) * r * 1.12, -Math.cos(U.rad(a)) * r * 1.12);
    }
    g.restore();
  }

  /* ---------------- Ship, top-down ------------------------------------- */
  // Draws a caravel pointing "up" (north) centred at 0,0. Caller rotates.
  function shipTop(g, o) {
    const L = o.len || 46, W = L * 0.2;
    const t = o.t || 0;
    // hull shadow
    g.fillStyle = 'rgba(0,20,30,0.28)';
    g.beginPath(); g.ellipse(L * 0.07, L * 0.1, W * 1.25, L * 0.55, 0, 0, 7); g.fill();
    // bowsprit
    g.strokeStyle = '#3b2412'; g.lineWidth = L * 0.03; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -L * 0.45); g.lineTo(0, -L * 0.66); g.stroke();
    // hull
    const hull = new Path2D();
    hull.moveTo(0, -L / 2);
    hull.bezierCurveTo(W * 0.7, -L * 0.42, W, -L * 0.24, W, 0);
    hull.lineTo(W * 0.86, L * 0.4);
    hull.quadraticCurveTo(W * 0.8, L * 0.5, W * 0.55, L * 0.5);
    hull.lineTo(-W * 0.55, L * 0.5);
    hull.quadraticCurveTo(-W * 0.8, L * 0.5, -W * 0.86, L * 0.4);
    hull.lineTo(-W, 0);
    hull.bezierCurveTo(-W, -L * 0.24, -W * 0.7, -L * 0.42, 0, -L / 2);
    const hg = g.createLinearGradient(-W, 0, W, 0);
    hg.addColorStop(0, '#3e2412'); hg.addColorStop(0.5, '#8a5a32'); hg.addColorStop(1, '#3a2010');
    g.fillStyle = hg; g.fill(hull);
    g.strokeStyle = o.gold ? '#e8b84a' : '#1e1008'; g.lineWidth = o.gold ? 2 : 1.2; g.stroke(hull);
    // deck
    g.save(); g.scale(0.8, 0.9);
    const dg = g.createLinearGradient(-W, 0, W, 0);
    dg.addColorStop(0, '#a27546'); dg.addColorStop(0.5, '#c9a06b'); dg.addColorStop(1, '#9e7042');
    g.fillStyle = dg; g.fill(hull);
    g.restore();
    // planks
    g.save(); g.clip(hull);
    g.strokeStyle = 'rgba(70,40,15,0.35)'; g.lineWidth = 0.6;
    for (let x = -W; x <= W; x += W * 0.28) { g.beginPath(); g.moveTo(x, -L / 2); g.lineTo(x, L / 2); g.stroke(); }
    g.restore();
    // forecastle
    g.fillStyle = '#7a4c28';
    g.beginPath(); g.moveTo(0, -L * 0.47); g.lineTo(W * 0.55, -L * 0.33); g.lineTo(-W * 0.55, -L * 0.33); g.closePath(); g.fill();
    g.strokeStyle = '#2a170a'; g.lineWidth = 0.8; g.stroke();
    // sterncastle
    g.fillStyle = '#80532f';
    g.fillRect(-W * 0.72, L * 0.2, W * 1.44, L * 0.28);
    g.strokeStyle = '#2a170a'; g.strokeRect(-W * 0.72, L * 0.2, W * 1.44, L * 0.28);
    g.strokeStyle = 'rgba(40,20,5,0.4)';
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-W * 0.72, L * (0.2 + i * 0.07)); g.lineTo(W * 0.72, L * (0.2 + i * 0.07)); g.stroke(); }
    // hatch & barrels
    g.fillStyle = '#5a3a1e'; g.fillRect(-W * 0.3, -L * 0.12, W * 0.6, L * 0.1);
    g.fillStyle = '#6b4424';
    g.beginPath(); g.arc(W * 0.5, L * 0.1, W * 0.17, 0, 7); g.arc(-W * 0.45, -L * 0.2, W * 0.15, 0, 7); g.fill();
    // lantern
    g.fillStyle = o.night ? '#ffd27a' : '#d9b860';
    g.beginPath(); g.arc(0, L * 0.5, L * 0.025, 0, 7); g.fill();
    // crew dots
    if (o.crew !== false) {
      g.fillStyle = '#e9c9a0';
      const cr = U.rng(7);
      for (let i = 0; i < 4; i++) {
        const cx = (cr() - 0.5) * W * 1.0, cy = (cr() - 0.4) * L * 0.5 + Math.sin(t * 2 + i) * 0.6;
        g.beginPath(); g.arc(cx, cy, L * 0.022, 0, 7); g.fill();
      }
    }
    // masts & sails
    const masts = o.square
      ? [[-L * 0.2, L * 0.46, 'sq'], [L * 0.02, L * 0.55, 'sq'], [L * 0.25, L * 0.34, 'lat']]
      : [[-L * 0.2, L * 0.46, 'lat'], [L * 0.02, L * 0.6, 'lat'], [L * 0.25, L * 0.36, 'lat']];
    const sa = o.sailAngle || 0, fill = U.clamp(o.fill ?? 0.7, 0.05, 1), reef = o.reefed ? 0.55 : 1;
    for (let mi = 0; mi < masts.length; mi++) {
      const [my, ml, type] = masts[mi];
      g.save(); g.translate(0, my);
      if (type === 'lat') {
        g.rotate(sa);
        const len = ml * reef;
        // sail bulging to leeward (+x when sa>0)
        const side = sa >= 0 ? 1 : -1;
        const bul = W * 1.3 * fill * side;
        const sp = new Path2D();
        sp.moveTo(0, -len * 0.55);
        sp.quadraticCurveTo(bul, -len * 0.1, bul * 0.25, len * 0.5);
        sp.lineTo(0, len * 0.45);
        sp.closePath();
        const sg = g.createLinearGradient(0, 0, bul, 0);
        if (o.gold) { sg.addColorStop(0, '#fff3c0'); sg.addColorStop(1, '#e0b44a'); }
        else { sg.addColorStop(0, '#fbf3df'); sg.addColorStop(1, '#d8c7a1'); }
        g.fillStyle = sg; g.fill(sp);
        g.strokeStyle = 'rgba(60,40,20,0.7)'; g.lineWidth = 0.8; g.stroke(sp);
        // seams
        g.strokeStyle = 'rgba(120,90,50,0.25)';
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, -len * 0.55 + k * len * 0.24); g.lineTo(bul * 0.55, -len * 0.4 + k * len * 0.24); g.stroke(); }
        // cross
        if (o.cross !== false && mi === 1) {
          g.save(); g.translate(bul * 0.42, -len * 0.05);
          g.fillStyle = '#a3241b';
          const cs = W * 0.42 * Math.max(0.35, fill);
          g.fillRect(-cs * 0.18, -cs, cs * 0.36, cs * 2); g.fillRect(-cs * 0.75, -cs * 0.2, cs * 1.5, cs * 0.36);
          g.restore();
        }
        // yard
        g.strokeStyle = '#3a2110'; g.lineWidth = L * 0.025;
        g.beginPath(); g.moveTo(0, -len * 0.6); g.lineTo(0, len * 0.5); g.stroke();
      } else {
        g.rotate(sa * 0.55);
        const span = ml * 0.75 * reef, bul = -L * 0.12 * fill;
        const sp = new Path2D();
        sp.moveTo(-span / 2, 0); sp.quadraticCurveTo(0, bul * 2, span / 2, 0); sp.lineTo(span / 2 * 0.9, L * 0.03); sp.quadraticCurveTo(0, bul * 1.6 + L * 0.03, -span / 2 * 0.9, L * 0.03); sp.closePath();
        g.fillStyle = o.gold ? '#f3d27a' : '#efe3c6'; g.fill(sp); g.strokeStyle = 'rgba(60,40,20,0.7)'; g.lineWidth = 0.8; g.stroke(sp);
        if (o.cross !== false && mi === 1) {
          g.fillStyle = '#a3241b'; const cs = span * 0.12;
          g.fillRect(-cs * 0.2, bul * 1.2 - cs * 0.4, cs * 0.4, cs * 1.2); g.fillRect(-cs * 0.6, bul * 1.2 - cs * 0.05, cs * 1.2, cs * 0.35);
        }
        g.strokeStyle = '#3a2110'; g.lineWidth = L * 0.025;
        g.beginPath(); g.moveTo(-span / 2, 0); g.lineTo(span / 2, 0); g.stroke();
      }
      g.fillStyle = '#2a1608'; g.beginPath(); g.arc(0, 0, L * 0.03, 0, 7); g.fill();
      g.restore();
    }
    // pennant from main mast, streaming downwind
    const pa = o.pennantAngle || 0;
    g.save(); g.translate(0, L * 0.02); g.rotate(pa);
    g.fillStyle = o.pennant || '#a3241b';
    g.beginPath(); g.moveTo(0, 0);
    const wv = Math.sin(t * 9) * 1.6;
    g.quadraticCurveTo(-2 + wv, L * 0.12, wv * 0.6, L * 0.24); g.quadraticCurveTo(2 + wv, L * 0.12, 3, 0); g.closePath(); g.fill();
    g.restore();
  }

  /* ---------------- Ship, side view (for scenes) ------------------------ */
  function shipSide(g, x, y, s, o = {}) {
    const dir = o.dir || 1, sails = o.sails || 'lateen', ink = o.ink || '#2b1d10';
    g.save(); g.translate(x, y); g.scale(s * dir, s);
    // hull
    g.fillStyle = o.hull || '#5a3a20'; g.strokeStyle = ink; g.lineWidth = 1.4 / s;
    g.beginPath();
    g.moveTo(-50, -14); g.lineTo(-44, -26); g.lineTo(-30, -24); g.lineTo(-28, -14); g.lineTo(30, -12); g.lineTo(44, -20); g.lineTo(52, -18);
    g.quadraticCurveTo(44, 6, 26, 10); g.lineTo(-34, 10); g.quadraticCurveTo(-46, 4, -50, -14); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(240,220,180,0.35)'; g.beginPath(); g.moveTo(-46, -6); g.lineTo(46, -6); g.stroke();
    g.beginPath(); g.moveTo(-44, 0); g.lineTo(40, 0); g.stroke();
    // masts
    g.strokeStyle = ink; g.lineWidth = 2 / s;
    const masts = [[-26, 46], [4, 66], [30, 50]];
    for (let i = 0; i < masts.length; i++) {
      const [mx, mh] = masts[i];
      g.beginPath(); g.moveTo(mx, -12); g.lineTo(mx, -12 - mh); g.stroke();
      g.fillStyle = o.sail || '#f2e7cc';
      if (sails === 'lateen' || (sails === 'mixed' && i === 0)) {
        g.beginPath(); g.moveTo(mx - 22, -14 - mh * 0.15); g.lineTo(mx + 14, -12 - mh * 1.05);
        g.quadraticCurveTo(mx + 6, -12 - mh * 0.4, mx + 4, -16); g.closePath(); g.fill(); g.stroke();
        g.lineWidth = 1.5 / s; g.beginPath(); g.moveTo(mx - 24, -12 - mh * 0.12); g.lineTo(mx + 16, -12 - mh * 1.08); g.stroke(); g.lineWidth = 2 / s;
        if (i === 1 && o.cross !== false) { g.fillStyle = '#9b2018'; g.fillRect(mx - 1, -12 - mh * 0.62, 4, 16); g.fillRect(mx - 5, -12 - mh * 0.55, 12, 4); }
      } else {
        for (let k = 0; k < 2; k++) {
          const top = -12 - mh * (k ? 0.95 : 0.6), bot = -12 - mh * (k ? 0.68 : 0.15), w = (k ? 14 : 20);
          g.beginPath(); g.moveTo(mx - w, top); g.lineTo(mx + w, top); g.quadraticCurveTo(mx + w + 4, (top + bot) / 2, mx + w - 2, bot); g.lineTo(mx - w + 2, bot); g.quadraticCurveTo(mx - w - 4, (top + bot) / 2, mx - w, top); g.closePath(); g.fill(); g.stroke();
          if (k === 0 && i === 1 && o.cross !== false) { g.fillStyle = '#9b2018'; g.fillRect(mx - 2.5, top + 6, 5, bot - top - 12); g.fillRect(mx - 9, (top + bot) / 2 - 3, 18, 5); g.fillStyle = o.sail || '#f2e7cc'; }
        }
      }
    }
    // flag
    g.fillStyle = o.flag || '#9b2018';
    g.beginPath(); g.moveTo(4, -78); g.lineTo(18, -75); g.lineTo(4, -71); g.closePath(); g.fill();
    g.restore();
  }

  function dhow(g, x, y, s, dir = 1) {
    g.save(); g.translate(x, y); g.scale(s * dir, s);
    g.fillStyle = '#6b4a2a'; g.strokeStyle = '#2b1d10'; g.lineWidth = 1.2 / s;
    g.beginPath(); g.moveTo(-30, -8); g.lineTo(34, -12); g.quadraticCurveTo(26, 6, 14, 6); g.lineTo(-22, 6); g.quadraticCurveTo(-30, 2, -30, -8); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -8); g.lineTo(2, -52); g.stroke();
    g.fillStyle = '#efe0bd';
    g.beginPath(); g.moveTo(-28, -14); g.lineTo(26, -60); g.quadraticCurveTo(14, -30, 6, -10); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  /* ---------------- Portraits ----------------------------------------- */
  const LOOKS = {
    dias: { skin: '#e2b58c', hair: '#3a2a1c', beard: 'short', hat: 'beret', hatColor: '#1d1a1a', coat: '#5b1f1a', collar: '#e8dcc0' },
    columbus: { skin: '#ecc39b', hair: '#b07a4a', beard: 'none', hat: 'cap', hatColor: '#1a1414', coat: '#2c3d63', collar: '#e8dcc0', longHair: true },
    gama: { skin: '#dfae84', hair: '#2a201a', beard: 'long', hat: 'beret', hatColor: '#141212', coat: '#1c1c22', collar: '#ddd2b8', cross: true },
    magellan: { skin: '#e0b088', hair: '#2b2018', beard: 'full', hat: 'none', coat: '#6d6f74', collar: '#f1ebdc', armor: true, bald: true },
    elcano: { skin: '#e6b993', hair: '#5a3b22', beard: 'full', hat: 'cap', hatColor: '#4a2b16', coat: '#3e4a2e', collar: '#efe6d0' },
    john2: { skin: '#e4b48c', hair: '#2e2118', beard: 'full', hat: 'crown', coat: '#7a1c18', collar: '#f0e4c6', royal: true },
    manuel: { skin: '#e6b892', hair: '#5a3a20', beard: 'short', hat: 'crown', coat: '#1e3a6e', collar: '#f0e4c6', royal: true, longHair: true },
    ferdinand: { skin: '#e3b28a', hair: '#3a2416', beard: 'none', hat: 'crown', coat: '#7a1c18', collar: '#f0e4c6', royal: true, longHair: true },
    isabella: { skin: '#f0c9a6', hair: '#b5793e', beard: 'none', hat: 'crown', coat: '#3a2a6e', collar: '#f6efe0', royal: true, longHair: true, queen: true },
    charles: { skin: '#ecc19c', hair: '#8a5a2a', beard: 'short', hat: 'crown', coat: '#22222a', collar: '#f6efe0', royal: true },
  };
  function portrait(g, id, size, o = {}) {
    const L = LOOKS[id] || LOOKS.dias;
    const k = size / 200;
    g.save(); g.translate(size / 2, size / 2); g.scale(k, k);
    // background medallion
    g.save();
    g.beginPath(); g.arc(0, 0, 96, 0, 7); g.clip();
    const bg = g.createRadialGradient(-20, -30, 10, 0, 0, 110);
    bg.addColorStop(0, o.bg1 || '#efe0bb'); bg.addColorStop(1, o.bg2 || '#b49564');
    g.fillStyle = bg; g.fillRect(-100, -100, 200, 200);
    g.strokeStyle = 'rgba(80,55,25,0.18)'; g.lineWidth = 1;
    for (let i = -200; i < 200; i += 5) { g.beginPath(); g.moveTo(i, -100); g.lineTo(i + 100, 100); g.stroke(); }
    // torso
    const ink = '#2a1a0d';
    g.lineWidth = 2.2; g.strokeStyle = ink;
    g.fillStyle = L.armor ? '#7d8188' : L.coat;
    g.beginPath(); g.moveTo(-96, 100); g.bezierCurveTo(-92, 58, -60, 44, -26, 40); g.lineTo(26, 40); g.bezierCurveTo(60, 44, 92, 58, 96, 100); g.closePath(); g.fill(); g.stroke();
    if (L.armor) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(-52, 62, 26, 14, -0.4, 0, 7); g.fill();
      g.beginPath(); g.ellipse(52, 62, 26, 14, 0.4, 0, 7); g.fill();
      g.strokeStyle = 'rgba(30,30,40,0.6)';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 120, 60 + i * 9, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    } else {
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(-70 + i * 6, 100); g.lineTo(-40 + i * 4, 52); g.stroke(); }
      g.fillStyle = 'rgba(255,215,140,0.6)';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 56 + i * 11, 2.2, 0, 7); g.fill(); }
    }
    if (L.cross) {
      g.fillStyle = '#b3261e'; g.strokeStyle = ink; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-34, 58); g.lineTo(-30, 70); g.lineTo(-38, 70); g.closePath(); g.fill();
      g.fillRect(-40, 67, 12, 14); g.fillRect(-46, 72, 24, 5);
    }
    // collar / ruff
    g.fillStyle = L.collar; g.strokeStyle = ink; g.lineWidth = 1.6;
    g.beginPath();
    if (L.armor || id === 'elcano') {
      for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI; const r = i % 2 ? 31 : 36; g.lineTo(Math.cos(a) * r * 1.1, 44 - Math.sin(a) * r * 0.32); }
      for (let i = 12; i >= 0; i--) { const a = Math.PI + i / 12 * Math.PI; g.lineTo(Math.cos(a) * 20, 38 - Math.sin(a) * 6); }
    } else {
      g.moveTo(-28, 38); g.quadraticCurveTo(0, 54, 28, 38); g.lineTo(22, 34); g.quadraticCurveTo(0, 44, -22, 34); g.closePath();
    }
    g.fill(); g.stroke();
    // neck
    g.fillStyle = L.skin;
    g.beginPath(); g.moveTo(-16, 18); g.lineTo(-17, 40); g.quadraticCurveTo(0, 46, 17, 40); g.lineTo(16, 18); g.closePath(); g.fill(); g.stroke();
    // long hair behind
    if (L.longHair) {
      g.fillStyle = L.hair;
      g.beginPath(); g.moveTo(-40, -30); g.bezierCurveTo(-56, 0, -50, 34, -34, 46); g.lineTo(34, 46); g.bezierCurveTo(50, 34, 56, 0, 40, -30); g.closePath(); g.fill(); g.stroke();
    }
    // head
    const hg = g.createRadialGradient(-12, -26, 6, 0, -14, 52);
    hg.addColorStop(0, shade(L.skin, 1.08)); hg.addColorStop(1, shade(L.skin, 0.8));
    g.fillStyle = hg;
    g.beginPath(); g.ellipse(0, -14, 36, 46, 0, 0, 7); g.fill(); g.stroke();
    // ears
    g.beginPath(); g.ellipse(-36, -10, 6, 11, 0.2, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(36, -10, 6, 11, -0.2, 0, 7); g.fill(); g.stroke();
    // shadow hatching on right cheek
    g.save(); g.beginPath(); g.ellipse(0, -14, 36, 46, 0, 0, 7); g.clip();
    g.strokeStyle = 'rgba(60,30,10,0.22)'; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(14 + i * 2.5, -50); g.lineTo(8 + i * 2.5, 30); g.stroke(); }
    g.restore();
    // eyes
    g.fillStyle = '#fbf6ea'; g.lineWidth = 1.3;
    for (const sx of [-1, 1]) {
      g.beginPath(); g.ellipse(sx * 14, -18, 7.5, 3.6, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(sx * 14 + 1.5, -18, 2.8, 0, 7); g.fill(); g.fillStyle = '#fbf6ea';
      g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(sx * 6, -27); g.quadraticCurveTo(sx * 14, -31, sx * 23, -26); g.stroke();
      g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(sx * 7, -14); g.quadraticCurveTo(sx * 14, -11.5, sx * 21, -14.5); g.stroke();
    }
    // nose
    g.strokeStyle = ink; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(-2, -16); g.quadraticCurveTo(-3, -2, -7, 4); g.quadraticCurveTo(0, 8, 6, 4); g.stroke();
    // mouth
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-10, 16); g.quadraticCurveTo(0, 19, 10, 16); g.stroke();
    // beard
    g.fillStyle = L.hair;
    if (L.beard !== 'none') {
      const len = L.beard === 'long' ? 62 : L.beard === 'full' ? 42 : 28;
      g.beginPath();
      g.moveTo(-34, -8);
      g.bezierCurveTo(-36, 18, -24, 26 + len * 0.3, 0, 12 + len);
      g.bezierCurveTo(24, 26 + len * 0.3, 36, 18, 34, -8);
      g.bezierCurveTo(30, 8, 20, 10, 12, 10);
      g.quadraticCurveTo(0, 6, -12, 10);
      g.bezierCurveTo(-20, 10, -30, 8, -34, -8);
      g.closePath(); g.fill(); g.stroke();
      // mouth gap in beard
      g.fillStyle = shade(L.skin, 0.75);
      g.beginPath(); g.ellipse(0, 17, 8, 3, 0, 0, 7); g.fill();
      // moustache
      g.fillStyle = L.hair;
      g.beginPath(); g.moveTo(-16, 14); g.quadraticCurveTo(-6, 4, 0, 10); g.quadraticCurveTo(6, 4, 16, 14); g.quadraticCurveTo(6, 10, 0, 13); g.quadraticCurveTo(-6, 10, -16, 14); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const x = -26 + i * 4; g.beginPath(); g.moveTo(x, 18); g.quadraticCurveTo(x * 0.8, 24 + len * 0.4, x * 0.4, 6 + len); g.stroke(); }
      g.strokeStyle = ink; g.lineWidth = 1.6;
    }
    // hair top
    g.fillStyle = L.hair;
    if (L.bald) {
      g.beginPath(); g.moveTo(-36, -18); g.quadraticCurveTo(-38, -38, -28, -46); g.lineTo(-24, -30); g.quadraticCurveTo(-30, -22, -34, -6); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(36, -18); g.quadraticCurveTo(38, -38, 28, -46); g.lineTo(24, -30); g.quadraticCurveTo(30, -22, 34, -6); g.closePath(); g.fill(); g.stroke();
    } else {
      g.beginPath(); g.moveTo(-37, -14); g.bezierCurveTo(-42, -52, -14, -66, 4, -62); g.bezierCurveTo(30, -60, 42, -44, 37, -14);
      g.quadraticCurveTo(30, -40, 6, -44); g.quadraticCurveTo(-26, -44, -37, -14); g.closePath(); g.fill(); g.stroke();
    }
    // hat
    if (L.hat === 'beret') {
      g.fillStyle = L.hatColor;
      g.beginPath(); g.ellipse(-4, -54, 50, 16, -0.12, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(-6, -62, 36, 14, -0.12, Math.PI, 0); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(-18, -60, 16, 5, -0.12, 0, 7); g.fill();
    } else if (L.hat === 'cap') {
      g.fillStyle = L.hatColor;
      g.beginPath(); g.moveTo(-36, -40); g.bezierCurveTo(-36, -76, 36, -76, 36, -40); g.quadraticCurveTo(0, -48, -36, -40); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-26 + i * 13, -44); g.lineTo(-20 + i * 10, -68); g.stroke(); }
      g.strokeStyle = ink;
    } else if (L.hat === 'crown') {
      const cg = g.createLinearGradient(-36, -90, 36, -50);
      cg.addColorStop(0, '#fff0a8'); cg.addColorStop(0.5, '#d9a63c'); cg.addColorStop(1, '#a8741c');
      g.fillStyle = cg;
      g.beginPath(); g.moveTo(-34, -48);
      const pts = [[-34, -80], [-22, -64], [-11, -88], [0, -66], [11, -88], [22, -64], [34, -80], [34, -48]];
      for (const [px, py] of pts) g.lineTo(px, py);
      g.closePath(); g.fill(); g.stroke();
      g.fillRect(-35, -56, 70, 10); g.strokeRect(-35, -56, 70, 10);
      const gems = ['#b3261e', '#1f5fa8', '#2d8a4a', '#1f5fa8', '#b3261e'];
      gems.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(-24 + i * 12, -51, 3, 0, 7); g.fill(); });
      for (const [px, py] of [[-34, -80], [-11, -88], [11, -88], [34, -80]]) { g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(px, py, 3.2, 0, 7); g.fill(); g.stroke(); }
      if (L.queen) {
        g.fillStyle = 'rgba(250,245,235,0.55)';
        g.beginPath(); g.moveTo(-36, -46); g.bezierCurveTo(-60, -10, -56, 30, -46, 46); g.lineTo(-38, 40); g.bezierCurveTo(-46, 10, -42, -20, -30, -44); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(36, -46); g.bezierCurveTo(60, -10, 56, 30, 46, 46); g.lineTo(38, 40); g.bezierCurveTo(46, 10, 42, -20, 30, -44); g.closePath(); g.fill();
      }
    }
    if (L.royal) {
      // ermine trim on the shoulders
      g.fillStyle = '#f7f2e6';
      g.beginPath(); g.moveTo(-96, 100); g.bezierCurveTo(-90, 66, -62, 52, -30, 46); g.lineTo(-24, 58); g.bezierCurveTo(-56, 64, -78, 76, -80, 100); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(96, 100); g.bezierCurveTo(90, 66, 62, 52, 30, 46); g.lineTo(24, 58); g.bezierCurveTo(56, 64, 78, 76, 80, 100); g.closePath(); g.fill();
      g.fillStyle = '#1a1414';
      for (const [px, py] of [[-70, 78], [-50, 62], [-84, 92], [70, 78], [50, 62], [84, 92]]) { g.beginPath(); g.ellipse(px, py, 2, 3.5, 0, 0, 7); g.fill(); }
    }
    g.restore();
    // frame
    const fg = g.createLinearGradient(-100, -100, 100, 100);
    fg.addColorStop(0, '#f3d98c'); fg.addColorStop(0.5, '#a8772c'); fg.addColorStop(1, '#f0d283');
    g.strokeStyle = fg; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 96, 0, 7); g.stroke();
    g.strokeStyle = '#5a3a12'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 0, 100.5, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 91.5, 0, 7); g.stroke();
    // laurel dots
    g.fillStyle = '#fff3c4';
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 96, Math.sin(a) * 96, 1.4, 0, 7); g.fill(); }
    g.restore();
  }
  function shade(hex, f) {
    const v = parseInt(hex.slice(1), 16);
    const r = U.clamp(((v >> 16) & 255) * f, 0, 255) | 0, gg = U.clamp(((v >> 8) & 255) * f, 0, 255) | 0, b = U.clamp((v & 255) * f, 0, 255) | 0;
    return `rgb(${r},${gg},${b})`;
  }

  /* ---------------- Flags / heraldry ----------------------------------- */
  function flag(g, kind, x, y, w, h) {
    g.save(); g.translate(x, y);
    if (kind === 'portugal') {
      g.fillStyle = '#f4efe2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b3261e'; g.fillRect(w * 0.28, h * 0.12, w * 0.44, h * 0.76);
      g.fillStyle = '#f4efe2'; g.fillRect(w * 0.34, h * 0.22, w * 0.32, h * 0.56);
      g.fillStyle = '#1f3d8a';
      const q = [[0.5, 0.32], [0.5, 0.5], [0.5, 0.68], [0.41, 0.5], [0.59, 0.5]];
      for (const [qx, qy] of q) g.fillRect(w * qx - w * 0.035, h * qy - h * 0.06, w * 0.07, h * 0.1);
      g.fillStyle = '#e9c44b';
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.fillRect(w * 0.5 + Math.cos(a) * w * 0.19 - 1.5, h * 0.5 + Math.sin(a) * h * 0.33 - 1.5, 3, 3); }
    } else if (kind === 'castile' || kind === 'spain') {
      const q = (cx, cy, castle) => {
        g.fillStyle = castle ? '#b3261e' : '#f4efe2'; g.fillRect(cx, cy, w / 2, h / 2);
        if (castle) {
          g.fillStyle = '#e9c44b';
          g.fillRect(cx + w * 0.12, cy + h * 0.2, w * 0.26, h * 0.22); g.fillRect(cx + w * 0.17, cy + h * 0.1, w * 0.16, h * 0.12);
        } else {
          g.fillStyle = '#7a2b8a';
          g.beginPath(); g.ellipse(cx + w * 0.25, cy + h * 0.27, w * 0.11, h * 0.15, 0, 0, 7); g.fill();
          g.fillRect(cx + w * 0.16, cy + h * 0.15, w * 0.06, h * 0.08);
        }
      };
      q(0, 0, true); q(w / 2, 0, false); q(0, h / 2, false); q(w / 2, h / 2, true);
      if (kind === 'spain') { g.strokeStyle = '#b3261e'; g.lineWidth = Math.max(2, w * 0.08); g.beginPath(); g.moveTo(w * 0.1, h * 0.1); g.lineTo(w * 0.9, h * 0.9); g.moveTo(w * 0.9, h * 0.1); g.lineTo(w * 0.1, h * 0.9); g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1; }
    }
    g.strokeStyle = '#3b2a17'; g.lineWidth = 1; g.strokeRect(0, 0, w, h);
    g.restore();
  }

  /* ---------------- Journal scene painter ------------------------------ */
  function scene(c, spec, seed = 1) {
    const g = c.getContext('2d'), W = c.width, H = c.height;
    const r = U.rng(seed);
    const items = new Set(spec.items || []);
    const hz = H * 0.58;
    const SKY = {
      day: ['#bcd3dc', '#f1e7cf'], dawn: ['#e9a77c', '#f4dfbf'], dusk: ['#c66b4a', '#e9b77c'], night: ['#16203a', '#3e4a6a'],
      storm: ['#3e444c', '#8a8e90'], fog: ['#cfd3cd', '#e7e4d6'],
    };
    const sk = SKY[spec.sky] || SKY.day;
    const gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, sk[0]); gr.addColorStop(1, sk[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
    // sun / moon / stars
    if (spec.sky === 'night') {
      g.fillStyle = '#fff8e0';
      for (let i = 0; i < 70; i++) { g.globalAlpha = 0.4 + r() * 0.6; g.fillRect(r() * W, r() * hz * 0.9, 1.5, 1.5); }
      g.globalAlpha = 1;
      g.beginPath(); g.arc(W * 0.8, H * 0.18, 16, 0, 7); g.fill();
      g.fillStyle = sk[0]; g.beginPath(); g.arc(W * 0.8 + 7, H * 0.18 - 4, 14, 0, 7); g.fill();
    } else if (spec.sky === 'dusk' || spec.sky === 'dawn') {
      const sx = spec.sky === 'dusk' ? W * 0.25 : W * 0.7;
      const sg = g.createRadialGradient(sx, hz - 10, 4, sx, hz - 10, 120);
      sg.addColorStop(0, 'rgba(255,240,200,0.95)'); sg.addColorStop(0.2, 'rgba(255,210,140,0.6)'); sg.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, hz);
      g.fillStyle = '#fff1cf'; g.beginPath(); g.arc(sx, hz - 6, 18, Math.PI, 0); g.fill();
    } else if (spec.sky === 'day') {
      const sg = g.createRadialGradient(W * 0.82, H * 0.15, 4, W * 0.82, H * 0.15, 70);
      sg.addColorStop(0, 'rgba(255,250,225,1)'); sg.addColorStop(0.25, 'rgba(255,240,200,0.6)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, hz);
    }
    // clouds
    const nC = spec.sky === 'storm' ? 14 : spec.sky === 'night' ? 3 : 6;
    for (let i = 0; i < nC; i++) {
      const cx = r() * W, cy = r() * hz * 0.6 + 10, cw = 50 + r() * 90;
      cloud(g, cx, cy, cw, spec.sky === 'storm' ? 'rgba(50,55,62,0.75)' : spec.sky === 'night' ? 'rgba(80,90,120,0.4)' : spec.sky === 'dusk' ? 'rgba(255,200,170,0.6)' : 'rgba(255,255,250,0.75)');
    }
    // far mountains
    if (items.has('mountains') || spec.land === 'strait' || spec.land === 'bay') {
      g.fillStyle = spec.sky === 'night' ? '#2a3350' : '#8f9a9c';
      g.beginPath(); g.moveTo(0, hz);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, hz - 30 - Math.abs(Math.sin(x * 0.012 + seed)) * 50 - r() * 10);
      g.lineTo(W, hz); g.closePath(); g.fill();
      if (spec.land === 'strait') {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (let x = 30; x < W; x += 80) { g.beginPath(); g.moveTo(x - 14, hz - 50); g.lineTo(x, hz - 75); g.lineTo(x + 14, hz - 50); g.closePath(); g.fill(); }
      }
    }
    // sea
    const sea = spec.sky === 'night' ? ['#1d2c44', '#0e1626'] : spec.sky === 'storm' ? ['#4f5a5c', '#2a3436'] : spec.sky === 'dusk' ? ['#7a6a70', '#3a4a5a'] : ['#7fa6ad', '#3f6b78'];
    const sgr = g.createLinearGradient(0, hz, 0, H); sgr.addColorStop(0, sea[0]); sgr.addColorStop(1, sea[1]);
    g.fillStyle = sgr; g.fillRect(0, hz, W, H - hz);
    // land
    const landCol = spec.sky === 'night' ? '#1e2a26' : spec.sky === 'storm' ? '#4a4a3c' : '#7d8a55';
    const landFar = spec.sky === 'night' ? '#26332e' : '#9aa070';
    g.strokeStyle = '#2b1d10'; g.lineWidth = 1.2;
    let shore = null; // [x0,x1,y] region where items like palms go
    switch (spec.land) {
      case 'cliffs': {
        g.fillStyle = spec.sky === 'night' ? '#2d2a26' : '#8a7a62';
        g.beginPath(); g.moveTo(0, hz + 30); g.lineTo(0, hz - 70); g.lineTo(W * 0.12, hz - 80); g.lineTo(W * 0.22, hz - 60); g.lineTo(W * 0.3, hz - 40); g.lineTo(W * 0.34, hz + 2); g.lineTo(W * 0.36, hz + 30); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(40,25,10,0.45)';
        for (let i = 0; i < 18; i++) { const x = r() * W * 0.3, y = hz - 60 + r() * 80; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 12); g.stroke(); }
        shore = [W * 0.04, W * 0.2, hz - 74];
        break;
      }
      case 'cape': {
        g.fillStyle = spec.sky === 'storm' ? '#55554a' : '#7a7a5c';
        g.beginPath(); g.moveTo(W, hz + 10); g.lineTo(W * 0.48, hz + 8); g.quadraticCurveTo(W * 0.55, hz - 40, W * 0.62, hz - 78); g.lineTo(W * 0.86, hz - 84); g.quadraticCurveTo(W * 0.95, hz - 60, W, hz - 50); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(30,25,15,0.4)';
        for (let i = 0; i < 20; i++) { const x = W * 0.55 + r() * W * 0.4, y = hz - 70 + r() * 70; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 14); g.stroke(); }
        // surf
        g.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(W * 0.5 + i * 22, hz + 10 + r() * 3, 10, 2.5, 0, 0, 7); g.fill(); }
        shore = [W * 0.62, W * 0.86, hz - 82];
        break;
      }
      case 'island': case 'atoll': {
        const small = spec.land === 'atoll';
        g.fillStyle = small ? '#d9c79a' : landFar;
        g.beginPath(); g.moveTo(W * 0.45, hz + 3);
        g.bezierCurveTo(W * 0.5, small ? hz - 6 : hz - 50, W * 0.8, small ? hz - 8 : hz - 60, W * 0.95, hz + 3); g.closePath(); g.fill(); g.stroke();
        if (!small) { g.fillStyle = '#e1d0a2'; g.fillRect(W * 0.46, hz, W * 0.48, 3); }
        shore = [W * 0.5, W * 0.9, hz - (small ? 4 : 20)];
        break;
      }
      case 'jungle': case 'hills': case 'coast': case 'flat': case 'dunes': {
        const amp = spec.land === 'flat' ? 6 : spec.land === 'dunes' ? 20 : spec.land === 'hills' ? 36 : 28;
        g.fillStyle = spec.land === 'dunes' ? '#d8b57a' : landFar;
        g.beginPath(); g.moveTo(W * 0.3, hz + 4);
        for (let x = W * 0.3; x <= W; x += 10) g.lineTo(x, hz - 4 - Math.abs(Math.sin(x * 0.02 + seed)) * amp * U.smooth(W * 0.3, W * 0.5, x));
        g.lineTo(W, hz + 4); g.closePath(); g.fill(); g.stroke();
        if (spec.land === 'jungle') {
          g.fillStyle = spec.sky === 'night' ? '#16241a' : '#3e5a30';
          for (let x = W * 0.4; x < W; x += 8) { g.beginPath(); g.arc(x, hz - 8 - r() * 22 * U.smooth(W * 0.3, W * 0.55, x), 8 + r() * 6, 0, 7); g.fill(); }
        }
        shore = [W * 0.5, W * 0.95, hz - 10];
        break;
      }
      case 'city': case 'castle': {
        g.fillStyle = landFar;
        g.beginPath(); g.moveTo(W * 0.25, hz + 4); g.quadraticCurveTo(W * 0.5, hz - 30, W, hz - 24); g.lineTo(W, hz + 4); g.closePath(); g.fill(); g.stroke();
        const wall = spec.sky === 'night' ? '#4a4a52' : spec.land === 'castle' ? '#ede4cf' : '#d9c7a2';
        g.fillStyle = wall;
        const x0 = W * 0.45;
        if (spec.land === 'castle') {
          g.fillRect(x0, hz - 50, 160, 46); g.strokeRect(x0, hz - 50, 160, 46);
          for (const tx of [x0 - 10, x0 + 70, x0 + 150]) { g.fillRect(tx, hz - 74, 22, 70); g.strokeRect(tx, hz - 74, 22, 70); for (let k = 0; k < 3; k++) { g.fillRect(tx + k * 8, hz - 80, 5, 6); } }
          g.fillStyle = '#5a3a20'; g.fillRect(x0 + 74, hz - 26, 12, 22);
          if (items.has('flags')) { }
          flag(g, 'portugal', x0 + 76, hz - 98, 16, 11);
          g.beginPath(); g.moveTo(x0 + 76, hz - 98); g.lineTo(x0 + 76, hz - 74); g.stroke();
        } else {
          let x = x0;
          while (x < W - 20) {
            const bw = 16 + r() * 22, bh = 18 + r() * 34;
            g.fillStyle = wall; g.fillRect(x, hz - bh, bw, bh); g.strokeRect(x, hz - bh, bw, bh);
            const roll = r();
            if (roll < 0.25) { g.beginPath(); g.arc(x + bw / 2, hz - bh, bw / 2, Math.PI, 0); g.fill(); g.stroke(); }
            else if (roll < 0.4) { g.fillRect(x + bw / 2 - 3, hz - bh - 26, 6, 26); g.strokeRect(x + bw / 2 - 3, hz - bh - 26, 6, 26); g.beginPath(); g.arc(x + bw / 2, hz - bh - 26, 4, Math.PI, 0); g.fill(); g.stroke(); }
            else if (roll < 0.7) { g.fillStyle = '#a0543a'; g.beginPath(); g.moveTo(x - 2, hz - bh); g.lineTo(x + bw / 2, hz - bh - 10); g.lineTo(x + bw + 2, hz - bh); g.closePath(); g.fill(); g.stroke(); }
            g.fillStyle = 'rgba(40,25,10,0.6)';
            for (let k = 0; k < 2; k++) g.fillRect(x + 3 + k * 7, hz - bh + 6, 3, 5);
            x += bw + 2;
          }
          if (items.has('flags')) { flag(g, 'castile', x0 + 30, hz - 90, 16, 11); g.beginPath(); g.moveTo(x0 + 30, hz - 90); g.lineTo(x0 + 30, hz - 50); g.stroke(); }
        }
        shore = [W * 0.3, W * 0.44, hz - 8];
        break;
      }
      case 'bay': {
        // sugarloaf
        g.fillStyle = landFar;
        g.beginPath(); g.moveTo(W * 0.55, hz + 4); g.quadraticCurveTo(W * 0.6, hz - 110, W * 0.66, hz - 112); g.quadraticCurveTo(W * 0.72, hz - 110, W * 0.74, hz + 4); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(W * 0.0, hz + 4); g.quadraticCurveTo(W * 0.15, hz - 40, W * 0.35, hz + 4); g.closePath(); g.fill(); g.stroke();
        shore = [W * 0.78, W * 0.98, hz - 4];
        g.fillStyle = landFar; g.fillRect(W * 0.74, hz - 6, W * 0.26, 10);
        break;
      }
      case 'strait': {
        g.fillStyle = landCol;
        g.beginPath(); g.moveTo(0, H); g.lineTo(0, hz - 50); g.quadraticCurveTo(W * 0.18, hz - 30, W * 0.3, hz + 8); g.lineTo(W * 0.24, H); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(W, H); g.lineTo(W, hz - 60); g.quadraticCurveTo(W * 0.82, hz - 30, W * 0.7, hz + 8); g.lineTo(W * 0.78, H); g.closePath(); g.fill(); g.stroke();
        shore = [W * 0.8, W * 0.95, hz - 30];
        break;
      }
      default: break;
    }
    // waves
    g.strokeStyle = spec.sky === 'night' ? 'rgba(200,210,255,0.25)' : 'rgba(255,255,255,0.45)'; g.lineWidth = 1.1;
    const nW = spec.sky === 'storm' || items.has('waves') ? 60 : items.has('calm') ? 10 : 34;
    for (let i = 0; i < nW; i++) {
      const y = hz + 6 + Math.pow(r(), 1.3) * (H - hz - 8), x = r() * W, w = 6 + (y - hz) * 0.25;
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - w * 0.35 * (spec.sky === 'storm' ? 2 : 1), x + w, y); g.stroke();
    }
    if (items.has('calm')) {
      g.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 6; i++) g.fillRect(r() * W, hz + 10 + r() * (H - hz - 20), 60 + r() * 80, 1.5);
    }
    // land items
    if (shore) {
      const [sx0, sx1, sy] = shore;
      if (items.has('palms')) for (let i = 0; i < 5; i++) palm(g, sx0 + r() * (sx1 - sx0), sy + 6, 0.7 + r() * 0.5, spec.sky === 'night');
      if (items.has('padrao')) padrao(g, sx0 + (sx1 - sx0) * 0.3, sy + 4, 1);
      if (items.has('huts')) for (let i = 0; i < 3; i++) hut(g, sx0 + (sx1 - sx0) * (0.5 + i * 0.12), sy + 6);
      if (items.has('cattle')) for (let i = 0; i < 5; i++) cow(g, sx0 + r() * (sx1 - sx0), sy + 4 + r() * 4, 0.6 + r() * 0.3);
      if (items.has('fire')) fire(g, sx0 + (sx1 - sx0) * 0.6, sy + 4);
      if (items.has('seals')) for (let i = 0; i < 7; i++) { g.fillStyle = '#4a3a30'; g.beginPath(); g.ellipse(W * 0.08 + r() * W * 0.25, hz + 10 + r() * 14, 8, 3.5, 0, 0, 7); g.fill(); }
      if (items.has('spice')) cloves(g, W * 0.08, H - 10);
    }
    if (items.has('weed')) { g.fillStyle = 'rgba(190,150,60,0.75)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(r() * W, hz + 10 + r() * (H - hz - 10), 6 + r() * 12, 2, 0, 0, 7); g.fill(); } }
    if (items.has('whale')) { g.fillStyle = '#2d3a42'; g.beginPath(); g.ellipse(W * 0.2, hz + 30, 30, 8, 0, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(W * 0.2 - 10, hz + 22); g.quadraticCurveTo(W * 0.2 - 10 + k * 8, hz + 5, W * 0.2 - 10 + k * 14, hz + 2); g.stroke(); } }
    if (items.has('birds')) { g.strokeStyle = '#2b1d10'; g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const bx = W * 0.3 + r() * W * 0.5, by = 20 + r() * hz * 0.5; g.beginPath(); g.moveTo(bx - 6, by); g.quadraticCurveTo(bx - 3, by - 4, bx, by); g.quadraticCurveTo(bx + 3, by - 4, bx + 6, by); g.stroke(); } }
    if (items.has('lightning')) { g.strokeStyle = '#fffbe0'; g.lineWidth = 2.5; g.shadowColor = '#fff'; g.shadowBlur = 14; g.beginPath(); let lx = W * 0.6, ly = 0; g.moveTo(lx, ly); while (ly < hz - 10) { lx += (r() - 0.5) * 30; ly += 15 + r() * 15; g.lineTo(lx, ly); } g.stroke(); g.shadowBlur = 0; }
    // ships
    const sails = spec.sails || 'lateen';
    const nShips = items.has('ships3') ? 3 : items.has('ships2') ? 2 : items.has('ships1') ? 1 : 0;
    const shipCol = spec.sky === 'night' ? { hull: '#1a140e', sail: '#a8a49a' } : {};
    for (let i = 0; i < nShips; i++) shipSide(g, W * (0.18 + i * 0.17), hz + 24 + i * 10 - (i === 1 ? 14 : 0), 0.75 - i * 0.12, Object.assign({ dir: 1, sails: i === 0 ? 'mixed' : sails }, shipCol));
    if (items.has('wreck')) { g.save(); g.translate(W * 0.28, hz + 30); g.rotate(-0.35); shipSide(g, 0, 0, 0.7, Object.assign({ sails: 'square' }, shipCol)); g.restore(); g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(W * 0.2 + i * 14, hz + 40, 8, 2, 0, 0, 7); g.fill(); } }
    if (items.has('dhows')) { dhow(g, W * 0.62, hz + 34, 0.7, -1); dhow(g, W * 0.82, hz + 22, 0.5, 1); }
    if (items.has('canoes')) for (let i = 0; i < 3; i++) canoe(g, W * (0.55 + i * 0.1), hz + 40 + i * 8, 0.8);
    // rain for storms
    if (spec.sky === 'storm') { g.strokeStyle = 'rgba(220,225,230,0.35)'; g.lineWidth = 1; for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y + 14); g.stroke(); } }
    if (spec.sky === 'fog') { for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(235,235,228,0.35)'; g.fillRect(0, hz - 30 + i * 18, W, 12); } }
    // sepia tint, vignette, frame
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(240,215,170,0.45)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(60,35,10,0)'); vg.addColorStop(1, 'rgba(60,35,10,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(80,50,20,${r() * 0.08})`; g.fillRect(r() * W, r() * H, 1, 1); }
    g.strokeStyle = '#3b2a17'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
  }
  function cloud(g, x, y, w, col) {
    g.fillStyle = col;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + (i - 2.5) * w * 0.16, y + Math.sin(i * 1.7) * w * 0.05, w * 0.18, w * 0.11, 0, 0, 7); g.fill(); }
  }
  function palm(g, x, y, s, night) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = night ? '#141a14' : '#4a3520'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, -24, 2, -44); g.stroke();
    g.fillStyle = night ? '#121e14' : '#2f5a28';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.5;
      g.save(); g.translate(2, -44); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -6, 24, 4); g.quadraticCurveTo(10, 0, 0, 2); g.fill();
      g.restore();
    }
    g.restore();
  }
  function padrao(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = '#e8e0cc'; g.strokeStyle = '#2b1d10'; g.lineWidth = 1.2;
    g.fillRect(-4, -40, 8, 40); g.strokeRect(-4, -40, 8, 40);
    g.fillRect(-7, -48, 14, 9); g.strokeRect(-7, -48, 14, 9);
    g.fillRect(-1.5, -60, 3, 12); g.fillRect(-5, -56, 10, 3);
    g.strokeRect(-1.5, -60, 3, 12);
    g.restore();
  }
  function hut(g, x, y) {
    g.fillStyle = '#9a7b4a'; g.strokeStyle = '#2b1d10';
    g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 10, y - 8); g.lineTo(x, y - 18); g.lineTo(x + 10, y - 8); g.lineTo(x + 10, y); g.closePath(); g.fill(); g.stroke();
  }
  function cow(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#3a2a1e';
    g.fillRect(-8, -8, 16, 6); g.fillRect(-7, -2, 2, 5); g.fillRect(5, -2, 2, 5); g.fillRect(7, -10, 5, 4);
    g.restore();
  }
  function fire(g, x, y) {
    const fg = g.createRadialGradient(x, y - 4, 1, x, y - 4, 26);
    fg.addColorStop(0, 'rgba(255,230,150,0.95)'); fg.addColorStop(0.3, 'rgba(255,140,40,0.6)'); fg.addColorStop(1, 'rgba(255,100,20,0)');
    g.fillStyle = fg; g.fillRect(x - 30, y - 30, 60, 40);
    g.fillStyle = '#ffcf5a'; g.beginPath(); g.moveTo(x - 4, y); g.quadraticCurveTo(x, y - 14, x + 4, y); g.fill();
  }
  function canoe(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = '#4a3020'; g.beginPath(); g.moveTo(-18, -2); g.quadraticCurveTo(0, 6, 18, -2); g.lineTo(16, 0); g.quadraticCurveTo(0, 4, -16, 0); g.fill();
    g.fillStyle = '#2b1d10'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * 8, -6, 2.4, 0, 7); g.fill(); g.fillRect(i * 8 - 1.5, -5, 3, 5); }
    g.strokeStyle = '#2b1d10'; g.beginPath(); g.moveTo(10, -6); g.lineTo(16, 4); g.stroke();
    g.restore();
  }
  function cloves(g, x, y) {
    g.strokeStyle = '#4a3020'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.22, l = 22 + (i % 3) * 6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      g.fillStyle = '#7a3a1e'; g.beginPath(); g.arc(x + Math.cos(a) * l, y + Math.sin(a) * l, 3.2, 0, 7); g.fill();
    }
  }

  /* ---------------- Category icons (canvas) ----------------------------- */
  function catIcon(g, cat, x, y, s, col = '#3b2a17') {
    g.save(); g.translate(x, y); g.scale(s / 40, s / 40);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
    switch (cat) {
      case 'ship': shipSide(g, 0, 10, 0.32, { ink: col, hull: col, sail: 'rgba(0,0,0,0)', flag: col, cross: false }); break;
      case 'nav': g.beginPath(); g.arc(0, 0, 14, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.moveTo(-9, -9); g.lineTo(9, 9); g.stroke(); g.beginPath(); g.arc(0, -17, 3, 0, 7); g.stroke(); break;
      case 'wind': for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-16, -8 + i * 8); g.lineTo(8 - i * 3, -8 + i * 8); g.arc(8 - i * 3, -12 + i * 8, 4, Math.PI / 2, -Math.PI * 0.9, true); g.stroke(); } break;
      case 'place': compassRose(g, 0, 0, 15, { fleur: false, ink: col, light: '#f3e6c4', red: col, gold: col, ringFill: 'rgba(0,0,0,0)' }); break;
      case 'people': g.beginPath(); g.moveTo(-14, 8); g.lineTo(-14, -6); g.lineTo(-7, 1); g.lineTo(0, -10); g.lineTo(7, 1); g.lineTo(14, -6); g.lineTo(14, 8); g.closePath(); g.stroke(); g.fillRect(-14, 9, 28, 4); break;
      case 'idea': g.beginPath(); g.moveTo(-12, -12); g.lineTo(10, -12); g.quadraticCurveTo(16, -12, 14, -6); g.lineTo(12, 12); g.lineTo(-12, 12); g.quadraticCurveTo(-16, 8, -12, 6); g.closePath(); g.stroke(); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-6, -5 + i * 6); g.lineTo(8, -5 + i * 6); g.stroke(); } break;
      default: break;
    }
    g.restore();
  }

  /* ---------------- Sea creatures & effects (top-down) ----------------- */
  function whaleTop(g, x, y, ang, s, phase) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    const sub = 0.5 + 0.5 * Math.sin(phase);
    g.globalAlpha = 0.35 + sub * 0.55;
    g.fillStyle = '#25343c';
    g.beginPath(); g.ellipse(0, 0, 9, 26, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(0, 22); g.lineTo(-11, 34); g.quadraticCurveTo(0, 30, 11, 34); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-3, -8, 3, 10, 0, 0, 7); g.fill();
    g.restore();
  }
  function dolphin(g, x, y, ang, s, jump) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s * (1 + jump * 0.3), s * (1 + jump * 0.3));
    g.fillStyle = `rgba(0,20,30,${0.25 * (1 - jump)})`; g.beginPath(); g.ellipse(4 * jump, 6 * jump, 3, 9, 0, 0, 7); g.fill();
    g.fillStyle = '#5b7480';
    g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(3.5, -2, 2, 8); g.lineTo(4, 12); g.lineTo(0, 10); g.lineTo(-4, 12); g.lineTo(-2, 8); g.quadraticCurveTo(-3.5, -2, 0, -11); g.fill();
    g.fillStyle = '#c9d6db'; g.beginPath(); g.ellipse(0, -3, 1.2, 5, 0, 0, 7); g.fill();
    g.restore();
  }
  function bird(g, x, y, s, flap, col = '#f4f1ea') {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = col; g.lineWidth = 1.6; g.lineCap = 'round';
    const f = Math.sin(flap) * 4;
    g.beginPath(); g.moveTo(-8, f); g.quadraticCurveTo(-4, -3, 0, 0); g.quadraticCurveTo(4, -3, 8, f); g.stroke();
    g.restore();
  }

  /* ---------------- Royal throne room -------------------------------- */
  function throneRoom(c, flagKind, n = 1) {
    const g = c.getContext('2d'), W = c.width, H = c.height;
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#3a2418'); wall.addColorStop(0.65, '#6a4428'); wall.addColorStop(1, '#2a180e');
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    const fy = H * 0.66;
    // arches
    g.strokeStyle = 'rgba(240,210,150,0.35)'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + i * 0.2), aw = W * 0.07;
      g.fillStyle = 'rgba(20,10,5,0.45)';
      g.beginPath(); g.moveTo(x - aw, fy); g.lineTo(x - aw, H * 0.28); g.arc(x, H * 0.28, aw, Math.PI, 0); g.lineTo(x + aw, fy); g.closePath(); g.fill(); g.stroke();
      const lg = g.createRadialGradient(x, H * 0.3, 2, x, H * 0.3, aw * 1.6);
      lg.addColorStop(0, 'rgba(255,220,150,0.35)'); lg.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = lg; g.fillRect(x - aw * 2, 0, aw * 4, fy);
    }
    // floor tiles in perspective
    g.fillStyle = '#d8c8a8'; g.fillRect(0, fy, W, H - fy);
    for (let r = 0; r < 8; r++) {
      const y0 = fy + (H - fy) * Math.pow(r / 8, 1.6), y1 = fy + (H - fy) * Math.pow((r + 1) / 8, 1.6);
      for (let k = -12; k < 12; k++) {
        if ((k + r) % 2) continue;
        const sx = (t, y) => W / 2 + (k + t) * (W * 0.05) * (0.4 + (y - fy) / (H - fy) * 1.6);
        g.fillStyle = '#2a2018';
        g.beginPath(); g.moveTo(sx(0, y0), y0); g.lineTo(sx(1, y0), y0); g.lineTo(sx(1, y1), y1); g.lineTo(sx(0, y1), y1); g.closePath(); g.fill();
      }
    }
    // red carpet
    g.fillStyle = '#8a1e16';
    g.beginPath(); g.moveTo(W * 0.46, fy); g.lineTo(W * 0.54, fy); g.lineTo(W * 0.66, H); g.lineTo(W * 0.34, H); g.closePath(); g.fill();
    g.strokeStyle = '#e0b04a'; g.lineWidth = 2; g.stroke();
    // banners
    for (const bx of [W * 0.2, W * 0.8]) {
      g.fillStyle = '#5a1810'; g.fillRect(bx - 34, H * 0.08, 68, H * 0.42);
      flag(g, flagKind, bx - 26, H * 0.12, 52, 40);
      g.fillStyle = '#5a1810';
      g.beginPath(); g.moveTo(bx - 34, H * 0.5); g.lineTo(bx, H * 0.58); g.lineTo(bx + 34, H * 0.5); g.closePath(); g.fill();
      g.strokeStyle = '#e0b04a'; g.lineWidth = 2; g.strokeRect(bx - 34, H * 0.08, 68, H * 0.42);
    }
    // throne(s) on a dais
    g.fillStyle = '#4a2c18'; g.fillRect(W * 0.32, fy - 14, W * 0.36, 16);
    g.fillStyle = '#6a4024'; g.fillRect(W * 0.35, fy - 26, W * 0.30, 14);
    const tw = 60;
    for (let i = 0; i < n; i++) {
      const tx = W / 2 + (n === 1 ? 0 : (i ? 46 : -46));
      g.fillStyle = '#b8862e'; g.strokeStyle = '#4a2a0a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(tx - tw / 2, fy - 26); g.lineTo(tx - tw / 2, fy - 130); g.quadraticCurveTo(tx, fy - 170, tx + tw / 2, fy - 130); g.lineTo(tx + tw / 2, fy - 26); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#8a1e16'; g.fillRect(tx - tw / 2 + 8, fy - 120, tw - 16, 80);
      g.fillStyle = '#e8c860'; g.beginPath(); g.arc(tx, fy - 150, 6, 0, 7); g.fill();
    }
    // light and vignette
    const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, W * 0.7);
    vg.addColorStop(0, 'rgba(255,220,160,0.12)'); vg.addColorStop(1, 'rgba(10,5,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3b2a17'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
  }

  return { throneRoom, parchment, compassRose, shipTop, shipSide, dhow, portrait, flag, scene, catIcon, whaleTop, dolphin, bird, cloud, padrao, palm };
})();
