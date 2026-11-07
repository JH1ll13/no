/* ==========================================================================
   Race to the Spice Islands — a whole-class projector game.
   Two teams (Portugal sailing east, Spain sailing west) race to the
   Moluccas. Each round the teacher shows a question, marks each team right
   or wrong, and the ships sail: right answers bring fair winds.
   ========================================================================== */
'use strict';

const Race = (() => {
  const $ = id => document.getElementById(id);
  const LON0 = -105;                     // map runs from 105°W eastward 360°
  const LAT_T = 50, LAT_B = -58;

  /* ---------------- Routes & milestones ---------------------------------- */
  // [lat, lon] with continuous (unwrapped) longitudes; m = milestone
  const ROUTES = {
    portugal: [
      [38.6, -9.4, { n: 'Lisbon' }], [26.1, -15.2, { n: 'Cape Bojador', fx: 0, t: 'In 1434 Gil Eanes proved ships could pass Cape Bojador and return.' }],
      [14.7, -17.9, { n: 'Cape Verde', fx: 0.3, t: 'The volta do mar: swinging wide into the Atlantic catches better winds.', b: 'Volta do mar!' }],
      [-8, -26], [-30, -12], [-34.8, 18.4, { n: 'Cape of Good Hope', fx: -0.3, t: 'Dias called it the Cape of Storms. Heavy seas slow you down!', b: 'Storm at the Cape' }],
      [-33.2, 30], [-15, 41.3, { n: 'Mozambique', fx: 0, t: 'Arab and Swahili merchants already trade gold, pepper and cloves here.' }],
      [-3.2, 40.5, { n: 'Malindi', fx: 0.4, t: 'The Sultan of Malindi provides a pilot who knows the monsoon winds.', b: 'A pilot joins you!' }],
      [6, 60], [11.2, 75.4, { n: 'Calicut', fx: 0, t: 'Da Gama reached Calicut in 1498: "We came in search of Christians and spices."' }],
      [5.4, 80.6], [5.8, 95], [2.4, 101.6, { n: 'Malacca', fx: 0.1, t: 'Portugal captured Malacca in 1511, the gateway to the Spice Islands.', b: 'Gateway to the spices' }],
      [1.0, 104.4], [-4.5, 111], [-5.5, 120], [-3, 126.2], [0.8, 127.3, { n: 'Spice Islands', end: true }],
    ],
    spain: [
      [36.7, -6.6, { n: 'Sanlúcar' }], [28.0, -16.4, { n: 'Canary Islands', fx: 0.3, t: 'The northeast trade winds blow straight toward the west.', b: 'Trade winds!' }],
      [10, -28], [-23.1, -42.9, { n: 'Rio de Janeiro', fx: 0.2, t: 'The Tupi people trade fresh fruit and food with the fleet.', b: 'Fresh food!' }],
      [-35.5, -55.5], [-49.3, -67.2], [-52.5, -68.6], [-53.6, -71.0, { n: 'Strait of Magellan', fx: 0.2, t: 'Magellan finds the passage west in 1520 — it takes 38 days to sail through.', b: 'The strait!' }],
      [-52.7, -74.9], [-35, -86], [-14.8, -138.6, { n: 'Pacific crossing', fx: -0.3, t: 'Calm seas, but 98 days without fresh food: scurvy strikes the crew.', b: 'Scurvy!' }],
      [5, -168], [13.4, -215.5, { n: 'Guam', fx: 0.2, t: 'After crossing the Pacific, the crew finally finds food and water.', b: 'Food at last!' }],
      [10.3, -235.9, { n: 'Philippines', fx: -0.2, t: 'Magellan is killed at Mactan in 1521 by Lapu-Lapu\'s warriors.', b: 'Battle of Mactan' }],
      [4, -234], [0.8, -232.7, { n: 'Spice Islands', end: true }],
    ],
  };
  const TEAM = {
    portugal: { flag: 'portugal', color: '#1f7a5a', light: '#d9efe4', dir: 'east, around Africa' },
    spain: { flag: 'spain', color: '#a3241b', light: '#f6dcd6', dir: 'west, across the Atlantic and Pacific' },
  };
  const MOVE_RIGHT = 1.3, MOVE_WRONG = 0.5, STREAK_BONUS = 0.3;

  /* ---------------- Question bank ---------------------------------------- */
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const PLACES = [
    ['Lisbon', 38.7, -9.1], ['the Canary Islands', 28.3, -16], ['Cape Verde', 14.7, -17.5], ['the Cape of Good Hope', -34.4, 18.5], ['Malindi', -3.2, 40.1],
    ['Calicut', 11.25, 75.8], ['San Salvador', 24.05, -74.5], ['Rio de Janeiro', -22.9, -43.2], ['the Strait of Magellan', -53, -70.5], ['Guam', 13.4, 144.8],
    ['the Philippines', 10.3, 124], ['the Spice Islands', 0.8, 127.3], ['the Azores', 38.5, -28], ['Mozambique Island', -15, 40.7], ['Hispaniola', 19, -71],
  ];
  const DIR_PAIRS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 0], [7, 8], [8, 9], [9, 10], [12, 0], [3, 13], [13, 4], [1, 6], [5, 11], [0, 14], [10, 11]];
  function bearing(a, b) {
    const y = U.rad(b[1] - a[1]) * Math.cos(U.rad((a[0] + b[0]) / 2)), x = U.rad(b[0] - a[0]);
    return U.normAng(U.deg(Math.atan2(y, x)));
  }
  function geoQuestions() {
    const qs = [];
    const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    for (const [i, j] of DIR_PAIRS) {
      const A = PLACES[i], B = PLACES[j];
      const d = U.compass8(bearing([A[1], A[2]], [B[1], B[2]]));
      const k = DIRS.indexOf(d);
      const wrong = shuffle([DIRS[(k + 4) % 8], DIRS[(k + 2) % 8], DIRS[(k + 6) % 8], DIRS[(k + 3) % 8]]).slice(0, 3);
      qs.push({ cat: 'geo', q: `A ship sails from ${A[0]} to ${B[0]}. In which general direction does it sail?`, a: [d, ...wrong].map(w => w[0].toUpperCase() + w.slice(1)) });
    }
    for (const P of PLACES) qs.push({ cat: 'geo', q: `${/^the .*s$/.test(P[0]) ? 'Are' : 'Is'} ${P[0]} north or south of the Equator?`, a: [P[1] >= 0 ? 'North' : 'South', P[1] >= 0 ? 'South' : 'North', 'Exactly on it'] });
    const fixed = [
      ['Which ocean did Columbus cross?', 'The Atlantic', 'The Pacific', 'The Indian', 'The Arctic'],
      ['Which ocean lies between Africa and India?', 'The Indian Ocean', 'The Pacific Ocean', 'The Atlantic Ocean', 'The Southern Ocean'],
      ['Which is the largest ocean on Earth?', 'The Pacific', 'The Atlantic', 'The Indian', 'The Arctic'],
      ['On which continent is Calicut?', 'Asia', 'Africa', 'Europe', 'South America'],
      ['On which continent is the Cape of Good Hope?', 'Africa', 'South America', 'Asia', 'Australia'],
      ['On which continent is the Strait of Magellan?', 'South America', 'North America', 'Africa', 'Asia'],
      ['Which line of latitude is 0°?', 'The Equator', 'The Prime Meridian', 'The Tropic of Cancer', 'The Arctic Circle'],
      ['What do lines of latitude measure?', 'Distance north or south of the Equator', 'Distance east or west', 'The height of mountains', 'Ocean depth'],
      ['Which direction is exactly halfway between south and west?', 'Southwest', 'Northwest', 'Southeast', 'Northeast'],
      ['What is the opposite of northeast?', 'Southwest', 'Northwest', 'Southeast', 'South'],
      ['The Tropic of Cancer lies at about…', '23.5° north', '23.5° south', '0°', '66.5° north'],
      ['Which winds carried Columbus west across the Atlantic?', 'The northeast trade winds', 'The westerlies', 'The monsoon', 'The polar easterlies'],
      ['Which winds carried ships home to Europe from the Caribbean?', 'The westerlies', 'The trade winds', 'The doldrums', 'The monsoon'],
      ['Where are the doldrums?', 'Near the Equator', 'Near the North Pole', 'In the Mediterranean', 'Around Cape Horn'],
      ['Which strait connects the Atlantic and the Mediterranean?', 'The Strait of Gibraltar', 'The Strait of Magellan', 'The Strait of Malacca', 'The Bering Strait'],
      ['Which islands are the Spice Islands?', 'The Moluccas', 'The Canaries', 'The Azores', 'The Bahamas'],
    ];
    for (const [q, ...a] of fixed) qs.push({ cat: 'geo', q, a });
    return qs;
  }
  function termQuestions() {
    const qs = [];
    for (const [id, T] of Object.entries(TERMS)) {
      let def = T.d;
      const words = [T.t.replace(/\s*\(.*\)/, ''), ...T.t.replace(/[()]/g, '').split(/\s+|&/).filter(w => w.length >= 6)];
      for (const w of words) def = def.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '_____');
      if (def.length > 230) def = def.slice(0, def.lastIndexOf(' ', 225)) + '…';
      const pool = shuffle(Object.keys(TERMS).filter(k => k !== id && TERMS[k].cat === T.cat)).slice(0, 3).map(k => TERMS[k].t);
      if (pool.length < 3) continue;
      const lead = T.cat === 'people' ? 'Who is this?' : T.cat === 'place' ? 'Which place is this?' : 'Which term matches this meaning?';
      qs.push({ cat: 'terms', q: `${lead} “${def}”`, a: [T.t, ...pool] });
    }
    return qs;
  }
  function explorerQuestions() {
    const qs = [];
    for (const ex of EXPLORERS) for (const w of ex.waypoints) if (w.quiz) qs.push({ cat: 'explorers', q: w.quiz.q, a: w.quiz.a, x: w.quiz.x });
    for (const R of Object.values(ROYAL)) for (const q of R.questions) qs.push({ cat: 'explorers', q: q.q.replace(/\byour\b/g, 'the').replace(/\byou\b/g, 'the explorer'), a: q.a, x: q.x });
    return qs;
  }
  function buildDeck(cats, n) {
    let all = [];
    if (cats.geo) all = all.concat(geoQuestions());
    if (cats.terms) all = all.concat(termQuestions());
    if (cats.explorers) all = all.concat(explorerQuestions());
    if (!all.length) all = geoQuestions();
    // spread categories evenly
    const byCat = {};
    for (const q of shuffle(all)) (byCat[q.cat] = byCat[q.cat] || []).push(q);
    const keys = Object.keys(byCat), deck = [];
    let i = 0;
    while (deck.length < n && keys.some(k => byCat[k].length)) { const k = keys[i++ % keys.length]; if (byCat[k].length) deck.push(byCat[k].pop()); }
    return deck;
  }

  /* ---------------- Map geometry ----------------------------------------- */
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + U.rad(lat) / 2));
  let canvas, ctx, mapImg = null, W = 0, H = 0, dpr = 1, frame = null;
  let MX = 0, MY = 0, MW = 0, MH = 0;   // map rect inside canvas (css px)
  const proj = (lat, lon) => {
    let l = lon; while (l < LON0) l += 360; while (l >= LON0 + 360) l -= 360;
    const x = MX + (l - LON0) / 360 * MW;
    const y = MY + (merc(LAT_T) - merc(lat)) / (merc(LAT_T) - merc(LAT_B)) * MH;
    return [x, y];
  };
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ar = 360 / ((merc(LAT_T) - merc(LAT_B)) * 180 / Math.PI);
    MW = Math.min(W - 16, (H - 16) * ar); MH = MW / ar;
    MX = (W - MW) / 2; MY = (H - MH) / 2;
    renderMap();
    buildPaths();
  }
  function renderMap() {
    const c = U.canvas(MW * dpr, MH * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    const P = (lat, lon) => { const [x, y] = proj(lat, lon); return [x - MX, y - MY]; };
    const sea = g.createLinearGradient(0, 0, 0, MH);
    sea.addColorStop(0, '#9fc0c0'); sea.addColorStop(1, '#86aeb2');
    g.fillStyle = sea; g.fillRect(0, 0, MW, MH);
    // rhumb lines
    g.lineWidth = 0.7;
    for (const [la, lo] of [[20, -40], [-30, 70], [10, 180]]) {
      const [cx, cy] = P(la, lo);
      for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; g.strokeStyle = i % 2 ? 'rgba(155,45,32,0.12)' : 'rgba(43,29,16,0.12)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * MW, cy + Math.sin(a) * MW); g.stroke(); }
    }
    // land (each ring drawn twice so it shows on both sides of the seam)
    const land = new Path2D();
    for (const r of World.rings) {
      if (r.dup || r.hole) continue;
      if (r.area < 40) continue;
      for (const off of [0, 360]) {
        let any = false;
        for (let i = 0; i < r.n; i++) { const lo = r.lon[i] + off; if (lo >= LON0 - 5 && lo <= LON0 + 365) { any = true; break; } }
        if (!any) continue;
        for (let i = 0; i < r.n; i++) {
          const lo = r.lon[i] + off, la = U.clamp(r.lat[i], -78, 84);
          const x = (lo - LON0) / 360 * MW, y = (merc(LAT_T) - merc(la)) / (merc(LAT_T) - merc(LAT_B)) * MH;
          i ? land.lineTo(x, y) : land.moveTo(x, y);
        }
        land.closePath();
      }
    }
    g.save(); g.beginPath(); g.rect(0, 0, MW, MH); g.clip();
    g.strokeStyle = 'rgba(230,245,240,0.5)'; g.lineWidth = 6; g.lineJoin = 'round'; g.stroke(land);
    g.fillStyle = '#e6d2a0'; g.fill(land, 'evenodd');
    g.strokeStyle = '#6b4a24'; g.lineWidth = 1; g.stroke(land);
    // Tordesillas line and its anti-meridian (the Spice Islands dispute)
    g.setLineDash([8, 6]); g.lineWidth = 2; g.strokeStyle = 'rgba(155,45,32,0.75)';
    for (const lo of [-46.6, 133.4]) { const [x] = P(0, lo); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, MH); g.stroke(); }
    g.setLineDash([]);
    const fs = Math.max(10, MW / 95);
    g.font = `italic ${fs}px "IM Fell English", Georgia, serif`; g.fillStyle = 'rgba(155,45,32,0.9)'; g.textAlign = 'left';
    { const [x] = P(0, -46.6); g.fillText('Tordesillas line, 1494', x + 5, MH - 8); }
    { const [x] = P(0, 133.4); g.fillText('…and its other side', x + 5, MH - 8); }
    // labels
    g.textAlign = 'center';
    g.font = `italic ${fs * 1.15}px "IM Fell English", Georgia, serif`; g.fillStyle = 'rgba(30,70,85,0.75)';
    for (const [la, lo, t] of [[28, -45, 'Atlantic Ocean'], [-20, 75, 'Indian Ocean'], [-25, -125, 'Pacific Ocean'], [15, 165, 'Pacific Ocean']]) { const [x, y] = P(la, lo); g.fillText(t, x, y); }
    g.font = `${fs * 1.25}px "IM Fell English SC", Georgia, serif`; g.fillStyle = 'rgba(80,55,25,0.75)';
    for (const [la, lo, t] of [[12, 20, 'AFRICA'], [45, 95, 'ASIA'], [-12, -58, 'SOUTH AMERICA'], [47, -82, 'NORTH AMERICA'], [-25, 134, 'AUSTRALIA']]) { const [x, y] = P(la, lo); g.fillText(t, x, y); }
    g.restore();
    // compass rose
    Art.compassRose(g, MW * 0.9, MH * 0.8, Math.min(MW, MH) * 0.09, { labels: false });
    g.strokeStyle = '#3b2a17'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, MW - 3, MH - 3);
    mapImg = c;
  }
  let paths = {};
  function buildPaths() {
    paths = {};
    for (const [team, pts] of Object.entries(ROUTES)) {
      // densify in lat/lon space, then measure on screen (unwrapped x)
      const dense = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let s = 0; s < steps; s++) dense.push([a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps, s === 0 ? a[2] : null]);
      }
      const last = pts[pts.length - 1]; dense.push([last[0], last[1], last[2]]);
      const ux = lon => (lon - LON0) / 360 * MW; // unwrapped
      let len = 0; const cum = [0];
      for (let i = 1; i < dense.length; i++) {
        const [, ya] = proj(dense[i - 1][0], 0), [, yb] = proj(dense[i][0], 0);
        len += Math.hypot(ux(dense[i][1]) - ux(dense[i - 1][1]), yb - ya); cum.push(len);
      }
      const ms = [];
      dense.forEach((d, i) => { if (d[2] && d[2].n) ms.push(Object.assign({ at: cum[i] / len }, d[2])); });
      paths[team] = { dense, cum, len, ms };
    }
  }
  function pointAt(team, f) {
    const P = paths[team]; f = U.clamp(f, 0, 1);
    const target = f * P.len;
    let i = 1; while (i < P.cum.length - 1 && P.cum[i] < target) i++;
    const a = P.dense[i - 1], b = P.dense[i], seg = P.cum[i] - P.cum[i - 1] || 1, t = (target - P.cum[i - 1]) / seg;
    const lat = a[0] + (b[0] - a[0]) * t, lon = a[1] + (b[1] - a[1]) * t;
    const [x, y] = proj(lat, lon);
    const [x2, y2] = proj(b[0], b[1]);
    let dx = x2 - x; if (Math.abs(dx) > MW / 2) dx -= Math.sign(dx) * MW;
    return { x, y, ang: Math.atan2(y2 - y, dx) };
  }

  /* ---------------- State ------------------------------------------------ */
  let S = null;
  function newTeam(id, name) { return { id, name, pos: 0, shown: 0, right: 0, streak: 0, best: 0, graded: null, msIdx: 1, wake: [], finished: false }; }
  function start(opts) {
    const n = opts.rounds;
    S = {
      rounds: n, round: 0, unit: 1 / n, deck: buildDeck(opts.cats, n + 4), timer: opts.timer, phase: 'question', revealed: false,
      teams: { portugal: newTeam('portugal', opts.names.portugal || 'Portugal'), spain: newTeam('spain', opts.names.spain || 'Spain') },
      floats: [], cards: [], t: 0, timeLeft: opts.timer, timerOn: false, over: false,
    };
    canvas = $('raceCanvas'); ctx = canvas.getContext('2d');
    $('race').classList.remove('hidden');
    layout();
    for (const id of ['portugal', 'spain']) {
      const fc = $('rf_' + id); fc.width = 60; fc.height = 40; Art.flag(fc.getContext('2d'), TEAM[id].flag, 0, 0, 60, 40);
      $('rn_' + id).textContent = S.teams[id].name;
      $('rd_' + id).textContent = 'Sailing ' + TEAM[id].dir;
    }
    Sound.music('sail');
    nextRound();
    last = performance.now();
    if (!frame) frame = requestAnimationFrame(loop);
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = null; S = null;
    $('race').classList.add('hidden'); $('raceEnd').classList.add('hidden');
  }
  function nextRound() {
    S.round++;
    S.phase = 'question'; S.revealed = false;
    for (const t of Object.values(S.teams)) t.graded = null;
    const q = S.deck[(S.round - 1) % S.deck.length];
    S.q = q;
    S.opts = shuffle(q.a.map((t, i) => ({ t, ok: i === 0 })));
    S.timeLeft = S.timer; S.timerOn = !!S.timer;
    renderQuestion();
    updatePanels();
    Sound.play('paper');
  }
  const CAT_LABEL = { geo: 'Geography', terms: 'Key term', explorers: 'Explorers & events' };
  function renderQuestion() {
    $('rqRound').textContent = `Round ${S.round} of ${S.rounds}`;
    $('rqCat').textContent = CAT_LABEL[S.q.cat] || '';
    $('rqText').textContent = S.q.q;
    const box = $('rqOpts'); box.innerHTML = '';
    S.opts.forEach((o, i) => {
      const d = U.el('div', 'rq-opt' + (S.revealed && o.ok ? ' right' : '') + (S.revealed && !o.ok ? ' dim' : ''), `<b>${'ABCD'[i]}</b><span>${o.t}</span>`);
      box.appendChild(d);
    });
    $('rqExplain').innerHTML = S.revealed && S.q.x ? S.q.x : '';
    $('rqReveal').disabled = S.revealed;
  }
  function grade(team, ok) {
    if (!S || S.phase !== 'question') return;
    S.teams[team].graded = ok;
    Sound.play(ok ? 'correct' : 'wrong');
    updatePanels();
  }
  function reveal() {
    if (!S || S.phase !== 'question') return;
    S.revealed = true; S.timerOn = false; renderQuestion(); Sound.play('bell');
  }
  function sail() {
    if (!S || S.phase !== 'question') return;
    const T = S.teams;
    if (T.portugal.graded === null || T.spain.graded === null) return;
    if (!S.revealed) { S.revealed = true; renderQuestion(); }
    S.phase = 'sailing'; S.sailT = 0;
    for (const t of Object.values(T)) {
      let mv = t.graded ? MOVE_RIGHT : MOVE_WRONG, label;
      if (t.graded) {
        t.right++; t.streak++; t.best = Math.max(t.best, t.streak);
        label = 'Fair winds!';
        if (t.streak >= 3) { mv += STREAK_BONUS; label = `Trade-wind surge! ×${t.streak}`; }
      } else { t.streak = 0; label = U.pick(['Becalmed in the doldrums', 'Headwinds slow you down', 'A wrong turn costs time']); }
      t.from = t.pos; t.to = Math.min(1, t.pos + mv * S.unit);
      const p = pointAt(t.id, t.pos);
      floatText(p.x, p.y - 30, label, t.graded ? '#fff3b0' : '#ffd0c8');
    }
    Sound.play('gust');
    updatePanels();
  }
  function floatText(x, y, text, color) { S.floats.push({ x, y, text, color, t: 0 }); }
  function showCard(team, m) {
    const host = $('raceCards');
    const c = U.el('div', 'race-card ' + team, `<div class="rc-team">${S.teams[team].name}</div><div class="rc-name">${m.n}</div><div class="rc-text">${m.t}</div>${m.fx ? `<div class="rc-fx">${m.fx > 0 ? '▲' : '▼'} ${m.b}</div>` : ''}`);
    host.appendChild(c);
    while (host.children.length > 2) host.removeChild(host.firstChild);
    setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 600); }, 6500);
  }
  function finishSail() {
    const T = S.teams;
    S.phase = 'between';
    const done = Object.values(T).filter(t => t.pos >= 1);
    if (done.length || S.round >= S.rounds) return endRace();
    updatePanels();
  }
  function endRace() {
    S.over = true; S.phase = 'over';
    const P = S.teams.portugal, Sp = S.teams.spain;
    let winner = null;
    if (P.pos >= 1 && Sp.pos >= 1) winner = P.right === Sp.right ? null : (P.right > Sp.right ? P : Sp);
    else if (P.pos >= 1 || Sp.pos >= 1) winner = P.pos >= 1 ? P : Sp;
    else winner = Math.abs(P.pos - Sp.pos) < 0.005 ? null : (P.pos > Sp.pos ? P : Sp);
    Sound.music('victory'); Sound.play('landho');
    const end = $('raceEnd');
    $('reTitle').textContent = winner ? `${winner.name} wins the race!` : 'A dead heat!';
    $('reSub').textContent = winner ? (winner.pos >= 1 ? `${winner.name} reached the Spice Islands first.` : `The season ended with ${winner.name} closest to the Spice Islands.`) : 'Both fleets finished side by side.';
    const fc = $('reFlag'); fc.width = 150; fc.height = 100;
    if (winner) Art.flag(fc.getContext('2d'), TEAM[winner.id].flag, 0, 0, 150, 100); else fc.getContext('2d').clearRect(0, 0, 150, 100);
    const row = t => `<div class="re-team ${t.id}"><b>${t.name}</b><span>${Math.round(Math.min(1, t.pos) * 100)}% of the way</span><span>${t.right} of ${S.round} correct</span><span>Best streak: ${t.best}</span></div>`;
    $('reStats').innerHTML = row(P) + row(Sp);
    end.classList.remove('hidden');
  }
  function updatePanels() {
    if (!S) return;
    for (const t of Object.values(S.teams)) {
      $('rp_' + t.id).style.width = (Math.min(1, t.shown) * 100).toFixed(1) + '%';
      $('rpc_' + t.id).textContent = Math.round(Math.min(1, t.shown) * 100) + '%';
      $('rs_' + t.id).textContent = `${t.right} correct` + (t.streak >= 2 ? ` · 🔥 ${t.streak} in a row` : '');
      const yes = $('ry_' + t.id), no = $('rx_' + t.id);
      yes.classList.toggle('on', t.graded === true); no.classList.toggle('on', t.graded === false);
      yes.disabled = no.disabled = S.phase !== 'question';
    }
    const T = S.teams, ready = T.portugal.graded !== null && T.spain.graded !== null;
    const go = $('rqGo');
    if (S.phase === 'question') { go.textContent = ready ? '⛵ Set Sail!' : 'Mark both teams to sail'; go.disabled = !ready; }
    else if (S.phase === 'sailing') { go.textContent = 'Sailing…'; go.disabled = true; }
    else if (S.phase === 'between') { go.textContent = 'Next Question ▶'; go.disabled = false; }
    else { go.textContent = 'Race over'; go.disabled = true; }
  }

  /* ---------------- Loop & drawing --------------------------------------- */
  let last = 0;
  function loop(now) {
    frame = requestAnimationFrame(loop);
    if (!S) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    S.t += dt;
    if (S.phase === 'question' && S.timerOn && S.timeLeft > 0) {
      S.timeLeft -= dt;
      if (S.timeLeft <= 0) { S.timeLeft = 0; S.timerOn = false; Sound.play('bell'); }
    }
    $('rqTimer').textContent = S.timer ? (S.timeLeft > 0 ? Math.ceil(S.timeLeft) + 's' : 'Time!') : '';
    if (S.phase === 'sailing') {
      S.sailT += dt / 3.2;
      const k = U.easeInOut(Math.min(1, S.sailT));
      for (const t of Object.values(S.teams)) {
        const prev = t.pos;
        t.pos = t.from + (t.to - t.from) * k;
        // milestones
        const ms = paths[t.id].ms;
        while (t.msIdx < ms.length && t.pos >= ms[t.msIdx].at - 1e-6) {
          const m = ms[t.msIdx]; t.msIdx++;
          if (m.end) { t.pos = 1; t.to = 1; Sound.play('landho'); continue; }
          if (m.fx) { t.to = U.clamp(t.to + m.fx * S.unit, prev, 1); const p = pointAt(t.id, t.pos); floatText(p.x, p.y + 30, m.b, m.fx > 0 ? '#c8ffd0' : '#ffd0c8'); Sound.play(m.fx > 0 ? 'pickup' : 'thunder'); }
          showCard(t.id, m);
        }
        t.shown = t.pos;
      }
      updatePanels();
      if (S.sailT >= 1) { for (const t of Object.values(S.teams)) { t.pos = t.to; t.shown = t.pos; } finishSail(); }
    }
    draw(dt);
  }
  function draw(dt) {
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (mapImg) g.drawImage(mapImg, MX, MY, MW, MH);
    g.save(); g.beginPath(); g.rect(MX, MY, MW, MH); g.clip();
    // routes
    for (const [team, P] of Object.entries(paths)) {
      g.strokeStyle = TEAM[team].color; g.lineWidth = 3; g.setLineDash([7, 6]); g.lineCap = 'round';
      g.beginPath();
      let px = null;
      for (const d of P.dense) { const [x, y] = proj(d[0], d[1]); if (px !== null && Math.abs(x - px) > MW / 2) g.moveTo(x, y); else if (px === null) g.moveTo(x, y); else g.lineTo(x, y); px = x; }
      g.stroke(); g.setLineDash([]);
      // sailed portion
      const t = S.teams[team];
      g.strokeStyle = TEAM[team].color; g.lineWidth = 5; g.beginPath(); px = null;
      const lim = t.shown * P.len;
      for (let i = 0; i < P.dense.length; i++) {
        if (P.cum[i] > lim) break;
        const [x, y] = proj(P.dense[i][0], P.dense[i][1]);
        if (px !== null && Math.abs(x - px) > MW / 2) g.moveTo(x, y); else if (px === null) g.moveTo(x, y); else g.lineTo(x, y); px = x;
      }
      if (px !== null) { const p = pointAt(team, t.shown); if (Math.abs(p.x - px) < MW / 2) g.lineTo(p.x, p.y); }
      g.stroke();
      // milestones
      const fs = Math.max(10, MW / 110);
      for (const m of P.ms) {
        const p = pointAt(team, m.at);
        const passed = t.shown >= m.at - 1e-6;
        g.fillStyle = passed ? TEAM[team].color : '#fff8e6'; g.strokeStyle = TEAM[team].color; g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, m.end ? 9 : 5.5, 0, 7); g.fill(); g.stroke();
        if ((m.end && team === 'portugal') || (!m.end && (m.n === 'Lisbon' || m.n === 'Sanlúcar' || MW > 900))) {
          g.font = `${m.end ? 'bold ' : ''}${fs * (m.end ? 1.25 : 1)}px "IM Fell English", Georgia, serif`;
          g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,248,230,0.9)';
          const ly = m.end ? p.y + 26 : p.y + (team === 'portugal' ? -10 : 18);
          g.strokeText(m.n, p.x, ly); g.fillStyle = '#2b1d10'; g.fillText(m.n, p.x, ly);
        }
      }
    }
    // ships
    const sz = Math.max(26, MW / 34);
    for (const t of Object.values(S.teams)) {
      const p = pointAt(t.id, t.shown);
      if (S.phase === 'sailing' && Math.random() < 0.6) t.wake.push({ x: p.x - Math.cos(p.ang) * sz * 0.4, y: p.y - Math.sin(p.ang) * sz * 0.4, life: 1 });
      for (const w of t.wake) { w.life -= dt * 0.8; g.fillStyle = `rgba(255,255,255,${Math.max(0, w.life) * 0.6})`; g.beginPath(); g.arc(w.x, w.y, (1.4 - w.life) * 5, 0, 7); g.fill(); }
      t.wake = t.wake.filter(w => w.life > 0);
      g.save(); g.translate(p.x, p.y + Math.sin(S.t * 2 + (t.id === 'spain' ? 1 : 0)) * 1.5); g.rotate(p.ang + Math.PI / 2);
      g.scale(sz / 50, sz / 50);
      Art.shipTop(g, { len: 50, sailAngle: 0.5, fill: 0.85, t: S.t, pennant: TEAM[t.id].color, crew: false, square: true });
      g.restore();
      // flag marker
      g.fillStyle = TEAM[t.id].color; g.strokeStyle = '#fff'; g.lineWidth = 2;
      const fy = p.y - sz * 1.15;
      g.beginPath(); g.moveTo(p.x, p.y - sz * 0.45); g.lineTo(p.x, fy); g.stroke();
      g.beginPath(); g.roundRect ? g.roundRect(p.x - sz * 0.55, fy - sz * 0.42, sz * 1.1, sz * 0.42, 4) : g.rect(p.x - sz * 0.55, fy - sz * 0.42, sz * 1.1, sz * 0.42); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = `bold ${sz * 0.26}px "IM Fell English SC", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t.name.slice(0, 10), p.x, fy - sz * 0.2); g.textBaseline = 'alphabetic';
    }
    // floating text
    for (const f of S.floats) {
      f.t += dt;
      g.globalAlpha = Math.max(0, 1 - f.t / 2.6);
      g.font = `bold ${Math.max(14, MW / 70)}px "IM Fell English", Georgia, serif`; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(30,20,10,0.8)'; g.strokeText(f.text, f.x, f.y - f.t * 22);
      g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - f.t * 22);
      g.globalAlpha = 1;
    }
    S.floats = S.floats.filter(f => f.t < 2.6);
    g.restore();
  }

  /* ---------------- Setup & controls ------------------------------------- */
  function openSetup() {
    $('raceSetup').classList.remove('hidden');
    Sound.play('paper');
  }
  function bind(onExit) {
    $('rsStart').onclick = () => {
      Sound.init(); Sound.play('bell');
      const rounds = +document.querySelector('input[name=rsLen]:checked').value;
      const cats = { geo: $('rsGeo').checked, terms: $('rsTerms').checked, explorers: $('rsExp').checked };
      const timer = $('rsTimer').checked ? 30 : 0;
      $('raceSetup').classList.add('hidden');
      start({ rounds, cats, timer, names: { portugal: $('rsNameP').value.trim(), spain: $('rsNameS').value.trim() } });
    };
    $('rsCancel').onclick = () => { $('raceSetup').classList.add('hidden'); Sound.play('click'); };
    for (const id of ['portugal', 'spain']) {
      $('ry_' + id).onclick = () => grade(id, true);
      $('rx_' + id).onclick = () => grade(id, false);
    }
    $('rqReveal').onclick = () => reveal();
    $('rqGo').onclick = () => { if (!S) return; if (S.phase === 'question') sail(); else if (S.phase === 'between') nextRound(); };
    $('rqSkip').onclick = () => { if (S && S.phase === 'question') { S.deck.splice(S.round - 1, 1); S.round--; nextRound(); } };
    $('raceExit').onclick = () => { if (S && !S.over && !confirm('End this race and return to the map?')) return; stop(); onExit(); };
    $('reAgain').onclick = () => { $('raceEnd').classList.add('hidden'); stop(); openSetup(); };
    $('reMenu').onclick = () => { stop(); onExit(); };
    window.addEventListener('resize', () => { if (S) layout(); });
    window.addEventListener('keydown', e => {
      if (!S || $('race').classList.contains('hidden') || !$('raceEnd').classList.contains('hidden')) return;
      const k = e.key.toLowerCase();
      if (k === '1') grade('portugal', true); else if (k === '2') grade('portugal', false);
      else if (k === '9') grade('spain', true); else if (k === '0') grade('spain', false);
      else if (k === 'r') reveal();
      else if (k === 'enter' || k === ' ') { e.preventDefault(); $('rqGo').click(); }
    });
  }

  return { openSetup, bind, stop, get active() { return !!S; }, _state: () => S };
})();
