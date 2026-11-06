/* ==========================================================================
   Utilities: math, noise, projection, storage
   ========================================================================== */
'use strict';

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth(a, b, x) { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
  rad: d => d * Math.PI / 180,
  deg: r => r * 180 / Math.PI,
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  pick: arr => arr[(Math.random() * arr.length) | 0],
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeInOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  /** signed shortest difference a-b in degrees, result in (-180,180] */
  angDiff(a, b) { let d = (a - b) % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; },
  normAng(a) { a %= 360; return a < 0 ? a + 360 : a; },

  rng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hash2(ix, iy) {
    let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = U.hash2(ix, iy), b = U.hash2(ix + 1, iy), c = U.hash2(ix, iy + 1), d = U.hash2(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  },
  fbm(x, y, oct = 4) {
    let v = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { v += amp * U.noise2(x * f + i * 17.3, y * f - i * 9.1); n += amp; amp *= 0.5; f *= 2.03; }
    return v / n;
  },

  /** 8-point compass name for a bearing in degrees (0 = north) */
  compass8(b) {
    const names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return names[Math.round(U.normAng(b) / 45) % 8];
  },
  compass8Short(b) {
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return names[Math.round(U.normAng(b) / 45) % 8];
  },
  compass16Short(b) {
    const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return names[Math.round(U.normAng(b) / 22.5) % 16];
  },

  fmtLat(lat) { return Math.abs(lat).toFixed(0) + '°' + (lat >= 0 ? 'N' : 'S'); },
  fmtLon(lon) { lon = ((lon + 540) % 360) - 180; return Math.abs(lon).toFixed(0) + '°' + (lon >= 0 ? 'E' : 'W'); },

  /** great-circle distance in km */
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = U.rad(lat2 - lat1), dLon = U.rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(U.rad(lat1)) * Math.cos(U.rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  },

  roman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = ''; for (const [v, r] of map) while (n >= v) { s += r; n -= v; } return s;
  },

  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  $(sel) { return document.querySelector(sel); },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; },
};

/* ---------------- Projection (Web-Mercator style, wraps east-west) ------- */
const GEO = (() => {
  const S = 48;                         // world pixels per degree of longitude
  const R = S * 180 / Math.PI;
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + U.rad(lat) / 2));
  const Y0 = merc(80), YB = merc(-75);
  const W = 360 * S, H = Math.ceil((Y0 - YB) * R);
  return {
    S, R, W, H,
    lonToX: lon => (lon + 180) * S,
    latToY: lat => (Y0 - merc(U.clamp(lat, -79, 84))) * R,
    xToLon(x) { let l = x / S - 180; l = ((l + 540) % 360) - 180; return l; },
    yToLat: y => U.deg(Math.atan(Math.sinh(Y0 - y / R))),
    wrapX: x => ((x % W) + W) % W,
    /** shortest signed delta a-b along the wrapping x axis */
    dx(a, b) { let d = (a - b) % W; if (d > W / 2) d -= W; if (d < -W / 2) d += W; return d; },
    toXY(lat, lon) { return { x: (lon + 180) * S, y: (Y0 - merc(lat)) * R }; },
    /** pixels per km at a latitude (mercator scale) */
    pxPerKm: lat => S / (111.32 * Math.cos(U.rad(lat))),
  };
})();

/* ---------------- Save data -------------------------------------------- */
const Save = {
  KEY: 'beyond-horizon-save-v1',
  data: null,
  defaults() {
    return {
      ducats: 0, xp: 0,
      upgrades: { sails: 0, hull: 0, hold: 0, nav: 0, crew: 0 },
      codex: {},            // termId -> true
      voyages: {},          // explorerId -> {done, stars, best:{days,quiz}, plays}
      checkpoint: null,     // {explorer, wp, state...}
      settings: { music: 0.6, sfx: 0.8, ambience: 0.7 },
      seenTutorial: false,
      atlas: {},            // explorerId -> revealed on old map (animation played)
    };
  },
  load() {
    let d = null;
    try { const s = localStorage.getItem(this.KEY); if (s) d = JSON.parse(s); } catch (e) { d = null; }
    const def = this.defaults();
    this.data = Object.assign(def, d || {});
    this.data.upgrades = Object.assign(def.upgrades, (d && d.upgrades) || {});
    this.data.settings = Object.assign(def.settings, (d && d.settings) || {});
    return this.data;
  },
  write() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ } },
  reset() { this.data = this.defaults(); this.write(); },
};
