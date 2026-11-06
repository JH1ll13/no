/* ==========================================================================
   UI: screens, HUD, journal events, quizzes, codex, shipyard, results
   ========================================================================== */
'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);
  const show = id => $(id).classList.remove('hidden');
  const hide = id => $(id).classList.add('hidden');
  const isShown = id => !$(id).classList.contains('hidden');
  const CAT_NAMES = { ship: 'Ships', nav: 'Navigation', wind: 'Winds', place: 'Places', people: 'People', idea: 'Big Ideas' };
  const CAPTAIN_NAMES = { dias: 'Bartolomeu Dias', columbus: 'Christopher Columbus', gama: 'Vasco da Gama', magellan: 'Ferdinand Magellan', elcano: 'Juan Sebastián Elcano' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------------- Ranks ---------------------------------------------- */
  function rankFor(xp) {
    let r = RANKS[0], next = null;
    for (let i = 0; i < RANKS.length; i++) { if (xp >= RANKS[i].xp) { r = RANKS[i]; next = RANKS[i + 1] || null; } }
    return { r, next, frac: next ? (xp - r.xp) / (next.xp - r.xp) : 1 };
  }
  function refreshMenuStats() {
    const S = Save.data;
    const rk = rankFor(S.xp);
    $('rankName').textContent = rk.r.t;
    $('xpFill').style.width = (rk.frac * 100).toFixed(0) + '%';
    $('menuDucats').textContent = S.ducats;
    $('codexCount').textContent = `${Object.keys(S.codex).length}/${Object.keys(TERMS).length}`;
  }

  /* ---------------- Explorer cards / dossier ---------------------------- */
  let selected = null;
  function buildCards(onSelect) {
    const wrap = $('explorerCards');
    wrap.innerHTML = '';
    EXPLORERS.forEach((ex, i) => {
      const v = Save.data.voyages[ex.id] || {};
      const card = U.el('div', 'ex-card parchment');
      card.style.animationDelay = (i * 0.08) + 's';
      const c = U.canvas(220, 220);
      Art.portrait(c.getContext('2d'), ex.id, 220);
      card.appendChild(c);
      card.appendChild(U.el('div', 'nm', ex.name));
      card.appendChild(U.el('div', 'yr', ex.years));
      const fr = U.el('div', 'flagrow');
      const fc = U.canvas(30, 20); Art.flag(fc.getContext('2d'), ex.flag, 0, 0, 30, 20); fc.style.width = '24px'; fc.style.height = '16px';
      fr.appendChild(fc); fr.appendChild(U.el('span', '', 'Sailing for ' + ex.nation));
      card.appendChild(fr);
      card.appendChild(U.el('div', 'stars', starsHTML(v.stars || 0)));
      const cp = Save.data.checkpoint;
      if (cp && cp.explorer === ex.id) card.appendChild(U.el('div', 'ribbon cont', 'In progress'));
      else if (v.done) card.appendChild(U.el('div', 'ribbon', 'Completed'));
      card.addEventListener('click', () => { Sound.play('paper'); onSelect(ex); });
      card.addEventListener('mouseenter', () => { Sound.play('hover'); hooks.hover && hooks.hover(ex); });
      card.addEventListener('mouseleave', () => { hooks.hover && hooks.hover(null); });
      card.dataset.id = ex.id;
      wrap.appendChild(card);
    });
  }
  function starsHTML(n, total = 3) { let s = ''; for (let i = 0; i < total; i++) s += i < n ? '★' : '<span class="off">★</span>'; return s; }
  function openDossier(ex) {
    selected = ex;
    document.querySelectorAll('.ex-card').forEach(c => c.classList.toggle('sel', c.dataset.id === ex.id));
    const v = Save.data.voyages[ex.id] || {};
    const pc = $('dossierPortrait'); const g = pc.getContext('2d'); g.clearRect(0, 0, 180, 180); Art.portrait(g, ex.id, 180);
    $('dName').textContent = ex.name;
    $('dAlt').textContent = ex.alt;
    $('dTag').textContent = ex.tagline;
    $('dStars').innerHTML = starsHTML(v.stars || 0);
    $('dFacts').innerHTML = `
      <dt>Voyage</dt><dd>${ex.years}</dd>
      <dt>Sponsor</dt><dd>${ex.sponsor}</dd>
      <dt>Ships</dt><dd>${ex.ships}</dd>
      <dt>Crew</dt><dd>${ex.crew}</dd>
      <dt>Mission</dt><dd>${ex.goal}</dd>
      <dt>Stops</dt><dd>${ex.waypoints.filter(w => w.kind !== 'nav').length} landmarks · ${ex.scrolls.length} codex scrolls to find</dd>`;
    const acc = $('dAcc');
    acc.innerHTML = ex.accomplishments.map(a => `<li>${a}</li>`).join('');
    acc.classList.toggle('locked', !v.done);
    if (!v.done) acc.title = 'Complete the voyage to reveal';
    const cp = Save.data.checkpoint;
    $('btnContinue').classList.toggle('hidden', !(cp && cp.explorer === ex.id));
    $('btnSetSail').textContent = v.done ? '⛵ Sail Again' : (cp && cp.explorer === ex.id ? '⛵ Start Over' : '⛵ Set Sail');
    show('dossier');
    hooks.select && hooks.select(ex);
  }

  /* ---------------- Briefing letter ------------------------------------ */
  function briefing(ex, onGo) {
    $('letterBody').innerHTML = ex.letter;
    $('letterPlace').textContent = '— ' + ex.place;
    show('briefing');
    Sound.play('paper');
    $('btnHoist').onclick = () => { Sound.play('click'); hide('briefing'); onGo(); };
  }

  /* ---------------- HUD ------------------------------------------------ */
  let lastCaptain = null, hudInfoCache = null, compassCtx = null;
  function hudShow(st) {
    show('hud');
    lastCaptain = null;
    $('btnReef').classList.remove('on');
    $('btnReef').innerHTML = '⛵<small>Full sail</small>';
    void st;
  }
  function setBar(id, v) {
    const b = $(id); b.style.width = (U.clamp(v, 0, 1) * 100).toFixed(1) + '%'; b.classList.toggle('low', v < 0.22);
  }
  function hud(info) {
    hudInfoCache = info;
    if (info.captain !== lastCaptain) {
      lastCaptain = info.captain;
      const c = $('hudPortrait'), g = c.getContext('2d'); g.clearRect(0, 0, 84, 84); Art.portrait(g, info.captain, 84);
      $('hudCaptain').textContent = CAPTAIN_NAMES[info.captain] || '';
    }
    $('hudShip').textContent = `Flagship: ${info.flagship} · Fleet of ${info.fleet}`;
    const d = info.date;
    $('hudDate').textContent = `Day ${info.day} · ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    setBar('barFood', info.food); setBar('barWater', info.water); setBar('barHealth', info.health); setBar('barMorale', info.morale); setBar('barHull', info.hull);
    $('hudLat').textContent = U.fmtLat(info.lat);
    $('hudLon').textContent = '≈ ' + U.fmtLon(info.lon);
    $('hudKnots').textContent = info.knots.toFixed(1) + ' knots' + (info.boost ? ' 💨 fair winds!' : '');
    $('hudHeading').textContent = U.compass16Short(info.bearing) + ' (' + Math.round(info.bearing) + '°)';
    $('hudScrolls').textContent = `${info.scrolls}/${info.scrollsTotal}`;
    $('hudDucats').textContent = ' ' + info.ducats;
    $('windName').textContent = '🌬 ' + (info.windName || 'Wind');
    $('windDir').textContent = `From the ${U.compass8(info.wind.b + 180)} · ${info.wind.s > 0.75 ? 'strong' : info.wind.s > 0.4 ? 'steady' : 'light'}`;
    $('posSail').textContent = info.pos;
    if (info.wp && !challengeActive) {
      $('objDist').textContent = `${Math.round(info.leagues)} leagues ${U.compass8(info.wpBearing)}`;
    }
    drawCompass();
  }
  function drawCompass() {
    const info = hudInfoCache; if (!info) return;
    const c = $('compassPad');
    const D = 2, S = 230;
    if (c.width !== S * D) { c.width = S * D; c.height = S * D; }
    const g = compassCtx || (compassCtx = c.getContext('2d'));
    g.setTransform(D, 0, 0, D, 0, 0);
    g.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, R = 88;
    // outer ring
    const rg = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
    rg.addColorStop(0, 'rgba(234,216,174,0.95)'); rg.addColorStop(1, 'rgba(190,160,110,0.95)');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R * 1.22, 0, 7); g.fill();
    g.strokeStyle = '#3b2a17'; g.lineWidth = 2; g.stroke();
    // desired heading highlight wedge
    const db = U.rad(info.desired - 90);
    g.fillStyle = 'rgba(255,214,100,0.45)';
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 1.2, db - 0.3, db + 0.3); g.closePath(); g.fill();
    Art.compassRose(g, cx, cy, R * 0.92, { fleur: false, labels: false, ringFill: 'rgba(243,230,196,0.0)' });
    // 8 labels
    const L = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    L.forEach((t, i) => {
      const a = U.rad(i * 45 - 90), r = R * 1.08;
      const on = Math.abs(U.angDiff(info.desired, i * 45)) < 1;
      g.font = `${t.length === 1 ? 'bold 17px' : 'bold 12px'} "IM Fell English SC", Georgia, serif`;
      g.fillStyle = on ? '#9b2d20' : '#2b1d10';
      g.fillText(t, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    });
    // target marker
    if (info.wp && !challengeActive) {
      const a = U.rad(info.wpBearing - 90);
      g.fillStyle = '#ffd25a'; g.strokeStyle = '#3b2a17'; g.lineWidth = 1.2;
      const tx = cx + Math.cos(a) * R * 0.95, ty = cy + Math.sin(a) * R * 0.95;
      g.beginPath();
      for (let k = 0; k < 10; k++) { const aa = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 4 : 9; g.lineTo(tx + Math.cos(aa) * rr, ty + Math.sin(aa) * rr); }
      g.closePath(); g.fill(); g.stroke();
    }
    // wind arrow (blowing toward)
    {
      const a = U.rad(info.wind.b - 90);
      const ox = cx - Math.cos(a) * R * 0.78, oy = cy - Math.sin(a) * R * 0.78;
      const ex = cx - Math.cos(a) * R * 0.25, ey = cy - Math.sin(a) * R * 0.25;
      g.strokeStyle = '#2a6f9a'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = '#2a6f9a';
      g.beginPath(); g.moveTo(ex + Math.cos(a) * 9, ey + Math.sin(a) * 9); g.lineTo(ex + Math.cos(a + 2.4) * 9, ey + Math.sin(a + 2.4) * 9); g.lineTo(ex + Math.cos(a - 2.4) * 9, ey + Math.sin(a - 2.4) * 9); g.closePath(); g.fill();
      g.font = 'italic 11px "IM Fell English", Georgia, serif'; g.fillStyle = '#1e5274';
      g.fillText('wind', ox - Math.cos(a) * 10, oy - Math.sin(a) * 10);
    }
    // ship heading needle
    {
      const a = U.rad(info.bearing - 90);
      g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2);
      g.fillStyle = '#9b2d20'; g.strokeStyle = '#2b1d10'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -R * 0.78); g.lineTo(8, 0); g.lineTo(0, 10); g.lineTo(-8, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f3e6c4'; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); g.stroke();
      g.restore();
    }
  }
  function bindCompass(onPick) {
    const c = $('compassPad');
    const pick = (e) => {
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      if (Math.hypot(x, y) < r.width * 0.08) return;
      const b = U.normAng(U.deg(Math.atan2(x, -y)));
      const snapped = Math.round(b / 45) * 45 % 360;
      onPick(snapped);
    };
    c.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); c.setPointerCapture(e.pointerId); pick(e); });
    c.addEventListener('pointermove', e => { if (e.buttons) pick(e); });
  }
  function journeyDots() {
    const st = Sail.state; if (!st) return;
    const n = st.ex.waypoints.length;
    let h = '';
    for (let i = 0; i < n; i++) {
      if (i) h += '<b></b>';
      const cls = (i < st.wpIndex ? 'done' : i === st.wpIndex ? 'cur' : '') + (i === n - 1 ? ' fin' : '');
      h += `<i class="${cls}" title="${st.ex.waypoints[i].name}"></i>`;
    }
    $('objDots').innerHTML = h;
  }
  function objective(o) {
    journeyDots();
    if (!o) return;
    $('objText').textContent = o.text;
    $('objHint').textContent = o.hint || '';
    $('objDist').textContent = '';
  }

  /* ---------------- Toasts & banners ----------------------------------- */
  function toast(html, kind = 'info', ms = 4800) {
    const box = $('toasts');
    while (box.children.length > 3) box.removeChild(box.firstChild);
    const t = U.el('div', 'toast ' + kind, html);
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, ms);
    return t;
  }
  function banner(text, sub) {
    const b = $('banner');
    b.classList.add('hidden'); void b.offsetWidth;
    b.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    b.classList.remove('hidden');
    clearTimeout(banner._t); banner._t = setTimeout(() => b.classList.add('hidden'), 2700);
  }
  function unlockTerm(id, silent) {
    const T = TERMS[id]; if (!T) return false;
    const fresh = !Save.data.codex[id];
    if (fresh) { Save.data.codex[id] = 'new'; Save.write(); }
    if (silent) return fresh;
    if (fresh) {
      Sound.play('unlock');
      const t = toast('', 'unlock-toast', 6000);
      const c = U.canvas(80, 80); Art.catIcon(c.getContext('2d'), T.cat, 40, 40, 64, '#6b2a18');
      t.appendChild(c);
      const d = U.el('div', '', `<div class="uk">NEW KEY TERM · ${CAT_NAMES[T.cat].toUpperCase()}</div><div class="ut">${T.t}</div>`);
      t.appendChild(d);
      t.style.pointerEvents = 'auto'; t.style.cursor = 'pointer';
      t.onclick = () => showCard(id, true);
    } else {
      toast(`📜 Scroll found: <b>${T.t}</b> (already in your Codex) · +10 ducats`, 'good');
    }
    return fresh;
  }

  /* ---------------- Term cards ----------------------------------------- */
  function termCardHTML(id, label) {
    const T = TERMS[id];
    return `<div class="k">${label || CAT_NAMES[T.cat]}</div><div class="t">${T.t}</div><div class="d">${T.d}</div><div class="f">✦ ${T.f}</div>`;
  }
  function addCatIcon(el, cat) {
    const c = U.canvas(80, 80); Art.catIcon(c.getContext('2d'), cat, 40, 40, 64, '#6b2a18'); el.appendChild(c);
  }
  let cardResumeSail = false;
  function showCard(id, fromGame) {
    const el = $('cardBig');
    el.innerHTML = termCardHTML(id) + '<div class="j-actions"><button class="btn" id="cardClose">Close</button></div>';
    addCatIcon(el, TERMS[id].cat);
    if (Save.data.codex[id] === 'new') { Save.data.codex[id] = true; Save.write(); }
    show('card');
    Sound.play('paper');
    cardResumeSail = fromGame && Sail.running && !Sail.paused;
    if (cardResumeSail) Sail.pause(true);
    $('cardClose').onclick = () => { hide('card'); if (cardResumeSail) Sail.pause(false); Sound.play('click'); if (isShown('codex')) renderCodex(); };
  }

  /* ---------------- Journal (waypoint events) -------------------------- */
  function journal(wp, st, done) {
    const ex = st.ex;
    $('jDate').textContent = wp.date;
    $('jTitle').textContent = wp.title;
    $('jPlace').textContent = `${wp.name} · ${U.fmtLat(wp.lat)}, ${U.fmtLon(wp.lon)}`;
    const sc = $('jScene');
    Art.scene(sc, Object.assign({ sails: ex.id === 'gama' || ex.id === 'magellan' ? 'square' : 'lateen' }, wp.scene || {}), wp.id.length * 31 + ex.id.length);
    $('jText').innerHTML = wp.text;
    const termsBox = $('jTerms'); termsBox.innerHTML = '';
    for (const id of wp.terms || []) {
      const fresh = unlockTerm(id, true);
      const card = U.el('div', 'term-card', termCardHTML(id, (fresh ? '★ NEW KEY TERM · ' : 'KEY TERM · ') + CAT_NAMES[TERMS[id].cat].toUpperCase()));
      addCatIcon(card, TERMS[id].cat);
      termsBox.appendChild(card);
      if (fresh) Save.data.codex[id] = true;
    }
    Save.write();
    const qbox = $('jQuiz'); qbox.innerHTML = ''; qbox.classList.add('hidden');
    const next = $('jNext');
    next.disabled = false; next.textContent = wp.kind === 'final' ? 'Complete the Voyage' : 'Continue the Voyage';
    if (wp.quiz) {
      qbox.classList.remove('hidden');
      next.disabled = true;
      const q = wp.quiz;
      const opts = q.a.map((t, i) => ({ t, ok: i === 0 }));
      for (let i = opts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [opts[i], opts[j]] = [opts[j], opts[i]]; }
      qbox.innerHTML = `<div class="qk">🧭 THE PILOT ASKS…</div><div class="qq">${q.q}</div><div class="opts"></div><div class="qx"></div>`;
      const ob = qbox.querySelector('.opts');
      opts.forEach(o => {
        const b = U.el('button', 'opt', o.t);
        b.onclick = () => {
          ob.querySelectorAll('.opt').forEach(x => { x.disabled = true; });
          const right = [...ob.children].find((_, k) => opts[k].ok);
          right.classList.add('right');
          if (!o.ok) b.classList.add('wrong');
          Sail.quizResult(o.ok);
          Sound.play(o.ok ? 'correct' : 'wrong');
          qbox.querySelector('.qx').innerHTML = (o.ok ? '<b>Correct!</b> +15 ducats. ' : '<b>Not quite.</b> ') + q.x;
          next.disabled = false;
        };
        ob.appendChild(b);
      });
    } else if (wp.decision) {
      qbox.classList.remove('hidden');
      next.disabled = true;
      const dq = wp.decision;
      qbox.innerHTML = `<div class="qk">⚖ CAPTAIN’S DECISION</div><div class="qq">${dq.q}</div><div class="opts"></div><div class="qx"></div>`;
      const ob = qbox.querySelector('.opts');
      dq.a.forEach(o => {
        const b = U.el('button', 'opt', o.t);
        b.onclick = () => {
          ob.querySelectorAll('.opt').forEach(x => { x.disabled = true; });
          b.classList.add('right');
          Sound.play('paper');
          qbox.querySelector('.qx').innerHTML = '<b>What really happened:</b> ' + o.r;
          next.disabled = false;
        };
        ob.appendChild(b);
      });
    }
    show('journal');
    $('journal').scrollTop = 0;
    next.onclick = () => { Sound.play('click'); hide('journal'); done(); };
  }

  /* ---------------- Pilot's direction challenge ------------------------ */
  let challengeActive = false, challengeCb = null;
  function directionChallenge(name, bearing, cb) {
    challengeActive = true;
    drawCompass();
    const box = U.el('div', 'challenge parchment-dark', `<div class="ck">🧭 PILOT’S CHALLENGE</div>Which direction should you sail to reach <b>${name}</b>? <br>Tap the correct direction on the <b>compass rose</b>.<div class="skip">Skip</div>`);
    box.id = 'challengeBox';
    $('hud').appendChild(box);
    $('objText').textContent = `Which way to ${name}?`;
    $('objDist').textContent = '';
    $('objHint').textContent = 'Use the compass rose!';
    challengeCb = (picked) => {
      const target = U.compass8(bearing);
      const ok = U.compass8(picked) === target || Math.abs(U.angDiff(picked, bearing)) <= 25;
      box.remove(); challengeActive = false; challengeCb = null;
      cb(ok, target, picked);
    };
    box.querySelector('.skip').onclick = () => { box.remove(); challengeActive = false; challengeCb = null; cb(null, U.compass8(bearing)); };
  }

  /* ---------------- Codex ---------------------------------------------- */
  let codexTab = 'all';
  function openCodex() {
    show('codex');
    Sound.play('paper');
    const tabs = $('codexTabs');
    tabs.innerHTML = '';
    for (const [k, nm] of [['all', 'All'], ...Object.entries(CAT_NAMES)]) {
      const b = U.el('button', 'tab' + (k === codexTab ? ' on' : ''), nm);
      b.onclick = () => { codexTab = k; openCodex(); };
      tabs.appendChild(b);
    }
    renderCodex();
  }
  function renderCodex() {
    const grid = $('codexGrid'); grid.innerHTML = '';
    for (const [id, T] of Object.entries(TERMS)) {
      if (codexTab !== 'all' && T.cat !== codexTab) continue;
      const have = Save.data.codex[id];
      const c = U.el('div', 'cc' + (have ? '' : ' locked') + (have === 'new' ? ' new' : ''), `<div class="c">${CAT_NAMES[T.cat]}</div><div class="t">${have ? T.t : '? ? ?'}</div>`);
      if (have) { addCatIcon(c, T.cat); c.onclick = () => showCard(id, false); }
      grid.appendChild(c);
    }
  }

  /* ---------------- Shipyard ------------------------------------------- */
  const UP_ICONS = { sail: '⛵', hull: '🪵', barrel: '🛢', astrolabe: '🧭', crew: '👥' };
  function openShipyard() {
    show('shipyard'); Sound.play('paper');
    renderShipyard();
  }
  function renderShipyard() {
    $('yardDucats').textContent = Save.data.ducats;
    const list = $('yardList'); list.innerHTML = '';
    for (const u of UPGRADES) {
      const lv = Save.data.upgrades[u.id] || 0;
      const cost = u.costs[lv];
      const el = U.el('div', 'yard', `<div class="yi">${UP_ICONS[u.icon]}</div><div><div class="yn">${u.name}</div><div class="lv">${starsHTML(lv, 3).replace(/★/g, '◆')}</div><div class="yd">${u.desc}</div></div>`);
      const b = U.el('button', 'btn small', cost ? `Upgrade — ${cost} ducats` : 'Fully upgraded');
      b.disabled = !cost || Save.data.ducats < cost;
      b.onclick = () => {
        if (Save.data.ducats < cost) return;
        Save.data.ducats -= cost; Save.data.upgrades[u.id] = lv + 1; Save.write();
        Sound.play('coin'); renderShipyard(); refreshMenuStats();
      };
      el.appendChild(b);
      list.appendChild(el);
    }
  }

  /* ---------------- Results -------------------------------------------- */
  function results(st, rewards, onDone) {
    const ex = st.ex;
    $('resTitle').textContent = `${ex.name}, ${ex.years}`;
    $('resStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < rewards.stars ? '' : 'off'}" style="animation-delay:${0.3 + i * 0.35}s">★</span>`).join('');
    const rc = $('resChart');
    Sail.drawChart(rc, { full: true });
    const q = st.quizTotal ? Math.round(st.quizRight / st.quizTotal * 100) : 100;
    $('resGrid').innerHTML = `
      <div>Days at sea<b>${Math.floor(st.day) + 1}</b></div>
      <div>Pilot’s questions<b>${st.quizRight}/${st.quizTotal}</b></div>
      <div>Codex scrolls<b>${st.scrolls.length}/${ex.scrolls.length}</b></div>
      <div>Ducats earned<b>+${rewards.ducats}</b></div>
      <div>Experience<b>+${rewards.xp}</b></div>`;
    $('resEpilogue').innerHTML = `<b>What happened next:</b> ${ex.epilogue}`;
    const stars = [`★ Voyage completed`, `${rewards.stars >= 2 ? '★' : '☆'} Answer 70% of the pilot’s questions correctly (you: ${q}%)`, `${rewards.stars >= 3 ? '★' : '☆'} Find 70% of the codex scrolls (you: ${st.scrolls.length}/${ex.scrolls.length})`];
    $('resRank').innerHTML = stars.join('<br>') + (rewards.rankUp ? `<br><br>🎖 <b>Promoted to ${rewards.rankUp}!</b>` : '');
    show('results');
    $('btnResDone').onclick = () => { Sound.play('click'); hide('results'); onDone(); };
  }

  /* ---------------- Game over ------------------------------------------ */
  function gameOver(reason, onRetry, onMenu) {
    const R = {
      shipwreck: ['Shipwrecked!', 'Your hull was smashed by storms, reefs and rocks. Remember to <b>reef your sails</b> (Space) in storms and steer clear of foaming rocks.', { sky: 'storm', land: 'cliffs', items: ['wreck', 'waves', 'lightning'] }],
      scurvy: ['Lost to Hunger and Scurvy', 'Your crew could not survive so long without fresh food and water. Sail through <b>schools of fish</b> and <b>rain squalls</b>, and make landfall at ports.', { sky: 'dusk', land: 'none', items: ['ships1', 'calm'] }],
      mutiny: ['Mutiny!', 'The frightened crew seized the ship and turned for home. Keep morale up by reaching landmarks, collecting <b>signs of land</b>, and answering the pilot’s questions.', { sky: 'night', land: 'none', items: ['ships1', 'waves'] }],
    }[reason];
    $('goTitle').textContent = R[0];
    $('goText').innerHTML = R[1];
    Art.scene($('goScene'), R[2], 99);
    show('gameover');
    Sound.play('fail');
    $('btnRetry').onclick = () => { Sound.play('click'); hide('gameover'); onRetry(); };
    $('btnGoMenu').onclick = () => { Sound.play('click'); hide('gameover'); onMenu(); };
  }

  /* ---------------- Settings ------------------------------------------- */
  function bindSettings() {
    const S = Save.data.settings;
    const bindR = (id, key) => {
      const el = $(id); el.value = S[key];
      el.oninput = () => { S[key] = +el.value; Sound.setVolume(key, +el.value); Save.write(); };
    };
    bindR('volMusic', 'music'); bindR('volSfx', 'sfx'); bindR('volAmb', 'ambience');
  }

  let hooks = {};
  return {
    $, show, hide, isShown, setHooks(h) { hooks = h; },
    refreshMenuStats, buildCards, openDossier, briefing, hudShow, hud, objective, bindCompass,
    toast, banner, unlockTerm, showCard, journal, directionChallenge,
    get challengeActive() { return challengeActive; }, challengePick(b) { if (challengeCb) challengeCb(b); },
    openCodex, openShipyard, results, gameOver, bindSettings, rankFor, starsHTML, get selected() { return selected; },
    CAPTAIN_NAMES,
  };
})();
