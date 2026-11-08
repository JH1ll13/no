/* ==========================================================================
   Bonus Expedition (Easter egg): The Other Shore — Tenochtitlan, 1519–1521.
   Unlocked after the grand finale by a hidden glyph on the world map.
   The player is a young soldier on Cortés's expedition who keeps a
   chronicle. There is no combat: the player travels, observes, chooses,
   and hears the story from both Spanish and Nahua voices.
   ========================================================================== */
'use strict';

const Bonus = (() => {
  const $ = id => document.getElementById(id);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let canvas, ctx, W = 0, H = 0, dpr = 1, frame = null, t = 0, last = 0, onExit = null;
  let S = null;            // run state
  let pointer = { x: -999, y: -999 };

  /* ---------------- Content ---------------------------------------------- */
  const MARCH = [
    { id: 'veracruz', n: 'Veracruz', lat: 19.2, lon: -96.15, start: true },
    { id: 'cempoala', n: 'Cempoala', lat: 19.44, lon: -96.4, date: 'June 1519', title: 'The Totonac City',
      text: 'The Totonac people of Cempoala welcome the expedition. Their ruler complains that the Mexica force his people to pay heavy tribute: cloth, food, and even captives for sacrifice. The Totonacs decide to join the Spanish against the Mexica.',
      q: { q: 'Why did the Totonacs ally with the Spanish?', a: ['They resented paying tribute to the Mexica Empire', 'They wanted to move to Spain', 'They had never heard of the Mexica', 'The Spanish paid them in gold'], x: 'Many peoples conquered by the Mexica resented the tribute they had to pay. Cortés used that anger to win allies.' } },
    { id: 'tlaxcala', n: 'Tlaxcala', lat: 19.32, lon: -98.24, date: 'September 1519', title: 'The Unconquered Republic',
      text: 'The Tlaxcalans had fought the Mexica for generations and were never conquered. After fierce battles against the newcomers, their leaders choose to become allies. Tens of thousands of Tlaxcalan warriors will march with Cortés.',
      q: { q: 'Why were allies like the Tlaxcalans so important to the Spanish?', a: ['The Spanish numbered only a few hundred, while their Indigenous allies numbered in the tens of thousands', 'The Tlaxcalans owned ships', 'The Tlaxcalans spoke Spanish', 'The Tlaxcalans lived in Spain'], x: 'Historians stress that the “Spanish” conquest was fought mostly by Indigenous armies who had their own reasons to oppose the Mexica.' } },
    { id: 'cholula', n: 'Cholula', lat: 19.06, lon: -98.3, date: 'October 1519', title: 'The Holy City',
      text: 'Cholula is a holy city, home to the largest pyramid in the Americas. Cortés says he has learned of a plot against him. His soldiers and Tlaxcalan allies attack the unarmed nobles and people gathered in the temple courtyard, killing thousands. Spanish and Nahua accounts tell very different stories about why it happened.',
      q: { q: 'Why might Spanish and Nahua accounts of Cholula disagree?', a: ['Each side had reasons to justify or condemn what happened', 'One side could not write', 'They describe different cities', 'It happened in a different century'], x: 'Cortés wrote to his king and needed to justify the attack. Nahua survivors remembered it as a massacre. Historians compare both to understand what happened.' } },
    { id: 'paso', n: 'Pass of the Volcanoes', lat: 19.08, lon: -98.66, date: 'November 1519', title: 'Between the Volcanoes',
      text: 'The road climbs between two great volcanoes: smoking Popocatépetl and snow-capped Iztaccíhuatl. Below lies the Valley of Mexico, full of shining lakes, fields and cities. At its heart, on an island, stands Tenochtitlan.',
      q: { q: 'What is true about Popocatépetl today?', a: ['It is an active volcano that still erupts', 'It sank into the sea', 'It is the tallest mountain in the world', 'It is in South America'], x: 'Popocatépetl, “Smoking Mountain” in Nahuatl, is one of the most active volcanoes in Mexico.' } },
    { id: 'tenochtitlan', n: 'Tenochtitlan', lat: 19.43, lon: -99.13, date: 'November 8, 1519', title: 'The Meeting on the Causeway',
      text: 'On the great southern causeway, the emperor Moctezuma II comes out to greet Cortés, carried beneath a canopy of green feathers. Bernal Díaz later remembered the first sight of the city:',
      quote: '“…we were amazed and said that it was like the enchantments they tell of in the legend of Amadis, on account of the great towers and cues and buildings rising from the water, and all built of masonry. And some of our soldiers even asked whether the things that we saw were not a dream?”',
      cite: 'Bernal Díaz del Castillo, The True History of the Conquest of New Spain (written c. 1568), trans. A. P. Maudslay, vol. 2 (Hakluyt Society, 1910).',
      q: { q: 'Bernal Díaz wrote this about fifty years later, as an old man. How might that affect his account?', a: ['He might forget or exaggerate some details', 'It makes every detail perfectly accurate', 'He could not have seen the city', 'It means he was Mexica'], x: 'Historians value Díaz as an eyewitness but remember that memories fade and change over fifty years.' } },
  ];
  const MARCH_NOTES = [
    { id: 'cacao', lat: 18.6, lon: -96.0, t: 'Cacao', d: 'Cacao beans were so valuable that the Mexica used them as money. Nobles drank a frothy, bitter cacao drink. The word “chocolate” comes from Nahuatl.' },
    { id: 'orizaba', lat: 19.03, lon: -97.27, t: 'Citlaltépetl (Pico de Orizaba)', d: '“Star Mountain” in Nahuatl, it is the highest mountain in Mexico, about 5,600 meters tall.' },
    { id: 'maguey', lat: 19.6, lon: -97.9, t: 'Maguey fields', d: 'The maguey (agave) plant gave fiber for cloth and rope, needles from its spines, and sap for a drink called pulque.' },
  ];
  const CITY = [
    { id: 'temple', x: 0.50, y: 0.50, t: 'The Templo Mayor', d: 'The Great Temple: a pyramid about 45 meters tall, topped by twin shrines to Huitzilopochtli, god of sun and war, and Tlaloc, god of rain. Its ruins were rediscovered under Mexico City in 1978.' },
    { id: 'market', x: 0.50, y: 0.20, t: 'The Market of Tlatelolco', d: 'Cortés wrote to his king: “There is one square, twice as large as that of Salamanca, all surrounded by arcades, where there are daily more than sixty thousand souls, buying and selling…” (Second Letter, 1520, trans. F. A. MacNutt, 1908).' },
    { id: 'chinampa', x: 0.24, y: 0.66, t: 'Chinampas', d: 'Farmers built “floating gardens”: fields of mud and plants anchored in the shallow lake, growing maize, beans, squash, chiles and flowers. Some are still farmed today at Xochimilco.' },
    { id: 'causeway', x: 0.50, y: 0.86, t: 'The Causeways', d: 'Three great stone causeways linked the island to the shore, with wooden bridges that could be lifted to defend the city.' },
    { id: 'aqueduct', x: 0.12, y: 0.42, t: 'The Aqueduct of Chapultepec', d: 'A stone aqueduct carried fresh spring water from Chapultepec hill across the lake and into the city.' },
    { id: 'dike', x: 0.86, y: 0.40, t: 'The Dike of Nezahualcoyotl', d: 'A dike about 16 kilometers long separated salty lake water from the fresh water around the city and protected it from floods.' },
    { id: 'canals', x: 0.68, y: 0.62, t: 'Canals and canoes', d: 'Canals ran through the city like streets, and thousands of canoes carried people and goods. Spanish soldiers compared Tenochtitlan to Venice.' },
    { id: 'calpulli', x: 0.33, y: 0.38, t: 'Neighborhoods and schools', d: 'Tenochtitlan had roughly 200,000 people, more than any city in Spain at the time. It was organized into neighborhoods (calpulli), each with its own temple and a school for young people.' },
  ];
  const FALL = [
    { date: '1520', t: 'A Prisoner in His Own Palace', scene: { sky: 'dusk', land: 'city', items: ['flags'] }, d: 'Cortés takes Moctezuma captive inside his own palace. In 1520, during violent unrest in the city, Moctezuma dies. Spanish and Nahua accounts disagree about who killed him.' },
    { date: 'June 30, 1520', t: 'La Noche Triste: “The Sad Night”', scene: { sky: 'night', land: 'city', items: ['canoes', 'fire'] }, d: 'Mexica warriors rise up and drive the Spanish and their allies out of the city at night. Hundreds of Spanish soldiers die on the causeways, many weighed down by the gold they were carrying.' },
    { date: 'Autumn 1520', t: 'The Great Sickness', scene: { sky: 'fog', land: 'city', items: [] }, d: 'Smallpox, a disease brought from Europe, spreads through the city. The Mexica had no immunity to it. Thousands die, including the new emperor, Cuitláhuac. A Nahua account recalls:',
      quote: '“Sores erupted on our faces, our breasts, our bellies; we were covered with agonizing sores from head to foot.”', cite: 'Nahua account in the Florentine Codex, Book XII (compiled c. 1555–1576); trans. in Miguel León-Portilla, ed., The Broken Spears (1962).' },
    { date: 'May–August 1521', t: 'The Siege', scene: { sky: 'storm', land: 'city', items: ['canoes', 'waves'] }, d: 'Cortés returns with thirteen boats built for the lake and tens of thousands of Indigenous allies. They cut off the causeways and the aqueduct. For nearly three months the starving city fights on under its last emperor, Cuauhtémoc.' },
    { date: 'August 13, 1521', t: 'The Fall of Tenochtitlan', scene: { sky: 'dusk', land: 'city', items: ['fire'] }, d: 'Cuauhtémoc is captured and the city falls. Nahua poets mourned it:',
      quote: '“Broken spears lie in the roads; we have torn our hair in our grief. The houses are roofless now, and their walls are red with blood.”', cite: 'Nahua elegy (16th century), trans. Lysander Kemp in Miguel León-Portilla, ed., The Broken Spears (1962).' },
  ];
  const VOICES = [
    { q: '“…some of our soldiers even asked whether the things that we saw were not a dream?”', a: 'A Spanish soldier remembering, decades later', id: 'diaz' },
    { q: '“…more than sixty thousand souls, buying and selling…”', a: 'A Spanish captain writing to his king', id: 'cortes' },
    { q: '“…we were covered with agonizing sores from head to foot.”', a: 'Nahua survivors of the epidemic', id: 'smallpox' },
    { q: '“Broken spears lie in the roads; we have torn our hair in our grief.”', a: 'A Nahua poet mourning the city', id: 'poem' },
  ];
  const NEW_TERMS = {
    tenochtitlan: { t: 'Tenochtitlan', cat: 'place', d: 'The capital of the Mexica (Aztec) Empire, built on an island in Lake Texcoco. With roughly 200,000 people, it was one of the largest cities in the world in 1519. Mexico City stands on its ruins.', f: 'Its name is often translated as “place of the prickly pear cactus on the rock.”' },
    mexica: { t: 'The Mexica (Aztecs)', cat: 'people', d: 'The Nahuatl-speaking people who founded Tenochtitlan and ruled a large empire in central Mexico, collecting tribute from many conquered peoples.', f: 'Mexico takes its name from the Mexica.' },
    moctezuma: { t: 'Moctezuma II', cat: 'people', d: 'Emperor of the Mexica when Cortés arrived in 1519. He was taken captive in his own palace and died in 1520.', f: 'Spanish and Nahua sources disagree about how he died.' },
    malintzin: { t: 'Malintzin (Doña Marina)', cat: 'people', d: 'A Nahua woman who had been enslaved and was given to the Spanish in 1519. She translated between Nahuatl, Maya and later Spanish, and became Cortés’s key interpreter and advisor.', f: 'For a long time she was called a traitor; many historians now see a young woman who survived impossible choices.' },
    cortes: { t: 'Hernán Cortés', cat: 'people', d: 'The Spanish conquistador who led the expedition into Mexico in 1519 and, with tens of thousands of Indigenous allies, brought down the Mexica Empire in 1521.', f: 'He wrote long letters to King Charles I describing (and justifying) his actions.' },
    conquistador: { t: 'Conquistador', cat: 'idea', d: 'Spanish for “conqueror”: the soldiers and adventurers who conquered much of the Americas for Spain in the 1500s, often seeking gold, land and fame.', f: 'Most conquistadors were not professional soldiers; they paid their own way, hoping to get rich.' },
    chinampa: { t: 'Chinampa', cat: 'place', d: 'A “floating garden”: a raised field built from mud and plants in a shallow lake, used by the Mexica to grow food for their huge city.', f: 'Chinampas are still farmed today in Xochimilco, in Mexico City.' },
    smallpox: { t: 'Smallpox', cat: 'idea', d: 'A deadly disease brought from Europe. Indigenous peoples of the Americas had never been exposed to it, and epidemics killed a huge share of the population.', f: 'Disease was one of the biggest reasons for the fall of Tenochtitlan, and part of the Columbian Exchange.' },
    tlaxcala: { t: 'Tlaxcala', cat: 'place', d: 'A powerful Nahua republic that the Mexica never conquered. Its warriors became the most important allies of the Spanish.', f: 'Tlaxcala is still a state of Mexico today.' },
  };
  Object.assign(TERMS, NEW_TERMS); // part of the Codex, but only collectable in the bonus game

  /* ---------------- Unlock & entry --------------------------------------- */
  const unlocked = () => !!Save.data.admiral;
  function open(exit) {
    onExit = exit;
    canvas = $('bonusCanvas'); ctx = canvas.getContext('2d');
    $('bonus').classList.remove('hidden');
    S = { ch: 0, found: new Set((Save.data.bonus && Save.data.bonus.found) || []), right: 0, asked: 0, node: 0, moving: null, voices: {}, fallIdx: 0 };
    layout();
    Sound.init(); Sound.music('calm');
    chapterIntro();
    last = performance.now();
    if (!frame) frame = requestAnimationFrame(loop);
  }
  function close() {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    $('bonus').classList.add('hidden');
    saveProgress();
    if (onExit) onExit();
  }
  function saveProgress() {
    Save.data.bonus = Object.assign(Save.data.bonus || {}, { found: [...S.found] });
    Save.write();
  }
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    S && (S.mapImg = null, S.cityImg = null);
  }

  /* ---------------- Panel helpers ---------------------------------------- */
  function panel(html) { const p = $('bonusPanel'); p.innerHTML = html; p.scrollTop = 0; return p; }
  function setTop() {
    const names = ['Prologue', 'I · The Coast', 'II · The March Inland', 'III · The City on the Lake', 'IV · The Fall', 'Epilogue'];
    $('bonusChapter').textContent = names[S.ch] || '';
    $('bonusCount').textContent = `📜 Chronicle: ${S.found.size} / ${MARCH_NOTES.length + CITY.length}`;
  }
  function record(id, title) {
    if (S.found.has(id)) return false;
    S.found.add(id); saveProgress(); setTop();
    Sound.play('pickup');
    toast(`📜 Added to your chronicle: <b>${title}</b>`);
    return true;
  }
  function unlockTerm(id) {
    if (!Save.data.codex[id]) { Save.data.codex[id] = 'new'; Save.write(); toast(`★ New key term: <b>${TERMS[id].t}</b>`); Sound.play('unlock'); }
  }
  function toast(html) {
    const box = $('bonusToasts');
    const el = U.el('div', 'toast good', html);
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3800);
  }
  function quiz(q, onDone) {
    const opts = shuffle(q.a.map((t, i) => ({ t, ok: i === 0 })));
    const id = 'bq' + Math.random().toString(36).slice(2, 7);
    const html = `<div class="j-quiz"><div class="qk">✒ THE CHRONICLER ASKS</div><div class="qq">${q.q}</div><div class="opts" id="${id}"></div><div class="qx"></div></div>`;
    return { html, bind: () => {
      const box = $(id), qbox = box.parentElement;
      opts.forEach(o => {
        const b = U.el('button', 'opt', o.t);
        b.onclick = () => {
          box.querySelectorAll('.opt').forEach(x => { x.disabled = true; });
          box.children[opts.findIndex(x => x.ok)].classList.add('right');
          if (!o.ok) b.classList.add('wrong');
          S.asked++; if (o.ok) S.right++;
          Sound.play(o.ok ? 'correct' : 'wrong');
          qbox.querySelector('.qx').innerHTML = (o.ok ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x;
          onDone && onDone(o.ok);
        };
        box.appendChild(b);
      });
    } };
  }
  function next(label, fn) { return `<div class="j-actions"><button class="btn big" id="bNext">${label}</button></div>`; }
  function bindNext(fn, enabled = true) { const b = $('bNext'); if (!b) return; b.disabled = !enabled; b.onclick = () => { Sound.play('click'); fn(); }; }

  /* ---------------- Chapters --------------------------------------------- */
  function chapterIntro() {
    S.ch = 0; S.view = 'scene'; S.scene = { sky: 'dawn', land: 'jungle', items: ['ships3', 'palms'] }; S.sceneImg = null; setTop();
    panel(`<div class="res-kicker">A secret chapter, unlocked by the Admiral of the Ocean Sea</div>
      <h2>The Other Shore</h2><div class="b-sub">Tenochtitlan, 1519–1521</div>
      <p>In 1519, Hernán Cortés led about 500 Spanish soldiers into the lands of the <b>Mexica</b> (often called the Aztecs), who ruled one of the largest empires in the Americas from their island city, <b>Tenochtitlan</b>. These men called themselves <i>conquistadors</i>, “conquerors.”</p>
      <p>You join the expedition as a young soldier who keeps a <b>chronicle</b>, like the real conquistador Bernal Díaz del Castillo. <b>You will not fight.</b> You will travel, observe, make choices and record what you see, and you will hear the story from the Mexica side too.</p>
      <div class="b-note"><b>Before you begin:</b> the Spanish conquest brought war, disease and enslavement that killed a great many Indigenous people. This chapter tells that history honestly, and it honors the people of Tenochtitlan, whose descendants and language live on in Mexico today.</div>
      ${next('Begin the Chronicle')}`);
    bindNext(chapterCoast);
  }
  function chapterCoast() {
    S.ch = 1; S.view = 'scene'; S.scene = { sky: 'day', land: 'jungle', items: ['ships3', 'palms', 'canoes'] }; S.sceneImg = null; setTop();
    Sound.play('bell');
    panel(`<div class="j-date">Spring 1519 · The Gulf Coast</div><h2>Strangers on the Shore</h2>
      <p>Eleven ships anchor off the coast of what is now Veracruz, Mexico. Messengers from the Mexica emperor <b>Moctezuma II</b> paddle out with gifts of gold and fine featherwork, and to learn who these strangers are. But how can anyone understand each other?</p>
      <div class="b-puzzle"><div class="qk">✒ BUILD THE CHAIN OF TRANSLATORS</div>
      <p class="b-small">Moctezuma’s messengers speak <b>Nahuatl</b>. Cortés speaks only <b>Spanish</b>. Tap a person, then tap the gap where they belong.</p>
      <div class="chain"><span class="lang">Nahuatl</span><button class="slot" data-slot="0">?</button><span class="lang">Maya</span><button class="slot" data-slot="1">?</button><span class="lang">Spanish</span></div>
      <div class="cards" id="bCards"></div><div class="qx" id="bChainX"></div></div>
      ${next('Continue')}`);
    const people = shuffle([
      { id: 'malintzin', n: 'Malintzin', d: 'a Nahua woman who also speaks Maya' },
      { id: 'aguilar', n: 'Gerónimo de Aguilar', d: 'a Spaniard who learned Maya after a shipwreck' },
      { id: 'diaz', n: 'Bernal Díaz', d: 'a young soldier who speaks only Spanish' },
    ]);
    let pick = null; const placed = [null, null];
    const cards = $('bCards');
    people.forEach(p => {
      const b = U.el('button', 'pcard', `<b>${p.n}</b><span>${p.d}</span>`);
      b.onclick = () => { pick = p; cards.querySelectorAll('.pcard').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.play('click'); };
      cards.appendChild(b);
    });
    document.querySelectorAll('.slot').forEach(s => s.onclick = () => {
      if (!pick) return;
      const i = +s.dataset.slot; placed[i] = pick; s.textContent = pick.n; s.classList.add('filled'); Sound.play('paper');
      if (placed[0] && placed[1]) {
        const ok = placed[0].id === 'malintzin' && placed[1].id === 'aguilar';
        S.asked++; if (ok) S.right++;
        Sound.play(ok ? 'correct' : 'wrong');
        document.querySelectorAll('.slot').forEach((x, k) => { x.disabled = true; x.textContent = k ? 'Gerónimo de Aguilar' : 'Malintzin'; x.classList.add(ok ? 'right' : 'fixed'); });
        cards.querySelectorAll('.pcard').forEach(x => { x.disabled = true; });
        $('bChainX').innerHTML = (ok ? '<b>Correct!</b> ' : '<b>Here is how it worked:</b> ') + 'Malintzin translated Nahuatl into Maya, and Aguilar translated Maya into Spanish. Every word between Moctezuma and Cortés passed through two people. Malintzin soon learned Spanish herself and became Cortés’s most important interpreter and advisor.';
        unlockTerm('malintzin'); unlockTerm('moctezuma');
        bindNext(coastShips, true);
      }
    });
    bindNext(coastShips, false);
  }
  function coastShips() {
    S.scene = { sky: 'dusk', land: 'coast', items: ['wreck', 'palms'] }; S.sceneImg = null;
    const q = quiz({ q: 'Some of Cortés’s men want to sail back to Cuba. Cortés has most of his ships run aground and stripped. Why?', a: ['So no one could turn back', 'To build a church from the wood', 'Because a storm wrecked them', 'To trade them to the Mexica'], x: 'With the ships gone, the expedition had to go forward. Cortés was already disobeying the governor of Cuba, who had ordered him not to invade.' }, () => bindNext(chapterMarch, true));
    panel(`<div class="j-date">August 1519 · Villa Rica de la Vera Cruz</div><h2>No Turning Back</h2>
      <p>Cortés founds a Spanish town on the coast and claims the land for King Charles I, though the people who live there have not agreed to anything.</p>${q.html}${next('March Inland')}`);
    q.bind(); bindNext(chapterMarch, false);
    unlockTerm('cortes'); unlockTerm('conquistador');
  }
  function chapterMarch() {
    S.ch = 2; S.view = 'march'; S.node = 0; S.mapImg = null; setTop();
    Sound.play('bell');
    marchPanel();
  }
  function marchPanel() {
    const nx = MARCH[S.node + 1];
    panel(`<div class="j-date">1519 · The March Inland</div><h2>The Road to Tenochtitlan</h2>
      <p>The expedition, now joined by Totonac allies, climbs from the hot coast into the mountains. Tap the <b>glowing marker</b> on the map to travel to <b>${nx.n}</b>.</p>
      <p class="b-small">Keep your eyes open: tap the small ✦ sparkles on the map to add notes to your chronicle.</p>`);
  }
  function arriveNode(i) {
    const n = MARCH[i];
    if (n.id === 'tlaxcala') unlockTerm('tlaxcala');
    const q = quiz(n.q, () => bindNext(() => { if (i >= MARCH.length - 1) chapterCity(); else marchPanel(); }, true));
    panel(`<div class="j-date">${n.date} · ${n.n}</div><h2>${n.title}</h2><p>${n.text}</p>
      ${n.quote ? `<blockquote class="b-quote">${n.quote}<cite>${n.cite}</cite></blockquote>` : ''}
      ${q.html}${next(i >= MARCH.length - 1 ? 'Enter the City' : 'Continue the March')}`);
    q.bind(); bindNext(null, false);
    if (n.id === 'tenochtitlan') { unlockTerm('tenochtitlan'); unlockTerm('mexica'); }
  }
  function chapterCity() {
    S.ch = 3; S.view = 'city'; S.cityImg = null; setTop();
    Sound.play('bell');
    cityPanel();
  }
  function cityPanel(extra) {
    const left = CITY.filter(c => !S.found.has(c.id)).length;
    const q = left ? null : quiz({ q: 'Why did Spanish soldiers compare Tenochtitlan to Venice?', a: ['Both cities were built on water and crossed by canals', 'Both cities were in Italy', 'Both were ruled by the Pope', 'Both had no buildings'], x: 'Venice, like Tenochtitlan, was built on islands in a lagoon, with canals for streets.' }, () => bindNext(chapterFall, true));
    panel(`<div class="j-date">Winter 1519–1520 · Tenochtitlan</div><h2>The City on the Lake</h2>
      <p>For months the expedition lives inside Tenochtitlan as guests, while Moctezuma is held captive in his own palace. Explore the city: move across the map and tap the <b>glowing spots</b> to record what you see.</p>
      ${extra || ''}
      <p class="b-small">${left ? `${left} discoveries left to record.` : 'You have recorded the whole city.'}</p>
      ${q ? q.html : ''}${next('Continue')}`);
    if (q) { q.bind(); unlockTerm('chinampa'); }
    bindNext(chapterFall, false);
  }
  function chapterFall() {
    S.ch = 4; S.view = 'scene'; S.fallIdx = 0; setTop();
    fallCard();
  }
  function fallCard() {
    const f = FALL[S.fallIdx];
    S.scene = f.scene; S.sceneImg = null;
    Sound.play(S.fallIdx === 4 ? 'fail' : 'paper');
    if (S.fallIdx === 2) unlockTerm('smallpox');
    panel(`<div class="j-date">${f.date}</div><h2>${f.t}</h2><p>${f.d}</p>
      ${f.quote ? `<blockquote class="b-quote">${f.quote}<cite>${f.cite}</cite></blockquote>` : ''}
      <div class="b-progress">${FALL.map((_, i) => `<i class="${i <= S.fallIdx ? 'on' : ''}"></i>`).join('')}</div>
      ${next(S.fallIdx < FALL.length - 1 ? 'Continue' : 'Two Voices')}`);
    bindNext(() => { if (S.fallIdx < FALL.length - 1) { S.fallIdx++; fallCard(); } else voices(); });
  }
  function voices() {
    S.view = 'scene'; S.scene = { sky: 'dawn', land: 'city', items: ['canoes'] }; S.sceneImg = null;
    const answers = shuffle(VOICES.map(v => v.a));
    panel(`<div class="j-date">Reading Like a Historian</div><h2>Two Voices</h2>
      <p>The story of Tenochtitlan comes to us from both Spanish and Nahua writers. Match each quotation to the person who said it.</p>
      <div class="voices">${VOICES.map((v, i) => `<div class="voice"><div class="vq">${v.q}</div><select data-i="${i}" aria-label="Who said it?"><option value="">Who said it?</option>${answers.map(a => `<option>${a}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="j-actions"><button class="btn" id="bCheck">Check my answers</button></div><div class="qx" id="bVoiceX"></div>
      ${next('Final Reflection')}`);
    bindNext(reflection, false);
    $('bCheck').onclick = () => {
      let right = 0;
      document.querySelectorAll('.voice select').forEach(sel => {
        const v = VOICES[+sel.dataset.i], ok = sel.value === v.a;
        sel.parentElement.classList.toggle('right', ok); sel.parentElement.classList.toggle('wrong', !ok);
        if (!ok) { sel.value = v.a; }
        sel.disabled = true; if (ok) right++;
      });
      S.asked += VOICES.length; S.right += right;
      Sound.play(right === VOICES.length ? 'correct' : 'paper');
      $('bVoiceX').innerHTML = `<b>${right} of ${VOICES.length} correct.</b> Spanish writers described amazement and wealth; Nahua writers remembered sickness and grief. Historians need both voices to understand what happened.`;
      $('bCheck').disabled = true;
      bindNext(reflection, true);
    };
  }
  function reflection() {
    const opts = [
      ['Smallpox and other diseases', 'Epidemics killed a huge share of the city’s people, including the emperor Cuitláhuac, at the worst possible moment.'],
      ['Tens of thousands of Indigenous allies', 'Tlaxcalans, Totonacs and others who resented Mexica rule made up most of the army that besieged the city.'],
      ['Spanish steel, guns, horses and boats', 'These gave the Spanish advantages in battle, though they were only a few hundred men.'],
      ['Cutting off food and water during the siege', 'The siege destroyed the causeways and aqueduct and starved the city.'],
    ];
    panel(`<div class="j-date">Your Chronicle</div><h2>Why Did Tenochtitlan Fall?</h2>
      <p>There is no single right answer. Choose the reason you think mattered most, then see what historians say.</p>
      <div class="opts b-reflect">${opts.map((o, i) => `<button class="opt" data-i="${i}">${o[0]}</button>`).join('')}</div>
      <div class="qx" id="bReflX"></div>${next('Finish the Chronicle')}`);
    bindNext(epilogue, false);
    document.querySelectorAll('.b-reflect .opt').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      document.querySelectorAll('.b-reflect .opt').forEach(x => { x.disabled = true; });
      b.classList.add('right'); Sound.play('paper');
      $('bReflX').innerHTML = `<b>You chose:</b> ${opts[i][1]} <br><br>Most historians today say it took all of these together, and they put special weight on <b>disease</b> and on the <b>Indigenous allies</b> who did most of the fighting. The idea that a few hundred Spaniards conquered an empire alone is a myth.`;
      bindNext(epilogue, true);
    });
  }
  function epilogue() {
    S.ch = 5; S.view = 'scene'; S.scene = { sky: 'day', land: 'city', items: ['palms', 'mountains'] }; S.sceneImg = null; setTop();
    const total = MARCH_NOTES.length + CITY.length, found = S.found.size;
    const firstTime = !(Save.data.bonus && Save.data.bonus.done);
    Save.data.bonus = Object.assign(Save.data.bonus || {}, { done: true, found: [...S.found] });
    if (firstTime) Save.data.ducats += 200;
    Save.write();
    Sound.music('victory');
    panel(`<div class="res-kicker">Chronicle complete</div><h2>Keeper of Both Voices</h2>
      <div class="fa-stats"><div><b>${found}/${total}</b>discoveries</div><div><b>${S.right}/${S.asked}</b>answers</div><div><b>${Object.keys(NEW_TERMS).filter(k => Save.data.codex[k]).length}/${Object.keys(NEW_TERMS).length}</b>new Codex terms</div><div><b>${firstTime ? '+200' : '—'}</b>ducats</div></div>
      <p><b>What happened next:</b> The Spanish built Mexico City on the ruins of Tenochtitlan, using stones from its temples. Spain ruled “New Spain” for 300 years. Disease, forced labor and war caused the Indigenous population of central Mexico to fall by as much as 90 percent within a century.</p>
      <p>But the Mexica world did not disappear. About 1.6 million people in Mexico speak <b>Nahuatl</b> today, and English borrowed Nahuatl words such as <i>chocolate</i>, <i>tomato</i>, <i>avocado</i>, <i>chili</i> and <i>coyote</i>. The ruins of the Templo Mayor stand in the center of Mexico City, and Mexico’s flag shows the eagle on a cactus from the story of Tenochtitlan’s founding.</p>
      <div class="j-actions"><button class="btn" id="bAgain">Read Again</button><button class="btn big" id="bDone">Return to the World Map</button></div>`);
    $('bDone').onclick = () => { Sound.play('click'); close(); };
    $('bAgain').onclick = () => { Sound.play('click'); chapterIntro(); };
  }

  /* ---------------- Drawing ---------------------------------------------- */
  function marchGeo() {
    // fit the region to the stage, centred between the coast and the valley
    const CLAT = 19.3, CLON = -97.55;
    const k = Math.min(W / 4.9, H / (2.5 * 1.06));
    const lonSpan = W / k, latSpan = H / (1.06 * k);
    const LON0 = CLON - lonSpan / 2, LON1 = CLON + lonSpan / 2, LAT0 = CLAT + latSpan / 2, LAT1 = CLAT - latSpan / 2;
    return { P: (la, lo) => [(lo - LON0) * k, (LAT0 - la) * 1.06 * k], k, ox: 0, oy: 0, mw: W, mh: H, LON0, LON1, LAT0, LAT1 };
  }
  function renderMarchMap() {
    const G = marchGeo(), c = U.canvas(W * dpr, H * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#2b1d10'; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); g.rect(G.ox, G.oy, G.mw, G.mh); g.clip();
    g.fillStyle = '#7fb0b8'; g.fillRect(G.ox, G.oy, G.mw, G.mh);
    const land = new Path2D();
    for (const r of World.rings) {
      if (r.dup || r.maxx < GEO.lonToX(G.LON0 - 1) || r.minx > GEO.lonToX(G.LON1 + 1)) continue;
      for (let i = 0; i < r.n; i++) { const [x, y] = G.P(r.lat[i], r.lon[i]); i ? land.lineTo(x, y) : land.moveTo(x, y); }
      land.closePath();
    }
    g.strokeStyle = 'rgba(230,250,245,0.5)'; g.lineWidth = 10; g.stroke(land);
    // terrain: lowland green to highland tan
    const tg = g.createLinearGradient(G.P(19, -96)[0], 0, G.P(19, -99)[0], 0);
    tg.addColorStop(0, '#6f9a52'); tg.addColorStop(0.35, '#a7a466'); tg.addColorStop(1, '#cdb989');
    g.fillStyle = tg; g.fill(land, 'evenodd');
    g.strokeStyle = '#4a3418'; g.lineWidth = 1.5; g.stroke(land);
    // forest stipple near the coast
    const rnd = U.rng(5);
    for (let i = 0; i < 260; i++) {
      const lo = -97.2 + rnd() * 1.4, la = 18.3 + rnd() * 2;
      const q = GEO.toXY(la, lo); if (!World.isLand(q.x, q.y)) continue;
      const [x, y] = G.P(la, lo); g.fillStyle = `rgba(40,80,40,${0.35 + rnd() * 0.3})`; g.beginPath(); g.arc(x, y, 2 + rnd() * 2.5, 0, 7); g.fill();
    }
    // the lakes of the Valley of Mexico
    g.fillStyle = '#7fb0b8'; g.strokeStyle = '#3d6a74'; g.lineWidth = 1.2;
    const lake = [[19.75, -99.05], [19.62, -98.92], [19.45, -98.95], [19.32, -99.0], [19.24, -99.1], [19.27, -99.2], [19.4, -99.17], [19.55, -99.12], [19.7, -99.15]];
    g.beginPath(); lake.forEach(([la, lo], i) => { const [x, y] = G.P(la, lo); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.stroke();
    // mountains & volcanoes
    const peak = (la, lo, h, snow, smoke, name) => {
      const [x, y] = G.P(la, lo), s = h * G.k / 60;
      g.fillStyle = '#8a7358'; g.beginPath(); g.moveTo(x - s * 1.2, y + s * 0.3); g.lineTo(x, y - s); g.lineTo(x + s * 1.2, y + s * 0.3); g.closePath(); g.fill();
      g.fillStyle = '#5f4e3c'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 1.2, y + s * 0.3); g.lineTo(x + s * 0.1, y + s * 0.3); g.closePath(); g.fill();
      if (snow) { g.fillStyle = '#f6f4ee'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.35, y - s * 0.6); g.lineTo(x - s * 0.35, y - s * 0.6); g.closePath(); g.fill(); }
      if (smoke) { g.fillStyle = 'rgba(240,240,240,0.55)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + i * s * 0.25, y - s - i * s * 0.35, s * (0.2 + i * 0.08), 0, 7); g.fill(); } }
      if (name) { g.font = `italic ${U.clamp(G.k / 11, 11, 15)}px "IM Fell English", Georgia, serif`; g.fillStyle = '#2b1d10'; g.textAlign = 'center'; g.fillText(name, x, y + s * 0.3 + 14); }
    };
    for (let i = 0; i < 40; i++) { const la = 18.5 + rnd() * 1.8, lo = -98.9 + rnd() * 1.6; const q = GEO.toXY(la, lo); if (World.isLand(q.x, q.y)) peak(la, lo, 3 + rnd() * 3, false, false); }
    peak(18.98, -98.75, 9, true, true, 'Popocatépetl');
    peak(19.24, -98.72, 8, true, false, 'Iztaccíhuatl');
    peak(19.03, -97.27, 9, true, false, 'Citlaltépetl');
    // labels
    g.font = `italic ${U.clamp(G.k / 8, 13, 20)}px "IM Fell English", Georgia, serif`; g.fillStyle = 'rgba(30,70,85,0.8)'; g.textAlign = 'center';
    { const [x, y] = G.P(19.9, -95.9); g.fillText('Gulf of Mexico', x, y); }
    { const [x, y] = G.P(19.85, -99.0); g.fillText('Lake Texcoco', x, y); }
    g.font = `${U.clamp(G.k / 7, 14, 22)}px "IM Fell English SC", Georgia, serif`; g.fillStyle = 'rgba(70,45,20,0.75)';
    { const [x, y] = G.P(20.05, -99.1); g.fillText('VALLEY OF MEXICO', x, y); }
    g.restore();
    g.strokeStyle = '#c9973e'; g.lineWidth = 3; g.strokeRect(G.ox + 1.5, G.oy + 1.5, G.mw - 3, G.mh - 3);
    Art.compassRose(g, G.ox + G.mw - 60, G.oy + G.mh - 60, 42, { labels: false });
    S.mapImg = c;
  }
  function drawMarch(g, dt) {
    if (!S.mapImg) renderMarchMap();
    g.drawImage(S.mapImg, 0, 0, W, H);
    const G = marchGeo();
    // route
    g.lineCap = 'round';
    for (let i = 0; i < MARCH.length - 1; i++) {
      const [x1, y1] = G.P(MARCH[i].lat, MARCH[i].lon), [x2, y2] = G.P(MARCH[i + 1].lat, MARCH[i + 1].lon);
      g.strokeStyle = i < S.node ? '#9b2d20' : 'rgba(155,45,32,0.45)'; g.lineWidth = i < S.node ? 4 : 2.5; g.setLineDash(i < S.node ? [] : [8, 7]);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    g.setLineDash([]);
    const fs = U.clamp(G.k / 9, 12, 17);
    MARCH.forEach((m, i) => {
      const [x, y] = G.P(m.lat, m.lon);
      const nextUp = i === S.node + 1 && !S.moving && (S.node === 0 || S.answered);
      if (nextUp) {
        const pr = (Math.sin(t * 4) + 1) / 2;
        g.fillStyle = `rgba(255,214,100,${0.25 + pr * 0.35})`; g.beginPath(); g.arc(x, y, 16 + pr * 8, 0, 7); g.fill();
      }
      g.fillStyle = i <= S.node ? '#9b2d20' : '#fff6dd'; g.strokeStyle = '#2b1d10'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, m.id === 'tenochtitlan' ? 10 : 7, 0, 7); g.fill(); g.stroke();
      g.font = `600 ${fs}px "IM Fell English", Georgia, serif`; g.textAlign = 'center';
      const ly = m.id === 'paso' ? y + 22 : m.id === 'veracruz' ? y + 22 : y - 14;
      g.lineWidth = 4; g.strokeStyle = 'rgba(255,248,230,0.9)'; g.strokeText(m.n, x, ly); g.fillStyle = '#2b1d10'; g.fillText(m.n, x, ly);
    });
    // chronicle sparkles
    for (const n of MARCH_NOTES) {
      if (S.found.has(n.id)) continue;
      const [x, y] = G.P(n.lat, n.lon), pr = (Math.sin(t * 3 + x) + 1) / 2;
      g.fillStyle = `rgba(255,240,170,${0.5 + pr * 0.5})`; g.font = `${16 + pr * 6}px serif`; g.textAlign = 'center'; g.fillText('✦', x, y + 6);
    }
    // expedition marker
    let px, py;
    if (S.moving) {
      S.moving.k += dt / 2.2;
      const a = MARCH[S.moving.from], b = MARCH[S.moving.to], k = U.easeInOut(Math.min(1, S.moving.k));
      const [x1, y1] = G.P(a.lat, a.lon), [x2, y2] = G.P(b.lat, b.lon);
      px = x1 + (x2 - x1) * k; py = y1 + (y2 - y1) * k;
      if (S.moving.k >= 1) { S.node = S.moving.to; S.moving = null; S.answered = false; arriveNode(S.node); }
    } else { [px, py] = G.P(MARCH[S.node].lat, MARCH[S.node].lon); }
    const bob = Math.sin(t * 6) * 1.5;
    g.fillStyle = '#2b1d10'; g.fillRect(px - 1, py - 34 + bob, 2.5, 30);
    g.fillStyle = '#b8462e'; g.beginPath(); g.moveTo(px + 1.5, py - 34 + bob); g.lineTo(px + 22, py - 28 + bob); g.lineTo(px + 1.5, py - 21 + bob); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(px, py, 9, 3, 0, 0, 7); g.fill();
  }
  function marchClick(x, y) {
    const G = marchGeo();
    for (const n of MARCH_NOTES) {
      if (S.found.has(n.id)) continue;
      const [nx, ny] = G.P(n.lat, n.lon);
      if (Math.hypot(nx - x, ny - y) < 22) { record(n.id, n.t); toast(`<b>${n.t}:</b> ${n.d}`); return; }
    }
    if (S.moving || S.node >= MARCH.length - 1) return;
    if (S.node > 0 && !S.answered) return;
    const nx = MARCH[S.node + 1], [mx, my] = G.P(nx.lat, nx.lon);
    if (Math.hypot(mx - x, my - y) < 30) { S.moving = { from: S.node, to: S.node + 1, k: 0 }; Sound.play('gust'); }
  }

  function cityGeo() {
    const s = Math.min(W, H) * 0.92, ox = (W - s) / 2, oy = (H - s) / 2;
    return { s, ox, oy, P: (fx, fy) => [ox + fx * s, oy + fy * s] };
  }
  function renderCity() {
    const G = cityGeo(), c = U.canvas(W * dpr, H * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#2b1d10'; g.fillRect(0, 0, W, H);
    const { s, ox, oy } = G;
    // lake
    const lg = g.createRadialGradient(ox + s / 2, oy + s / 2, s * 0.1, ox + s / 2, oy + s / 2, s * 0.75);
    lg.addColorStop(0, '#6aa6b0'); lg.addColorStop(1, '#3f7888');
    g.fillStyle = lg; g.fillRect(ox, oy, s, s);
    // shore at the edges
    g.fillStyle = '#b9a874';
    g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + s * 0.18, oy); g.quadraticCurveTo(ox + s * 0.06, oy + s * 0.5, ox + s * 0.1, oy + s); g.lineTo(ox, oy + s); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(ox + s, oy + s * 0.75); g.quadraticCurveTo(ox + s * 0.8, oy + s * 0.9, ox + s * 0.75, oy + s); g.lineTo(ox + s, oy + s); g.closePath(); g.fill();
    // Chapultepec hill
    g.fillStyle = '#7f8f55'; g.beginPath(); g.ellipse(ox + s * 0.05, oy + s * 0.42, s * 0.05, s * 0.035, 0, 0, 7); g.fill();
    // dike
    g.strokeStyle = '#8a7358'; g.lineWidth = s * 0.012;
    g.beginPath(); g.moveTo(ox + s * 0.84, oy + s * 0.02); g.quadraticCurveTo(ox + s * 0.9, oy + s * 0.4, ox + s * 0.8, oy + s * 0.78); g.stroke();
    // causeways
    g.strokeStyle = '#d8c79a'; g.lineWidth = s * 0.018; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(ox + s * 0.5, oy + s * 0.68); g.lineTo(ox + s * 0.5, oy + s); g.stroke();
    g.beginPath(); g.moveTo(ox + s * 0.32, oy + s * 0.5); g.lineTo(ox + s * 0.08, oy + s * 0.52); g.stroke();
    g.beginPath(); g.moveTo(ox + s * 0.5, oy + s * 0.1); g.lineTo(ox + s * 0.52, oy); g.stroke();
    // aqueduct
    g.strokeStyle = '#9a8562'; g.lineWidth = s * 0.008; g.setLineDash([s * 0.012, s * 0.006]);
    g.beginPath(); g.moveTo(ox + s * 0.07, oy + s * 0.42); g.lineTo(ox + s * 0.34, oy + s * 0.44); g.stroke(); g.setLineDash([]);
    // island
    const island = new Path2D();
    island.moveTo(ox + s * 0.36, oy + s * 0.12); island.lineTo(ox + s * 0.64, oy + s * 0.1); island.quadraticCurveTo(ox + s * 0.76, oy + s * 0.3, ox + s * 0.74, oy + s * 0.5);
    island.quadraticCurveTo(ox + s * 0.72, oy + s * 0.68, ox + s * 0.56, oy + s * 0.7); island.lineTo(ox + s * 0.4, oy + s * 0.7); island.quadraticCurveTo(ox + s * 0.28, oy + s * 0.6, ox + s * 0.3, oy + s * 0.42);
    island.quadraticCurveTo(ox + s * 0.3, oy + s * 0.22, ox + s * 0.36, oy + s * 0.12); island.closePath();
    g.fillStyle = '#d9c9a0'; g.fill(island); g.strokeStyle = '#6b5a3a'; g.lineWidth = 2; g.stroke(island);
    // chinampas around the island
    const rnd = U.rng(9);
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 60; i++) {
      const a = (i + ring * 0.5) / 60 * Math.PI * 2, rr = 0.255 + ring * 0.028;
      const x = ox + s * (0.52 + Math.cos(a) * rr * 0.95), y = oy + s * (0.41 + Math.sin(a) * rr * 1.15);
      if (g.isPointInPath(island, x * dpr, y * dpr) || rnd() < 0.25) continue;
      if (Math.abs(Math.cos(a)) < 0.12 && Math.sin(a) > 0) continue; // leave the southern causeway clear
      g.fillStyle = rnd() < 0.5 ? '#6f9a52' : '#88ab5c'; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillRect(-s * 0.011, -s * 0.0045, s * 0.022, s * 0.009); g.restore();
    }
    // canals & houses grid
    g.save(); g.clip(island);
    for (let gx = 0.3; gx < 0.76; gx += 0.035) for (let gy = 0.1; gy < 0.72; gy += 0.035) {
      g.fillStyle = rnd() < 0.15 ? '#c9b78a' : '#ece0c2'; g.fillRect(ox + s * gx + 2, oy + s * gy + 2, s * 0.026, s * 0.026);
      g.fillStyle = 'rgba(180,80,50,0.3)'; if (rnd() < 0.3) g.fillRect(ox + s * gx + 4, oy + s * gy + 4, s * 0.012, s * 0.012);
    }
    g.strokeStyle = '#6aa6b0'; g.lineWidth = s * 0.006;
    for (const fx of [0.4, 0.62]) { g.beginPath(); g.moveTo(ox + s * fx, oy + s * 0.1); g.lineTo(ox + s * fx, oy + s * 0.72); g.stroke(); }
    for (const fy of [0.3, 0.6]) { g.beginPath(); g.moveTo(ox + s * 0.28, oy + s * fy); g.lineTo(ox + s * 0.76, oy + s * fy); g.stroke(); }
    g.restore();
    // sacred precinct and Templo Mayor
    g.fillStyle = '#f1e7cf'; g.strokeStyle = '#6b5a3a'; g.lineWidth = 2;
    g.fillRect(ox + s * 0.43, oy + s * 0.42, s * 0.14, s * 0.15); g.strokeRect(ox + s * 0.43, oy + s * 0.42, s * 0.14, s * 0.15);
    for (let k = 0; k < 4; k++) { const w = s * (0.08 - k * 0.016); g.fillStyle = k % 2 ? '#d6c49a' : '#c7b285'; g.fillRect(ox + s * 0.5 - w / 2, oy + s * 0.5 - w / 2, w, w); g.strokeRect(ox + s * 0.5 - w / 2, oy + s * 0.5 - w / 2, w, w); }
    g.fillStyle = '#3a5f9a'; g.fillRect(ox + s * 0.485, oy + s * 0.485, s * 0.012, s * 0.012);
    g.fillStyle = '#9b2d20'; g.fillRect(ox + s * 0.503, oy + s * 0.485, s * 0.012, s * 0.012);
    // market
    g.fillStyle = '#efe0bd'; g.fillRect(ox + s * 0.44, oy + s * 0.14, s * 0.12, s * 0.09); g.strokeRect(ox + s * 0.44, oy + s * 0.14, s * 0.12, s * 0.09);
    for (let i = 0; i < 40; i++) { g.fillStyle = U.pick(['#b8462e', '#1f7a5a', '#c9973e', '#3a5f9a']); g.fillRect(ox + s * (0.45 + rnd() * 0.1), oy + s * (0.15 + rnd() * 0.07), 3, 3); }
    g.font = `italic ${Math.max(12, s / 45)}px "IM Fell English", Georgia, serif`; g.fillStyle = 'rgba(20,50,60,0.8)'; g.textAlign = 'center';
    g.fillText('Lake Texcoco', ox + s * 0.18, oy + s * 0.86);
    g.textAlign = 'left'; g.fillText('Chapultepec', ox + s * 0.02, oy + s * 0.36); g.textAlign = 'center';
    g.strokeStyle = '#c9973e'; g.lineWidth = 3; g.strokeRect(ox + 1.5, oy + 1.5, s - 3, s - 3);
    S.cityImg = c;
  }
  let canoes = [];
  function drawCity(g, dt) {
    if (!S.cityImg) renderCity();
    g.drawImage(S.cityImg, 0, 0, W, H);
    const G = cityGeo();
    if (canoes.length < 14) canoes.push({ a: Math.random() * Math.PI * 2, r: 0.3 + Math.random() * 0.12, v: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.08) });
    g.fillStyle = '#4a3020';
    for (const c of canoes) { c.a += c.v * dt; const [x, y] = G.P(0.52 + Math.cos(c.a) * c.r * 0.95, 0.41 + Math.sin(c.a) * c.r * 1.15); g.save(); g.translate(x, y); g.rotate(c.a + Math.PI / 2); g.fillRect(-1.5, -6, 3, 12); g.restore(); }
    // spots
    for (const sp of CITY) {
      const [x, y] = G.P(sp.x, sp.y);
      const found = S.found.has(sp.id), near = Math.hypot(pointer.x - x, pointer.y - y) < G.s * 0.1;
      const pr = (Math.sin(t * 3 + sp.x * 10) + 1) / 2;
      if (found) { g.fillStyle = '#9b2d20'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); continue; }
      g.fillStyle = `rgba(255,230,140,${(near ? 0.55 : 0.18) + pr * 0.3})`; g.beginPath(); g.arc(x, y, (near ? 20 : 12) + pr * 5, 0, 7); g.fill();
      g.fillStyle = '#fff6d0'; g.font = `${near ? 22 : 15}px serif`; g.textAlign = 'center'; g.fillText('✦', x, y + 6);
    }
    // lens around pointer
    if (pointer.x > G.ox && pointer.x < G.ox + G.s && pointer.y > G.oy && pointer.y < G.oy + G.s) {
      g.strokeStyle = 'rgba(255,240,200,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(pointer.x, pointer.y, G.s * 0.1, 0, 7); g.stroke();
    }
  }
  function cityClick(x, y) {
    const G = cityGeo();
    for (const sp of CITY) {
      const [sx, sy] = G.P(sp.x, sp.y);
      if (Math.hypot(sx - x, sy - y) < Math.max(26, G.s * 0.05)) {
        const fresh = record(sp.id, sp.t);
        cityPanel(`<div class="term-card"><div class="k">${fresh ? 'NEW DISCOVERY' : 'DISCOVERY'}</div><div class="t">${sp.t}</div><div class="d">${sp.d}</div></div>`);
        return;
      }
    }
  }
  function drawScene(g) {
    if (!S.sceneImg) { const c = U.canvas(1200, 520); Art.scene(c, S.scene, S.ch * 7 + (S.fallIdx || 0) * 3 + 1); S.sceneImg = c; }
    g.fillStyle = '#2b1d10'; g.fillRect(0, 0, W, H);
    const ar = 1200 / 520; let w = W - 20, h = w / ar; if (h > H - 20) { h = H - 20; w = h * ar; }
    g.drawImage(S.sceneImg, (W - w) / 2, (H - h) / 2, w, h);
  }
  function loop(now) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const g = ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.view === 'march') drawMarch(g, dt); else if (S.view === 'city') drawCity(g, dt); else drawScene(g);
  }

  /* ---------------- Map glyph (the Easter egg) --------------------------- */
  function drawGlyph(g, x, y, r, time) {
    const pr = (Math.sin(time * 2.2) + 1) / 2;
    const glow = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    glow.addColorStop(0, `rgba(255,214,100,${0.45 + pr * 0.35})`); glow.addColorStop(1, 'rgba(255,214,100,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill();
    g.save(); g.translate(x, y); g.rotate(time * 0.3);
    g.fillStyle = '#e8b84a'; g.strokeStyle = '#6b4a10'; g.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-r * 0.25, -r * 0.8); g.lineTo(0, -r * 1.35); g.lineTo(r * 0.25, -r * 0.8); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
    g.fillStyle = '#f6d27a'; g.beginPath(); g.arc(x, y, r * 0.85, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#8a5d17'; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.stroke();
    g.fillStyle = '#8a5d17'; g.beginPath(); g.arc(x - r * 0.2, y - r * 0.1, r * 0.08, 0, 7); g.arc(x + r * 0.2, y - r * 0.1, r * 0.08, 0, 7); g.fill();
    g.beginPath(); g.arc(x, y + r * 0.12, r * 0.22, 0.2, Math.PI - 0.2); g.stroke();
  }

  function bind() {
    const cv = $('bonusCanvas');
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointermove', e => { [pointer.x, pointer.y] = pos(e); });
    cv.addEventListener('pointerleave', () => { pointer.x = pointer.y = -999; });
    cv.addEventListener('pointerdown', e => {
      const [x, y] = pos(e); pointer.x = x; pointer.y = y;
      if (!S) return;
      if (S.view === 'march') marchClick(x, y); else if (S.view === 'city') cityClick(x, y);
    });
    $('bonusExit').onclick = () => { Sound.play('click'); close(); };
    window.addEventListener('resize', () => { if (frame) layout(); });
  }
  // after a march quiz is answered the next marker becomes available
  const _quizHook = () => { if (S && S.view === 'march') S.answered = true; };
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#bonusPanel .opt')) _quizHook(); });

  // used by automated tests to find things on the canvas
  const _debug = {
    state: () => S,
    nodeXY: i => { const G = marchGeo(); return G.P(MARCH[i].lat, MARCH[i].lon); },
    noteXY: i => { const G = marchGeo(); return G.P(MARCH_NOTES[i].lat, MARCH_NOTES[i].lon); },
    cityXY: i => { const G = cityGeo(); return G.P(CITY[i].x, CITY[i].y); },
  };
  return { open, bind, unlocked, drawGlyph, _debug, get active() { return !!frame; } };
})();
