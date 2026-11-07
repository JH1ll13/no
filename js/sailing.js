/* ==========================================================================
   Sailing: the voyage gameplay — ship physics, winds, fog of war, events,
   collectibles, hazards, camera and rendering.
   ========================================================================== */
'use strict';

const Sail = (() => {
  let canvas, ctx, W = 1, H = 1, dpr = 1;
  let st = null;               // voyage state
  let running = false, paused = false;
  const cam = { x: 0, y: 0, z: 1, userZ: 1, shake: 0 };
  const keys = new Set();
  const pointer = { down: false, x: 0, y: 0 };
  let hooks = {};              // callbacks to UI
  let time = 0;

  /* ---------------- Fog of war ----------------------------------------- */
  const FOG_S = 1 / 16;
  let fogC, fogG, fogLayer, fogLayerG, mistPattern, mistTex;
  function fogInit() {
    fogC = U.canvas(Math.ceil(GEO.W * FOG_S), Math.ceil(GEO.H * FOG_S));
    fogG = fogC.getContext('2d');
    fogG.fillStyle = '#000'; fogG.fillRect(0, 0, fogC.width, fogC.height);
    explored = null;
    if (!mistTex) {
      // tileable mist texture
      const N = 256; mistTex = U.canvas(N, N);
      const g = mistTex.getContext('2d'), img = g.createImageData(N, N), d = img.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        // tileable by sampling on a torus
        const a = x / N * Math.PI * 2, b = y / N * Math.PI * 2;
        const v = U.fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + Math.cos(b) * 1.6 * 0.7 + Math.sin(b) * 1.6 * 0.7, 5);
        const o = (y * N + x) * 4;
        const c = 0.6 + v * 0.6;
        d[o] = 40 * c; d[o + 1] = 52 * c; d[o + 2] = 68 * c; d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
  }
  const EXP_S = 1 / 64;
  let explored = null, EXW = 0, EXH = 0;
  function markExplored(x, y, r) {
    if (!explored) { EXW = Math.ceil(GEO.W * EXP_S); EXH = Math.ceil(GEO.H * EXP_S); explored = new Uint8Array(EXW * EXH); }
    const cx = GEO.wrapX(x) * EXP_S, cy = y * EXP_S, cr = r * 0.75 * EXP_S;
    for (let j = Math.floor(cy - cr); j <= Math.ceil(cy + cr); j++) {
      if (j < 0 || j >= EXH) continue;
      for (let i = Math.floor(cx - cr); i <= Math.ceil(cx + cr); i++) {
        if ((i - cx) ** 2 + (j - cy) ** 2 > cr * cr) continue;
        explored[j * EXW + ((i % EXW) + EXW) % EXW] = 1;
      }
    }
  }
  function reveal(x, y, r, strength = 1) {
    markExplored(x, y, r);
    const fx = GEO.wrapX(x) * FOG_S, fy = y * FOG_S, fr = r * FOG_S;
    fogG.save();
    fogG.globalCompositeOperation = 'destination-out';
    for (const off of [0, -fogC.width, fogC.width]) {
      if (fx + off + fr < 0 || fx + off - fr > fogC.width) continue;
      const gr = fogG.createRadialGradient(fx + off, fy, fr * 0.35, fx + off, fy, fr);
      gr.addColorStop(0, `rgba(0,0,0,${strength})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      fogG.fillStyle = gr;
      fogG.fillRect(fx + off - fr, fy - fr, fr * 2, fr * 2);
    }
    fogG.restore();
  }
  function fogAt(x, y) {
    if (!explored) return 1;
    const i = Math.floor(GEO.wrapX(x) * EXP_S), j = Math.floor(y * EXP_S);
    if (j < 0 || j >= EXH) return 1;
    return explored[j * EXW + i] ? 0 : 1;
  }

  /* ---------------- Wind model ----------------------------------------- */
  function vecFromBearing(b, s) { const r = U.rad(b); return [Math.sin(r) * s, Math.cos(r) * s]; } // [east, north]
  function windAt(lat, lon, t) {
    // returns {b: bearing the wind blows TOWARD, s: strength 0..1, zone}
    const bands = [];
    const add = (w, b, s, zone) => { if (w > 0.001) bands.push([w, b, s, zone]); };
    const a = lat;
    // smooth weights for each belt
    const wPolarN = U.smooth(58, 64, a), wPolarS = U.smooth(-58, -64, a);
    const wWestN = U.smooth(30, 36, a) * (1 - wPolarN), wWestS = U.smooth(-29, -35, a) * (1 - wPolarS);
    const wTradeN = U.smooth(4, 9, a) * (1 - U.smooth(26, 32, a));
    const wTradeS = U.smooth(-3, -7, a) * (1 - U.smooth(-25, -31, a));
    const wDold = Math.max(0, 1 - Math.abs(a - 1.5) / 5.5);
    const monsoon = lon > 38 && lon < 100 && a > -2 && a < 26 ? U.smooth(-2, 3, a) * U.smooth(38, 45, lon) * (1 - U.smooth(92, 100, lon)) : 0;
    add(wPolarN, 250, 0.55, 'polar');
    add(wPolarS, 290, 0.6, 'polar');
    add(wWestN, 65, 0.85, 'westerlies');
    const roar = U.smooth(-38, -42, a) * (1 - U.smooth(-52, -56, a));
    add(wWestS * (1 - roar), 95, 0.85, 'westerlies');
    add(wWestS * roar, 92, 1.0, 'roaringforties');
    add(wTradeN * (1 - monsoon), 238, 0.82, 'tradewindsN');
    add(wTradeS * (1 - monsoon), 302, 0.82, 'tradewindsS');
    add(wDold * (1 - monsoon), 200 + U.noise2(t * 0.05, lon * 0.05) * 320, 0.14, 'doldrums');
    add(monsoon, 50, 0.9, 'monsoon');
    // northerly coastal winds off Portugal and NW Africa (the "Portuguese trades")
    const nort = (lat > 20 && lat < 44 && lon > -22 && lon < -5) ? U.smooth(44, 38, lat) * U.smooth(20, 26, lat) * U.smooth(-22, -16, lon) * (1 - U.smooth(-7, -5, lon)) : 0;
    if (nort > 0) { for (const b of bands) b[0] *= (1 - nort); add(nort, 200, 0.8, 'nortada'); }
    // horse latitudes (weak) fill gaps
    const tot = bands.reduce((s, b) => s + b[0], 0);
    if (tot < 1) add(1 - tot, 180 + U.noise2(t * 0.04 + 3, lat * 0.1) * 360, 0.3, 'horse');
    let ex = 0, ny = 0, sw = 0, best = null;
    for (const [w, b, s, z] of bands) {
      const [e, n] = vecFromBearing(b, s * w);
      ex += e; ny += n; sw += w;
      if (!best || w > best[0]) best = [w, z];
    }
    const jitter = (U.noise2(t * 0.07, lon * 0.08 + lat * 0.05) - 0.5) * 30;
    let b = U.normAng(U.deg(Math.atan2(ex, ny)) + jitter);
    let s = Math.hypot(ex, ny) / Math.max(sw, 0.0001);
    s *= 0.85 + U.noise2(t * 0.11 + 9, lat * 0.07) * 0.3;
    // sheltered in the Strait of Magellan
    if (lat < -51.5 && lat > -55 && lon > -76 && lon < -67.5) s *= 0.5;
    return { b, s: U.clamp(s, 0.08, 1.1), zone: best ? best[1] : 'horse' };
  }
  const ZONE_INFO = {
    tradewindsN: { name: 'Northeast Trade Winds', term: 'tradewinds', msg: 'Steady winds blowing from the northeast—perfect for sailing west!' },
    tradewindsS: { name: 'Southeast Trade Winds', term: 'tradewinds', msg: 'Steady winds blowing from the southeast.' },
    westerlies: { name: 'The Westerlies', term: 'westerlies', msg: 'Winds from the west—they carry ships east.' },
    roaringforties: { name: 'The Roaring Forties', term: 'roaringforties', msg: 'Howling westerly winds and giant waves!' },
    doldrums: { name: 'The Doldrums', term: 'doldrums', msg: 'The wind dies near the Equator… look for rain squalls.' },
    monsoon: { name: 'The Monsoon', term: 'monsoon', msg: 'The seasonal monsoon blows toward India.' },
    horse: { name: 'Variable Winds', term: null, msg: '' },
    nortada: { name: 'Northerly Coastal Winds', term: null, msg: '' },
    polar: { name: 'Polar Easterlies', term: null, msg: '' },
  };
  function polar(off) {
    // off: angle between heading and the direction the wind comes FROM (0 = straight into the wind)
    if (off < 25) return 0.12;
    if (off < 45) return U.lerp(0.12, 0.58, (off - 25) / 20);
    if (off < 90) return U.lerp(0.58, 0.93, (off - 45) / 45);
    if (off < 130) return U.lerp(0.93, 1.0, (off - 90) / 40);
    return U.lerp(1.0, 0.86, (off - 130) / 50);
  }
  function pointOfSail(off) {
    if (off < 30) return 'In irons — too close to the wind!';
    if (off < 60) return 'Close-hauled';
    if (off < 110) return 'Beam reach';
    if (off < 150) return 'Broad reach — fast!';
    return 'Running with the wind';
  }

  /* ---------------- Voyage setup --------------------------------------- */
  function upg(k) { return (Save.data.upgrades[k] || 0); }
  function start(ex, checkpoint) {
    fogInit();
    const S = Save.data;
    const caps = { food: 100 * (1 + 0.2 * upg('hold')), water: 100 * (1 + 0.2 * upg('hold')), hull: 100 * (1 + 0.3 * upg('hull')) };
    const p0 = GEO.toXY(ex.start.lat, ex.start.lon);
    st = {
      ex, wpIndex: 0, caps,
      ship: { x: p0.x, y: p0.y, bearing: ex.start.bearing, desired: ex.start.bearing, speed: 0, reefed: false, vx: 0, vy: 0, bump: 0 },
      food: caps.food, water: caps.water, hull: caps.hull, health: 100, morale: 100,
      day: 0, t: 0, sinceLand: 0, farFromLand: 0, lastLandD: 0,
      fleet: ex.fleet.slice(1).map((name, i) => Object.assign({ name, bearing: ex.start.bearing, speed: 0 }, behind(p0.x, p0.y, ex.start.bearing, i))),
      flagship: ex.fleet[0], captain: ex.id,
      trail: [], route: [[p0.x, p0.y]], lastRoute: [p0.x, p0.y],
      quizRight: 0, quizTotal: 0, scrolls: [], ducats: 0, xp: 0,
      boost: 0, forced: null, zonesSeen: {}, lastZone: null, ironsT: 0,
      entities: [], spawnT: 1, decorT: 3, events: [], landHoCooldown: 0,
      lineCross: {}, lastLat: ex.start.lat,
    };
    // estimate voyage length for the calendar
    let len = 0, px = p0.x, py = p0.y;
    for (const w of ex.waypoints) { const q = GEO.toXY(w.lat, w.lon); len += Math.hypot(GEO.dx(q.x, px), q.y - py); px = q.x; py = q.y; }
    const HIST = { dias: 290, columbus: 225, gama: 316, magellan: 1082 };
    st.dayRate = (HIST[ex.id] || 300) / Math.max(60, len / 62);
    // known world
    revealKnown(ex);
    // wind ribbons & scrolls & reefs
    buildRouteEntities(ex);
    if (checkpoint) restore(checkpoint);
    // initial fog around ship
    reveal(st.ship.x, st.ship.y, revealR() * 1.3);
    for (const [x, y] of st.route) reveal(x, y, revealR());
    cam.x = st.ship.x; cam.y = st.ship.y;
    cam.z = baseZoom();
    // prime tiles around ship
    primeTiles(true);
    running = true; paused = false;
    st.particles = [];
    initWaves(); initClouds();
  }
  function restore(cp) {
    Object.assign(st, {
      wpIndex: cp.wpIndex, food: cp.food, water: cp.water, hull: cp.hull, health: cp.health, morale: cp.morale,
      day: cp.day, t: cp.t, flagship: cp.flagship, captain: cp.captain, quizRight: cp.quizRight, quizTotal: cp.quizTotal,
      scrolls: cp.scrolls || [], ducats: cp.ducats || 0, xp: cp.xp || 0, zonesSeen: cp.zonesSeen || {}, lineCross: cp.lineCross || {},
    });
    st.route = cp.route || st.route;
    st.ship.x = cp.x; st.ship.y = cp.y; st.ship.bearing = st.ship.desired = cp.bearing || 180;
    st.fleet = (cp.fleet || []).map((name, i) => Object.assign({ name, bearing: cp.bearing || 180, speed: 0 }, behind(cp.x, cp.y, cp.bearing || 180, i)));
    st.entities = st.entities.filter(e => !(e.type === 'scroll' && st.scrolls.includes(e.term)) && !(e.type === 'ribbon' && e.leg < st.wpIndex));
  }
  function checkpoint() {
    const s = st;
    return {
      explorer: s.ex.id, wpIndex: s.wpIndex, x: s.ship.x, y: s.ship.y, bearing: s.ship.bearing,
      food: s.food, water: s.water, hull: s.hull, health: s.health, morale: s.morale, day: s.day, t: s.t,
      flagship: s.flagship, captain: s.captain, fleet: s.fleet.map(f => f.name), quizRight: s.quizRight, quizTotal: s.quizTotal,
      scrolls: s.scrolls.slice(), ducats: s.ducats, xp: s.xp, zonesSeen: s.zonesSeen, lineCross: s.lineCross,
      route: s.route.length > 1600 ? s.route.filter((_, i) => i % 2 === 0) : s.route.slice(),
    };
  }
  function revealKnown(ex) {
    const k = ex.known;
    for (let i = 0; i < k.coast.length - 1; i++) {
      const [la1, lo1] = k.coast[i], [la2, lo2] = k.coast[i + 1];
      const steps = Math.ceil(Math.hypot(la2 - la1, lo2 - lo1) / 1.2);
      for (let s = 0; s <= steps; s++) {
        const la = la1 + (la2 - la1) * s / steps, lo = lo1 + (lo2 - lo1) * s / steps;
        const p = GEO.toXY(la, lo);
        reveal(p.x, p.y, k.r * GEO.S / Math.cos(U.rad(la)), 1);
      }
    }
    for (const [la, lo, r] of k.areas) {
      const p = GEO.toXY(la, lo);
      const rp = r * GEO.S / Math.cos(U.rad(la));
      for (let a = 0; a < 6; a++) reveal(p.x + Math.cos(a) * rp * 0.4, p.y + Math.sin(a) * rp * 0.4, rp * 0.8, 1);
      reveal(p.x, p.y, rp, 1);
    }
  }
  function buildRouteEntities(ex) {
    const wps = ex.waypoints;
    let prev = GEO.toXY(ex.start.lat, ex.start.lon);
    const legs = [];
    wps.forEach((w, i) => {
      let q = GEO.toXY(w.lat, w.lon);
      q = { x: prev.x + GEO.dx(q.x, prev.x), y: q.y };
      legs.push([prev, q, w, i]);
      prev = q;
    });
    // wind ribbons along flagged legs
    for (const [a, b, w, i] of legs) {
      if (!w.wind) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = 260; s < len - 260; s += 300) {
        const x = a.x + (b.x - a.x) * s / len, y = a.y + (b.y - a.y) * s / len;
        if (World.isLand(x, y) || World.landDistance(x, y, 60, 2) < 60) continue;
        st.entities.push({ type: 'ribbon', x, y, r: 55, leg: i, t: Math.random() * 10 });
      }
    }
    // scrolls distributed over legs
    const terms = ex.scrolls.slice();
    const total = legs.reduce((s, l) => s + Math.hypot(l[1].x - l[0].x, l[1].y - l[0].y), 0);
    const rnd = U.rng(ex.id.length * 977 + 13);
    terms.forEach((term, k) => {
      let target = total * (k + 0.6) / (terms.length + 0.4);
      for (const [a, b, , i] of legs) {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (target > len) { target -= len; continue; }
        const t = target / len;
        const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        let off = (rnd() - 0.5) * 360;
        let x, y, tries = 0;
        do {
          x = a.x + (b.x - a.x) * t + nx * off; y = a.y + (b.y - a.y) * t + ny * off;
          off *= 0.6; tries++;
        } while ((World.isLand(x, y) || World.landDistance(x, y, 50, 2) < 50) && tries < 8);
        if (!World.isLand(x, y)) st.entities.push({ type: 'scroll', x, y, r: 34, term, leg: i, t: rnd() * 10 });
        break;
      }
    });
    // reefs
    const REEFS = {
      columbus: [[23.6, -75.15, 3], [20.25, -72.95, 3]],
      dias: [[25.3, -15.1, 4], [-30.5, 16.5, 4]],
      gama: [[-25.0, 34.2, 3]],
      magellan: [[-18.0, -38.6, 4], [10.15, 124.25, 3]],
    }[ex.id] || [];
    for (const [la, lo, n] of REEFS) {
      const c = GEO.toXY(la, lo);
      for (let k = 0; k < n; k++) {
        const x = c.x + (rnd() - 0.5) * 120, y = c.y + (rnd() - 0.5) * 120;
        if (World.isLand(x, y)) continue;
        st.entities.push({ type: 'reef', x, y, r: 9 + rnd() * 5, t: rnd() * 10 });
      }
    }
  }

  /* ---------------- Helpers -------------------------------------------- */
  function behind(x, y, bearing, i) {
    // a spot on open water behind (and to one side of) the flagship
    const r = U.rad(bearing);
    for (let d = 55 * (i + 1); d > 0; d -= 15) {
      const side = (i % 2 ? 1 : -1) * 24;
      const px = x - Math.sin(r) * d + Math.cos(r) * side, py = y + Math.cos(r) * d + Math.sin(r) * side;
      if (!World.isLand(px, py)) return { x: px, y: py };
    }
    return { x, y };
  }
  const revealR = () => 240 + upg('nav') * 70;
  function baseZoom() { return U.clamp(Math.min(W / 1350, H / 820), 0.5, 1.25); }
  function shipLatLon() { return { lat: GEO.yToLat(st.ship.y), lon: GEO.xToLon(st.ship.x) }; }
  function currentWP() { return st.ex.waypoints[st.wpIndex]; }
  function wpXY(w) { const p = GEO.toXY(w.lat, w.lon); return { x: st.ship.x + GEO.dx(p.x, st.ship.x), y: p.y }; }
  function bearingTo(x, y) { return U.normAng(U.deg(Math.atan2(GEO.dx(x, st.ship.x), -(y - st.ship.y)))); }
  function toast(msg, kind) { hooks.toast && hooks.toast(msg, kind); }
  function unlock(term, silent) { hooks.unlock && hooks.unlock(term, silent); }

  function primeTiles(urgent) {
    const vw = W / cam.z, vh = H / cam.z;
    const T = World.TILE;
    const tx0 = Math.floor((cam.x - vw / 2) / T) - 1, tx1 = Math.floor((cam.x + vw / 2) / T) + 1;
    const ty0 = Math.floor((cam.y - vh / 2) / T) - 1, ty1 = Math.floor((cam.y + vh / 2) / T) + 1;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const inView = tx > tx0 && tx < tx1 && ty > ty0 && ty < ty1;
      World.requestTile(tx, ty, urgent && inView);
    }
  }

  /* ---------------- Update --------------------------------------------- */
  let hudT = 0, slowT = 0;
  function update(dt) {
    time += dt;
    if (!running || paused) return;
    const s = st, sh = s.ship;
    s.t += dt;
    s.day += dt * s.dayRate;
    const { lat, lon } = shipLatLon();
    const wind = windAt(lat, lon, s.t);
    s.wind = wind;

    // steering input
    let kx = 0, ky = 0;
    if (keys.has('ArrowUp') || keys.has('KeyW')) ky += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) ky -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) kx += 1;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) kx -= 1;
    if (kx || ky) sh.desired = U.normAng(U.deg(Math.atan2(kx, ky)));
    if (pointer.down && pointer.steer) {
      const sp = worldToScreen(sh.x, sh.y);
      const dx = pointer.x - sp.x, dy = pointer.y - sp.y;
      if (Math.hypot(dx, dy) > 20) sh.desired = U.normAng(U.deg(Math.atan2(dx, -dy)));
    }
    // forced drift (storm scripted)
    let control = 1;
    if (s.forced) {
      s.forced.t -= dt; control = 0.25;
      if (s.forced.t <= 0) { s.forced = null; hooks.forcedEnd && hooks.forcedEnd(); }
    }
    const turnRate = 75 * (0.55 + 0.45 * U.clamp(sh.speed / 50, 0, 1));
    const diff = U.angDiff(sh.desired, sh.bearing);
    sh.bearing = U.normAng(sh.bearing + U.clamp(diff, -turnRate * dt * control, turnRate * dt * control));

    // speed
    const off = Math.abs(U.angDiff(sh.bearing, wind.b + 180));
    s.off = off;
    const p = polar(off);
    const healthF = 0.55 + 0.45 * (s.health / 100);
    let target = 72 * (1 + 0.1 * upg('sails')) * (0.22 + 0.9 * p * wind.s) * (sh.reefed ? 0.6 : 1) * healthF;
    if (s.boost > 0) { target *= 1.55; s.boost -= dt; }
    let inStorm = 0;
    for (const e of s.entities) if (e.type === 'storm') {
      const d = Math.hypot(GEO.dx(e.x, sh.x), e.y - sh.y);
      if (d < e.r) inStorm = Math.max(inStorm, 1 - d / e.r * 0.6);
    }
    s.inStorm = inStorm;
    sh.speed += (target - sh.speed) * Math.min(1, dt * 0.9);
    if (sh.bump > 0) sh.bump -= dt;
    // movement
    const br = U.rad(sh.bearing);
    let vx = Math.sin(br) * sh.speed, vy = -Math.cos(br) * sh.speed;
    if (s.forced) { const fr = U.rad(s.forced.bearing); vx += Math.sin(fr) * 70; vy += -Math.cos(fr) * 70; }
    if (inStorm > 0) {
      const gust = U.noise2(s.t * 0.8, 3) - 0.5, gust2 = U.noise2(s.t * 0.8, 7) - 0.5;
      vx += gust * 60 * inStorm; vy += gust2 * 60 * inStorm;
      const dmg = (sh.reefed ? 1.1 : 4.2) * inStorm * (1 - 0.15 * upg('hull'));
      s.hull -= dmg * dt;
      s.morale -= 0.6 * dt * inStorm;
      cam.shake = Math.max(cam.shake, 3 * inStorm);
      if (!sh.reefed && !s.reefHint) { s.reefHint = true; toast('⛈ Storm! Press SPACE to reef your sails and reduce damage.', 'warn'); unlock('reef'); }
    }
    // never let the ship get trapped inside the coastline
    if (World.isLand(sh.x, sh.y)) {
      outer: for (let r = 6; r <= 240; r += 6) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, px = sh.x + Math.cos(a) * r, py = sh.y + Math.sin(a) * r;
        if (!World.isLand(px, py)) { sh.x = px; sh.y = py; break outer; }
      }
    }
    const nx = sh.x + vx * dt, ny = sh.y + vy * dt;
    // collision with land (check bow)
    const bowX = nx + Math.sin(br) * 18, bowY = ny - Math.cos(br) * 18;
    if (World.isLand(bowX, bowY) || World.isLand(nx, ny)) {
      // try sliding
      if (!World.isLand(nx, sh.y) && !World.isLand(nx + Math.sin(br) * 18, sh.y)) sh.x = nx;
      else if (!World.isLand(sh.x, ny) && !World.isLand(sh.x, ny - Math.cos(br) * 18)) sh.y = ny;
      if (sh.speed > 30 && sh.bump <= 0) {
        s.hull -= 2 + sh.speed * 0.04; sh.bump = 2; Sound.play('aground'); cam.shake = 6;
        toast('Ran aground! Steer back to open water.', 'warn');
      }
      sh.speed *= 0.3;
    } else { sh.x = nx; sh.y = ny; }
    sh.y = U.clamp(sh.y, 40, GEO.H - 40);
    sh.vx = vx; sh.vy = vy;

    // trail for companions + route record
    const last = s.trail[s.trail.length - 1];
    if (!last || Math.hypot(GEO.dx(sh.x, last[0]), sh.y - last[1]) > 6) { s.trail.push([sh.x, sh.y, sh.bearing]); if (s.trail.length > 400) s.trail.shift(); }
    if (Math.hypot(GEO.dx(sh.x, s.lastRoute[0]), sh.y - s.lastRoute[1]) > 40) { s.route.push([Math.round(sh.x), Math.round(sh.y)]); s.lastRoute = [sh.x, sh.y]; }
    updateFleet(dt);

    // fog
    reveal(sh.x, sh.y, revealR(), 0.55);

    // supplies, health, morale
    const holdF = 1;
    s.food = Math.max(0, s.food - 0.62 * dt * holdF);
    s.water = Math.max(0, s.water - 0.72 * dt * holdF);
    s.sinceLand += dt;
    const crewF = 1 - 0.15 * upg('crew');
    if (s.sinceLand > 48) s.health -= 0.3 * dt * crewF;
    if (s.food <= 0 || s.water <= 0) { s.health -= 1.6 * dt; s.morale -= 1.5 * dt; }
    const wp = currentWP();
    const fear = (wp && wp.fear) || (s.ex.id === 'columbus' && wp && ['sargasso', 'mutiny', 'sansalvador'].includes(wp.id) ? 2.2 : 1);
    s.morale -= (0.04 + 0.0018 * s.sinceLand) * dt * crewF * fear;
    if (wind.zone === 'doldrums' && sh.speed < 35) s.morale -= 0.15 * dt;
    s.health = U.clamp(s.health, 0, 100); s.morale = U.clamp(s.morale, 0, 100); s.hull = U.clamp(s.hull, 0, s.caps.hull);

    // fail states
    if (s.hull <= 0) return fail('shipwreck');
    if (s.health <= 0) return fail('scurvy');
    if (s.morale <= 0) return fail('mutiny');

    // entities
    updateEntities(dt, wind);
    spawn(dt, lat, lon, wind);

    // slow checks
    slowT -= dt;
    if (slowT <= 0) { slowT = 0.5; slowChecks(lat, lon, wind); }

    // waypoint
    if (wp && !s.forced) {
      const q = wpXY(wp);
      const d = Math.hypot(q.x - sh.x, q.y - sh.y);
      s.wpDist = d;
      if (d < (wp.r || 95)) arrive(wp);
    }

    // camera
    const look = 0.7;
    const tx = sh.x + vx * look, ty = sh.y + vy * look;
    cam.x += GEO.dx(tx, cam.x) * Math.min(1, dt * 2.2);
    cam.y += (ty - cam.y) * Math.min(1, dt * 2.2);
    const nearLand = s.lastLandD < 260;
    const zt = baseZoom() * cam.userZ * (nearLand ? 1.1 : 0.92) * (s.ex.id === 'magellan' && s.wpIndex >= 6 && s.wpIndex <= 10 ? 1.25 : 1);
    cam.z += (zt - cam.z) * Math.min(1, dt * 0.8);
    cam.shake *= Math.pow(0.05, dt);

    // tiles
    primeTiles(false);
    World.pump(7);

    // audio
    Sound.ambience({ on: true, wind: U.clamp(wind.s * 0.7 + inStorm * 0.6, 0, 1), rain: Math.max(inStorm, s.inRain || 0), nearLand: s.lastLandD < 300, sailing: true });
    const mood = inStorm > 0.15 ? 'storm' : (todNight() > 0.6 ? 'calm' : 'sail');
    if (mood !== s.mood) { s.moodT = (s.moodT || 0) + dt; if (s.moodT > 2.5 || mood === 'storm') { s.mood = mood; s.moodT = 0; Sound.music(mood); } } else s.moodT = 0;

    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; hooks.hud && hooks.hud(hudInfo()); }
  }

  function updateFleet(dt) {
    const s = st;
    s.fleet.forEach((f, i) => {
      const lag = 9 + i * 8;
      const idx = s.trail.length - 1 - lag;
      let tx, ty;
      if (idx >= 0) {
        const [px, py, pb] = s.trail[idx];
        const side = (i % 2 ? 1 : -1) * 22;
        const r = U.rad(pb);
        tx = px + Math.cos(r) * side; ty = py + Math.sin(r) * side;
        if (World.isLand(tx, ty)) { tx = px; ty = py; }
      } else { tx = s.ship.x - 40 * (i + 1); ty = s.ship.y + 40 * (i + 1); }
      const dx = GEO.dx(tx, f.x), dy = ty - f.y, d = Math.hypot(dx, dy);
      const want = U.normAng(U.deg(Math.atan2(dx, -dy)));
      if (d > 4) f.bearing = U.normAng(f.bearing + U.clamp(U.angDiff(want, f.bearing), -120 * dt, 120 * dt));
      const sp = U.clamp(d * 2.2, 0, s.ship.speed * 1.4 + 40);
      f.speed += (sp - f.speed) * Math.min(1, dt * 2);
      const r = U.rad(f.bearing);
      const nx = f.x + Math.sin(r) * f.speed * dt, ny = f.y - Math.cos(r) * f.speed * dt;
      if (World.isLand(nx, ny)) { f.x += dx * Math.min(1, dt * 3); f.y += dy * Math.min(1, dt * 3); } else { f.x = nx; f.y = ny; }
      if (d > 600) { f.x = tx; f.y = ty; }
    });
  }

  function slowChecks(lat, lon, wind) {
    const s = st, sh = s.ship;
    // land distance & land ho
    const ld = World.landDistance(sh.x, sh.y, 420, 4);
    if (ld >= 420) s.farFromLand += 0.5; else {
      if (s.farFromLand > 22 && s.landHoCooldown <= 0) {
        hooks.landHo && hooks.landHo();
        s.morale = Math.min(100, s.morale + 12);
        s.landHoCooldown = 30;
      }
      s.farFromLand = 0;
    }
    s.landHoCooldown -= 0.5;
    s.lastLandD = ld;
    // wind zones
    if (wind.zone !== s.lastZone) {
      s.lastZone = wind.zone;
      const info = ZONE_INFO[wind.zone];
      if (info && info.term && !s.zonesSeen[wind.zone]) {
        s.zonesSeen[wind.zone] = 1;
        toast(`🌬 You have entered <b>${info.name}</b>. ${info.msg}`, 'info');
        unlock(info.term);
      }
    }
    // latitude lines
    const crossings = [[0, 'equator', 'You crossed the <b>Equator</b> (0°)! You are now in the ' + (lat < 0 ? 'Southern' : 'Northern') + ' Hemisphere.'],
      [23.44, 'tropics', 'You crossed the <b>Tropic of Cancer</b> (23.5°N).'], [-23.44, 'tropics', 'You crossed the <b>Tropic of Capricorn</b> (23.5°S).']];
    for (const [L, term, msg] of crossings) {
      if ((s.lastLat - L) * (lat - L) < 0) {
        const key = term + L;
        if (!s.lineCross[key]) { s.lineCross[key] = 1; toast('🧭 ' + msg, 'info'); unlock(term); s.ducats += 5; }
      }
    }
    s.lastLat = lat;
    // in irons hint
    if (s.off < 30 && sh.speed < 30) { s.ironsT += 0.5; if (s.ironsT > 4 && !s.ironsHint) { s.ironsHint = true; toast('⛵ You are sailing straight into the wind. Try zig-zagging at an angle (tacking)!', 'info'); unlock('lateen'); } } else s.ironsT = 0;
    // supply warnings
    if (s.food < 20 && !s.warnFood) { s.warnFood = true; toast('🍞 Food is running low! Sail through schools of fish.', 'warn'); }
    if (s.water < 20 && !s.warnWater) { s.warnWater = true; toast('💧 Fresh water is running low! Sail under rain clouds.', 'warn'); }
    if (s.food > 40) s.warnFood = false; if (s.water > 40) s.warnWater = false;
    if (s.health < 60 && s.sinceLand > 48 && !s.warnScurvy) { s.warnScurvy = true; toast('🤒 Scurvy is spreading—your crew needs landfall!', 'warn'); unlock('scurvy'); }
    if (s.morale < 30 && !s.warnMorale) { s.warnMorale = true; toast('😠 The crew is grumbling… morale is low. Reach land soon!', 'warn'); unlock('mutiny'); }
    if (s.morale > 50) s.warnMorale = false;
    // despawn far entities
    s.entities = s.entities.filter(e => e.fixed || e.type === 'scroll' || e.type === 'ribbon' || e.type === 'reef' || Math.hypot(GEO.dx(e.x, sh.x), e.y - sh.y) < 2200);
  }

  /* ---------------- Entities ------------------------------------------- */
  function spawn(dt, lat, lon, wind) {
    const s = st, sh = s.ship;
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      s.spawnT = 2.2 + Math.random() * 1.6;
      const count = s.entities.filter(e => ['fish', 'rain', 'flotsam', 'storm'].includes(e.type)).length;
      if (count < 9) {
        const al = Math.abs(lat);
        const capeZone = lat < -30 && lon > 8 && lon < 36;
        const weights = {
          fish: 1.0 + (s.food < 40 ? 1 : 0) + (al > 30 ? 0.4 : 0),
          rain: 0.7 + (al < 12 ? 0.6 : 0) + (s.water < 40 ? 1 : 0) + (wind.zone === 'doldrums' ? 1 : 0),
          flotsam: s.lastLandD < 400 || (s.ex.id === 'columbus' && lon < -40) ? 0.9 : 0.15,
          storm: s.forced ? 0 : (capeZone ? 0.55 : (al > 38 ? 0.3 : wind.zone === 'roaringforties' ? 0.5 : 0.1)),
        };
        if (s.entities.some(e => e.type === 'storm')) weights.storm = 0;
        if (s.t < 25) weights.storm = 0;
        const tot = Object.values(weights).reduce((a, b) => a + b, 0);
        let r = Math.random() * tot, type = 'fish';
        for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) { type = k; break; } }
        const ahead = U.rad(sh.bearing + (Math.random() - 0.5) * 140);
        const dist = 520 + Math.random() * 520;
        const x = sh.x + Math.sin(ahead) * dist, y = sh.y - Math.cos(ahead) * dist;
        if (!World.isLand(x, y) && World.landDistance(x, y, 40, 2) >= 40) {
          if (type === 'storm') s.entities.push({ type, x, y, r: 170 + Math.random() * 110, t: 0, rot: Math.random() * 6, life: 40 + Math.random() * 30 });
          else if (type === 'rain') s.entities.push({ type, x, y, r: 70 + Math.random() * 30, t: 0, life: 40 });
          else if (type === 'fish') s.entities.push({ type, x, y, r: 38, t: 0, n: 14 + (Math.random() * 10 | 0), life: 45 });
          else s.entities.push({ type: 'flotsam', x, y, r: 26, t: 0, kind: Math.random() < 0.5 ? 'branch' : 'birds', life: 40 });
        }
      }
    }
    // decorative wildlife
    s.decorT -= dt;
    if (s.decorT <= 0) {
      s.decorT = 5 + Math.random() * 7;
      const al = Math.abs(lat);
      const a = U.rad(sh.bearing + (Math.random() - 0.5) * 200), d = 200 + Math.random() * 300;
      const x = sh.x + Math.sin(a) * d, y = sh.y - Math.cos(a) * d;
      if (!World.isLand(x, y)) {
        const roll = Math.random();
        if (roll < 0.45 && al < 40) s.entities.push({ type: 'dolphins', x, y, t: 0, life: 9, b: sh.bearing + (Math.random() - 0.5) * 60, n: 3 + (Math.random() * 3 | 0), deco: 1 });
        else if (roll < 0.75) { s.entities.push({ type: 'whale', x, y, t: 0, life: 16, b: Math.random() * 360, deco: 1 }); if (Math.random() < 0.5) Sound.play('whale'); }
        else if (s.lastLandD < 500) s.entities.push({ type: 'gulls', x, y, t: 0, life: 14, b: Math.random() * 360, n: 3 + (Math.random() * 4 | 0), deco: 1 });
        else if (al < 25) s.entities.push({ type: 'flyfish', x, y, t: 0, life: 3, b: sh.bearing + 30, deco: 1 });
      }
    }
  }

  function updateEntities(dt, wind) {
    const s = st, sh = s.ship;
    const wv = vecFromBearing(wind.b, wind.s);
    s.inRain = 0;
    for (const e of s.entities) {
      e.t += dt;
      if (e.life) e.life -= dt;
      const dx = GEO.dx(e.x, sh.x), dy = e.y - sh.y, d = Math.hypot(dx, dy);
      switch (e.type) {
        case 'storm':
          e.x += wv[0] * 12 * dt; e.y -= wv[1] * 12 * dt; e.rot += dt * 0.25;
          if (e.follow) { e.x = sh.x + Math.sin(e.t) * 40; e.y = sh.y + Math.cos(e.t * 0.7) * 40; }
          if (Math.random() < dt * 0.5 && d < e.r * 1.6) { e.flash = 1; Sound.play('thunder'); }
          if (e.flash) e.flash = Math.max(0, e.flash - dt * 3);
          if (e.life <= 0 && !e.follow) e.r -= dt * 30;
          break;
        case 'rain':
          e.x += wv[0] * 18 * dt; e.y -= wv[1] * 18 * dt;
          if (d < e.r) {
            s.inRain = 0.6;
            const before = s.water;
            s.water = Math.min(s.caps.water, s.water + 14 * dt);
            if (!e.got && s.water > before) { e.got = 1; Sound.play('water'); floatText(e.x, e.y, '+ Fresh water', '#8fd3ff'); }
          }
          break;
        case 'fish':
          if (d < e.r + 18 && !e.dead) {
            e.dead = 1; s.food = Math.min(s.caps.food, s.food + 16); s.morale = Math.min(100, s.morale + 3);
            Sound.play('food'); floatText(e.x, e.y, '+ Fish for food', '#ffe08a');
          }
          break;
        case 'flotsam':
          if (d < e.r + 18 && !e.dead) {
            e.dead = 1; s.morale = Math.min(100, s.morale + 9); Sound.play('pickup');
            floatText(e.x, e.y, e.kind === 'birds' ? '+ Morale: seabirds — land is near!' : '+ Morale: a green branch — land is near!', '#c9f0a0');
          }
          break;
        case 'scroll':
          if (d < e.r + 16 && !e.dead) {
            e.dead = 1; s.scrolls.push(e.term); s.ducats += 10; Sound.play('pickup');
            unlock(e.term);
          }
          break;
        case 'ribbon':
          if (d < e.r + 10 && !e.dead) {
            e.dead = 1; s.boost = 4.5; Sound.play('gust');
            const z = ZONE_INFO[wind.zone];
            floatText(e.x, e.y, 'Fair winds! ' + (z && z.term ? z.name : '') , '#e9f7ff');
          }
          break;
        case 'reef':
          if (d < e.r + 12 && sh.bump <= 0) {
            s.hull -= 9; sh.bump = 1.4; sh.speed *= 0.3; Sound.play('aground'); cam.shake = 7;
            toast('💥 Struck a reef! Watch for foaming rocks in shallow water.', 'warn');
            const a = Math.atan2(dy, dx); sh.x -= Math.cos(a) * 12; sh.y -= Math.sin(a) * 12;
          }
          break;
        case 'dolphins': case 'whale': case 'gulls': case 'flyfish': {
          const sp = e.type === 'whale' ? 12 : e.type === 'dolphins' ? 85 : e.type === 'flyfish' ? 160 : 40;
          const r = U.rad(e.b);
          e.x += Math.sin(r) * sp * dt; e.y -= Math.cos(r) * sp * dt;
          if (e.type === 'gulls') e.b += Math.sin(e.t) * 40 * dt;
          break;
        }
        default: break;
      }
    }
    s.entities = s.entities.filter(e => !(e.dead && e.type !== 'ribbon' && e.type !== 'scroll') && !(e.life !== undefined && e.life <= -2 && e.type !== 'storm') && !(e.type === 'storm' && e.r < 20));
    // particles
    for (const p of s.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.size += p.grow * dt; }
    s.particles = s.particles.filter(p => p.life > 0);
    // wake emission
    const sh2 = s.ship;
    const emit = (x, y, b, spd) => {
      if (spd < 8) return;
      const r = U.rad(b);
      const sx = x - Math.sin(r) * 20, sy = y + Math.cos(r) * 20;
      for (const side of [-1, 1]) {
        if (Math.random() < 0.7) s.particles.push({ x: sx + Math.cos(r) * side * 5, y: sy + Math.sin(r) * side * 5, vx: Math.cos(r) * side * 14 - Math.sin(r) * 5, vy: Math.sin(r) * side * 14 + Math.cos(r) * 5, life: 1.6, max: 1.6, size: 2, grow: 3, kind: 'foam' });
      }
      if (Math.random() < spd / 120) s.particles.push({ x: x + Math.sin(r) * 22, y: y - Math.cos(r) * 22, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.5, max: 0.5, size: 1.5, grow: 4, kind: 'spray' });
    };
    emit(sh2.x, sh2.y, sh2.bearing, sh2.speed);
    for (const f of s.fleet) emit(f.x, f.y, f.bearing, f.speed);
    // floating texts
    if (s.floats) { for (const f of s.floats) f.t += dt; s.floats = s.floats.filter(f => f.t < 2.2); }
  }
  function floatText(x, y, text, color) { (st.floats = st.floats || []).push({ x, y, text, color, t: 0 }); }

  /* ---------------- Waypoints & events --------------------------------- */
  function arrive(wp) {
    const s = st;
    if (wp.kind === 'nav') {
      // a channel marker: no journal, just keep sailing
      Sound.play('bell');
      toast(`🚩 ${wp.name} — ${wp.text || 'keep following the channel.'}`, 'good');
      s.ducats += 5; s.wpIndex++;
      Save.data.checkpoint = checkpoint(); Save.write();
      hooks.nextLeg && hooks.nextLeg(objective(wp), s, true);
      return;
    }
    paused = true;
    s.ducats += 20; s.xp += 25;
    s.morale = Math.min(100, s.morale + 25);
    const fx = wp.fx || {};
    if (fx.resupply) {
      const k = fx.resupply;
      s.food = Math.max(s.food, s.caps.food * k); s.water = Math.max(s.water, s.caps.water * k);
      if (k >= 1) { s.hull = s.caps.hull; s.health = Math.min(100, s.health + 60); s.morale = Math.min(100, s.morale + 25); }
      else s.health = Math.min(100, s.health + 20);
      s.sinceLand = 0;
    }
    if (wp.kind === 'port') { s.sinceLand = 0; s.health = Math.min(100, s.health + 25); }
    Sound.play(wp.kind === 'final' || wp.kind === 'port' ? 'landho' : 'bell');
    hooks.arrive && hooks.arrive(wp, s, () => afterEvent(wp));
  }
  function afterEvent(wp) {
    const s = st, fx = wp.fx || {};
    const msgs = [];
    if (fx.loseShip) {
      if (fx.loseShip === s.flagship) {
        const nf = fx.flagship;
        s.fleet = s.fleet.filter(f => f.name !== nf);
        msgs.push(`⚓ The <b>${fx.loseShip}</b> is lost. You now sail aboard the <b>${nf}</b>.`);
        s.flagship = nf;
      } else {
        const had = s.fleet.some(f => f.name === fx.loseShip);
        s.fleet = s.fleet.filter(f => f.name !== fx.loseShip);
        if (had) msgs.push(`⚓ Your fleet loses the <b>${fx.loseShip}</b>.`);
      }
    }
    if (fx.gainShip && !s.fleet.some(f => f.name === fx.gainShip)) {
      s.fleet.push({ name: fx.gainShip, x: s.ship.x + 120, y: s.ship.y + 80, bearing: s.ship.bearing, speed: 0 });
      msgs.push(`⛵ The <b>${fx.gainShip}</b> rejoins your fleet!`); Sound.play('ship');
    }
    if (fx.captain) { s.captain = fx.captain; msgs.push('🧭 <b>Juan Sebastián Elcano</b> takes command of the expedition.'); }
    msgs.forEach(m => toast(m, 'info'));
    if (fx.storm) {
      s.forced = { bearing: fx.storm.bearing, t: fx.storm.secs };
      s.entities.push({ type: 'storm', x: s.ship.x, y: s.ship.y, r: 300, t: 0, rot: 0, life: fx.storm.secs + 4, follow: true, fixed: true });
      setTimeout(() => { const e = st && st.entities.find(x => x.follow); if (e) { e.follow = false; e.life = 3; } }, fx.storm.secs * 1000 + 300);
    }
    s.wpIndex++;
    if (s.wpIndex >= s.ex.waypoints.length) { running = false; hooks.complete && hooks.complete(s); return; }
    Save.data.checkpoint = checkpoint(); Save.write();
    paused = false;
    hooks.nextLeg && hooks.nextLeg(objective(wp), s);
  }
  function objective(prevWp) {
    const wp = currentWP();
    if (!wp) return null;
    const q = wpXY(wp);
    const b = bearingTo(q.x, q.y);
    const text = (prevWp && prevWp.nextObj) || wp.obj || `Sail ${U.compass8(b).toUpperCase()} to ${wp.name}.`;
    return { text, hint: wp.hint, name: wp.name, bearing: b, dist: Math.hypot(q.x - st.ship.x, q.y - st.ship.y) };
  }
  function fail(reason) {
    running = false;
    hooks.fail && hooks.fail(reason, st);
  }

  /* ---------------- HUD info ------------------------------------------- */
  function hudInfo() {
    const s = st, { lat, lon } = shipLatLon(), wp = currentWP();
    let distKm = 0, bear = 0;
    if (wp) { distKm = U.haversine(lat, lon, wp.lat, wp.lon); const q = wpXY(wp); bear = bearingTo(q.x, q.y); }
    const date = new Date(s.ex.startDate[0], s.ex.startDate[1] - 1, s.ex.startDate[2] + Math.floor(s.day));
    return {
      lat, lon, day: Math.floor(s.day) + 1, date, bearing: s.ship.bearing, desired: s.ship.desired,
      knots: s.ship.speed / 12, wind: s.wind, windName: ZONE_INFO[s.wind.zone] ? ZONE_INFO[s.wind.zone].name : '', pos: pointOfSail(s.off || 90),
      food: s.food / s.caps.food, water: s.water / s.caps.water, hull: s.hull / s.caps.hull, health: s.health / 100, morale: s.morale / 100,
      wp, wpBearing: bear, leagues: distKm / 5.556, reefed: s.ship.reefed, boost: s.boost > 0,
      flagship: s.flagship, captain: s.captain, fleet: s.fleet.length + 1, scrolls: s.scrolls.length, scrollsTotal: s.ex.scrolls.length,
      ducats: s.ducats, sinceLand: s.sinceLand,
    };
  }

  /* ---------------- Rendering ------------------------------------------ */
  let vignette = null;
  let waves = [], clouds = [], cloudSprite = null, causticTex = null, causticPat = null;
  function initWaves() {
    waves = [];
    for (let i = 0; i < 170; i++) waves.push(newWave(true));
  }
  function newWave(anywhere) {
    const vw = W / cam.z, vh = H / cam.z;
    return { x: cam.x + (Math.random() - 0.5) * vw * 1.1, y: cam.y + (Math.random() - 0.5) * vh * 1.1, t: anywhere ? Math.random() * 3 : 0, life: 2 + Math.random() * 2.5, s: 0.6 + Math.random() * 0.9 };
  }
  function initClouds() {
    if (!cloudSprite) {
      cloudSprite = U.canvas(256, 160);
      const g = cloudSprite.getContext('2d');
      for (let i = 0; i < 14; i++) {
        const x = 50 + Math.random() * 156, y = 50 + Math.random() * 60, r = 22 + Math.random() * 34;
        const gr = g.createRadialGradient(x, y, 2, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    clouds = [];
    for (let i = 0; i < 9; i++) clouds.push({ x: cam.x + (Math.random() - 0.5) * 2600, y: cam.y + (Math.random() - 0.5) * 1800, s: 1 + Math.random() * 1.6 });
    if (!causticTex) {
      const N = 256; causticTex = U.canvas(N, N);
      const g = causticTex.getContext('2d'), img = g.createImageData(N, N), d = img.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const a = x / N * Math.PI * 2, b = y / N * Math.PI * 2;
        const v = U.fbm(Math.cos(a) * 2 + Math.sin(b) * 0.5 + 10, Math.sin(a) * 2 + Math.cos(b) * 2, 4);
        const ridge = 1 - Math.abs(v * 2 - 1);
        const o = (y * N + x) * 4;
        d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = Math.pow(ridge, 6) * 90;
      }
      g.putImageData(img, 0, 0);
    }
  }
  function worldToScreen(x, y) {
    return { x: GEO.dx(x, cam.x) * cam.z + W / 2, y: (y - cam.y) * cam.z + H / 2 };
  }
  function todNight() {
    const tod = ((st ? st.t : 0) / 150 + 0.32) % 1; // 0..1 ; 0.5 = noon
    const n = Math.cos(tod * Math.PI * 2); // 1 at midnight
    return U.clamp((n + 0.15) / 1.15, 0, 1);
  }

  function render() {
    if (!st) return;
    if (paused) { primeTiles(false); World.pump(6); }
    const g = ctx, s = st, z = cam.z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shx = (Math.random() - 0.5) * cam.shake, shy = (Math.random() - 0.5) * cam.shake;
    const cx = cam.x - shx / z, cy = cam.y - shy / z;
    const clat = GEO.yToLat(cy);
    const al = Math.abs(clat);
    // ocean base
    const deep = al < 23 ? [12, 84, 112] : al < 40 ? [16, 70, 104] : [22, 58, 84];
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgb(${deep[0] + 6},${deep[1] + 10},${deep[2] + 12})`); gr.addColorStop(1, `rgb(${deep[0]},${deep[1]},${deep[2]})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // caustic shimmer
    if (!causticPat) causticPat = g.createPattern(causticTex, 'repeat');
    const wind = s.wind || { b: 0, s: 0.5 };
    const wv = vecFromBearing(wind.b, 1);
    for (let k = 0; k < 1; k++) {
      const m = new DOMMatrix();
      const sc = z * (k ? 1.7 : 1.1);
      m.translateSelf(-cx * z * (k ? 1 : 1) + W / 2 + time * wv[0] * (k ? 9 : 5), -cy * z + H / 2 - time * wv[1] * (k ? 9 : 5));
      m.scaleSelf(sc, sc);
      causticPat.setTransform(m);
      g.globalAlpha = 0.3;
      g.fillStyle = causticPat; g.fillRect(0, 0, W, H);
    }
    g.globalAlpha = 1;
    // tiles
    const T = World.TILE, vw = W / z, vh = H / z;
    const tx0 = Math.floor((cx - vw / 2) / T), tx1 = Math.floor((cx + vw / 2) / T);
    const ty0 = Math.floor((cy - vh / 2) / T), ty1 = Math.floor((cy + vh / 2) / T);
    g.imageSmoothingEnabled = true;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = World.getTile(tx, ty);
      if (!t) { World.requestTile(tx, ty, false); continue; }
      if (t.empty) continue;
      const sx = (tx * T - cx) * z + W / 2, sy = (ty * T - cy) * z + H / 2;
      g.drawImage(t.canvas, Math.floor(sx), Math.floor(sy), Math.ceil(T * z) + 1, Math.ceil(T * z) + 1);
    }
    // latitude lines
    g.save();
    g.setLineDash([10, 10]); g.lineWidth = 1.5;
    for (const [L, name] of [[0, 'EQUATOR  0°'], [23.44, 'TROPIC OF CANCER  23.5°N'], [-23.44, 'TROPIC OF CAPRICORN  23.5°S']]) {
      const y = (GEO.latToY(L) - cy) * z + H / 2;
      if (y < -10 || y > H + 10) continue;
      g.strokeStyle = 'rgba(255,240,200,0.35)';
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      g.fillStyle = 'rgba(255,240,200,0.6)'; g.font = '600 12px "IM Fell English SC", Georgia, serif';
      g.textAlign = 'left';
      const tx = ((-cx * z) % 600 + 600) % 600;
      for (let x = tx - 600; x < W; x += 600) g.fillText(name, x + 10, y - 6);
    }
    g.restore();
    g.setLineDash([]);
    const toS = (x, y) => [GEO.dx(x, cx) * z + W / 2, (y - cy) * z + H / 2];
    const onScreen = (x, y, m = 100) => { const [a, b] = toS(x, y); return a > -m && a < W + m && b > -m && b < H + m; };

    // wave crests
    g.lineCap = 'round';
    const perp = U.rad(wind.b + 90);
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      w.t += 1 / 60;
      w.x += wv[0] * 6 / 60; w.y -= wv[1] * 6 / 60;
      if (w.t > w.life || !onScreen(w.x, w.y, 60)) { waves[i] = newWave(false); continue; }
      if (w.land === undefined) w.land = World.isLand(w.x, w.y);
      if (w.land) continue;
      const a = Math.sin(w.t / w.life * Math.PI) * (0.25 + wind.s * 0.35);
      const [sx, sy] = toS(w.x, w.y);
      const len = 9 * w.s * z;
      g.strokeStyle = `rgba(235,250,255,${a})`; g.lineWidth = 1.4 * z;
      g.beginPath();
      g.moveTo(sx - Math.cos(perp) * len, sy - Math.sin(perp) * len);
      g.quadraticCurveTo(sx - wv[0] * 3 * z, sy + wv[1] * 3 * z, sx + Math.cos(perp) * len, sy + Math.sin(perp) * len);
      g.stroke();
    }
    // entities beneath ship
    for (const e of s.entities) {
      if (!onScreen(e.x, e.y, (e.r || 40) * z + 200)) continue;
      const [ex, ey] = toS(e.x, e.y);
      drawEntityLow(g, e, ex, ey, z);
    }
    // waypoint marker
    const wp = s.hideTarget ? null : currentWP();
    if (wp) {
      const q = wpXY(wp);
      const [wx, wy] = toS(q.x, q.y);
      const pulse = (Math.sin(time * 3) + 1) / 2;
      const R = (wp.r || 95) * z;
      g.strokeStyle = `rgba(255,215,120,${0.55 + pulse * 0.35})`; g.lineWidth = 3;
      g.setLineDash([12, 10]); g.lineDashOffset = -time * 20;
      g.beginPath(); g.arc(wx, wy, R, 0, 7); g.stroke(); g.setLineDash([]);
      const bg = g.createRadialGradient(wx, wy, 0, wx, wy, R);
      bg.addColorStop(0, 'rgba(255,220,130,0.25)'); bg.addColorStop(1, 'rgba(255,220,130,0)');
      g.fillStyle = bg; g.beginPath(); g.arc(wx, wy, R, 0, 7); g.fill();
      // beacon
      g.fillStyle = `rgba(255,236,170,${0.6 + pulse * 0.4})`;
      g.beginPath(); g.arc(wx, wy, 6 + pulse * 3, 0, 7); g.fill();
      g.font = '700 16px "IM Fell English SC", Georgia, serif'; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(30,20,10,0.75)'; g.strokeText(wp.name, wx, wy - R - 10);
      g.fillStyle = '#ffe9b0'; g.fillText(wp.name, wx, wy - R - 10);
    }
    // particles (wake)
    for (const p of s.particles) {
      if (!onScreen(p.x, p.y, 20)) continue;
      const [px, py] = toS(p.x, p.y);
      const a = p.life / p.max;
      g.fillStyle = p.kind === 'spray' ? `rgba(255,255,255,${a * 0.9})` : `rgba(235,248,255,${a * 0.45})`;
      g.beginPath(); g.arc(px, py, p.size * z, 0, 7); g.fill();
    }
    // ships
    const night = todNight();
    const rel = (b) => U.angDiff(wind.b, b);
    const drawShip = (x, y, b, speed, main, name) => {
      const [sx, sy] = toS(x, y);
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) return;
      g.save(); g.translate(sx, sy);
      const bob = Math.sin(time * 1.8 + x * 0.01) * 0.03;
      g.rotate(U.rad(b) + bob);
      const r = rel(b);
      const trim = U.rad(Math.sign(r || 1) * U.clamp((180 - Math.abs(r)) / 180 * 80, 6, 80));
      const isSq = st.ex.id === 'gama' || (st.ex.id === 'magellan') || (name === 'Niña') || (name === 'Santa María');
      g.scale(z, z);
      Art.shipTop(g, {
        len: main ? 52 : 44, sailAngle: trim, fill: U.clamp(wind.s * (Math.abs(r) < 150 ? 1 : 0.4), 0.15, 1), reefed: main ? st.ship.reefed : false,
        t: time + x * 0.01, pennantAngle: U.rad(r) + Math.PI, night: night > 0.5, square: isSq,
        pennant: main ? st.ex.color : '#a3241b', gold: main && !!Save.data.admiral,
      });
      g.restore();
      if (main || z > 0.8) {
        g.font = `600 ${main ? 13 : 11}px "IM Fell English", Georgia, serif`; g.textAlign = 'center';
        g.lineWidth = 3; g.strokeStyle = 'rgba(20,15,10,0.6)'; g.strokeText(name, sx, sy + 42 * z);
        g.fillStyle = main ? '#fff1c8' : 'rgba(255,241,200,0.8)'; g.fillText(name, sx, sy + 42 * z);
      }
      void speed;
    };
    for (const f of s.fleet) drawShip(f.x, f.y, f.bearing, f.speed, false, f.name);
    drawShip(s.ship.x, s.ship.y, s.ship.bearing, s.ship.speed, true, s.flagship);
    // high entities (birds, storm clouds, rain)
    for (const e of s.entities) {
      if (!onScreen(e.x, e.y, (e.r || 40) * z + 250)) continue;
      const [ex, ey] = toS(e.x, e.y);
      drawEntityHigh(g, e, ex, ey, z);
    }
    // clouds + shadows
    for (const c of clouds) {
      c.x += wv[0] * 10 / 60; c.y -= wv[1] * 10 / 60;
      let [sx, sy] = toS(c.x, c.y);
      const cw = 256 * c.s * z * 1.4, chh = 160 * c.s * z * 1.4;
      if (sx < -cw * 1.5 || sx > W + cw * 1.5 || sy < -chh * 1.5 || sy > H + chh * 1.5) {
        c.x = cx + (Math.random() - 0.5) * vw * 1.6 + wv[0] * -vw * 0.6; c.y = cy + (Math.random() - 0.5) * vh * 1.6 + wv[1] * vh * 0.6; continue;
      }
      g.globalAlpha = 0.18; g.filter = 'none';
      g.drawImage(cloudSprite, sx - cw / 2 + 50 * z, sy - chh / 2 + 70 * z, cw, chh);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.32;
      g.drawImage(cloudSprite, sx - cw / 2, sy - chh / 2, cw, chh);
      g.globalAlpha = 1;
    }
    // floating texts
    if (s.floats) for (const f of s.floats) {
      const [fx, fy] = toS(f.x, f.y);
      const a = 1 - f.t / 2.2;
      g.font = '700 15px "IM Fell English", Georgia, serif'; g.textAlign = 'center';
      g.globalAlpha = a; g.lineWidth = 4; g.strokeStyle = 'rgba(20,15,10,0.7)'; g.strokeText(f.text, fx, fy - f.t * 30);
      g.fillStyle = f.color; g.fillText(f.text, fx, fy - f.t * 30); g.globalAlpha = 1;
    }
    // fog of war
    drawFog(g, cx, cy, z);
    // labels on revealed land/sea
    drawLabels(g, cx, cy, z);
    // night / dusk light
    if (night > 0.02) {
      const [sx, sy] = toS(s.ship.x, s.ship.y);
      const lg = g.createRadialGradient(sx, sy, 30 * z, sx, sy, Math.max(W, H) * 0.7);
      lg.addColorStop(0, `rgba(10,16,40,${night * 0.12})`); lg.addColorStop(0.25, `rgba(10,16,40,${night * 0.45})`); lg.addColorStop(1, `rgba(6,10,28,${night * 0.62})`);
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      const lan = g.createRadialGradient(sx, sy, 0, sx, sy, 70 * z);
      lan.addColorStop(0, `rgba(255,200,110,${night * 0.25})`); lan.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = lan; g.fillRect(sx - 80 * z, sy - 80 * z, 160 * z, 160 * z);
    }
    const tod = (s.t / 150 + 0.32) % 1;
    const duskA = Math.max(0, 1 - Math.abs(tod - 0.75) * 14) + Math.max(0, 1 - Math.abs(tod - 0.25) * 14);
    if (duskA > 0) { g.fillStyle = `rgba(255,120,50,${duskA * 0.13})`; g.fillRect(0, 0, W, H); }
    // storm darkness & flash
    if (s.inStorm > 0) {
      g.fillStyle = `rgba(20,25,35,${s.inStorm * 0.35})`; g.fillRect(0, 0, W, H);
    }
    const flash = s.entities.reduce((m, e) => Math.max(m, e.flash || 0), 0);
    if (flash > 0) { g.fillStyle = `rgba(240,245,255,${flash * 0.35})`; g.fillRect(0, 0, W, H); }
    // rain overlay
    const rainA = Math.max(s.inStorm, s.inRain || 0);
    if (rainA > 0.05) {
      g.strokeStyle = `rgba(210,225,240,${0.35 * rainA})`; g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < 160 * rainA; i++) { const x = Math.random() * W, y = Math.random() * H; g.moveTo(x, y); g.lineTo(x - 6 - wv[0] * 8, y + 16); }
      g.stroke();
    }
    // off-screen arrow to waypoint
    if (wp) {
      const q = wpXY(wp); const [wx, wy] = toS(q.x, q.y);
      if (wx < 30 || wx > W - 30 || wy < 30 || wy > H - 30) {
        const ang = Math.atan2(wy - H / 2, wx - W / 2);
        const m = 54;
        const ax = U.clamp(W / 2 + Math.cos(ang) * W, m, W - m), ay = U.clamp(H / 2 + Math.sin(ang) * H, m + 60, H - m - 60);
        g.save(); g.translate(ax, ay); g.rotate(ang);
        g.fillStyle = 'rgba(255,215,120,0.95)'; g.strokeStyle = 'rgba(40,25,10,0.8)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(22, 0); g.lineTo(-10, -14); g.lineTo(-4, 0); g.lineTo(-10, 14); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    }
    // vignette (cached)
    if (!vignette || vignette.width !== Math.ceil(W / 2) || vignette.height !== Math.ceil(H / 2)) {
      vignette = U.canvas(Math.ceil(W / 2), Math.ceil(H / 2));
      const vgc = vignette.getContext('2d'), w2 = vignette.width, h2 = vignette.height;
      const vg = vgc.createRadialGradient(w2 / 2, h2 / 2, Math.min(w2, h2) * 0.45, w2 / 2, h2 / 2, Math.max(w2, h2) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,8,5,0.45)');
      vgc.fillStyle = vg; vgc.fillRect(0, 0, w2, h2);
    }
    g.drawImage(vignette, 0, 0, W, H);
  }

  function drawFog(g, cx, cy, z) {
    const vw = W / z, vh = H / z;
    const LW = Math.ceil(W / 2), LH = Math.ceil(H / 2);
    if (!fogLayer || fogLayer.width !== LW || fogLayer.height !== LH) { fogLayer = U.canvas(LW, LH); fogLayerG = fogLayer.getContext('2d'); mistPattern = null; }
    const f = fogLayerG;
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, LW, LH);
    f.imageSmoothingEnabled = true;
    const x0 = cx - vw / 2, y0 = cy - vh / 2;
    let sx = GEO.wrapX(x0) * FOG_S, sy = y0 * FOG_S, sw = vw * FOG_S, shh = vh * FOG_S;
    const k = LW / sw;
    const parts = [];
    if (sx + sw <= fogC.width) parts.push([sx, sw, 0]);
    else { const a = fogC.width - sx; parts.push([sx, a, 0]); parts.push([0, sw - a, a]); }
    for (const [px, pw, off] of parts) {
      // clamp vertical source
      let syc = sy, shc = shh, dy = 0;
      if (syc < 0) { dy = -syc; shc += syc; syc = 0; }
      if (syc + shc > fogC.height) shc = fogC.height - syc;
      if (shc <= 0 || pw <= 0) continue;
      f.drawImage(fogC, px, syc, pw, shc, off * k, dy * k, pw * k, shc * k);
    }
    f.globalCompositeOperation = 'source-in';
    if (!mistPattern) mistPattern = f.createPattern(mistTex, 'repeat');
    const m = new DOMMatrix();
    m.translateSelf((-cx * z / 2 + time * 6) % 512, (-cy * z / 2 + time * 3) % 512); m.scaleSelf(z * 1.2, z * 1.2);
    mistPattern.setTransform(m);
    f.fillStyle = mistPattern; f.fillRect(0, 0, LW, LH);
    // lighter drifting layer
    f.globalCompositeOperation = 'source-atop';
    const m2 = new DOMMatrix(); m2.translateSelf((-cx * z / 2 - time * 9) % 512, (-cy * z / 2 + time * 5) % 512); m2.scaleSelf(z * 2.2, z * 2.2);
    mistPattern.setTransform(m2);
    f.globalAlpha = 0.35; f.fillStyle = mistPattern; f.fillRect(0, 0, LW, LH); f.globalAlpha = 1;
    g.drawImage(fogLayer, 0, 0, W, H);
  }

  const LABELS = [
    ['ATLANTIC OCEAN', 32, -42, 'sea', 1.3], ['(THE OCEAN SEA)', 29.8, -42, 'sea', 0.8], ['SOUTH ATLANTIC OCEAN', -22, -18, 'sea', 1.2], ['INDIAN OCEAN', -18, 74, 'sea', 1.3], ['PACIFIC OCEAN', -8, -125, 'sea', 1.4],
    ['PACIFIC OCEAN', 18, 170, 'sea', 1.4], ['ARABIAN SEA', 15, 63, 'sea', 1], ['MEDITERRANEAN SEA', 35.2, 17, 'sea', .9], ['CARIBBEAN SEA', 15, -75, 'sea', 1], ['GULF OF GUINEA', 2, 2, 'sea', .9],
    ['SARGASSO SEA', 30, -58, 'sea', .9], ['BAY OF BENGAL', 15, 88, 'sea', .9], ['SOUTH CHINA SEA', 13, 114, 'sea', .9], ['NORTH SEA', 56, 3, 'sea', .8], ['RED SEA', 20, 38.5, 'sea', .7],
    ['MOZAMBIQUE CHANNEL', -18, 41.5, 'sea', .75], ['GULF OF MEXICO', 25, -90, 'sea', .9], ['PHILIPPINE SEA', 18, 132, 'sea', .9], ['SOUTHERN OCEAN', -50, 40, 'sea', 1],
    ['EUROPE', 49, 14, 'land', 1.5], ['AFRICA', 8, 21, 'land', 1.8], ['ASIA', 45, 92, 'land', 1.8], ['SOUTH AMERICA', -9, -58, 'land', 1.5], ['NORTH AMERICA', 46, -100, 'land', 1.5], ['AUSTRALIA', -25, 134, 'land', 1.3],
    ['PORTUGAL', 39.6, -8, 'land', .75], ['SPAIN (CASTILE)', 40.2, -3.8, 'land', .8], ['FRANCE', 47, 2.5, 'land', .8], ['ENGLAND', 52.5, -1.5, 'land', .7], ['ITALY', 42.5, 12.8, 'land', .7],
    ['OTTOMAN EMPIRE', 39, 33, 'land', .8], ['SAHARA DESERT', 23, 5, 'land', 1.1], ['ARABIA', 23, 46, 'land', .9], ['PERSIA', 32, 54, 'land', .85], ['INDIA', 22, 79, 'land', 1.1],
    ['CHINA (CATHAY)', 32, 108, 'land', 1], ['JAPAN (CIPANGU)', 36.5, 138.5, 'land', .7], ['ETHIOPIA', 9, 39.5, 'land', .75], ['KONGO', -4.5, 16, 'land', .75], ['MALI', 15, -5, 'land', .75],
    ['BRAZIL', -11, -46, 'land', 1], ['PATAGONIA', -45, -69.5, 'land', .85], ['TIERRA DEL FUEGO', -54.4, -68.5, 'land', .6], ['CUBA', 21.9, -79.5, 'land', .7], ['HISPANIOLA', 18.9, -71, 'land', .6],
    ['MADAGASCAR', -19.5, 46.6, 'land', .7], ['PHILIPPINES', 12, 122.5, 'land', .7], ['BORNEO', 0.5, 114, 'land', .7], ['SUMATRA', -0.5, 101.8, 'land', .6], ['SRI LANKA', 7.8, 80.7, 'land', .5],
    ['NEW GUINEA', -5, 142, 'land', .6], ['BAHAMAS', 24.6, -76.6, 'sea', .55], ['CANARY ISLANDS', 29.3, -15.8, 'sea', .55], ['AZORES', 39.2, -28, 'sea', .55], ['CAPE VERDE ISLANDS', 16.3, -24, 'sea', .55],
    ['Cape of Good Hope', -34.36, 18.47, 'cape', .7], ['Cape Agulhas', -34.83, 20.0, 'cape', .55], ['Cape Bojador', 26.13, -14.5, 'cape', .55], ['Cape Verde', 14.72, -17.5, 'cape', .55], ['Cape Horn', -55.98, -67.27, 'cape', .55],
    ['Strait of Gibraltar', 35.95, -5.6, 'cape', .55], ['Strait of Magellan', -53.0, -70.4, 'cape', .55], ['Río de la Plata', -35.0, -57.3, 'cape', .55], ['Moluccas (Spice Islands)', -1.5, 128.5, 'cape', .6],
    ['Lisbon', 38.72, -9.14, 'city', .6], ['Seville', 37.39, -5.99, 'city', .55], ['Palos', 37.23, -6.89, 'city', .5], ['Venice', 45.44, 12.33, 'city', .5], ['Constantinople', 41.01, 28.98, 'city', .5],
    ['Cairo', 30.04, 31.24, 'city', .5], ['Calicut', 11.25, 75.78, 'city', .55], ['Malacca', 2.2, 102.25, 'city', .5], ['Timbuktu', 16.77, -3.0, 'city', .5], ['Kilwa', -8.95, 39.5, 'city', .45],
    ['Hormuz', 27.1, 56.4, 'city', .45], ['Tenochtitlan (Aztec)', 19.43, -99.13, 'city', .5], ['Cuzco (Inca)', -13.5, -72.0, 'city', .5], ['Beijing', 39.9, 116.4, 'city', .5],
  ];
  function drawLabels(g, cx, cy, z) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [t, la, lo, kind, sz] of LABELS) {
      const p = GEO.toXY(la, lo);
      const sx = GEO.dx(p.x, cx) * z + W / 2, sy = (p.y - cy) * z + H / 2;
      if (sx < -300 || sx > W + 300 || sy < -50 || sy > H + 50) continue;
      const key = t + la;
      const seen = fogAtCached(p.x, p.y) < 0.5;
      const prev = labelAlpha.get(key) || 0;
      const a = seen ? Math.min(1, prev + 0.02) : 0;
      labelAlpha.set(key, a);
      if (a < 0.02) continue;
      if (kind === 'city' || kind === 'cape') {
        if (kind === 'city') { g.fillStyle = `rgba(150,30,20,${a})`; g.strokeStyle = `rgba(30,20,10,${a})`; g.lineWidth = 1.2; g.beginPath(); g.rect(sx - 4, sy - 4, 8, 8); g.fill(); g.stroke(); }
        else { g.fillStyle = `rgba(255,240,200,${a})`; g.beginPath(); g.arc(sx, sy, 3, 0, 7); g.fill(); }
        g.font = `italic 600 ${Math.round(13 * sz / .55 * Math.min(1, z + 0.2))}px "IM Fell English", Georgia, serif`;
        g.lineWidth = 3.5; g.strokeStyle = `rgba(25,18,10,${a * 0.75})`; g.strokeText(t, sx, sy + 14);
        g.fillStyle = `rgba(255,242,210,${a})`; g.fillText(t, sx, sy + 14);
      } else {
        const fs = Math.round(17 * sz * Math.min(1.2, z + 0.15));
        g.font = `${kind === 'sea' ? 'italic ' : ''}600 ${fs}px "IM Fell English SC", Georgia, serif`;
        const spaced = t.split('').join(kind === 'land' ? '  ' : ' ');
        g.lineWidth = 3; g.strokeStyle = kind === 'sea' ? `rgba(10,30,45,${a * 0.5})` : `rgba(30,20,8,${a * 0.55})`;
        g.strokeText(spaced, sx, sy);
        g.fillStyle = kind === 'sea' ? `rgba(200,230,240,${a * 0.75})` : `rgba(255,240,205,${a * 0.85})`;
        g.fillText(spaced, sx, sy);
      }
    }
  }
  const labelAlpha = new Map();
  const fogCache = new Map(); let fogCacheT = 0;
  function fogAtCached(x, y) {
    if (time - fogCacheT > 1) { fogCache.clear(); fogCacheT = time; }
    const k = Math.round(x) + ',' + Math.round(y);
    if (!fogCache.has(k)) fogCache.set(k, fogAt(x, y));
    return fogCache.get(k);
  }

  function drawEntityLow(g, e, x, y, z) {
    switch (e.type) {
      case 'fish': {
        if (e.dead) return;
        for (let i = 0; i < e.n; i++) {
          const a = e.t * 1.6 + i * 2.4, r = (14 + (i * 7) % 22) * z;
          const fx = x + Math.cos(a) * r, fy = y + Math.sin(a * 1.3) * r * 0.7;
          g.save(); g.translate(fx, fy); g.rotate(a + Math.PI / 2);
          g.fillStyle = 'rgba(210,230,240,0.85)'; g.beginPath(); g.ellipse(0, 0, 1.6 * z + 0.6, 4 * z + 1, 0, 0, 7); g.fill();
          g.restore();
        }
        const pr = (Math.sin(e.t * 4) + 1) / 2;
        g.strokeStyle = `rgba(255,240,170,${0.25 + pr * 0.3})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, e.r * z, 0, 7); g.stroke();
        break;
      }
      case 'flotsam': {
        if (e.dead) return;
        g.save(); g.translate(x, y); g.rotate(Math.sin(e.t) * 0.3);
        if (e.kind === 'branch') {
          g.strokeStyle = '#5a3a1e'; g.lineWidth = 2.5 * z; g.beginPath(); g.moveTo(-12 * z, 0); g.lineTo(12 * z, 0); g.stroke();
          g.fillStyle = '#4c8a3a'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(k * 5 * z, -4 * z * (k % 2 ? 1 : -1), 4 * z, 2 * z, 0.5, 0, 7); g.fill(); }
        }
        g.restore();
        const pr = (Math.sin(e.t * 4) + 1) / 2;
        g.strokeStyle = `rgba(200,255,170,${0.2 + pr * 0.3})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, e.r * z, 0, 7); g.stroke();
        break;
      }
      case 'scroll': {
        if (e.dead) return;
        const bob = Math.sin(e.t * 2) * 3 * z;
        const glow = g.createRadialGradient(x, y, 2, x, y, 40 * z);
        glow.addColorStop(0, 'rgba(255,230,140,0.75)'); glow.addColorStop(1, 'rgba(255,230,140,0)');
        g.fillStyle = glow; g.fillRect(x - 40 * z, y - 40 * z, 80 * z, 80 * z);
        g.save(); g.translate(x, y + bob); g.rotate(-0.4); g.scale(z, z);
        // bottle with rolled map
        g.fillStyle = 'rgba(180,220,200,0.55)'; g.strokeStyle = '#2b3a30'; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(0, 0, 7, 15, 0, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#f0e0b0'; g.fillRect(-3.5, -9, 7, 16);
        g.fillStyle = '#8a5a2a'; g.fillRect(-3, -21, 6, 6);
        g.restore();
        break;
      }
      case 'ribbon': {
        if (e.dead) return;
        const wind = st.wind || { b: 0 };
        const r = U.rad(wind.b);
        g.save(); g.translate(x, y); g.rotate(r);
        for (let k = 0; k < 5; k++) {
          const ph = ((e.t * 1.2 + k * 0.2) % 1);
          const yy = (ph - 0.5) * 90 * z;
          const a = Math.sin(ph * Math.PI);
          g.strokeStyle = `rgba(230,245,255,${a * 0.85})`; g.lineWidth = 2.4;
          g.beginPath(); g.moveTo((-20 + k * 10) * z, yy + 10 * z); g.lineTo((-20 + k * 10) * z + 0, yy - 10 * z);
          g.moveTo((-26 + k * 10) * z, yy - 2 * z); g.lineTo((-20 + k * 10) * z, yy - 10 * z); g.lineTo((-14 + k * 10) * z, yy - 2 * z);
          g.stroke();
        }
        g.restore();
        g.strokeStyle = 'rgba(230,245,255,0.25)'; g.lineWidth = 1.5; g.setLineDash([4, 6]);
        g.beginPath(); g.arc(x, y, e.r * z, 0, 7); g.stroke(); g.setLineDash([]);
        break;
      }
      case 'reef': {
        const pr = (Math.sin(e.t * 2 + e.r) + 1) / 2;
        // turquoise shoal and breaking surf
        const sg = g.createRadialGradient(x, y, 0, x, y, (e.r + 18) * z);
        sg.addColorStop(0, 'rgba(120,230,215,0.45)'); sg.addColorStop(1, 'rgba(120,230,215,0)');
        g.fillStyle = sg; g.beginPath(); g.arc(x, y, (e.r + 18) * z, 0, 7); g.fill();
        g.strokeStyle = `rgba(255,255,255,${0.35 + pr * 0.4})`; g.lineWidth = 1.6;
        g.beginPath(); g.arc(x, y, (e.r + 3 + pr * 4) * z, 0.2, 2.4); g.stroke();
        g.beginPath(); g.arc(x, y, (e.r + 5 + (1 - pr) * 4) * z, 3.3, 5.6); g.stroke();
        for (let k = 0; k < 3; k++) {
          const ox = (U.hash2(k, e.r * 10 | 0) - 0.5) * e.r * 1.2 * z, oy = (U.hash2(k + 9, e.r * 10 | 0) - 0.5) * e.r * 1.2 * z;
          const rr = e.r * z * (0.35 + 0.25 * U.hash2(k + 3, 7));
          g.fillStyle = '#5f564a'; g.strokeStyle = 'rgba(30,25,18,0.8)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x + ox - rr, y + oy + rr * 0.4); g.lineTo(x + ox - rr * 0.3, y + oy - rr); g.lineTo(x + ox + rr * 0.6, y + oy - rr * 0.5); g.lineTo(x + ox + rr, y + oy + rr * 0.4); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(x + ox - rr * 0.3, y + oy - rr); g.lineTo(x + ox - rr * 0.6, y + oy + rr * 0.2); g.lineTo(x + ox, y + oy); g.closePath(); g.fill();
        }
        break;
      }
      case 'whale': Art.whaleTop(g, x, y, U.rad(e.b), z * 1.1, e.t * 0.8); if (Math.sin(e.t * 0.8) > 0.92) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x, y - 6 * z, 8 * z, 0, 7); g.fill(); } break;
      case 'dolphins':
        for (let i = 0; i < e.n; i++) {
          const ph = (e.t * 1.4 + i * 0.37) % 1;
          const off = (i - e.n / 2) * 16 * z;
          const r = U.rad(e.b);
          Art.dolphin(g, x + Math.cos(r) * off + Math.sin(r) * i * 10 * z, y + Math.sin(r) * off - Math.cos(r) * i * 10 * z, r, z, Math.max(0, Math.sin(ph * Math.PI)));
        }
        break;
      case 'flyfish':
        g.fillStyle = 'rgba(220,235,245,0.9)';
        for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + i * 9 * z, y + Math.sin(e.t * 9 + i) * 4 * z, 4 * z, 1.5 * z, U.rad(e.b - 90), 0, 7); g.fill(); }
        break;
      case 'rain': {
        // cloud shadow on water
        g.fillStyle = 'rgba(20,40,60,0.18)'; g.beginPath(); g.ellipse(x + 30 * z, y + 40 * z, e.r * z * 1.1, e.r * z * 0.8, 0, 0, 7); g.fill();
        break;
      }
      case 'storm': {
        g.fillStyle = 'rgba(10,20,30,0.25)'; g.beginPath(); g.arc(x, y, e.r * z * 1.05, 0, 7); g.fill();
        break;
      }
      default: break;
    }
  }
  function drawEntityHigh(g, e, x, y, z) {
    switch (e.type) {
      case 'rain': {
        for (let k = 0; k < 5; k++) {
          const a = k * 1.3 + e.t * 0.1, rr = e.r * z * 0.45;
          const cx = x + Math.cos(a) * rr, cy = y + Math.sin(a) * rr * 0.6;
          const gr = g.createRadialGradient(cx, cy, 2, cx, cy, e.r * z * 0.7);
          gr.addColorStop(0, 'rgba(120,135,150,0.65)'); gr.addColorStop(1, 'rgba(120,135,150,0)');
          g.fillStyle = gr; g.fillRect(cx - e.r * z, cy - e.r * z, e.r * z * 2, e.r * z * 2);
        }
        g.strokeStyle = 'rgba(200,220,240,0.5)'; g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i < 26; i++) { const rx = x + (U.hash2(i, 3) - 0.5) * e.r * z * 1.3, ry = y + ((U.hash2(i, 7) + e.t * 1.5) % 1 - 0.3) * e.r * z; g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 12); }
        g.stroke();
        g.font = '600 12px "IM Fell English", Georgia, serif'; g.fillStyle = 'rgba(220,240,255,0.85)'; g.textAlign = 'center';
        g.fillText('rain squall', x, y - e.r * z * 0.7);
        break;
      }
      case 'storm': {
        g.save(); g.translate(x, y); g.rotate(e.rot);
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * Math.PI * 2, rr = e.r * z * (0.35 + (k % 3) * 0.18);
          const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr;
          const gr = g.createRadialGradient(cx, cy, 4, cx, cy, e.r * z * 0.55);
          gr.addColorStop(0, 'rgba(40,46,56,0.75)'); gr.addColorStop(1, 'rgba(40,46,56,0)');
          g.fillStyle = gr; g.fillRect(cx - e.r * z * 0.6, cy - e.r * z * 0.6, e.r * z * 1.2, e.r * z * 1.2);
        }
        g.restore();
        if (e.flash > 0.5) {
          g.strokeStyle = `rgba(255,255,230,${e.flash})`; g.lineWidth = 2.5;
          g.beginPath(); let lx = x + (Math.random() - 0.5) * e.r * z, ly = y - e.r * z * 0.6; g.moveTo(lx, ly);
          for (let i = 0; i < 6; i++) { lx += (Math.random() - 0.5) * 30; ly += 18 * z; g.lineTo(lx, ly); }
          g.stroke();
        }
        break;
      }
      case 'gulls':
        for (let i = 0; i < e.n; i++) Art.bird(g, x + Math.cos(e.t + i * 1.7) * 30 * z, y + Math.sin(e.t * 1.2 + i * 2.1) * 20 * z, z * 1.1, e.t * 8 + i);
        break;
      case 'flotsam':
        if (!e.dead && e.kind === 'birds') for (let i = 0; i < 4; i++) Art.bird(g, x + Math.cos(e.t * 1.5 + i * 1.6) * 18 * z, y + Math.sin(e.t * 1.5 + i * 1.6) * 12 * z, z, e.t * 8 + i, '#fff');
        break;
      default: break;
    }
  }

  /* ---------------- Mini-map / chart ----------------------------------- */
  function drawChart(c, opts = {}) {
    if (!st) return;
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const mini = World.miniMap(), M = World.MINI;
    let x0, y0, x1, y1;
    if (opts.full) {
      const pts = [[st.ex.start.lat, st.ex.start.lon], ...st.ex.waypoints.map(w2 => [w2.lat, w2.lon])];
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      const ref = GEO.toXY(st.ex.start.lat, st.ex.start.lon).x;
      for (const [la, lo] of pts) { const p = GEO.toXY(la, lo); const px = ref + GEO.dx(p.x, ref); minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); }
      if (st.ex.id === 'magellan') { minx = 0; maxx = GEO.W; miny = GEO.latToY(62); maxy = GEO.latToY(-58); opts.world = true; }
      const padX = opts.world ? 0 : (maxx - minx) * 0.12 + 300, padY = opts.world ? 0 : (maxy - miny) * 0.12 + 300;
      x0 = minx - padX; x1 = maxx + padX; y0 = miny - padY; y1 = maxy + padY;
      // fit aspect
      const ar = w / h, cw = x1 - x0, ch = y1 - y0;
      if (opts.world) { const nh = cw / ar; const mid = (y0 + y1) / 2; y0 = mid - nh / 2; y1 = mid + nh / 2; }
      else if (cw / ch > ar) { const nh = cw / ar; y0 -= (nh - ch) / 2; y1 = y0 + nh; } else { const nw = ch * ar; x0 -= (nw - cw) / 2; x1 = x0 + nw; }
    } else {
      const span = 2600;
      x0 = st.ship.x - span / 2; x1 = st.ship.x + span / 2;
      const sh = span * h / w; y0 = st.ship.y - sh / 2; y1 = st.ship.y + sh / 2;
    }
    y0 = Math.max(0, y0); y1 = Math.min(GEO.H, y1);
    const k = w / (x1 - x0);
    g.fillStyle = '#9fb8b0'; g.fillRect(0, 0, w, h);
    // base map with wrap
    const drawWrapped = (img, scale) => {
      const sxw = GEO.wrapX(x0) * scale, sw = (x1 - x0) * scale, sy = y0 * scale, sh = (y1 - y0) * scale;
      const total = img.width;
      let drawn = 0, sx = sxw;
      while (drawn < sw - 0.5) {
        const part = Math.min(sw - drawn, total - sx);
        g.drawImage(img, sx, sy, part, sh, drawn / scale * k, 0, part / scale * k, sh / scale * k);
        drawn += part; sx = 0;
      }
    };
    drawWrapped(mini, M);
    // fog
    g.save();
    const tmp = U.canvas(w, h), tg = tmp.getContext('2d');
    const save = g; void save;
    const gg = tg;
    {
      const sxw = GEO.wrapX(x0) * FOG_S, sw = (x1 - x0) * FOG_S, sy = y0 * FOG_S, sh = (y1 - y0) * FOG_S;
      let drawn = 0, sx = sxw;
      while (drawn < sw - 0.5) {
        const part = Math.min(sw - drawn, fogC.width - sx);
        gg.drawImage(fogC, sx, sy, part, sh, drawn / FOG_S * k, 0, part / FOG_S * k, sh / FOG_S * k);
        drawn += part; sx = 0;
      }
      gg.globalCompositeOperation = 'source-in';
      gg.fillStyle = '#3a3f46'; gg.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 0.88; g.drawImage(tmp, 0, 0); g.globalAlpha = 1;
    g.restore();
    const P = opts.world ? (x, y) => [(GEO.wrapX(x) - x0) * k, (y - y0) * k] : (x, y) => [(x0 + GEO.dx(x, x0) - x0) * k, (y - y0) * k];
    // route
    g.strokeStyle = st.ex.color; g.lineWidth = opts.full ? 3 : 2; g.lineJoin = 'round';
    g.beginPath();
    let prev = null;
    for (const [rx, ry] of st.route) {
      const [px, py] = P(rx, ry);
      if (prev && Math.abs(px - prev[0]) > w * 0.5) g.moveTo(px, py); else if (prev) g.lineTo(px, py); else g.moveTo(px, py);
      prev = [px, py];
    }
    { const [px, py] = P(st.ship.x, st.ship.y); if (prev && Math.abs(px - prev[0]) < w * 0.5) g.lineTo(px, py); }
    g.stroke();
    // waypoints
    st.ex.waypoints.forEach((wpp, i) => {
      if (i > st.wpIndex || (i === st.wpIndex && st.hideTarget)) return;
      const p = GEO.toXY(wpp.lat, wpp.lon); const [px, py] = P(p.x, p.y);
      g.fillStyle = i === st.wpIndex ? '#ffd56a' : '#fff4d0'; g.strokeStyle = '#2b1d10'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(px, py, i === st.wpIndex ? 5 : 3.5, 0, 7); g.fill(); g.stroke();
      if (opts.full) { g.font = '600 13px "IM Fell English", Georgia, serif'; g.fillStyle = '#2b1d10'; g.textAlign = 'left'; g.fillText(wpp.name, px + 7, py - 6); }
    });
    // scrolls (navigator upgrade)
    if (upg('nav') >= 2 || opts.full) {
      for (const e of st.entities) if (e.type === 'scroll' && !e.dead && (upg('nav') >= 2)) {
        const [px, py] = P(e.x, e.y); g.fillStyle = '#ffe28a'; g.beginPath(); g.arc(px, py, 2.5, 0, 7); g.fill();
      }
    }
    // ship
    const [sx, sy] = P(st.ship.x, st.ship.y);
    g.save(); g.translate(sx, sy); g.rotate(U.rad(st.ship.bearing));
    g.fillStyle = '#fff'; g.strokeStyle = '#2b1d10'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // frame
    g.strokeStyle = '#3b2a17'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  }

  /* ---------------- Public API ----------------------------------------- */
  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  return {
    init(c, h) {
      canvas = c; ctx = c.getContext('2d'); hooks = h; resize();
      window.addEventListener('resize', resize);
    },
    resize, start, update, render,
    get running() { return running; }, get paused() { return paused; },
    pause(v) { paused = v; if (v) Sound.ambience({ on: false }); },
    stop() { running = false; st = null; Sound.ambience({ on: false }); },
    keyDown(code) { keys.add(code); },
    keyUp(code) { keys.delete(code); },
    clearKeys() { keys.clear(); },
    pointerDown(x, y) { pointer.down = true; pointer.steer = true; pointer.x = x; pointer.y = y; },
    pointerMove(x, y) { pointer.x = x; pointer.y = y; },
    pointerUp() { pointer.down = false; },
    setDesired(b) { if (st) st.ship.desired = U.normAng(b); },
    toggleReef() { if (!st) return; st.ship.reefed = !st.ship.reefed; Sound.play('sail'); return st.ship.reefed; },
    zoom(f) { cam.userZ = U.clamp(cam.userZ * f, 0.6, 1.8); },
    drawChart, objective: () => st && objective(null), get state() { return st; }, get cam() { return cam; },
    quizResult(ok) { if (!st) return; st.quizTotal++; if (ok) { st.quizRight++; st.ducats += 15; st.xp += 15; st.morale = Math.min(100, st.morale + 8); } },
    addDucats(n) { if (st) st.ducats += n; },
    checkpoint,
    windAt,
  };
})();
