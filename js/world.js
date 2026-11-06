/* ==========================================================================
   World: coastline data, terrain tiles, land mask, geographic features
   ========================================================================== */
'use strict';

const World = (() => {
  const TILE = 480;            // world px per tile
  let RES = 1.25;              // canvas px per world px in tiles
  const MS = 0.25;             // mask px per world px
  const MCH = 512;             // mask chunk size (mask px)
  const MCW = MCH / MS;        // mask chunk size in world px

  const rings = [];
  let NTX, NTY, bins;
  const tileCache = new Map();
  const tileQueue = [];
  const maskChunks = new Map();
  let MAXTILES = 56;

  /* ---------------- Geographic features (lat, lon) ---------------------- */
  const RANGES = [
    { n: 'Alps', h: 1, p: [[45.6, 6.6], [46.3, 7.8], [46.5, 9.3], [46.8, 10.8], [47.1, 12.4], [47.3, 14.2]] },
    { n: 'Pyrenees', h: .7, p: [[43.0, -1.6], [42.7, 0.2], [42.5, 2.0]] },
    { n: 'Sierra Nevada', h: .5, p: [[37.1, -3.8], [37.0, -2.8]] },
    { n: 'Atlas', h: .8, p: [[30.8, -9.2], [31.6, -7.0], [32.6, -4.8], [33.8, -2.6], [35.0, 0.8], [36.0, 4.0], [36.4, 7.5]] },
    { n: 'Apennines', h: .5, p: [[44.3, 9.8], [43.4, 12.2], [42.2, 13.5], [40.7, 15.4], [39.3, 16.3]] },
    { n: 'Carpathians', h: .55, p: [[49.4, 19.5], [48.7, 23.5], [47.2, 25.2], [45.6, 25.6], [45.3, 23.0]] },
    { n: 'Balkans', h: .5, p: [[44.0, 17.5], [42.6, 20.5], [42.6, 24.0]] },
    { n: 'Caucasus', h: .9, p: [[43.6, 40.0], [42.9, 43.5], [41.6, 47.6]] },
    { n: 'Taurus', h: .6, p: [[37.0, 31.5], [37.6, 35.0], [38.3, 39.0], [38.8, 42.5]] },
    { n: 'Zagros', h: .7, p: [[36.8, 45.2], [34.2, 46.8], [31.5, 49.8], [29.0, 52.5], [27.6, 55.8]] },
    { n: 'Elburz', h: .7, p: [[36.4, 50.0], [36.0, 52.5], [36.6, 55.0]] },
    { n: 'Hindu Kush', h: 1, p: [[34.8, 68.0], [35.6, 70.5], [36.2, 72.5]] },
    { n: 'Himalaya', h: 1.2, p: [[35.0, 74.5], [33.0, 77.5], [30.8, 80.0], [29.0, 83.0], [28.0, 86.5], [27.8, 89.5], [27.9, 92.5], [28.4, 95.8]] },
    { n: 'Kunlun', h: .9, p: [[36.2, 78.5], [36.0, 84.0], [35.7, 90.0], [35.0, 96.0]] },
    { n: 'Tian Shan', h: .9, p: [[41.5, 71.0], [42.2, 76.5], [42.8, 81.0], [43.2, 86.0]] },
    { n: 'Altai', h: .7, p: [[50.5, 86.0], [49.0, 89.5], [47.0, 93.0]] },
    { n: 'Urals', h: .45, p: [[66.0, 61.5], [62.0, 59.5], [58.0, 59.2], [54.5, 58.8], [52.0, 58.4]] },
    { n: 'Scandinavian Mts', h: .55, p: [[69.5, 19.5], [67.0, 16.0], [64.5, 13.5], [62.2, 9.5], [60.5, 7.5]] },
    { n: 'Ethiopian Highlands', h: .8, p: [[14.0, 38.5], [11.5, 39.3], [9.0, 38.8], [7.0, 38.2]] },
    { n: 'Rift Highlands', h: .6, p: [[-0.5, 36.5], [-3.0, 37.3], [-8.0, 35.2], [-11.0, 34.5]] },
    { n: 'Drakensberg', h: .7, p: [[-25.5, 30.8], [-28.5, 29.4], [-30.2, 28.8], [-31.8, 27.2]] },
    { n: 'Cape Fold', h: .5, p: [[-33.4, 19.2], [-33.6, 21.5], [-33.7, 24.0]] },
    { n: 'Madagascar', h: .5, p: [[-13.5, 49.0], [-17.5, 47.6], [-21.0, 47.0], [-24.0, 46.2]] },
    { n: 'Western Ghats', h: .55, p: [[20.5, 73.7], [17.0, 73.8], [14.0, 74.6], [11.5, 76.0], [9.0, 77.2]] },
    { n: 'Arakan', h: .5, p: [[24.0, 93.5], [20.0, 94.0], [17.0, 94.6]] },
    { n: 'Annamite', h: .5, p: [[20.0, 104.0], [17.0, 106.0], [14.0, 108.0], [12.0, 108.3]] },
    { n: 'Japan Alps', h: .6, p: [[38.5, 140.3], [36.5, 137.8], [35.3, 136.0]] },
    { n: 'Rockies', h: 1, p: [[62.0, -132.0], [57.0, -125.0], [52.0, -118.0], [47.0, -113.0], [43.0, -110.0], [39.0, -106.0], [35.5, -105.6]] },
    { n: 'Sierra Madre', h: .8, p: [[30.0, -108.5], [25.0, -105.5], [21.5, -103.5], [19.0, -99.0], [17.2, -96.5]] },
    { n: 'Appalachians', h: .45, p: [[34.0, -84.6], [36.5, -82.0], [39.0, -79.2], [41.5, -76.0], [43.5, -73.5], [45.5, -70.5]] },
    { n: 'Andes', h: 1.2, p: [[10.5, -71.5], [7.0, -73.0], [4.0, -75.5], [0.0, -78.2], [-4.0, -79.2], [-8.0, -77.8], [-12.0, -75.5], [-15.5, -71.5], [-19.0, -68.5], [-23.0, -67.5], [-27.0, -68.8], [-31.0, -70.0], [-35.0, -70.3], [-39.0, -71.2], [-43.0, -71.8], [-47.0, -72.8], [-50.5, -73.3], [-53.5, -72.0], [-54.6, -69.5]] },
    { n: 'Guiana Highlands', h: .45, p: [[5.5, -62.0], [4.5, -59.0], [2.5, -55.0]] },
    { n: 'Brazilian Highlands', h: .45, p: [[-14.0, -47.5], [-18.5, -44.0], [-21.5, -44.5], [-23.0, -46.0]] },
    { n: 'Great Dividing Range', h: .45, p: [[-16.0, 145.4], [-21.0, 147.5], [-26.0, 151.0], [-31.0, 151.5], [-35.5, 148.5], [-37.2, 146.5]] },
    { n: 'New Guinea', h: .8, p: [[-3.5, 136.0], [-4.5, 139.5], [-5.6, 143.0], [-6.8, 146.0]] },
    { n: 'Hispaniola', h: .4, p: [[19.1, -72.4], [19.0, -71.0], [18.9, -70.0]] },
    { n: 'Sierra Maestra', h: .35, p: [[20.0, -77.0], [20.1, -76.0]] },
  ];

  const RIVERS = [
    [[31.45, 30.4], [30.05, 31.23], [27.2, 31.2], [25.7, 32.6], [24.1, 32.9], [22.0, 31.5], [19.5, 30.5], [18.0, 32.6], [15.6, 32.5], [12.0, 32.7], [9.5, 31.6], [6.0, 31.6], [3.5, 32.0]],
    [[-6.05, 12.35], [-5.4, 13.5], [-4.3, 15.3], [-2.2, 16.3], [0.0, 17.8], [1.6, 20.5], [1.9, 23.5], [0.5, 25.2], [-2.5, 25.9], [-5.8, 26.9], [-9.0, 27.0]],
    [[4.7, 6.1], [6.2, 6.7], [7.8, 6.7], [9.2, 5.4], [11.9, 3.5], [13.5, 2.1], [15.2, 0.6], [16.3, -0.1], [16.8, -3.0], [15.3, -4.6], [13.5, -6.0], [12.6, -8.0], [11.0, -9.6]],
    [[16.0, -16.5], [16.5, -15.0], [15.0, -12.5], [13.5, -11.0]],
    [[-18.8, 36.4], [-17.2, 35.3], [-15.9, 33.0], [-15.6, 30.4], [-17.9, 25.9], [-15.5, 23.0], [-12.5, 22.4]],
    [[-28.6, 16.45], [-28.8, 19.5], [-29.2, 22.0], [-30.0, 24.2], [-30.6, 26.0], [-29.5, 28.3]],
    [[-0.2, -50.5], [-1.9, -55.5], [-3.1, -60.0], [-3.4, -64.5], [-4.2, -69.9], [-4.4, -73.5]],
    [[-34.2, -58.4], [-32.9, -60.6], [-31.6, -60.7], [-29.0, -59.5], [-27.4, -58.8], [-25.6, -54.6], [-22.5, -52.8], [-20.0, -51.0]],
    [[8.6, -61.0], [8.1, -63.5], [7.6, -66.4], [6.2, -67.5], [4.0, -67.6]],
    [[29.2, -89.3], [31.0, -91.6], [34.5, -90.6], [38.6, -90.2], [41.5, -91.0], [44.9, -93.2]],
    [[38.7, -9.2], [39.4, -8.2], [39.7, -6.5], [39.9, -4.0], [40.4, -2.5]],
    [[36.8, -6.35], [37.4, -6.0], [37.9, -4.8], [38.0, -3.4]],
    [[37.2, -7.4], [38.5, -7.5], [38.9, -6.5], [39.0, -4.0]],
    [[41.15, -8.65], [41.2, -7.0], [41.6, -4.7], [41.9, -2.8]],
    [[40.7, 0.85], [41.6, 0.6], [42.4, -2.0], [43.0, -4.0]],
    [[51.9, 4.1], [51.8, 6.2], [50.4, 7.6], [49.0, 8.3], [47.6, 7.6], [47.6, 9.4]],
    [[45.2, 29.6], [44.2, 27.0], [43.7, 24.0], [44.8, 20.4], [47.5, 19.05], [48.2, 16.4], [48.3, 13.5], [48.7, 11.0], [48.0, 8.5]],
    [[47.25, -2.2], [47.4, 0.7], [47.6, 2.4], [46.4, 3.4], [45.0, 4.0]],
    [[43.3, 4.8], [45.7, 4.85], [46.8, 5.0], [47.3, 6.6]],
    [[24.0, 67.5], [25.4, 68.4], [27.7, 68.8], [30.0, 70.8], [33.9, 72.2], [35.4, 75.0]],
    [[22.0, 88.2], [24.0, 88.3], [25.4, 85.5], [25.4, 82.5], [26.4, 80.3], [28.3, 78.2], [30.0, 78.2]],
    [[30.0, 48.0], [31.0, 47.4], [33.3, 44.4], [36.3, 43.1], [37.8, 41.0]],
    [[31.0, 46.6], [33.4, 43.3], [35.9, 39.0], [37.5, 38.0]],
    [[31.4, 121.6], [30.5, 117.0], [30.6, 114.3], [29.7, 112.0], [30.8, 108.3], [29.5, 106.5], [28.5, 104.5]],
    [[37.7, 118.9], [36.6, 116.9], [34.9, 113.6], [34.6, 110.3], [36.5, 110.5], [40.3, 111.0], [40.5, 107.0], [37.5, 105.5], [36.0, 103.8]],
    [[10.0, 106.6], [12.0, 105.5], [15.1, 105.8], [17.9, 102.6], [20.3, 100.1]],
    [[46.0, 48.0], [48.7, 44.5], [51.5, 46.0], [53.2, 50.1], [55.8, 49.0], [57.6, 40.0]],
    [[46.5, 30.8], [48.5, 35.0], [50.4, 30.5], [52.5, 30.5], [54.5, 31.5]],
  ];

  /** Water channels carved into the land mask so the narrow Strait of Magellan is sailable */
  const CARVE = [
    [[-52.35, -68.35], [-52.48, -69.0], [-52.62, -69.6], [-52.75, -70.1], [-53.1, -70.6], [-53.45, -70.88], [-53.85, -71.15], [-53.88, -71.4], [-53.7, -72.0], [-53.45, -72.6], [-53.2, -73.1], [-52.95, -73.7], [-52.75, -74.3], [-52.7, -74.8]],
  ];

  /* biome helper ellipses: lat, lon, rlat, rlon, strength */
  const DRY = [
    [23, 8, 9.5, 24, 1.05], [22, -12, 6, 6, 1], [21.5, 30, 6, 6, 1], [22, 47, 9, 11, 1], [28.5, 60, 5.5, 13, .8], [27, 71, 3, 3.5, .8], [8, 46, 5.5, 6.5, .6],
    [-23, 21, 6, 7, .42], [-23, 15, 7.5, 2.2, 1], [-31.5, 22, 2.6, 5, .6], [-22, -70, 7, 1.7, 1], [-45, -68, 7.5, 4.5, .58],
    [-25, 132, 9.5, 15, .9], [-31, 124, 4, 6, .6], [32, -112, 6, 9, .82], [27, -104, 4, 4, .6], [43, 105, 5, 14, .82], [41.5, 62, 6, 14, .72],
    [39, 83, 3, 8.5, .95], [38, 98, 3, 6, .6], [33, 35, 3, 4, .55], [34, 40, 2.8, 5, .7], [-7, -37, 3, 3, .45], [11, -71, 1, 2, .4],
  ];
  const WET = [
    [-4, -62, 9, 16, 1], [0, 20, 6, 12, 1], [6.5, -5, 3, 12, .8], [8.5, -12, 2.5, 3.5, .7], [5, 105, 9, 20, 1], [-5, 142, 5, 10, 1], [12, -84, 6, 6, .8],
    [-20, -43, 7, 4, .7], [-17, 49, 6, 2, .8], [12, 75, 6, 2, .6], [12, 123, 7, 4, .9], [20, -75, 4, 10, .55], [22, 92, 4, 6, .7], [-2, 10, 3, 3, .9],
    [24, 110, 6, 10, .45], [-16, 145.5, 3, 2, .55],
  ];
  const ICE = [[72, -40, 12.5, 24, 1.2], [79, 20, 4, 15, .8]];

  function ellipseField(list, lat, lon) {
    let v = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      let dl = lon - e[1]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
      const d = (lat - e[0]) ** 2 / (e[2] * e[2]) + dl * dl / (e[3] * e[3]);
      if (d < 1.8) { const f = (1 - U.smooth(0.35, 1.6, d)) * e[4]; if (f > v) v = f; }
    }
    return v;
  }

  /* ---------------- Decode coastline data ------------------------------- */
  function decode() {
    const parts = window.LAND_DATA.split(';');
    for (const p of parts) {
      const hole = p[0] === 'h';
      const nums = (hole ? p.slice(1) : p).split(',');
      const n = nums.length >> 1;
      const lon = new Float32Array(n), lat = new Float32Array(n), x = new Float32Array(n), y = new Float32Array(n);
      let qx = 0, qy = 0, minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (let i = 0; i < n; i++) {
        qx += +nums[2 * i]; qy += +nums[2 * i + 1];
        lon[i] = qx / 50; lat[i] = qy / 50;
        // unwrap rings that cross the antimeridian so they stay continuous
        if (i > 0) { while (lon[i] - lon[i - 1] > 180) lon[i] -= 360; while (lon[i] - lon[i - 1] < -180) lon[i] += 360; }
      }
      let mean = 0; for (let i = 0; i < n; i++) mean += lon[i]; mean /= n;
      const shift = mean > 180 ? -360 : mean < -180 ? 360 : 0;
      for (let i = 0; i < n; i++) {
        lon[i] += shift;
        x[i] = GEO.lonToX(lon[i]); y[i] = GEO.latToY(lat[i]);
        if (x[i] < minx) minx = x[i]; if (x[i] > maxx) maxx = x[i];
        if (y[i] < miny) miny = y[i]; if (y[i] > maxy) maxy = y[i];
      }
      let lmin = 1e9, lmax = -1e9; for (let i = 0; i < n; i++) { if (lat[i] < lmin) lmin = lat[i]; if (lat[i] > lmax) lmax = lat[i]; }
      const ring = { hole, lon, lat, x, y, n, minx, maxx, miny, maxy, area: (maxx - minx) * (maxy - miny) };
      rings.push(ring);
      // rings poking past the world edge get a wrapped twin so tiles on the other side draw them
      if (minx < 0 || maxx > GEO.W) {
        const off = minx < 0 ? GEO.W : -GEO.W;
        const x2 = new Float32Array(n); for (let i = 0; i < n; i++) x2[i] = x[i] + off;
        rings.push(Object.assign({}, ring, { x: x2, minx: minx + off, maxx: maxx + off, dup: true }));
      }
    }
    NTX = Math.ceil(GEO.W / TILE); NTY = Math.ceil(GEO.H / TILE);
    bins = new Array(NTX * NTY);
    for (let i = 0; i < bins.length; i++) bins[i] = [];
    const M = 60;
    rings.forEach((r, idx) => {
      const tx0 = Math.max(0, Math.floor((r.minx - M) / TILE)), tx1 = Math.min(NTX - 1, Math.floor((r.maxx + M) / TILE));
      const ty0 = Math.max(0, Math.floor((r.miny - M) / TILE)), ty1 = Math.min(NTY - 1, Math.floor((r.maxy + M) / TILE));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) bins[ty * NTX + tx].push(idx);
    });
  }

  function ringsPath(list) {
    const p = new Path2D();
    for (const idx of list) {
      const r = rings[idx];
      p.moveTo(r.x[0], r.y[0]);
      for (let i = 1; i < r.n; i++) p.lineTo(r.x[i], r.y[i]);
      p.closePath();
    }
    return p;
  }
  function ringsInRect(x0, y0, x1, y1) {
    const out = [];
    rings.forEach((r, i) => { if (r.maxx >= x0 && r.minx <= x1 && r.maxy >= y0 && r.miny <= y1) out.push(i); });
    return out;
  }
  function llPath(pts, ctx, offx = 0) {
    for (let i = 0; i < pts.length; i++) {
      const x = GEO.lonToX(pts[i][1]) + offx, y = GEO.latToY(pts[i][0]);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  }

  /* ---------------- Land mask ------------------------------------------ */
  function maskChunk(cx, cy) {
    const key = cx + ',' + cy;
    let m = maskChunks.get(key);
    if (m) return m;
    const c = U.canvas(MCH, MCH), g = c.getContext('2d', { willReadFrequently: true });
    const x0 = cx * MCW, y0 = cy * MCW;
    const list = ringsInRect(x0 - 10, y0 - 10, x0 + MCW + 10, y0 + MCW + 10);
    g.setTransform(MS, 0, 0, MS, -x0 * MS, -y0 * MS);
    g.fillStyle = '#000';
    g.fill(ringsPath(list), 'evenodd');
    // carve channels
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = 22; g.lineJoin = g.lineCap = 'round';
    for (const ch of CARVE) { g.beginPath(); llPath(ch, g); g.stroke(); }
    const d = g.getImageData(0, 0, MCH, MCH).data;
    m = new Uint8Array(MCH * MCH);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    maskChunks.set(key, m);
    return m;
  }
  function isLand(x, y) {
    x = GEO.wrapX(x);
    if (y < 0 || y >= GEO.H) return y >= GEO.H; // the far south counts as land/ice
    const cx = Math.floor(x / MCW), cy = Math.floor(y / MCW);
    const m = maskChunk(cx, cy);
    const ix = Math.floor((x - cx * MCW) * MS), iy = Math.floor((y - cy * MCW) * MS);
    return m[iy * MCH + ix] === 1;
  }
  /** distance (px, coarse) to nearest land up to maxR; returns maxR if none */
  function landDistance(x, y, maxR = 400, steps = 6) {
    if (isLand(x, y)) return 0;
    for (let s = 1; s <= steps; s++) {
      const r = maxR * s / steps, n = 8 + s * 4;
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2;
        if (isLand(x + Math.cos(a) * r, y + Math.sin(a) * r)) return r;
      }
    }
    return maxR;
  }

  /* ---------------- Terrain colouring ---------------------------------- */
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const C = {
    trop: [86, 128, 58], sav: [150, 146, 82], subt: [128, 136, 76], temp: [92, 126, 62], cool: [70, 106, 60],
    boreal: [56, 84, 60], tundra: [148, 146, 126], rain: [36, 84, 42], sand: [226, 198, 142], dune: [236, 210, 156],
    rock: [128, 112, 96], snow: [242, 242, 240], ice: [234, 240, 245],
  };
  function landRGB(lon, lat, n, m) {
    const al = Math.abs(lat);
    let c;
    if (al < 10) c = lerp3(C.trop, C.sav, U.smooth(4, 10, al));
    else if (al < 25) c = lerp3(C.sav, C.subt, U.smooth(14, 25, al));
    else if (al < 42) c = lerp3(C.subt, C.temp, U.smooth(30, 42, al));
    else if (al < 56) c = lerp3(C.temp, C.cool, U.smooth(44, 56, al));
    else if (al < 66) c = lerp3(C.cool, C.boreal, U.smooth(56, 63, al));
    else c = lerp3(C.boreal, C.tundra, U.smooth(64, 70, al));
    const wet = U.clamp(ellipseField(WET, lat, lon) + (n - 0.5) * 0.25, 0, 1);
    c = lerp3(c, C.rain, wet * 0.9);
    let dry = U.clamp(ellipseField(DRY, lat, lon) + (n - 0.5) * 0.3, 0, 1.1);
    if (dry > 0) { c = lerp3(c, dry > 0.75 ? C.dune : C.sand, U.smooth(0.15, 0.85, dry)); }
    const ice = Math.max(ellipseField(ICE, lat, lon), U.smooth(72, 76, al));
    if (ice > 0) c = lerp3(c, C.ice, U.clamp(ice, 0, 1));
    if (m > 0.3) {
      c = lerp3(c, C.rock, U.clamp((m - 0.3) * 1.6, 0, 0.85));
      if (m > 0.72 && (al > 22 || m > 0.95)) c = lerp3(c, C.snow, U.clamp((m - 0.72) * 3, 0, 1));
    }
    return c;
  }
  function forestness(lon, lat, n) {
    const al = Math.abs(lat);
    const wet = ellipseField(WET, lat, lon);
    const dry = ellipseField(DRY, lat, lon);
    let f = wet * 1.0;
    f += (U.smooth(40, 50, al) - U.smooth(64, 70, al)) * 0.55;
    f += (al < 12 ? 0.25 : 0);
    f -= dry * 1.3;
    f += (n - 0.5) * 0.6;
    if (ellipseField(ICE, lat, lon) > 0.2) f = 0;
    return U.clamp(f, 0, 1);
  }

  function rangeSegmentsNear(lat0, lat1, lon0, lon1) {
    const segs = [];
    for (const r of RANGES) {
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        if (Math.max(a[0], b[0]) < lat0 - 5 || Math.min(a[0], b[0]) > lat1 + 5) continue;
        if (Math.max(a[1], b[1]) < lon0 - 6 || Math.min(a[1], b[1]) > lon1 + 6) continue;
        segs.push([a[0], a[1], b[0], b[1], r.h]);
      }
    }
    return segs;
  }
  function segDist(lat, lon, s) {
    const k = Math.cos(U.rad(lat));
    const ax = s[1] * k, ay = s[0], bx = s[3] * k, by = s[2], px = lon * k, py = lat;
    const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    const t = U.clamp((wx * vx + wy * vy) / (vx * vx + vy * vy || 1), 0, 1);
    const dx = px - (ax + vx * t), dy = py - (ay + vy * t);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function terrainCanvas(tx, ty) {
    const N = Math.round(TILE * RES / 2);
    const c = U.canvas(N, N), g = c.getContext('2d');
    const img = g.createImageData(N, N), d = img.data;
    const step = TILE / N;
    const lats = new Float32Array(N + 2), lons = new Float32Array(N + 2);
    for (let i = -1; i <= N; i++) {
      lats[i + 1] = GEO.yToLat(ty * TILE + (i + 0.5) * step);
      lons[i + 1] = GEO.xToLon(tx * TILE + (i + 0.5) * step);
    }
    const segs = rangeSegmentsNear(lats[N + 1], lats[0], Math.min(lons[0], lons[N + 1]), Math.max(lons[0], lons[N + 1]));
    const H = new Float32Array((N + 2) * (N + 2)), MM = new Float32Array((N + 2) * (N + 2)), NN = new Float32Array((N + 2) * (N + 2));
    for (let j = 0; j <= N + 1; j++) {
      const lat = lats[j];
      for (let i = 0; i <= N + 1; i++) {
        const lon = lons[i];
        const n = U.fbm(lon * 0.32, lat * 0.32, 5);
        let m = 0;
        for (let s = 0; s < segs.length; s++) {
          const dd = segDist(lat, lon, segs[s]);
          if (dd < 4) { const v = Math.exp(-(dd * dd) / 1.6) * segs[s][4]; if (v > m) m = v; }
        }
        const rid = 1 - Math.abs(U.noise2(lon * 1.3, lat * 1.3) * 2 - 1);
        const k = j * (N + 2) + i;
        H[k] = n * 0.9 + m * (0.6 + rid * 0.7) + U.noise2(lon * 4, lat * 4) * 0.08;
        MM[k] = m * (0.75 + rid * 0.35);
        NN[k] = n;
      }
    }
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        const k = j * (N + 2) + i;
        const c3 = landRGB(lons[i], lats[j], NN[k], MM[k]);
        const sh = (H[k - 1] - H[k + 1]) * 1.0 + (H[k - (N + 2)] - H[k + (N + 2)]) * 1.0;
        const f = U.clamp(1 + sh * 6.5, 0.62, 1.38);
        const grain = 0.96 + U.hash2(i + tx * 977, j + ty * 733) * 0.08;
        const o = ((j - 1) * N + (i - 1)) * 4;
        d[o] = U.clamp(c3[0] * f * grain, 0, 255);
        d[o + 1] = U.clamp(c3[1] * f * grain, 0, 255);
        d[o + 2] = U.clamp(c3[2] * f * grain, 0, 255);
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function shallowColor(lat) {
    const al = Math.abs(lat);
    if (al < 26) return [70, 222, 205];
    if (al < 40) return [84, 190, 190];
    return [110, 160, 175];
  }

  /* ---------------- Tile rendering ------------------------------------- */
  function renderTile(tx, ty) {
    const TS = Math.round(TILE * RES);
    const c = U.canvas(TS, TS), g = c.getContext('2d');
    const list = bins[ty * NTX + tx];
    const empty = list.length === 0;
    const x0 = tx * TILE, y0 = ty * TILE;
    const clat = GEO.yToLat(y0 + TILE / 2);
    const carveNear = CARVE.some(ch => ch.some(p => {
      const px = GEO.lonToX(p[1]), py = GEO.latToY(p[0]);
      return px > x0 - 60 && px < x0 + TILE + 60 && py > y0 - 60 && py < y0 + TILE + 60;
    }));
    if (empty && !carveNear) return { canvas: null, empty: true };
    const path = ringsPath(list);
    const W = [RES, 0, 0, RES, -x0 * RES, -y0 * RES];
    g.setTransform(...W);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const sc = shallowColor(clat);
    // shallow water halo
    const bands = [[70, 0.05], [46, 0.07], [30, 0.1], [18, 0.14], [9, 0.2]];
    for (const [w, a] of bands) { g.strokeStyle = `rgba(${sc[0]},${sc[1]},${sc[2]},${a})`; g.lineWidth = w; g.stroke(path); }
    // surf
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 7; g.stroke(path);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3.4; g.stroke(path);
    // land
    g.save();
    g.clip(path, 'evenodd');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(terrainCanvas(tx, ty), 0, 0, TS, TS);
    g.setTransform(...W);
    // beach and inner shading
    g.strokeStyle = 'rgba(30,20,10,0.10)'; g.lineWidth = 16; g.stroke(path);
    g.strokeStyle = 'rgba(232,212,160,0.85)'; g.lineWidth = 4.5; g.stroke(path);
    // rivers
    for (const rv of RIVERS) {
      g.beginPath(); llPath(rv, g);
      g.strokeStyle = 'rgba(40,80,100,0.55)'; g.lineWidth = 3.6; g.stroke();
      g.strokeStyle = 'rgba(96,160,190,0.95)'; g.lineWidth = 2; g.stroke();
    }
    // trees
    const rnd = U.rng(tx * 7919 + ty * 104729);
    const step = 11;
    for (let yy = 0; yy < TILE; yy += step) {
      for (let xx = 0; xx < TILE; xx += step) {
        const wx = x0 + xx + rnd() * step, wy = y0 + yy + rnd() * step;
        const lon = GEO.xToLon(wx), lat = GEO.yToLat(wy);
        const f = forestness(lon, lat, U.fbm(lon * 0.32, lat * 0.32, 3));
        if (rnd() > f * 0.85) continue;
        if (!isLand(wx, wy)) continue;
        const tropic = Math.abs(lat) < 23;
        const r = (tropic ? 2.6 : 2.1) + rnd() * 1.4;
        g.fillStyle = 'rgba(10,25,10,0.35)';
        g.beginPath(); g.ellipse(wx + 1.2, wy + 1.4, r, r * 0.8, 0, 0, 7); g.fill();
        g.fillStyle = tropic ? `rgb(${30 + rnd() * 15},${70 + rnd() * 25},${32 + rnd() * 10})` : `rgb(${40 + rnd() * 15},${72 + rnd() * 20},${42 + rnd() * 12})`;
        if (!tropic && Math.abs(lat) > 50) {
          g.beginPath(); g.moveTo(wx, wy - r * 1.5); g.lineTo(wx + r, wy + r * 0.8); g.lineTo(wx - r, wy + r * 0.8); g.closePath(); g.fill();
        } else {
          g.beginPath(); g.arc(wx, wy, r, 0, 7); g.fill();
          g.fillStyle = 'rgba(160,200,110,0.35)';
          g.beginPath(); g.arc(wx - r * 0.35, wy - r * 0.35, r * 0.45, 0, 7); g.fill();
        }
      }
    }
    // mountain glyphs
    for (const rg of RANGES) {
      for (let i = 0; i < rg.p.length - 1; i++) {
        const a = GEO.toXY(rg.p[i][0], rg.p[i][1]), b = GEO.toXY(rg.p[i + 1][0], rg.p[i + 1][1]);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (Math.max(a.x, b.x) < x0 - 40 || Math.min(a.x, b.x) > x0 + TILE + 40 || Math.max(a.y, b.y) < y0 - 40 || Math.min(a.y, b.y) > y0 + TILE + 40) continue;
        const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        const sr = U.rng(i * 31 + rg.n.length * 1013);
        const rows = rg.h > 0.9 ? [-14, 0, 14] : rg.h > 0.6 ? [-7, 7] : [0];
        for (let s = 0; s < len; s += 15) {
          for (const off of rows) {
            const jit = (sr() - 0.5) * 8;
            const px = a.x + (b.x - a.x) * s / len + nx * (off + jit), py = a.y + (b.y - a.y) * s / len + ny * (off + jit);
            if (px < x0 - 20 || px > x0 + TILE + 20 || py < y0 - 20 || py > y0 + TILE + 20) { sr(); continue; }
            if (!isLand(px, py)) { sr(); continue; }
            const hgt = (7 + sr() * 7) * (0.7 + rg.h * 0.45) * (off === 0 ? 1.1 : 0.85);
            drawPeak(g, px, py, hgt, rg.h > 0.75 && (Math.abs(rg.p[i][0]) > 20 || rg.h > 1));
          }
        }
      }
    }
    g.restore();
    // ink coastline
    g.strokeStyle = 'rgba(52,40,22,0.55)'; g.lineWidth = 1.1; g.stroke(path);
    // carve channels (strait)
    if (carveNear) {
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = 20; g.lineCap = 'round';
      for (const ch of CARVE) { g.beginPath(); llPath(ch, g); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
      for (const ch of CARVE) {
        g.beginPath(); llPath(ch, g);
        g.strokeStyle = 'rgba(110,160,175,0.35)'; g.lineWidth = 20; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.4; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]);
      }
    }
    return { canvas: c, empty: false };
  }

  function drawPeak(g, x, y, h, snow) {
    const w = h * 0.95;
    g.fillStyle = 'rgba(30,20,10,0.25)';
    g.beginPath(); g.moveTo(x - w * 0.6, y + 1); g.lineTo(x + w * 1.1, y + 2); g.lineTo(x + w * 0.2, y - h * 0.6); g.fill();
    g.fillStyle = '#c9b89b';
    g.beginPath(); g.moveTo(x - w * 0.55, y); g.lineTo(x, y - h); g.lineTo(x + 0.5, y); g.closePath(); g.fill();
    g.fillStyle = '#7a6650';
    g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w * 0.55, y); g.lineTo(x - 0.5, y); g.closePath(); g.fill();
    if (snow) {
      g.fillStyle = '#f6f6f2';
      g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w * 0.2, y - h * 0.62); g.lineTo(x + 0.02 * w, y - h * 0.7); g.lineTo(x - w * 0.2, y - h * 0.6); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(50,35,20,0.6)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x - w * 0.55, y); g.lineTo(x, y - h); g.lineTo(x + w * 0.55, y); g.stroke();
  }

  /* ---------------- Tile cache ----------------------------------------- */
  let frame = 0;
  function getTile(tx, ty) {
    tx = ((tx % NTX) + NTX) % NTX;
    if (ty < 0 || ty >= NTY) return null;
    const key = tx + ',' + ty;
    const t = tileCache.get(key);
    if (t) { t.used = frame; return t; }
    return null;
  }
  function requestTile(tx, ty, urgent) {
    tx = ((tx % NTX) + NTX) % NTX;
    if (ty < 0 || ty >= NTY) return;
    const key = tx + ',' + ty;
    if (tileCache.has(key)) { tileCache.get(key).used = frame; return; }
    if (urgent) { buildTile(tx, ty); return; }
    if (!tileQueue.some(q => q[0] === tx && q[1] === ty)) tileQueue.push([tx, ty]);
  }
  function buildTile(tx, ty) {
    const key = tx + ',' + ty;
    if (tileCache.has(key)) return;
    const t = renderTile(tx, ty);
    t.used = frame;
    tileCache.set(key, t);
    // evict
    let filled = 0; for (const v of tileCache.values()) if (!v.empty) filled++;
    if (filled > MAXTILES) {
      let oldest = null, ok = null;
      for (const [k, v] of tileCache) if (!v.empty && (!oldest || v.used < oldest.used)) { oldest = v; ok = k; }
      if (ok) tileCache.delete(ok);
    }
  }
  function pump(budgetMs = 9) {
    frame++;
    const t0 = performance.now();
    while (tileQueue.length && performance.now() - t0 < budgetMs) {
      const [tx, ty] = tileQueue.shift();
      buildTile(tx, ty);
    }
  }

  /* ---------------- Small world map (minimap / chart) ------------------ */
  let miniCanvas = null;
  const MINI = 1 / 24;
  function miniMap() {
    if (miniCanvas) return miniCanvas;
    const w = Math.round(GEO.W * MINI), h = Math.round(GEO.H * MINI);
    miniCanvas = U.canvas(w, h);
    const g = miniCanvas.getContext('2d');
    g.fillStyle = '#9fb8b0'; g.fillRect(0, 0, w, h);
    g.setTransform(MINI, 0, 0, MINI, 0, 0);
    const all = rings.map((_, i) => i).filter(i => rings[i].area > 400);
    const p = ringsPath(all);
    g.strokeStyle = 'rgba(220,240,230,0.5)'; g.lineWidth = 60; g.stroke(p);
    g.fillStyle = '#d9c497'; g.fill(p, 'evenodd');
    g.strokeStyle = '#5a4526'; g.lineWidth = 22; g.stroke(p);
    return miniCanvas;
  }

  return {
    TILE, get RES() { return RES; }, set RES(v) { RES = v; }, set maxTiles(v) { MAXTILES = v; },
    rings, RANGES, RIVERS, CARVE,
    init() { decode(); },
    get NTX() { return NTX; }, get NTY() { return NTY; },
    getTile, requestTile, pump, isLand, landDistance, miniMap, MINI,
    ellipseField, DRY, WET,
    clearTiles() { tileCache.clear(); tileQueue.length = 0; },
    queueLength: () => tileQueue.length,
  };
})();
