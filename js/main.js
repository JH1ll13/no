/* ==========================================================================
   Main: boot, game loop, screen flow and input
   ========================================================================== */
'use strict';

const Game = (() => {
  const $ = UI.$;
  let mode = 'loading';
  let mapCanvas, mapCache = null, mapProj = null, hoverEx = null, menuDpr = 1;
  let knowNow = null, knowAnim = null;
  let last = performance.now();
  let miniT = 0;
  let currentEx = null;
  let glyphPos = null;

  /* ---------------- Boot ----------------------------------------------- */
  function boot() {
    Save.load();
    const S = Save.data.settings;
    Sound.setVolume('music', S.music); Sound.setVolume('sfx', S.sfx); Sound.setVolume('ambience', S.ambience);
    World.init();
    const small = Math.min(screen.width, screen.height) < 700 || (navigator.deviceMemory && navigator.deviceMemory < 4);
    World.RES = small ? 1.0 : 1.25;
    World.maxTiles = small ? 36 : 56;
    // parchment texture for CSS panels
    const p = Art.parchment(512, 512, { seed: 11, scale: 0.02, stains: 4, vignette: false });
    document.documentElement.style.setProperty('--parch', `url(${p.toDataURL('image/jpeg', 0.82)})`);
    mapCanvas = $('mapCanvas');
    Sail.init($('seaCanvas'), sailHooks);
    UI.setHooks({ hover: ex => { hoverEx = ex; }, select: ex => { hoverEx = ex; } });
    UI.bindSettings();
    UI.bindCompass(b => {
      Sound.init();
      if (UI.challengeActive) { UI.challengePick(b); Sail.setDesired(b); return; }
      Sail.setDesired(b); Sound.play('click');
    });
    bindInput();
    bindButtons();
    knowNow = OldMap.knowledgeFrom(doneMap());
    // wait for fonts so the map labels render in the period typeface
    const ready = () => {
      renderMap();
      UI.hide('loading');
      UI.show('title');
      mode = 'title';
    };
    if (document.fonts && document.fonts.ready) {
      Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).then(ready);
    } else setTimeout(ready, 200);
    window.addEventListener('resize', () => { if (mode === 'menu' || mode === 'title') renderMap(); });
    requestAnimationFrame(loop);
  }
  function doneMap() { const d = {}; for (const [k, v] of Object.entries(Save.data.voyages)) if (v.done) d[k] = 1; return d; }

  /* ---------------- Old world map (menu backdrop) ----------------------- */
  function renderMap() {
    menuDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(window.innerWidth * menuDpr), h = Math.round(window.innerHeight * menuDpr);
    mapCanvas.width = w; mapCanvas.height = h;
    if (!mapCache || mapCache.width !== w || mapCache.height !== h) mapCache = U.canvas(w, h);
    const routes = [];
    for (const ex of EXPLORERS) {
      const v = Save.data.voyages[ex.id];
      if (v && v.done) routes.push({ points: [[ex.start.lat, ex.start.lon], ...ex.waypoints.map(p => [p.lat, p.lon])], color: ex.color, width: 3 * menuDpr, alpha: 0.85 });
    }
    mapProj = OldMap.render(mapCache, { know: knowNow, routes });
    drawMenuFrame(0);
  }
  function drawMenuFrame(t) {
    if (!mapCache) return;
    const g = mapCanvas.getContext('2d');
    if (mode === 'title') {
      // slow drifting camera over the old map
      const k = 1.06 + Math.sin(t * 0.12) * 0.03;
      const w = mapCache.width, h = mapCache.height;
      g.drawImage(mapCache, -(w * (k - 1)) / 2 + Math.sin(t * 0.09) * w * 0.02, -(h * (k - 1)) / 2 + Math.cos(t * 0.07) * h * 0.015, w * k, h * k);
      // little ships crossing the Ocean Sea
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.018 + i / 3) % 1;
        const x = w * (0.08 + ph * 0.84), y = h * (0.58 + i * 0.1) + Math.sin(t * 2 + i) * 2;
        Art.shipSide(g, x, y, 0.2 * menuDpr, { dir: 1, sails: i === 1 ? 'square' : 'lateen' });
      }
      return;
    }
    g.drawImage(mapCache, 0, 0);
    // the Easter egg: a golden sun glyph in the New World, once the player is Admiral
    glyphPos = null;
    if (Bonus.unlocked() && mapProj && mode === 'menu') {
      const [gx, gy] = mapProj.PW(-98.6, 19.6);
      Bonus.drawGlyph(g, gx, gy, 10 * menuDpr, t);
      glyphPos = [gx / menuDpr, gy / menuDpr];
    }
    const ex = hoverEx || UI.selected;
    if (ex && mapProj) {
      const ll = [[ex.start.lat, ex.start.lon], ...ex.waypoints.map(p => [p.lat, p.lon])];
      const pts = ll.map(([la, lo]) => mapProj.PW(lo, la));
      g.save();
      g.lineCap = 'round'; g.lineJoin = 'round';
      const path = new Path2D();
      for (const part of OldMap.splitRoute(ll)) {
        const pp = part.map(([la, lo]) => mapProj.PW(lo, la));
        path.moveTo(pp[0][0], pp[0][1]);
        for (let i = 1; i < pp.length - 1; i++) { const mx = (pp[i][0] + pp[i + 1][0]) / 2, my = (pp[i][1] + pp[i + 1][1]) / 2; path.quadraticCurveTo(pp[i][0], pp[i][1], mx, my); }
        path.lineTo(pp[pp.length - 1][0], pp[pp.length - 1][1]);
      }
      g.strokeStyle = 'rgba(255,248,225,0.85)'; g.lineWidth = 7 * menuDpr; g.stroke(path);
      g.strokeStyle = ex.color; g.lineWidth = 3.5 * menuDpr; g.setLineDash([10 * menuDpr, 8 * menuDpr]); g.lineDashOffset = -t * 30; g.stroke(path); g.setLineDash([]);
      pts.forEach(([x, y], i) => {
        g.fillStyle = i === 0 ? '#fff6dd' : ex.color; g.strokeStyle = '#2b1d10'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, (i === 0 ? 5 : 4) * menuDpr, 0, 7); g.fill(); g.stroke();
      });
      // little ship sailing the route
      const k = (t * 0.06) % 1, seg = k * (pts.length - 1), si = Math.floor(seg), f = seg - si;
      const a = pts[si], b = pts[Math.min(si + 1, pts.length - 1)];
      const jump = Math.abs(ll[si][1] - ll[Math.min(si + 1, ll.length - 1)][1]) > 180;
      const sx = jump ? a[0] : a[0] + (b[0] - a[0]) * f, sy = jump ? a[1] : a[1] + (b[1] - a[1]) * f;
      Art.shipSide(g, sx, sy + Math.sin(t * 3) * 1.5, 0.22 * menuDpr, { dir: b[0] >= a[0] ? 1 : -1, sails: 'lateen' });
      // label
      const [lx, ly] = pts[pts.length - 1];
      g.font = `600 ${15 * menuDpr}px "IM Fell English SC", Georgia, serif`; g.textAlign = 'center';
      g.lineWidth = 4 * menuDpr; g.strokeStyle = 'rgba(255,248,225,0.9)'; g.strokeText(ex.waypoints[ex.waypoints.length - 1].name, lx, ly - 12 * menuDpr);
      g.fillStyle = '#2b1d10'; g.fillText(ex.waypoints[ex.waypoints.length - 1].name, lx, ly - 12 * menuDpr);
      g.restore();
    }
  }
  function animateKnowledge(from, to, done) {
    knowAnim = { from, to, t: 0, done };
  }

  /* ---------------- Menu flow ------------------------------------------ */
  function toMenu(opts = {}) {
    mode = 'menu';
    Sail.stop();
    UI.hide('hud'); UI.hide('seaCanvas'); $('seaCanvas').classList.add('hidden');
    mapCanvas.classList.remove('hidden');
    UI.show('menu');
    UI.hide('dossier');
    UI.refreshMenuStats();
    UI.buildCards(ex => UI.openDossier(ex));
    Sound.music('title');
    Sound.ambience({ on: false });
    const target = OldMap.knowledgeFrom(doneMap());
    const legend = $('mapLegend');
    const doneCount = Object.keys(doneMap()).length;
    legend.innerHTML = doneCount === 0
      ? '<b>The World in 1490</b><br>This is how Europeans pictured the world before the great voyages: Europe well known, Africa and Asia stretched and guessed at, an unknown southern land, mythical islands in the Ocean Sea—and no Americas at all.<br><br><i>Choose an explorer below. Each voyage you complete will redraw the map!</i>'
      : `<b>Your Map of the World</b><br>${doneCount} of 4 voyages completed. Each one has corrected Europe’s picture of the world.`;
    if (doneCount === 4) legend.innerHTML = '<b>You have sailed the whole world!</b><br>All four voyages are complete and the map is redrawn. Sail them again for more stars, finish your Codex, or challenge the class to a race.' + (Save.data.admiral ? '<br><br><i>✦ A golden glyph glimmers in the New World… what could it be?</i>' : '');
    $('btnHonors').classList.toggle('hidden', !Save.data.finaleSeen);
    const allDone = doneCount === 4 && !Save.data.finaleSeen;
    if (opts.reveal) {
      animateKnowledge(knowNow, target, () => {
        UI.toast('🗺 The map of the world has been redrawn with your discoveries!', 'good');
        if (allDone) setTimeout(() => playFinale(), 1800);
      });
      setTimeout(() => Sound.play('unlock'), 300);
    } else {
      knowNow = target; renderMap();
      if (allDone) setTimeout(() => playFinale(), 600);
    }
  }
  function playFinale() {
    if (mode !== 'menu' || Finale.playing) return;
    mode = 'finale';
    UI.hide('dossier');
    Finale.play(() => toMenu());
  }

  function startVoyage(ex, useCheckpoint) {
    currentEx = ex;
    UI.hide('dossier'); UI.hide('menu');
    const go = () => {
      mode = 'sailing';
      mapCanvas.classList.add('hidden');
      $('seaCanvas').classList.remove('hidden');
      Sail.resize();
      const cp = useCheckpoint ? Save.data.checkpoint : null;
      if (!useCheckpoint && Save.data.checkpoint && Save.data.checkpoint.explorer === ex.id) { Save.data.checkpoint = null; Save.write(); }
      // starting terms
      Sail.start(ex, cp);
      UI.hudShow(Sail.state);
      Sound.music('sail');
      UI.objective(Sail.objective());
      if (!cp) {
        UI.banner(ex.short + '’s Voyage', `${ex.years} · Sailing for ${ex.nation}`);
        setTimeout(() => { UI.unlockTerm('caravel'); }, 2600);
        setTimeout(() => UI.toast('Tip: hold two arrow keys (like ↓ and ←) to sail SOUTHWEST. Or tap the compass rose.', 'info', 6500), 4000);
        setTimeout(() => { UI.unlockTerm('ageofexploration'); }, 8000);
      } else UI.toast('Voyage resumed from your last landmark.', 'good');
      Save.data.voyages[ex.id] = Object.assign({ done: false, stars: 0, plays: 0 }, Save.data.voyages[ex.id] || {});
      Save.data.voyages[ex.id].plays++;
      Save.write();
    };
    if (useCheckpoint) go(); else UI.briefing(ex, go);
  }

  /* ---------------- Sailing hooks -------------------------------------- */
  const sailHooks = {
    hud: info => UI.hud(info),
    toast: (m, k) => UI.toast(m, k),
    unlock: (term, silent) => { if (Sail.state && TERMS[term]) { const fresh = UI.unlockTerm(term, silent); if (fresh) Sail.addDucats(5); } },
    landHo: () => { UI.banner('Land Ho!', 'The lookout spots land on the horizon'); Sound.play('landho'); },
    arrive: (wp, st, done) => {
      UI.journal(wp, st, done);
    },
    nextLeg: (obj, st, quiet) => {
      if (!obj) return;
      const legIdx = st.wpIndex;
      const challenge = !quiet && st.ex.waypoints[legIdx].kind !== 'nav' && st.ex.waypoints[legIdx - 1].kind !== 'nav' && legIdx % 2 === 1 && obj.dist > 500 && !st.ex.waypoints[legIdx - 1].nextObj && !st.ex.waypoints[legIdx].obj;
      if (challenge) {
        Sail.pause(true);
        Sail.state.hideTarget = true;
        UI.directionChallenge(obj.name, obj.bearing, (ok, target) => {
          Sail.state.hideTarget = false;
          Sail.pause(false);
          if (ok === true) { Sound.play('correct'); UI.toast(`🧭 Correct! ${obj.name} lies to the <b>${target.toUpperCase()}</b>. +15 ducats`, 'good'); Sail.quizResult(true); }
          else if (ok === false) { Sound.play('wrong'); UI.toast(`Not quite—${obj.name} lies to the <b>${target.toUpperCase()}</b>. Check the gold star on your compass.`, 'warn'); }
          UI.objective(obj);
        });
      } else UI.objective(obj);
    },
    forcedEnd: () => { UI.toast('The storm has passed. Where is the coast?', 'info'); UI.objective(Sail.objective()); },
    complete: st => finishVoyage(st),
    fail: (reason, st) => {
      mode = 'over';
      void st;
      setTimeout(() => UI.gameOver(reason, () => { startVoyage(currentEx, !!Save.data.checkpoint && Save.data.checkpoint.explorer === currentEx.id); }, () => toMenu()), 600);
    },
  };

  function finishVoyage(st) {
    mode = 'results';
    const ex = st.ex;
    Sound.music('victory');
    UI.banner('Voyage Complete!', ex.waypoints[ex.waypoints.length - 1].name);
    setTimeout(() => {
      UI.hide('hud');
      // the captain must first report to the monarch who paid for the voyage
      UI.royalReport(st, report => awardVoyage(st, report));
    }, 1800);
  }
  function awardVoyage(st, report) {
    const ex = st.ex;
    const S = Save.data;
    const asked = st.quizTotal + report.total, correct = st.quizRight + report.right;
    const quizFrac = asked ? correct / asked : 1;
    let stars = 1;
    if (quizFrac >= 0.7) stars++;
    if (st.scrolls.length >= Math.ceil(ex.scrolls.length * 0.7)) stars++;
    const prev = S.voyages[ex.id] || {};
    const firstTime = !prev.done;
    const ducats = st.ducats + report.reward + 100 + stars * 30;
    const xp = st.xp + report.right * 10 + 150 + stars * 50 + (firstTime ? 100 : 0);
    const oldRank = UI.rankFor(S.xp).r.t;
    S.ducats += ducats; S.xp += xp;
    const newRank = UI.rankFor(S.xp).r.t;
    S.voyages[ex.id] = Object.assign(prev, { done: true, stars: Math.max(prev.stars || 0, stars), report: Math.max(prev.report || 0, report.right) });
    S.checkpoint = null;
    Save.write();
    Sound.music('victory');
    UI.results(st, { stars, ducats, xp, quizFrac, report, rankUp: newRank !== oldRank ? newRank : null }, () => toMenu({ reveal: firstTime }));
    if (newRank !== oldRank) setTimeout(() => Sound.play('rankup'), 1400);
  }

  /* ---------------- Loop ----------------------------------------------- */
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    if (mode === 'sailing' || mode === 'over' || mode === 'results') {
      Sail.update(dt);
      Sail.render();
      miniT -= dt;
      if (miniT <= 0 && Sail.state) { miniT = 0.25; Sail.drawChart($('miniMap')); }
    } else if ((mode === 'menu' || mode === 'title') && !Race.active) {
      if (knowAnim) {
        knowAnim.t += dt / 3.2;
        const k = U.easeInOut(Math.min(1, knowAnim.t));
        const mix = {};
        for (const key of Object.keys(knowAnim.to)) mix[key] = U.lerp(knowAnim.from[key], knowAnim.to[key], k);
        knowNow = mix;
        if (!loop._rt || t - loop._rt > 0.08 || knowAnim.t >= 1) { loop._rt = t; renderMap(); }
        if (knowAnim.t >= 1) { const d = knowAnim.done; knowAnim = null; d && d(); }
      }
      drawMenuFrame(t);
    }
    requestAnimationFrame(loop);
  }

  /* ---------------- Input ---------------------------------------------- */
  function modalOpen() { return ['journal', 'codex', 'shipyard', 'chart', 'pause', 'royal', 'results', 'gameover', 'card', 'briefing'].some(UI.isShown); }
  function bindInput() {
    window.addEventListener('keydown', e => {
      Sound.init();
      const code = e.code;
      if (mode === 'title' && (code === 'Enter' || code === 'Space')) { $('btnBegin').click(); return; }
      if (code === 'KeyM') { const m = Sound.toggleMute(); UI.toast(m ? '🔇 Sound muted' : '🔊 Sound on', 'info', 1500); return; }
      if (mode !== 'sailing') {
        if (code === 'Escape') closeTopModal();
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
      if (modalOpen()) { if (code === 'Escape' || code === 'KeyC' && UI.isShown('chart')) closeTopModal(); return; }
      if (code === 'Space') { if (!e.repeat) toggleReef(); return; }
      if (code === 'KeyC') { openChart(); return; }
      if (code === 'KeyP' || code === 'Escape') { openPause(); return; }
      if (code === 'Equal' || code === 'NumpadAdd') { Sail.zoom(1.12); return; }
      if (code === 'Minus' || code === 'NumpadSubtract') { Sail.zoom(1 / 1.12); return; }
      if (UI.challengeActive) {
        const map = { ArrowUp: 0, KeyW: 0, ArrowRight: 90, KeyD: 90, ArrowDown: 180, KeyS: 180, ArrowLeft: 270, KeyA: 270 };
        if (code in map) { pendingKeys.add(code); clearTimeout(pendingT); pendingT = setTimeout(() => resolveKeyChallenge(), 180); }
        return;
      }
      Sail.keyDown(code);
    });
    window.addEventListener('keyup', e => Sail.keyUp(e.code));
    window.addEventListener('blur', () => Sail.clearKeys());
    const sea = $('seaCanvas');
    sea.addEventListener('pointerdown', e => { Sound.init(); if (UI.challengeActive) return; sea.setPointerCapture(e.pointerId); Sail.pointerDown(e.clientX, e.clientY); });
    sea.addEventListener('pointermove', e => Sail.pointerMove(e.clientX, e.clientY));
    sea.addEventListener('pointerup', () => Sail.pointerUp());
    sea.addEventListener('pointercancel', () => Sail.pointerUp());
    sea.addEventListener('wheel', e => { e.preventDefault(); Sail.zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'sailing' && !modalOpen()) openPause(); });
  }
  const pendingKeys = new Set(); let pendingT = 0;
  function resolveKeyChallenge() {
    let x = 0, y = 0;
    for (const k of pendingKeys) { if (k === 'ArrowUp' || k === 'KeyW') y++; if (k === 'ArrowDown' || k === 'KeyS') y--; if (k === 'ArrowRight' || k === 'KeyD') x++; if (k === 'ArrowLeft' || k === 'KeyA') x--; }
    pendingKeys.clear();
    if (!x && !y) return;
    const b = U.normAng(U.deg(Math.atan2(x, y)));
    UI.challengePick(b); Sail.setDesired(b);
  }
  function toggleReef() {
    const r = Sail.toggleReef();
    $('btnReef').classList.toggle('on', !!r);
    $('btnReef').innerHTML = r ? '⛵<small>Reefed</small>' : '⛵<small>Full sail</small>';
    UI.toast(r ? 'Sails reefed: slower, but safer in storms.' : 'Full sail! Maximum speed.', 'info', 1800);
  }
  function openChart() {
    Sail.pause(true);
    UI.show('chart');
    Sound.play('paper');
    Sail.drawChart($('chartCanvas'), { full: true });
  }
  function openPause(fromMenu) {
    if (!fromMenu) Sail.pause(true);
    $('pauseTitle').textContent = fromMenu ? 'Settings' : 'Paused';
    $('btnResume').textContent = fromMenu ? 'Close' : 'Resume';
    $('btnQuit').classList.toggle('hidden', !!fromMenu);
    $('btnReset').classList.toggle('hidden', !fromMenu);
    UI.show('pause');
    Sound.play('paper');
  }
  function closeTopModal() {
    for (const id of ['card', 'chart', 'pause', 'codex', 'shipyard']) {
      if (UI.isShown(id)) {
        UI.hide(id);
        if (mode === 'sailing' && !modalOpen()) Sail.pause(false);
        if (id === 'shipyard' || id === 'codex') UI.refreshMenuStats();
        return;
      }
    }
    if (UI.isShown('dossier')) { UI.hide('dossier'); document.querySelectorAll('.ex-card').forEach(c => c.classList.remove('sel')); }
  }

  /* ---------------- Buttons -------------------------------------------- */
  function bindButtons() {
    $('btnBegin').onclick = () => {
      Sound.init(); Sound.play('bell');
      UI.hide('title');
      toMenu();
    };
    $('btnCodex').onclick = () => { Sound.play('click'); UI.openCodex(); };
    $('btnRace').onclick = () => { Sound.init(); Sound.play('click'); Race.openSetup(); };
    Race.bind(() => { toMenu(); });
    Finale.bind();
    $('btnHonors').onclick = () => { Sound.play('click'); playFinale(); };
    Bonus.bind();
    const overGlyph = e => glyphPos && Math.hypot(e.clientX - glyphPos[0], e.clientY - glyphPos[1]) < 24;
    mapCanvas.addEventListener('pointermove', e => { mapCanvas.style.cursor = overGlyph(e) ? 'pointer' : ''; });
    mapCanvas.addEventListener('pointerdown', e => {
      if (mode !== 'menu' || !overGlyph(e)) return;
      Sound.init(); Sound.play('unlock');
      mode = 'bonus'; UI.hide('dossier'); UI.hide('menu');
      Bonus.open(() => toMenu());
    });
    $('btnShipyard').onclick = () => { Sound.play('click'); UI.openShipyard(); };
    $('btnSettings').onclick = () => { Sound.play('click'); openPause(true); };
    $('btnSetSail').onclick = () => { Sound.play('click'); startVoyage(UI.selected, false); };
    $('btnContinue').onclick = () => { Sound.play('click'); startVoyage(UI.selected, true); };
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
      Sound.play('click');
      const id = b.dataset.close;
      UI.hide(id);
      if (id === 'dossier') document.querySelectorAll('.ex-card').forEach(c => c.classList.remove('sel'));
      if (id === 'codex' || id === 'shipyard') { UI.refreshMenuStats(); if (mode === 'menu') UI.buildCards(ex => UI.openDossier(ex)); }
      if (mode === 'sailing' && !modalOpen()) Sail.pause(false);
    }));
    $('btnReef').onclick = () => toggleReef();
    $('btnChart').onclick = () => { Sound.play('click'); openChart(); };
    $('btnPause').onclick = () => { Sound.play('click'); openPause(); };
    $('miniMap').onclick = () => openChart();
    $('btnResume').onclick = () => { Sound.play('click'); UI.hide('pause'); if (mode === 'sailing') Sail.pause(false); };
    $('btnQuit').onclick = () => {
      Sound.play('click'); UI.hide('pause');
      UI.toast('Your progress is saved at the last landmark you reached.', 'info');
      toMenu();
    };
    $('btnReset').onclick = () => {
      if (confirm('Erase all progress, ducats, upgrades and codex cards? This cannot be undone.')) {
        Save.reset(); UI.hide('pause'); knowNow = OldMap.knowledgeFrom({}); toMenu();
      }
    };
  }

  return { boot, get mode() { return mode; } };
})();

window.addEventListener('DOMContentLoaded', () => Game.boot());
