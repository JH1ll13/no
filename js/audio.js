/* ==========================================================================
   Audio: procedural Renaissance-style music, ocean ambience and sound effects
   All sound is synthesized live with the Web Audio API (no audio files).
   ========================================================================== */
'use strict';

const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, ambBus, reverb, comp;
  let ready = false;
  const vol = { music: 0.6, sfx: 0.8, ambience: 0.7 };
  let muted = false;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const n = s => { const m = s.match(/^([A-G][#b]?)(-?\d)$/); return NOTE[m[1]] + (+m[2] + 1) * 12; };

  /* ---------------- Setup ---------------------------------------------- */
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master); ambBus.connect(master);
    // reverb
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(2.6, 2.2);
    const rvGain = ctx.createGain(); rvGain.gain.value = 0.32;
    reverb.connect(rvGain); rvGain.connect(master);
    applyVolumes();
    buildAmbience();
    ready = true;
    scheduler();
  }
  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(muted ? 0 : vol.music * 0.55, t, 0.1);
    sfxBus.gain.setTargetAtTime(muted ? 0 : vol.sfx * 0.9, t, 0.05);
    ambBus.gain.setTargetAtTime(muted ? 0 : vol.ambience * 0.8, t, 0.2);
  }

  let noiseBuf = null, brownBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function getBrown() {
    if (brownBuf) return brownBuf;
    const len = ctx.sampleRate * 4; brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = brownBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    return brownBuf;
  }
  function noiseSrc(brown) { const s = ctx.createBufferSource(); s.buffer = brown ? getBrown() : getNoise(); s.loop = true; return s; }

  /* ---------------- Instruments ---------------------------------------- */
  const ksCache = new Map();
  function ksBuffer(midi, bright = 0.5) {
    const key = midi + ':' + bright;
    if (ksCache.has(key)) return ksCache.get(key);
    const sr = ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * 2.2), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    const buf = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev * (1 - bright) + w * bright; buf[i] = prev; }
    const decay = 0.996 - Math.max(0, (midi - 60)) * 0.00025;
    let idx = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const v = buf[idx];
      const nv = (v + last) * 0.5 * decay;
      last = v; buf[idx] = nv; d[i] = v;
      idx = (idx + 1) % N;
    }
    ksCache.set(key, b);
    return b;
  }
  function out(dest, wet = 0.4) {
    const g = ctx.createGain();
    g.connect(dest);
    if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(reverb); }
    return g;
  }
  function lute(midi, t, vel = 0.5, dur = 1.6, dest = _musicBusProxy()) {
    const s = ctx.createBufferSource(); s.buffer = ksBuffer(midi, 0.55);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 0.4;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 5; body.Q.value = 1;
    const g = out(dest, 0.35); g.gain.setValueAtTime(vel * 0.55, t); g.gain.setTargetAtTime(0, t + dur, 0.12);
    s.connect(f); f.connect(body); body.connect(g);
    s.start(t); s.stop(t + dur + 0.6);
  }
  function recorder(midi, t, dur, vel = 0.4, dest = _musicBusProxy()) {
    const f = mtof(midi);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.4, dur * 0.6));
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const nz = noiseSrc(); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 2;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(vel * 0.06, t); ng.gain.exponentialRampToValueAtTime(vel * 0.012, t + 0.12);
    const g = out(dest, 0.5);
    const a = 0.035, r = 0.08;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.32, t + a);
    g.gain.setValueAtTime(vel * 0.28, Math.max(t + a, t + dur - r)); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o.connect(g); o2.connect(g2); g2.connect(g); nz.connect(nf); nf.connect(ng); ng.connect(g);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(t + dur + 0.1); });
    nz.start(t, Math.random()); nz.stop(t + dur + 0.1);
  }
  function drone(midis, t, dur, vel = 0.12, dest = _musicBusProxy()) {
    const g = out(dest, 0.4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.4);
    g.gain.setValueAtTime(vel, t + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 1.5; lp.connect(g);
    for (const m of midis) for (const det of [-6, 5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + dur + 0.2);
    }
  }
  function drum(t, vel = 0.5, kind = 'tabor', dest = _musicBusProxy()) {
    const g = out(dest, 0.18);
    if (kind === 'tabor' || kind === 'low') {
      const o = ctx.createOscillator(); o.type = 'sine';
      const f0 = kind === 'low' ? 90 : 160;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.18);
      const og = ctx.createGain(); og.gain.setValueAtTime(vel * 0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.4);
    }
    const nz = noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = kind === 'tick' ? 3500 : kind === 'low' ? 500 : 1200; bp.Q.value = kind === 'tick' ? 2 : 0.9;
    const ng = ctx.createGain(); const d = kind === 'tick' ? 0.05 : 0.14;
    ng.gain.setValueAtTime(vel * (kind === 'tick' ? 0.35 : 0.5), t); ng.gain.exponentialRampToValueAtTime(0.001, t + d);
    nz.connect(bp); bp.connect(ng); ng.connect(g); nz.start(t, Math.random()); nz.stop(t + d + 0.05);
  }
  function bell(midi, t, vel = 0.4, dest = sfxBus, len = 2.8) {
    const f = mtof(midi), g = out(dest, 0.5);
    g.gain.value = 1;
    const partials = [[1, 1], [2.0, 0.6], [2.76, 0.4], [5.4, 0.25], [8.93, 0.12], [0.5, 0.35]];
    for (const [r, a] of partials) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
      const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(vel * a * 0.35, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0008, t + len * (1.2 - r * 0.08));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 0.2);
    }
  }
  function brass(midi, t, dur, vel = 0.35, dest = _musicBusProxy()) {
    const f = mtof(midi), g = out(dest, 0.45);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.linearRampToValueAtTime(f * 5, t + 0.06); lp.frequency.setTargetAtTime(f * 3, t + 0.1, 0.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.42, t + 0.04); g.gain.setTargetAtTime(vel * 0.3, t + 0.06, 0.1);
    g.gain.setValueAtTime(vel * 0.3, t + Math.max(0.05, dur - 0.06)); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    lp.connect(g);
    for (const det of [-4, 4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
  }

  /* ---------------- Music ---------------------------------------------- */
  const CH = {   // chord tones (midi pitch classes as note names, root first)
    Dm: ['D', 'F', 'A'], A: ['A', 'C#', 'E'], C: ['C', 'E', 'G'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], D: ['D', 'F#', 'A'],
    Em: ['E', 'G', 'B'], Am: ['A', 'C', 'E'], Bm: ['B', 'D', 'F#'], Bb: ['Bb', 'D', 'F'], Gm: ['G', 'Bb', 'D'], E: ['E', 'G#', 'B'],
  };
  const pc = name => NOTE[name];
  const nearestPc = (pcs, target) => { let best = target, bd = 99; for (let m = target - 7; m <= target + 7; m++) if (pcs.includes(((m % 12) + 12) % 12) && Math.abs(m - target) < bd) { bd = Math.abs(m - target); best = m; } return best; };
  function chordMidis(ch, base) { return CH[ch].map(x => { let m = pc(x) + base; while (m < base) m += 12; return m; }); }

  // La Folia theme (title)
  const FOLIA_CH = ['Dm', 'A', 'Dm', 'C', 'F', 'C', 'Dm', 'A', 'Dm', 'A', 'Dm', 'C', 'F', 'C', 'Dm', 'A'];
  const FOLIA_MEL = [
    [['D5', 1], ['F5', 1.5], ['E5', .5]], [['E5', 1], ['C#5', 1.5], ['A4', .5]], [['D5', 1], ['F5', 1.5], ['A5', .5]], [['G5', 1], ['E5', 1.5], ['C5', .5]],
    [['F5', 1], ['A5', 1.5], ['G5', .5]], [['E5', 1], ['G5', 1.5], ['E5', .5]], [['F5', 1], ['D5', 1], ['E5', 1]], [['C#5', 2], ['A4', 1]],
    [['D5', 1], ['F5', 1.5], ['E5', .5]], [['E5', 1], ['A5', 1.5], ['G5', .5]], [['F5', 1], ['D5', 1.5], ['F5', .5]], [['E5', 1], ['C5', 1.5], ['E5', .5]],
    [['A5', 1], ['F5', 1.5], ['A5', .5]], [['G5', 1], ['E5', 1.5], ['C5', .5]], [['F5', 1], ['E5', 1], ['D5', 1]], [['E5', 1], ['C#5', 1], ['A4', 1]],
  ];

  const SONGS = {
    title: {
      bpm: 76, beats: 3,
      bar(i, t, B) {
        const bi = i % 16, loop = Math.floor(i / 16) % 3, ch = FOLIA_CH[bi];
        const cm = chordMidis(ch, 50);
        // bass + lute arpeggio
        lute(cm[0] - 12, t, 0.55, B * 3);
        const arp = [cm[0], cm[1], cm[2], cm[0] + 12, cm[2], cm[1]];
        arp.forEach((m, k) => lute(m, t + k * B * 0.5, 0.28 + (k === 0 ? 0.1 : 0), B * 1.2));
        if (bi % 4 === 0) drone([n('D2'), n('A2')], t, B * 12, 0.07);
        if (loop > 0) drum(t, 0.25, 'tabor');
        if (loop === 2) drum(t + B * 2, 0.15, 'tick');
        let tt = t;
        for (const [p, d] of FOLIA_MEL[bi]) {
          const m = n(p) - (loop === 1 ? 12 : 0);
          if (loop === 1) lute(m, tt, 0.45, d * B + 0.3);
          else recorder(m, tt, d * B * 0.95, 0.42);
          tt += d * B;
        }
      },
    },
    sail: makeGalliard(),
    calm: {
      bpm: 64, beats: 4,
      chords: ['Dm', 'C', 'Dm', 'Am', 'F', 'C', 'Dm', 'Dm'],
      bar(i, t, B) {
        const ch = this.chords[i % 8], cm = chordMidis(ch, 50);
        lute(cm[0] - 12, t, 0.4, B * 4);
        [0, 1, 2, 1, 0, 2, 1, 2].forEach((k, j) => { if (Math.random() < 0.85) lute(cm[k] + (j > 3 ? 12 : 0), t + j * B * 0.5, 0.18, B * 2); });
        if (i % 2 === 0) {
          const r = U.rng(i * 17 + 3);
          const top = chordMidis(ch, 69);
          recorder(top[(r() * 3) | 0], t + B, B * 2.6, 0.26);
          if (r() < 0.6) recorder(top[(r() * 3) | 0] + (r() < 0.5 ? 2 : -1), t + B * 3.6, B * 0.4, 0.22);
        }
        if (i % 4 === 0) drone([n('D2'), n('A2')], t, B * 16, 0.05);
      },
    },
    storm: {
      bpm: 132, beats: 4,
      chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'A'],
      bar(i, t, B) {
        const ch = this.chords[i % 8], cm = chordMidis(ch, 38);
        drone([cm[0], cm[0] + 7], t, B * 4, 0.1);
        for (let k = 0; k < 8; k++) lute(cm[k % 3] + 12, t + k * B * 0.5, 0.2 + (k % 4 === 0 ? 0.15 : 0), B * 0.6);
        drum(t, 0.7, 'low'); drum(t + B * 1.5, 0.4, 'low'); drum(t + B * 2, 0.6, 'low');
        for (let k = 0; k < 4; k++) drum(t + B * (3 + k * 0.25), 0.15 + k * 0.08, 'tabor');
        if (i % 2 === 1) brass(cm[0] + 24, t, B * 1.2, 0.3), brass(cm[2] + 24, t + B * 2, B * 1.5, 0.28);
      },
    },
    grand: {
      bpm: 76, beats: 4,
      chords: ['D', 'G', 'D', 'A', 'Bm', 'G', 'A', 'D'],
      mel: [['D5', 'F#5', 'A5', 'D6'], ['B5', 'A5', 'G5', 'B5'], ['A5', 'F#5', 'D6', 'A5'], ['E5', 'A5', 'C#6', 'E6'], ['D6', 'B5', 'F#5', 'B5'], ['G5', 'B5', 'D6', 'G6'], ['E6', 'C#6', 'A5', 'C#6'], ['D6', 'A5', 'F#5', 'D6']],
      bar(i, t, B) {
        const bi = i % 8, ch = this.chords[bi], cm = chordMidis(ch, 50);
        drone([cm[0] - 12, cm[0] - 5], t, B * 4, 0.07);
        lute(cm[0] - 12, t, 0.55, B * 4);
        for (let k = 0; k < 8; k++) lute(cm[k % 3] + (k > 3 ? 12 : 0), t + k * B * 0.5, 0.24, B);
        drum(t, 0.7, 'low'); drum(t + B * 2, 0.45, 'low');
        if (bi === 7) for (let k = 0; k < 6; k++) drum(t + B * (3 + k / 6), 0.25 + k * 0.08, 'tabor');
        this.mel[bi].forEach((p, k) => brass(n(p) - 12, t + k * B, B * 0.95, 0.3));
        if (i % 16 >= 8) this.mel[bi].forEach((p, k) => recorder(n(p), t + k * B, B * 0.9, 0.3));
        bell(cm[0] + 24, t, 0.25, _musicBusProxy(), 2.5);
      },
    },
    victory: {
      bpm: 92, beats: 4,
      chords: ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D'],
      mel: [['F#5', 'A5', 'D6', 'A5'], ['B5', 'G5', 'D5', 'G5'], ['A5', 'F#5', 'D5', 'F#5'], ['E5', 'C#5', 'A4', 'E5'], ['F#5', 'A5', 'D6', 'F#6'], ['G6', 'D6', 'B5', 'G5'], ['A5', 'E5', 'C#6', 'E6'], ['D6', 'A5', 'F#5', 'D5']],
      bar(i, t, B) {
        const bi = i % 8, ch = this.chords[bi], cm = chordMidis(ch, 50);
        lute(cm[0] - 12, t, 0.5, B * 4);
        for (let k = 0; k < 8; k++) lute(cm[k % 3] + (k > 3 ? 12 : 0), t + k * B * 0.5, 0.25, B);
        drum(t, 0.4, 'tabor'); drum(t + B * 2, 0.3, 'tabor'); drum(t + B * 3.5, 0.2, 'tick');
        this.mel[bi].forEach((p, k) => (i % 16 < 8 ? brass(n(p) - 12, t + k * B, B * 0.9, 0.24) : recorder(n(p), t + k * B, B * 0.9, 0.36)));
        if (bi === 0) drone([n('D2'), n('A2')], t, B * 32, 0.06);
      },
    },
  };

  function makeGalliard() {
    // 6/8, two sections, melody generated from motifs (varies every loop)
    const A = ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G'];
    const Bs = ['Em', 'D', 'C', 'D', 'Em', 'D', 'C', 'G'];
    const RH = [[2, 1, 2, 1], [3, 3], [1, 1, 1, 2, 1], [2, 1, 1, 1, 1], [3, 2, 1], [2, 1, 3]];
    const scale = [0, 2, 4, 5, 7, 9, 11]; // G major relative to G
    let phrase = null, phraseKey = -1;
    function genPhrase(seed, chords) {
      const r = U.rng(seed);
      const motif = [RH[(r() * RH.length) | 0], RH[(r() * RH.length) | 0]];
      const bars = [];
      let cur = n('D5');
      for (let b = 0; b < 8; b++) {
        const rh = (b % 4 === 3) ? [3, 3] : motif[b % 2];
        const tones = CH[chords[b]].map(pc);
        const notes = [];
        let pos = 0;
        rh.forEach((d, k) => {
          let m;
          if (pos === 0 || pos === 3) m = nearestPc(tones, cur + (r() < 0.5 ? 2 : -2));
          else {
            const step = r() < 0.5 ? 1 : -1;
            const gpc = ((cur - n('G4')) % 12 + 12) % 12;
            let si = scale.indexOf(gpc); if (si < 0) si = 0;
            si += step; const oct = Math.floor(si / 7); si = ((si % 7) + 7) % 7;
            m = cur - gpc + scale[si] + oct * 12;
          }
          m = U.clamp(m, n('G4'), n('A5'));
          if (b === 7 && k === rh.length - 1) m = nearestPc([pc('G')], cur);
          notes.push([m, d]); cur = m; pos += d;
        });
        bars.push(notes);
      }
      return bars;
    }
    return {
      bpm: 112, beats: 3, // dotted-quarter feel: bar = 6 eighths; B is an eighth*2
      bar(i, t, B) {
        const E = B / 2;      // eighth
        const sec = Math.floor(i / 8) % 2, chords = sec ? Bs : A, bi = i % 8, loop = Math.floor(i / 16);
        const key = Math.floor(i / 8);
        if (phraseKey !== key) { phrase = genPhrase(key * 7919 + 11, chords); phraseKey = key; }
        const cm = chordMidis(chords[bi], 50);
        lute(cm[0] - 12, t, 0.5, E * 6);
        [0, 2, 1, 0, 2, 1].forEach((k, j) => lute(cm[k] + (j === 3 ? 12 : 0), t + j * E, j === 0 || j === 3 ? 0.3 : 0.2, E * 2));
        drum(t, 0.4, 'tabor'); drum(t + E * 3, 0.28, 'tabor');
        if (loop % 2 === 1) { drum(t + E * 2, 0.12, 'tick'); drum(t + E * 5, 0.12, 'tick'); }
        if (bi % 4 === 0) drone([n(sec ? 'E2' : 'G2'), n(sec ? 'B2' : 'D3')], t, E * 24, 0.05);
        let tt = t;
        const useLute = loop % 3 === 2;
        for (const [m, d] of phrase[bi]) {
          if (useLute) lute(m, tt, 0.42, d * E + 0.2); else recorder(m + (loop % 3 === 1 ? 12 : 0), tt, d * E * 0.92, loop % 3 === 1 ? 0.3 : 0.4);
          tt += d * E;
        }
      },
    };
  }

  let current = null, currentGainNode = null, nextBarT = 0, barIdx = 0, timer = null;
  let pendingSong = null;
  function scheduler() {
    if (timer) return;
    timer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (pendingSong !== null) {
        startSong(pendingSong); pendingSong = null;
      }
      if (!current) return;
      const song = SONGS[current];
      const B = 60 / song.bpm;
      while (nextBarT < now + 0.35) {
        if (nextBarT < now) nextBarT = now + 0.05;
        song.bar(barIdx, nextBarT, B);
        nextBarT += B * song.beats;
        barIdx++;
      }
    }, 60);
  }
  function startSong(name) {
    const now = ctx.currentTime;
    if (currentGainNode) {
      const old = currentGainNode;
      old.gain.setTargetAtTime(0, now, 0.6);
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* already gone */ } }, 4000);
    }
    current = name; barIdx = 0;
    if (!name) { currentGainNode = null; return; }
    // route this song through its own gain for crossfading
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 1.2);
    g.connect(musicBus);
    currentGainNode = g;
    nextBarT = now + 0.3;
  }
  // instruments write to musicBus by default; redirect through the song gain:
  const _musicBusProxy = () => currentGainNode || musicBus;

  function music(name) {
    if (!ctx) { pendingSong = name; return; }
    if (name === current) return;
    pendingSong = name;
  }

  /* ---------------- Ambience ------------------------------------------- */
  const amb = {};
  function buildAmbience() {
    // ocean swell
    const s1 = noiseSrc(true), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g1 = ctx.createGain(); g1.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = 0.22;
    lfo.connect(lg); lg.connect(g1.gain);
    s1.connect(lp); lp.connect(g1); g1.connect(ambBus); s1.start(); lfo.start();
    const base1 = ctx.createConstantSource ? ctx.createConstantSource() : null;
    if (base1) { base1.offset.value = 0; base1.connect(g1.gain); base1.start(); }
    amb.ocean = { gain: g1, base: base1 };
    // wash / foam
    const s2 = noiseSrc(), hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1800; hp.Q.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.17; const lg2 = ctx.createGain(); lg2.gain.value = 0.04;
    lfo2.connect(lg2); lg2.connect(g2.gain);
    s2.connect(hp); hp.connect(g2); g2.connect(ambBus); s2.start(); lfo2.start();
    amb.wash = { gain: g2 };
    // wind
    const s3 = noiseSrc(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 1.2;
    const g3 = ctx.createGain(); g3.gain.value = 0;
    s3.connect(bp); bp.connect(g3); g3.connect(ambBus); s3.start();
    amb.wind = { gain: g3, filter: bp };
    // rain
    const s4 = noiseSrc(), hp4 = ctx.createBiquadFilter(); hp4.type = 'highpass'; hp4.frequency.value = 2500;
    const g4 = ctx.createGain(); g4.gain.value = 0;
    s4.connect(hp4); hp4.connect(g4); g4.connect(ambBus); s4.start();
    amb.rain = { gain: g4 };
  }
  let ambState = { on: false, wind: 0, rain: 0, nearLand: false, sailing: false };
  let creakT = 0, gullT = 0;
  function ambience(st) {
    if (!ready) return;
    ambState = Object.assign(ambState, st);
    const t = ctx.currentTime;
    const on = ambState.on ? 1 : 0;
    if (amb.ocean.base) amb.ocean.base.offset.setTargetAtTime(on * 0.32, t, 0.5);
    amb.wash.gain.gain.setTargetAtTime(on * 0.06, t, 0.5);
    amb.wind.gain.gain.setTargetAtTime(on * (0.04 + ambState.wind * 0.16), t, 0.4);
    amb.wind.filter.frequency.setTargetAtTime(380 + ambState.wind * 900 + Math.sin(t * 0.7) * 120, t, 0.5);
    amb.rain.gain.gain.setTargetAtTime(on * ambState.rain * 0.22, t, 0.6);
    if (on && ambState.sailing && t > creakT) { creak(); creakT = t + 3 + Math.random() * 6; }
    if (on && ambState.nearLand && t > gullT) { gull(); gullT = t + 4 + Math.random() * 9; }
  }

  /* ---------------- Sound effects -------------------------------------- */
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0008, t + a + d); }
  function creak() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 120 + Math.random() * 90;
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.75 + Math.random() * 0.2), t + 0.5);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 500; bp.Q.value = 9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 0.55);
    // amplitude flutter for a wood-grain sound
    const fl = ctx.createOscillator(); fl.frequency.value = 28 + Math.random() * 20; const fg = ctx.createGain(); fg.gain.value = 0.03;
    fl.connect(fg); fg.connect(g.gain);
    o.connect(bp); bp.connect(g); g.connect(ambBus); o.start(t); o.stop(t + 0.6); fl.start(t); fl.stop(t + 0.6);
  }
  function gull() {
    let t = ctx.currentTime + 0.05;
    const calls = 2 + (Math.random() * 3 | 0);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const dest = ctx.createGain(); dest.gain.value = 0.5;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; dest.connect(pan); pan.connect(ambBus); } else dest.connect(ambBus);
    for (let k = 0; k < calls; k++) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      const b = 1300 + Math.random() * 300;
      o.frequency.setValueAtTime(b, t); o.frequency.linearRampToValueAtTime(b * 1.35, t + 0.07); o.frequency.linearRampToValueAtTime(b * 0.8, t + 0.24);
      const g = ctx.createGain(); env(g, t, 0.02, 0.07, 0.24);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      o.connect(hp); hp.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35);
      t += 0.22 + Math.random() * 0.12;
    }
  }
  function thunder(dist = 0.5) {
    const t = ctx.currentTime + dist * 0.8;
    const s = noiseSrc(true), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 2.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.1 * (1 - dist * 0.5), t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
    s.connect(lp); lp.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 2); s.stop(t + 3.6);
  }
  function noiseHit(t, freq, q, peak, dur, type = 'bandpass', dest = sfxBus) {
    const s = noiseSrc(), f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.1);
    return f;
  }
  function tone(m, t, dur, type = 'sine', peak = 0.2, dest = sfxBus) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m);
    const g = ctx.createGain(); env(g, t, 0.008, peak, dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  const SFX = {
    click() { const t = ctx.currentTime; noiseHit(t, 2500, 3, 0.25, 0.04); tone(n('A5'), t, 0.06, 'triangle', 0.08); },
    hover() { const t = ctx.currentTime; noiseHit(t, 4000, 4, 0.06, 0.03); },
    paper() {
      const t = ctx.currentTime;
      for (let k = 0; k < 5; k++) noiseHit(t + k * 0.035 + Math.random() * 0.02, 3000 + Math.random() * 3000, 1, 0.12, 0.06, 'highpass');
    },
    coin() { const t = ctx.currentTime; tone(n('E6'), t, 0.12, 'square', 0.05); tone(n('B6'), t + 0.07, 0.35, 'square', 0.05); bell(n('B6'), t + 0.07, 0.2, sfxBus, 0.8); },
    pickup() { const t = ctx.currentTime; [n('D6'), n('F#6'), n('A6'), n('D7')].forEach((m, k) => bell(m, t + k * 0.06, 0.22, sfxBus, 1.2)); },
    food() { const t = ctx.currentTime; noiseHit(t, 900, 1, 0.3, 0.25, 'lowpass'); [n('G5'), n('B5'), n('D6')].forEach((m, k) => tone(m, t + k * 0.07, 0.18, 'triangle', 0.1)); },
    water() { const t = ctx.currentTime; for (let k = 0; k < 4; k++) { const f = noiseHit(t + k * 0.06, 600 + k * 250, 6, 0.18, 0.12); f.frequency.exponentialRampToValueAtTime(2000, t + k * 0.06 + 0.1); } },
    splash() { const t = ctx.currentTime; const f = noiseHit(t, 2000, 0.7, 0.45, 0.5, 'lowpass'); f.frequency.exponentialRampToValueAtTime(300, t + 0.5); },
    aground() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
      const g = ctx.createGain(); env(g, t, 0.01, 0.8, 0.5); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.6);
      for (let k = 0; k < 6; k++) noiseHit(t + k * 0.03, 300 + Math.random() * 900, 4, 0.25, 0.08);
    },
    damage() { const t = ctx.currentTime; for (let k = 0; k < 4; k++) noiseHit(t + k * 0.04, 500 + Math.random() * 700, 5, 0.2, 0.09); },
    bell() { const t = ctx.currentTime; bell(n('A5'), t, 0.55); bell(n('A5'), t + 0.45, 0.45); },
    landho() {
      const t = ctx.currentTime;
      const d = _musicBusProxy();
      [['D5', 0, .25], ['A5', .25, .25], ['D6', .5, .6], ['C#6', 1.1, .2], ['D6', 1.3, 1.0]].forEach(([p, o, l]) => brass(n(p), t + o, l, 0.42, sfxBus));
      drum(t, 0.6, 'low', sfxBus); drum(t + 0.5, 0.6, 'low', sfxBus); drum(t + 1.3, 0.8, 'low', sfxBus);
      void d;
    },
    unlock() { const t = ctx.currentTime; [n('A5'), n('C#6'), n('E6'), n('A6')].forEach((m, k) => bell(m, t + k * 0.08, 0.3, sfxBus, 1.6)); noiseHit(t, 6000, 1, 0.08, 0.6, 'highpass'); },
    correct() { const t = ctx.currentTime; [n('D5'), n('F#5'), n('A5'), n('D6')].forEach((m, k) => tone(m, t + k * 0.08, 0.3, 'triangle', 0.16)); bell(n('D6'), t + 0.32, 0.3); },
    wrong() { const t = ctx.currentTime; tone(n('E4'), t, 0.25, 'sawtooth', 0.07); tone(n('C4'), t + 0.18, 0.4, 'sawtooth', 0.07); },
    fail() { const t = ctx.currentTime; [['D4', 0], ['C4', .35], ['Bb3', .7], ['A3', 1.05]].forEach(([p, o]) => brass(n(p), t + o, 0.5, 0.35, sfxBus)); drum(t + 1.05, 0.7, 'low', sfxBus); },
    rankup() { const t = ctx.currentTime; [['D5', 0], ['F#5', .15], ['A5', .3], ['D6', .45]].forEach(([p, o]) => brass(n(p), t + o, 0.5, 0.35, sfxBus)); bell(n('D6'), t + 0.6, 0.5); bell(n('A6'), t + 0.75, 0.4); },
    gust() { const t = ctx.currentTime; const f = noiseHit(t, 400, 1.5, 0.35, 0.9); f.frequency.exponentialRampToValueAtTime(1800, t + 0.6); },
    sail() { const t = ctx.currentTime; noiseHit(t, 800, 1, 0.3, 0.25, 'lowpass'); noiseHit(t + 0.1, 1600, 2, 0.12, 0.2); },
    thunder() { thunder(Math.random() * 0.6); },
    ship() { const t = ctx.currentTime; bell(n('E5'), t, 0.4); bell(n('E5'), t + 0.25, 0.3); },
    firework() {
      const t = ctx.currentTime;
      noiseHit(t, 300, 0.6, 0.5, 0.6, 'lowpass');
      for (let k = 0; k < 10; k++) noiseHit(t + 0.15 + Math.random() * 0.6, 3000 + Math.random() * 4000, 2, 0.08, 0.05, 'highpass');
    },
    whale() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(330, t + 0.8); o.frequency.linearRampToValueAtTime(180, t + 2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 2.1);
      const s = ctx.createGain(); s.gain.value = 0.8; o.connect(g); g.connect(s); s.connect(reverb); g.connect(ambBus); o.start(t); o.stop(t + 2.2);
    },
  };

  return {
    init, n,
    get ready() { return ready; },
    play(name) { if (!ready) return; try { SFX[name] && SFX[name](); } catch (e) { /* ignore audio errors */ } },
    music,
    ambience,
    setVolume(k, v) { vol[k] = v; applyVolumes(); },
    toggleMute() { muted = !muted; applyVolumes(); return muted; },
    get muted() { return muted; },
    _bus: () => _musicBusProxy(),
  };
})();
