/* Masala Mayhem — core game */
(() => {
'use strict';

const TILES = window.MM_TILES;
const LEVELS = window.MM_LEVELS;
const CONFIG = window.MM_CONFIG || {};
const ROWS = 8, COLS = 8;
const SAVE_KEY = 'masala-mayhem-v1';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(res => setTimeout(res, ms));
const rand = n => Math.floor(Math.random() * n);
const K = (r, c) => r * COLS + c;
const RC = k => [Math.floor(k / COLS), k % COLS];
const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const shuffleArr = a => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* =========================================================
   Save data
   ========================================================= */
function defaultSave() {
  return { stars: {}, best: {}, boosters: { pin: 3, whisk: 3, saffron: 2 }, muted: false, recipeSeen: false };
}
let save = defaultSave();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = JSON.parse(raw);
    save = Object.assign(defaultSave(), s);
    save.boosters = Object.assign(defaultSave().boosters, s.boosters || {});
  }
} catch (e) { /* storage unavailable — play without saving */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

/* =========================================================
   Native bridge (iOS app). On the website none of this runs.
   ========================================================= */
const Native = (() => {
  const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mm;
  const waiting = {};
  let n = 0;
  return {
    on: !!h,
    post(msg) { if (h) { try { h.postMessage(msg); } catch (e) {} } },
    // resolves true if the player watched the whole rewarded ad
    rewarded() {
      return new Promise(res => {
        if (!h) { res(true); return; }
        const id = ++n; waiting[id] = res;
        h.postMessage({ type: 'rewarded', id });
      });
    },
    resolve(id, ok) { const f = waiting[id]; delete waiting[id]; if (f) f(!!ok); }
  };
})();
window.MMNative = {
  onReward(id, ok) {
    Native.resolve(id, ok);
    if (!ok) toast('No video available right now — try again in a moment');
  }
};
let levelsFinished = 0;
function maybeInterstitial() {
  if (!Native.on || !G || !G.ended) return;
  G.ended = false;
  levelsFinished++;
  // never in the first two levels a player finishes; then every 2nd level
  if (levelsFinished >= 3 && levelsFinished % 2 === 1) Native.post({ type: 'interstitial' });
}

/* =========================================================
   Sound (synthesised with Web Audio — no files needed)
   ========================================================= */
const Sound = (() => {
  let ctx = null, noiseBuf = null;
  function ac() {
    if (save.muted) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noiseSrc(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, type, freq, vol, when = 0, freqTo, q = 1) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const s = noiseSrc(c), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
  }
  return {
    unlock() { ac(); },
    swap() { tone(520, 0.08, 'triangle', 0.08, 0, 720); },
    bad() { tone(220, 0.14, 'square', 0.04, 0, 150); },
    pop(combo) { const f = 660 + Math.min(combo, 8) * 95; tone(f, 0.13, 'triangle', 0.12); tone(f * 2.01, 0.09, 'sine', 0.05, 0.015); },
    grind() { for (let i = 0; i < 4; i++) noise(0.12, 'bandpass', 280 + i * 45, 0.5, i * 0.085, null, 3); },
    whoosh() { noise(0.35, 'bandpass', 400, 0.45, 0, 3200, 2); },
    sizzle() { noise(0.9, 'highpass', 2600, 0.35); noise(0.35, 'lowpass', 180, 0.6); },
    bell() { tone(988, 1.1, 'sine', 0.1); tone(1976, 0.6, 'sine', 0.035); },
    crack() { noise(0.08, 'highpass', 1200, 0.45); tone(170, 0.1, 'square', 0.04); },
    born() { tone(1320, 0.15, 'sine', 0.06, 0, 1760); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.11, i * 0.11)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.45, 'triangle', 0.09, i * 0.18)); },
    click() { tone(880, 0.05, 'sine', 0.06); }
  };
})();

/* =========================================================
   Art (inline SVG)
   ========================================================= */
const ART = {
  paan: `<path d="M50 90 C22 70 7 50 15 31 C23 13 42 13 50 28 C58 13 77 13 85 31 C93 50 78 70 50 90Z" fill="#3a9a3f" stroke="#1d5a22" stroke-width="4"/>
    <path d="M50 30 L50 84 M50 47 L35 37 M50 47 L65 37 M50 63 L37 55 M50 63 L63 55" stroke="#a8dc8e" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M28 30 C32 24 38 23 42 27" stroke="#8fd07a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`,
  saffron: `<ellipse cx="50" cy="84" rx="22" ry="8" fill="#ffd9a0" stroke="#c97a1c" stroke-width="3"/>
    <g fill="none" stroke-linecap="round">
      <path d="M50 84 C47 62 35 42 24 20" stroke="#c43a0c" stroke-width="10"/>
      <path d="M50 84 C50 60 51 38 51 14" stroke="#ff6a1a" stroke-width="10"/>
      <path d="M50 84 C54 62 66 42 78 21" stroke="#ff8f2a" stroke-width="10"/>
    </g>
    <g fill="#ffc31a" stroke="#c46a00" stroke-width="2"><circle cx="23" cy="17" r="8"/><circle cx="51" cy="11" r="8"/><circle cx="79" cy="18" r="8"/></g>`,
  cardamom: `<g transform="rotate(-28 50 50)">
      <ellipse cx="50" cy="53" rx="25" ry="37" fill="#1fa79a" stroke="#0e5f57" stroke-width="4"/>
      <path d="M50 17 C38 40 38 66 50 89 M50 17 C62 40 62 66 50 89" stroke="#0e5f57" stroke-width="3" fill="none"/>
      <path d="M50 16 L50 6" stroke="#0e5f57" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="41" cy="40" rx="5" ry="11" fill="#9ff0e2" opacity=".7"/>
    </g>`,
  fennel: `<g fill="#d4b12a" stroke="#6f5a0e" stroke-width="3">
      <ellipse cx="33" cy="54" rx="11" ry="30" transform="rotate(-24 33 54)"/>
      <ellipse cx="67" cy="54" rx="11" ry="30" transform="rotate(24 67 54)"/>
      <ellipse cx="50" cy="48" rx="12" ry="34"/>
    </g>
    <g stroke="#8a7214" stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M46 22 L46 74 M54 22 L54 74"/>
    </g>
    <ellipse cx="46" cy="32" rx="3" ry="8" fill="#fff2a8" opacity=".75"/>`,
  rose: `<g fill="#ee5a8f" stroke="#a3244f" stroke-width="3">
      ${[0, 72, 144, 216, 288].map(a => `<ellipse cx="50" cy="28" rx="15" ry="22" transform="rotate(${a} 50 50)"/>`).join('')}
    </g>
    <circle cx="50" cy="50" r="14" fill="#c2185b" stroke="#7a0f38" stroke-width="3"/>
    <circle cx="46" cy="46" r="5" fill="#ffc1d8"/>`,
  chili: `<path d="M24 30 C21 54 40 82 88 88 C66 74 55 52 50 32 C45 23 30 21 24 30Z" fill="#d32f2f" stroke="#7f1212" stroke-width="4" stroke-linejoin="round"/>
    <path d="M32 38 C33 52 44 68 62 78" stroke="#ff8a80" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M36 26 C34 14 42 8 52 8" stroke="#2e7d32" stroke-width="7" fill="none" stroke-linecap="round"/>
    <ellipse cx="37" cy="27" rx="14" ry="7" fill="#43a047" stroke="#1b5e20" stroke-width="3"/>`
};

function wildArt() {
  const dots = TILES.map((t, i) => {
    const a = i * Math.PI / 3 - Math.PI / 2;
    return `<circle cx="${(50 + Math.cos(a) * 22).toFixed(1)}" cy="${(50 + Math.sin(a) * 22).toFixed(1)}" r="9.5" fill="${t.color}" stroke="#546e7a" stroke-width="2"/>`;
  }).join('');
  return `<circle cx="50" cy="50" r="44" fill="#b0bec5" stroke="#455a64" stroke-width="4"/>
    <circle cx="50" cy="50" r="37" fill="#eceff1"/>${dots}
    <circle cx="50" cy="50" r="8" fill="#ffca28" stroke="#546e7a" stroke-width="2"/>`;
}
const ingredientArt = c => c < 0 ? wildArt() : ART[TILES[c].id];

function tileSVG(t) {
  const inner = ingredientArt(t.c);
  const col = t.c < 0 ? '#ffca28' : TILES[t.c].color;
  let body;
  switch (t.s) {
    case 'mortar':
      body = `<path d="M60 62 L86 14" stroke="#616161" stroke-width="12" stroke-linecap="round"/>
        <path d="M60 62 L86 14" stroke="#9e9e9e" stroke-width="5" stroke-linecap="round"/>
        <g transform="translate(22 0) scale(.56)">${inner}</g>
        <path d="M9 50 H91 C91 77 72 95 50 95 C28 95 9 77 9 50Z" fill="#8d8d8d" stroke="#3d3d3d" stroke-width="4"/>
        <rect x="6" y="45" width="88" height="11" rx="5.5" fill="${col}" stroke="#3d3d3d" stroke-width="3"/>
        <path d="M24 68 Q50 77 76 68" stroke="#c4c4c4" stroke-width="3" fill="none"/>`;
      break;
    case 'belanH':
    case 'belanV':
      body = `<g transform="translate(13 13) scale(.74)">${inner}</g>
        <g ${t.s === 'belanV' ? 'transform="rotate(90 50 50)"' : ''}>
          <rect x="2" y="44" width="18" height="12" rx="6" fill="#8d5a2b" stroke="#4e2f14" stroke-width="2.5"/>
          <rect x="80" y="44" width="18" height="12" rx="6" fill="#8d5a2b" stroke="#4e2f14" stroke-width="2.5"/>
          <rect x="15" y="38" width="70" height="24" rx="12" fill="#d9a066" stroke="#6d4424" stroke-width="3.5"/>
          <rect x="22" y="42" width="56" height="6" rx="3" fill="#f6d7a7" opacity=".85"/>
        </g>`;
      break;
    case 'tadka':
      body = `<circle cx="50" cy="50" r="49" fill="url(#tadkaGlow)"/>
        <g transform="translate(24 6) scale(.52)">${inner}</g>
        <path d="M11 55 H89 C87 79 70 93 50 93 C30 93 13 79 11 55Z" fill="#3b2f2a" stroke="#140e0b" stroke-width="4"/>
        <circle cx="8" cy="60" r="6" fill="none" stroke="#140e0b" stroke-width="4"/>
        <circle cx="92" cy="60" r="6" fill="none" stroke="#140e0b" stroke-width="4"/>
        <rect x="11" y="52" width="78" height="8" rx="4" fill="${col}"/>
        <path d="M34 80 q4 -9 8 0 M46 83 q4 -11 8 0 M58 80 q4 -9 8 0" stroke="#ffb300" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      break;
    default:
      body = inner;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}

function garlandSVG(n) {
  const line = (x1, y1, x2, y2) => {
    let o = '';
    for (let i = 0; i <= 8; i++) {
      const x = (x1 + (x2 - x1) * i / 8).toFixed(1), y = (y1 + (y2 - y1) * i / 8).toFixed(1);
      o += `<circle cx="${x}" cy="${y}" r="8" fill="${i % 2 ? '#ffc107' : '#ff7b00'}" stroke="#a64200" stroke-width="1.8"/>`;
    }
    return o;
  };
  return `<svg viewBox="0 0 100 100">${line(6, 6, 94, 94)}${n > 1 ? line(94, 6, 6, 94) : ''}
    <circle cx="50" cy="50" r="10" fill="#e53935" stroke="#7f0000" stroke-width="2.5"/>
    <path d="M50 42 L56 34 M50 42 L44 34" stroke="#2e7d32" stroke-width="4" stroke-linecap="round"/></svg>`;
}

function kulhadSVG(hp) {
  return `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="91" rx="30" ry="5" fill="rgba(0,0,0,.28)"/>
    <path d="M16 20 H84 L73 89 H27 Z" fill="#b8612f" stroke="#5e2810" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="50" cy="20" rx="34" ry="8.5" fill="#6e2e14" stroke="#5e2810" stroke-width="4"/>
    <path d="M24 38 H76" stroke="#d98a55" stroke-width="3"/>
    ${hp > 1 ? '<path d="M22 56 H78" stroke="#f5e1c0" stroke-width="6"/>' :
      '<path d="M44 26 L53 45 L42 58 L51 76" stroke="#2e1206" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 32 L59 50" stroke="#2e1206" stroke-width="3.5" stroke-linecap="round"/>'}
  </svg>`;
}

function diyaSVG(lit) {
  return `<svg viewBox="0 0 100 100">
    ${lit ? '<circle cx="50" cy="38" r="36" fill="url(#diyaGlow)"/><path d="M50 14 C62 30 62 44 50 52 C38 44 38 30 50 14Z" fill="#ffd54f" stroke="#ff6f00" stroke-width="3"/>'
          : '<path d="M50 40 L50 52" stroke="#5d4037" stroke-width="3" stroke-linecap="round"/>'}
    <path d="M12 54 C22 82 78 82 88 54 C70 61 30 61 12 54Z" fill="${lit ? '#e65100' : '#8d6e63'}" stroke="#3e2723" stroke-width="4" stroke-linejoin="round"/>
    <path d="M84 56 L94 48" stroke="#3e2723" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}

const STAR_SVG = `<svg viewBox="0 0 100 100"><path d="M50 6 L62 37 L95 38 L69 58 L78 91 L50 72 L22 91 L31 58 L5 38 L38 37Z" stroke-linejoin="round"/></svg>`;

function goalIcon(g) {
  switch (g.type) {
    case 'score': return `<span class="star-ico">${STAR_SVG}</span>`;
    case 'collect': return `<svg viewBox="0 0 100 100">${ingredientArt(TILES.findIndex(t => t.id === g.tile))}</svg>`;
    case 'diya': return diyaSVG(false);
    case 'kulhad': return kulhadSVG(2);
    case 'garland': return garlandSVG(1);
  }
  return '';
}
function goalText(g) {
  switch (g.type) {
    case 'score': return `Reach <b>${g.target.toLocaleString()}</b> points`;
    case 'collect': return `Collect <b>${g.count}</b> ${TILES.find(t => t.id === g.tile).name}`;
    case 'diya': return `Light every <b>diya</b> (${G.totals.diya})`;
    case 'kulhad': return `Break every <b>kulhad</b> (${G.totals.kulhad})`;
    case 'garland': return `Untie every <b>garland</b> (${G.totals.garland})`;
  }
  return '';
}

/* =========================================================
   Game state
   ========================================================= */
let G = null;   // current level state
let S = 48;     // cell size in px

const newTile = (c, s = null) => ({ id: ++G.tileId, c, s, el: null });
const swappable = cell => cell && !cell.v && !cell.k && !cell.g && !!cell.t;
const gravityFixed = cell => cell.v || cell.k > 0 || cell.g > 0;

function colorAt(r, c) {
  const cell = G.cells[K(r, c)];
  if (cell.v || cell.k || !cell.t) return null;
  return cell.t.c;
}
const same = (a, k) => a !== null && (a === k || a === -1);

function findMatches() {
  const runs = [], squares = [], seen = new Set();
  const n = G.L.colors;
  for (let k = 0; k < n; k++) {
    // horizontal
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        if (!same(colorAt(r, c), k)) { c++; continue; }
        let e = c;
        while (e + 1 < COLS && same(colorAt(r, e + 1), k)) e++;
        if (e - c + 1 >= 3) {
          const id = `h${r}:${c}:${e}`;
          if (!seen.has(id)) { seen.add(id); const cells = []; for (let x = c; x <= e; x++) cells.push(K(r, x)); runs.push({ dir: 'h', cells, color: k }); }
        }
        c = e + 1;
      }
    }
    // vertical
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        if (!same(colorAt(r, c), k)) { r++; continue; }
        let e = r;
        while (e + 1 < ROWS && same(colorAt(e + 1, c), k)) e++;
        if (e - r + 1 >= 3) {
          const id = `v${c}:${r}:${e}`;
          if (!seen.has(id)) { seen.add(id); const cells = []; for (let y = r; y <= e; y++) cells.push(K(y, c)); runs.push({ dir: 'v', cells, color: k }); }
        }
        r = e + 1;
      }
    }
    // 2x2 squares
    for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS - 1; c++) {
      if (same(colorAt(r, c), k) && same(colorAt(r, c + 1), k) && same(colorAt(r + 1, c), k) && same(colorAt(r + 1, c + 1), k)) {
        const id = `s${r}:${c}`;
        if (!seen.has(id)) { seen.add(id); squares.push({ cells: [K(r, c), K(r, c + 1), K(r + 1, c), K(r + 1, c + 1)], color: k }); }
      }
    }
  }
  return { runs, squares };
}
const anyMatch = () => { const m = findMatches(); return m.runs.length > 0 || m.squares.length > 0; };

/* decide which special tiles a set of matches creates */
function planSpecials(runs, squares, pivots) {
  const matched = new Set();
  runs.forEach(r => r.cells.forEach(k => matched.add(k)));
  squares.forEach(s => s.cells.forEach(k => matched.add(k)));
  const used = new Set(), creations = [];
  const ok = k => !used.has(k) && !G.cells[k].g;
  const free = cells => !cells.some(k => used.has(k));
  const pick = cells => {
    for (const p of (pivots || [])) if (cells.includes(p) && ok(p)) return p;
    const f = cells.filter(ok);
    return f.length ? f[Math.floor(f.length / 2)] : null;
  };
  const claim = (cells, k, color, s) => { cells.forEach(x => used.add(x)); if (k !== null) creations.push({ k, c: color, s }); };

  // straight 5+ → Tadka
  for (const r of runs) if (r.cells.length >= 5 && free(r.cells)) claim(r.cells, pick(r.cells), r.color, 'tadka');
  // L / T shapes → Tadka
  const hs = runs.filter(r => r.dir === 'h'), vs = runs.filter(r => r.dir === 'v');
  for (const h of hs) for (const v of vs) {
    if (h.color !== v.color || !free(h.cells) || !free(v.cells)) continue;
    const x = h.cells.find(k => v.cells.includes(k));
    if (x === undefined) continue;
    const all = [...h.cells, ...v.cells];
    claim(all, ok(x) ? x : pick(all), h.color, 'tadka');
  }
  // 4 in a line → Rolling Pin
  for (const r of runs) if (r.cells.length === 4 && free(r.cells)) claim(r.cells, pick(r.cells), r.color, r.dir === 'h' ? 'belanH' : 'belanV');
  // 2x2 square → Mortar & Pestle
  for (const s of squares) if (free(s.cells)) claim(s.cells, pick(s.cells), s.color, 'mortar');

  return { matched, creations };
}

function specialArea(s, k) {
  const [r, c] = RC(k), out = [];
  const add = (rr, cc) => { if (inBounds(rr, cc)) out.push(K(rr, cc)); };
  if (s === 'belanH') for (let i = 0; i < COLS; i++) add(r, i);
  else if (s === 'belanV') for (let i = 0; i < ROWS; i++) add(i, c);
  else {
    const rad = s === 'tadka' ? 2 : 1;
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) add(r + dr, c + dc);
  }
  return out;
}

function swapData(a, b) { const t = G.cells[a].t; G.cells[a].t = G.cells[b].t; G.cells[b].t = t; }

function findMove() {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = K(r, c);
    if (!swappable(G.cells[a])) continue;
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const rr = r + dr, cc = c + dc;
      if (!inBounds(rr, cc)) continue;
      const b = K(rr, cc);
      if (!swappable(G.cells[b])) continue;
      if (G.cells[a].t.s && G.cells[b].t.s) return [a, b];
      swapData(a, b); const m = anyMatch(); swapData(a, b);
      if (m) return [a, b];
    }
  }
  return null;
}

/* =========================================================
   Level setup
   ========================================================= */
function startLevel(idx) {
  const L = LEVELS[idx];
  G = {
    idx, L, cells: [], score: 0, moves: L.moves,
    collected: new Array(TILES.length).fill(0),
    busy: true, over: false, sel: null, booster: null,
    tileId: 0, combo: 0, extraUsed: false, hintTimer: null
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = L.layout[r][c];
    const cell = { v: false, diya: 0, k: 0, g: 0, t: null, cellEl: null, overEl: null };
    switch (ch) {
      case 'X': cell.v = true; break;
      case 'D': cell.diya = 1; break;
      case 'g': cell.g = 1; break;
      case 'G': cell.g = 2; break;
      case 'k': cell.k = 1; break;
      case 'K': cell.k = 2; break;
      case 'a': cell.diya = 1; cell.g = 1; break;
      case 'b': cell.diya = 1; cell.g = 2; break;
    }
    G.cells.push(cell);
  }
  G.totals = {
    diya: G.cells.filter(c => c.diya).length,
    kulhad: G.cells.filter(c => c.k).length,
    garland: G.cells.filter(c => c.g).length
  };
  fillInitial();
  $('#hudGhat').textContent = L.ghat;
  $('#hudTitle').textContent = `${L.id}. ${L.title}`;
  show('game');
  buildBoardDOM();
  setupStarMarks();
  updateHUD();
  renderBoosters();
  showIntro();
}

function fillInitial() {
  for (let attempt = 0; attempt < 60; attempt++) {
    G.cells.forEach(cell => { cell.t = null; });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = G.cells[K(r, c)];
      if (cell.v || cell.k) continue;
      const bad = new Set();
      const col = (rr, cc) => inBounds(rr, cc) ? colorAt(rr, cc) : null;
      if (c >= 2 && col(r, c - 1) !== null && col(r, c - 1) === col(r, c - 2)) bad.add(col(r, c - 1));
      if (r >= 2 && col(r - 1, c) !== null && col(r - 1, c) === col(r - 2, c)) bad.add(col(r - 1, c));
      if (r >= 1 && c >= 1) {
        const a = col(r - 1, c), b = col(r, c - 1), d = col(r - 1, c - 1);
        if (a !== null && a === b && a === d) bad.add(a);
      }
      const opts = [];
      for (let i = 0; i < G.L.colors; i++) if (!bad.has(i)) opts.push(i);
      cell.t = newTile(opts[rand(opts.length)]);
    }
    if (!anyMatch() && findMove()) return;
  }
  shuffleData();
}

/* =========================================================
   Board DOM
   ========================================================= */
const board = $('#board');

function computeSize() {
  const wrap = $('#boardWrap');
  const w = Math.min(window.innerWidth - 16, 560);
  const h = wrap.clientHeight > 100 ? wrap.clientHeight - 8 : window.innerHeight - 270;
  S = Math.max(30, Math.floor(Math.min(w, h) / COLS));
  board.style.width = S * COLS + 'px';
  board.style.height = S * ROWS + 'px';
  board.style.setProperty('--s', S + 'px');
}

function place(el, r, c) {
  el.style.transform = `translate(${c * S}px, ${r * S}px)`;
  el.style.width = el.style.height = S + 'px';
}

function buildBoardDOM() {
  computeSize();
  const cl = $('#cellLayer'), tl = $('#tileLayer'), ol = $('#overLayer');
  cl.innerHTML = ''; tl.innerHTML = ''; ol.innerHTML = ''; $('#fxLayer').innerHTML = '';
  G.cells.forEach((cell, k) => {
    const [r, c] = RC(k);
    const d = document.createElement('div');
    place(d, r, c); cell.cellEl = d; cl.appendChild(d);
    const o = document.createElement('div');
    place(o, r, c); cell.overEl = o; ol.appendChild(o);
    if (cell.t) createTileEl(cell.t, r, c);
    renderCell(k);
  });
  (G.L.currents || []).forEach(r => {
    const b = document.createElement('div');
    b.className = 'current';
    b.style.top = (r * S) + 'px'; b.style.height = S + 'px';
    cl.appendChild(b);
  });
}

function renderCell(k) {
  const cell = G.cells[k];
  const [r, c] = RC(k);
  cell.cellEl.className = 'cell' + ((r + c) % 2 ? ' alt' : '') + (cell.v ? ' void' : '') +
    (cell.diya === 1 ? ' diya-off' : '') + (cell.diya === 2 ? ' diya-on' : '');
  let html = '';
  if (cell.k > 0) html = kulhadSVG(cell.k);
  else if (cell.g > 0) html = garlandSVG(cell.g);
  if (cell.diya) html += `<div class="badge">${diyaSVG(cell.diya === 2)}</div>`;
  cell.overEl.innerHTML = html;
  cell.overEl.className = 'over' + (cell.k > 0 ? ' kulhad' : '') + (cell.g > 0 ? ' garland' : '');
}

function tileClass(t) { return 'tile' + (t.s ? ' special ' + t.s : '') + (t.c < 0 ? ' wild' : ''); }

function createTileEl(t, r, c) {
  const el = document.createElement('div');
  el.className = tileClass(t);
  el.innerHTML = tileSVG(t);
  place(el, r, c);
  $('#tileLayer').appendChild(el);
  t.el = el;
  return el;
}
function refreshTile(t) {
  if (!t.el) return;
  t.el.innerHTML = tileSVG(t);
  t.el.className = tileClass(t);
}
function flashBorn(t) {
  if (!t.el) return;
  t.el.classList.remove('born'); void t.el.offsetWidth; t.el.classList.add('born');
}
function positionAll() {
  G.cells.forEach((cell, k) => {
    if (cell.t && cell.t.el) { const [r, c] = RC(k); cell.t.el.style.transform = `translate(${c * S}px, ${r * S}px)`; }
  });
}

/* =========================================================
   Effects
   ========================================================= */
const fxLayer = $('#fxLayer');
const center = k => { const [r, c] = RC(k); return { x: c * S + S / 2, y: r * S + S / 2 }; };

function fxSpecial(s, k) {
  const [r, c] = RC(k), { x, y } = center(k);
  const d = document.createElement('div');
  if (s === 'belanH') {
    d.className = 'fx streak h';
    d.style.top = (r * S + S * 0.22) + 'px'; d.style.height = (S * 0.56) + 'px';
  } else if (s === 'belanV') {
    d.className = 'fx streak v';
    d.style.left = (c * S + S * 0.22) + 'px'; d.style.width = (S * 0.56) + 'px';
  } else {
    const size = (s === 'tadka' ? 5.4 : 3.2) * S;
    d.className = 'fx ring ' + s;
    d.style.left = (x - size / 2) + 'px'; d.style.top = (y - size / 2) + 'px';
    d.style.width = d.style.height = size + 'px';
  }
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 800);
}
function fxBurst(k, colors, n = 7) {
  const { x, y } = center(k);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const a = Math.random() * Math.PI * 2, dist = S * (0.5 + Math.random() * 0.6);
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', Math.cos(a) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(a) * dist + 'px');
    fxLayer.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}
function floatScore(pts, k) {
  const { x, y } = center(k);
  const d = document.createElement('div');
  d.className = 'float'; d.textContent = '+' + pts;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 950);
}
function cheer(text) {
  const d = document.createElement('div');
  d.className = 'cheer'; d.textContent = text;
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* =========================================================
   Clearing, gravity, cascades
   ========================================================= */
async function applyClear(startSet, creations, opts = {}) {
  const queue = [...startSet];
  const processed = new Set();
  const removed = [];
  const kulhadHit = new Set(), garlandHit = new Set();
  const effects = [];
  let wilds = 0;

  if (!opts.noAdjacent) {
    for (const k of startSet) {
      const [r, c] = RC(k);
      for (const [dr, dc] of DIRS4) {
        const rr = r + dr, cc = c + dc;
        if (inBounds(rr, cc) && G.cells[K(rr, cc)].k > 0) kulhadHit.add(K(rr, cc));
      }
    }
  }
  while (queue.length) {
    const k = queue.shift();
    if (processed.has(k)) continue;
    processed.add(k);
    const cell = G.cells[k];
    if (cell.v) continue;
    if (cell.k > 0) { kulhadHit.add(k); continue; }
    if (cell.g > 0) { garlandHit.add(k); continue; }
    const t = cell.t;
    if (!t) continue;
    removed.push({ k, t });
    cell.t = null;
    if (t.s) {
      effects.push({ s: t.s, k });
      if (t.s === 'tadka') wilds += 5;
      for (const a of specialArea(t.s, k)) if (!processed.has(a)) queue.push(a);
    }
  }

  // visuals + sound
  effects.forEach(e => fxSpecial(e.s, e.k));
  if (effects.some(e => e.s === 'tadka')) { Sound.sizzle(); board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake'); }
  else if (effects.some(e => e.s === 'mortar')) Sound.grind();
  if (effects.some(e => e.s.startsWith('belan'))) Sound.whoosh();
  if (removed.length) Sound.pop(G.combo);

  const mult = Math.max(1, G.combo);
  const pts = removed.length * 60 * mult + effects.length * 150;
  G.score += pts;

  removed.forEach(({ k, t }) => {
    if (t.c >= 0) G.collected[t.c]++;
    if (t.el) { const el = t.el; el.classList.add('pop'); setTimeout(() => el.remove(), 300); }
    t.el = null;
  });
  let lit = false;
  removed.forEach(({ k }) => {
    const cell = G.cells[k];
    if (cell.diya === 1) { cell.diya = 2; lit = true; renderCell(k); fxBurst(k, ['#ffd54f', '#ff9800', '#fff3c4'], 9); }
  });
  if (lit) Sound.bell();
  kulhadHit.forEach(k => { const cell = G.cells[k]; cell.k--; renderCell(k); fxBurst(k, ['#b8612f', '#6e2e14', '#d98a55'], 8); });
  if (kulhadHit.size) Sound.crack();
  garlandHit.forEach(k => { G.cells[k].g--; renderCell(k); fxBurst(k, ['#ff7b00', '#ffc107', '#e53935'], 8); });

  if (removed.length) floatScore(pts, removed[Math.floor(removed.length / 2)].k);
  updateHUD();
  await sleep(effects.length ? 330 : 250);

  // new special tiles
  let born = false;
  for (const cr of creations || []) {
    const cell = G.cells[cr.k];
    if (cell.v || cell.k || cell.g || cell.t) continue;
    const t = newTile(cr.c, cr.s);
    cell.t = t;
    const [r, c] = RC(cr.k);
    createTileEl(t, r, c); flashBorn(t); born = true;
  }
  // Tadka scatters Masala Dabba wildcards
  if (wilds) {
    const cands = [];
    G.cells.forEach(cell => { if (cell.t && !cell.t.s && cell.t.c >= 0 && !cell.g) cands.push(cell.t); });
    shuffleArr(cands).slice(0, wilds).forEach(t => { t.c = -1; refreshTile(t); flashBorn(t); });
    born = true;
  }
  if (born) Sound.born();
}

async function gravity() {
  let any = false;
  for (let c = 0; c < COLS; c++) {
    const slots = [];
    for (let r = 0; r < ROWS; r++) if (!gravityFixed(G.cells[K(r, c)])) slots.push(r);
    const tiles = slots.map(r => G.cells[K(r, c)].t).filter(Boolean);
    const empty = slots.length - tiles.length;
    if (!empty) continue;
    any = true;
    const fresh = [];
    for (let i = 0; i < empty; i++) fresh.push(newTile(rand(G.L.colors)));
    fresh.forEach((t, i) => createTileEl(t, i - empty, c));
    const all = fresh.concat(tiles);
    slots.forEach((r, i) => { G.cells[K(r, c)].t = all[i]; });
  }
  if (!any) return;
  void $('#tileLayer').offsetWidth;
  positionAll();
  await sleep(300);
}

async function resolveBoard(pivots) {
  G.combo = 0;
  for (let guard = 0; guard < 80; guard++) {
    const { runs, squares } = findMatches();
    if (!runs.length && !squares.length) break;
    G.combo++;
    if (G.combo === 3) cheer('Wah!');
    else if (G.combo === 5) cheer('Shabash!');
    else if (G.combo === 7) cheer('Kamaal!');
    const plan = planSpecials(runs, squares, pivots);
    await applyClear(plan.matched, plan.creations);
    await gravity();
    pivots = null;
  }
}

async function flowCurrents() {
  let moved = false;
  for (const r of (G.L.currents || [])) {
    const slots = [];
    for (let c = 0; c < COLS; c++) { const cell = G.cells[K(r, c)]; if (!gravityFixed(cell) && cell.t) slots.push(c); }
    if (slots.length < 2) continue;
    const tiles = slots.map(c => G.cells[K(r, c)].t);
    const last = tiles.pop(); tiles.unshift(last);
    slots.forEach((c, i) => { G.cells[K(r, c)].t = tiles[i]; });
    if (last.el) {
      last.el.style.transition = 'none';
      last.el.style.transform = `translate(${(slots[0] - 1) * S}px, ${r * S}px)`;
      void last.el.offsetWidth;
      last.el.style.transition = '';
    }
    moved = true;
  }
  if (moved) { Sound.whoosh(); positionAll(); await sleep(330); }
}

function shuffleData() {
  const keys = [];
  G.cells.forEach((cell, k) => { if (swappable(cell)) keys.push(k); });
  const tiles = keys.map(k => G.cells[k].t);
  for (let a = 0; a < 300; a++) {
    shuffleArr(tiles);
    keys.forEach((k, i) => { G.cells[k].t = tiles[i]; });
    if (!anyMatch() && findMove()) return true;
  }
  for (let a = 0; a < 300; a++) {
    keys.forEach(k => { const t = G.cells[k].t; if (!t.s && t.c >= 0) t.c = rand(G.L.colors); });
    if (!anyMatch() && findMove()) { keys.forEach(k => refreshTile(G.cells[k].t)); return true; }
  }
  return false;
}

async function shuffleBoard(auto) {
  if (auto) toast('No moves left — the Whisk stirs things up!');
  G.cells.forEach(cell => { if (cell.t && cell.t.el) cell.t.el.classList.add('whisk'); });
  shuffleData();
  positionAll(); Sound.whoosh();
  await sleep(500);
  G.cells.forEach(cell => { if (cell.t && cell.t.el) cell.t.el.classList.remove('whisk'); });
}

/* =========================================================
   Player actions
   ========================================================= */
function setSel(k) {
  clearSel();
  G.sel = k;
  const t = G.cells[k].t; if (t && t.el) t.el.classList.add('sel');
  Sound.click();
}
function clearSel() {
  if (!G) return;
  if (G.sel !== null) { const t = G.cells[G.sel].t; if (t && t.el) t.el.classList.remove('sel'); }
  G.sel = null;
}

async function trySwap(a, b) {
  if (!G || G.busy || G.over) return;
  const A = G.cells[a], B = G.cells[b];
  if (!swappable(A) || !swappable(B)) {
    Sound.bad();
    if ((B && (B.g || B.k)) || A.g || A.k) toast('That one is stuck — clear it first');
    return;
  }
  G.busy = true; clearHint();
  swapData(a, b); Sound.swap(); positionAll();
  await sleep(180);
  const ta = G.cells[a].t, tb = G.cells[b].t;
  let valid = false;
  if (ta.s && tb.s) {
    valid = true; G.moves--; updateHUD();
    G.combo = 1; cheer('Double masala!');
    await applyClear(new Set([a, b]), []);
    await gravity();
    await resolveBoard(null);
  } else if (anyMatch()) {
    valid = true; G.moves--; updateHUD();
    await resolveBoard([b, a]);
  } else {
    swapData(a, b); positionAll(); Sound.bad();
    await sleep(180);
  }
  if (valid) await afterMove(true);
  G.busy = false;
  if (!G.over) scheduleHint();
}

async function afterMove(isMove) {
  if (isMove && G.L.currents && G.L.currents.length && !goalsDone()) {
    await flowCurrents();
    await resolveBoard(null);
  }
  if (goalsDone()) { await win(); return; }
  if (G.moves <= 0) { await lose(); return; }
  if (!findMove()) await shuffleBoard(true);
}

/* ---------- input ---------- */
let drag = null;
function boardPoint(e) {
  const rect = board.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / S), r = Math.floor((e.clientY - rect.top) / S);
  return inBounds(r, c) ? { r, c } : null;
}
board.addEventListener('pointerdown', e => {
  Sound.unlock();
  if (!G || G.busy || G.over) return;
  const p = boardPoint(e); if (!p) return;
  drag = { r: p.r, c: p.c, x: e.clientX, y: e.clientY, moved: false };
  try { board.setPointerCapture(e.pointerId); } catch (err) {}
});
board.addEventListener('pointermove', e => {
  if (!drag || drag.moved || !G || G.booster) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) < S * 0.35) return;
  drag.moved = true;
  let r2 = drag.r, c2 = drag.c;
  if (Math.abs(dx) > Math.abs(dy)) c2 += Math.sign(dx); else r2 += Math.sign(dy);
  if (inBounds(r2, c2)) { clearSel(); trySwap(K(drag.r, drag.c), K(r2, c2)); }
});
board.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.moved) onTap(d.r, d.c);
});
board.addEventListener('pointercancel', () => { drag = null; });

function onTap(r, c) {
  if (!G || G.busy || G.over) return;
  const k = K(r, c);
  if (G.booster) { useBoosterAt(k); return; }
  const cell = G.cells[k];
  if (!swappable(cell)) {
    clearSel();
    if (cell.g) toast('Garland-tied — include it in a match to untie it');
    else if (cell.k) toast('Match right next to a kulhad to crack it');
    return;
  }
  if (G.sel === null) { setSel(k); return; }
  if (G.sel === k) { clearSel(); return; }
  const [r0, c0] = RC(G.sel);
  if (Math.abs(r0 - r) + Math.abs(c0 - c) === 1) { const a = G.sel; clearSel(); trySwap(a, k); }
  else setSel(k);
}

/* ---------- hints ---------- */
function scheduleHint() { /* auto-hints turned off */ }
function clearHint() {
  if (!G) return;
  clearTimeout(G.hintTimer);
  $$('.tile.hint').forEach(e => e.classList.remove('hint'));
}

/* ---------- boosters ---------- */
const BOOSTER_NAMES = { pin: 'Rolling Pins', whisk: 'Whisks', saffron: 'Saffron Drops' };
const BOOSTER_SINGLE = { pin: 'Rolling Pin', whisk: 'Whisk', saffron: 'Saffron Drop' };

function renderBoosters() {
  $$('.booster').forEach(b => {
    const id = b.dataset.b;
    b.querySelector('.count').textContent = save.boosters[id];
    b.classList.toggle('empty', !save.boosters[id]);
    b.classList.toggle('active', !!(G && G.booster && G.booster.id === id));
  });
  const dir = $('.booster[data-b="pin"] .dir');
  dir.textContent = G && G.booster && G.booster.id === 'pin' ? (G.booster.dir === 'h' ? '↔' : '↕') : '';
}

function onBooster(id) {
  Sound.unlock();
  if (!G || G.busy || G.over) return;
  clearSel(); clearHint();
  if (save.boosters[id] <= 0) {
    if (Native.on) {
      openModal(`<h2>Out of ${BOOSTER_NAMES[id]}</h2><p>Watch a short video to get one free?</p>
        <div class="modal-btns"><button class="btn primary" data-act="adbooster" data-b="${id}">▶ Watch video</button><button class="btn ghost" data-act="close">No thanks</button></div>`);
    } else toast(`Out of ${BOOSTER_NAMES[id]} — win levels to earn more`);
    return;
  }
  Sound.click();
  if (id === 'whisk') {
    G.booster = null;
    save.boosters.whisk--; persist(); renderBoosters();
    G.busy = true;
    shuffleBoard(false).then(() => { G.busy = false; scheduleHint(); });
    return;
  }
  if (id === 'pin') {
    if (!G.booster || G.booster.id !== 'pin') G.booster = { id: 'pin', dir: 'h' };
    else if (G.booster.dir === 'h') G.booster.dir = 'v';
    else G.booster = null;
  } else if (id === 'saffron') {
    G.booster = G.booster && G.booster.id === 'saffron' ? null : { id: 'saffron' };
  }
  renderBoosters();
  if (G.booster && G.booster.id === 'pin') toast(`Tap a tile to flatten its ${G.booster.dir === 'h' ? 'row' : 'column'} (tap Pin again to turn it)`);
  else if (G.booster && G.booster.id === 'saffron') toast('Tap a spice — every one like it becomes a Rolling Pin');
}

async function useBoosterAt(k) {
  const b = G.booster;
  const [r, c] = RC(k);
  const cell = G.cells[k];
  if (b.id === 'saffron' && (!cell.t || cell.t.c < 0 || cell.t.s || cell.k || cell.v)) {
    toast('Pick a plain spice tile'); return;
  }
  if (b.id === 'pin' && cell.v) return;
  G.booster = null;
  G.busy = true; clearHint();
  save.boosters[b.id]--; persist(); renderBoosters();

  if (b.id === 'pin') {
    const set = new Set();
    for (let i = 0; i < 8; i++) set.add(b.dir === 'h' ? K(r, i) : K(i, c));
    fxSpecial(b.dir === 'h' ? 'belanH' : 'belanV', k); Sound.whoosh();
    G.combo = 1;
    await applyClear(set, [], { noAdjacent: true });
    await gravity();
    await resolveBoard(null);
  } else {
    const col = cell.t.c;
    Sound.bell();
    G.cells.forEach(cc => {
      if (cc.t && cc.t.c === col && !cc.t.s && !cc.g) {
        cc.t.s = Math.random() < 0.5 ? 'belanH' : 'belanV';
        refreshTile(cc.t); flashBorn(cc.t);
      }
    });
    await sleep(450);
  }
  await afterMove(false);
  G.busy = false;
  if (!G.over) scheduleHint();
}

$$('.booster').forEach(b => b.addEventListener('click', () => onBooster(b.dataset.b)));

/* =========================================================
   Goals, HUD
   ========================================================= */
function goalStatus(g) {
  let left = 0;
  switch (g.type) {
    case 'score': left = Math.max(0, g.target - G.score); break;
    case 'collect': { const i = TILES.findIndex(t => t.id === g.tile); left = Math.max(0, g.count - G.collected[i]); break; }
    case 'diya': left = G.cells.filter(c => c.diya === 1).length; break;
    case 'kulhad': left = G.cells.filter(c => c.k > 0).length; break;
    case 'garland': left = G.cells.filter(c => c.g > 0).length; break;
  }
  return { left, done: left === 0 };
}
const goalsDone = () => G.L.goals.every(g => goalStatus(g).done);
const fmtK = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n);

function setupStarMarks() {
  const [s1, s2, s3] = G.L.stars;
  const marks = $$('#starMarks i');
  [s1, s2, s3].forEach((s, i) => { marks[i].style.left = (s / s3 * 100) + '%'; });
}

function updateHUD() {
  if (!G) return;
  $('#hudMoves').textContent = G.moves;
  $('#movesBox').classList.toggle('low', G.moves <= 5);
  $('#hudScore').textContent = G.score.toLocaleString();
  const st = G.L.stars;
  $('#starFill').style.width = Math.min(100, G.score / st[2] * 100) + '%';
  $$('#starMarks i').forEach((m, i) => m.classList.toggle('on', G.score >= st[i]));
  $('#goals').innerHTML = G.L.goals.map(g => {
    const s = goalStatus(g);
    const label = s.done ? '✓' : (g.type === 'score' ? fmtK(g.target) : s.left);
    return `<div class="goal ${s.done ? 'done' : ''}"><span class="gi">${goalIcon(g)}</span><b>${label}</b></div>`;
  }).join('');
}

/* =========================================================
   Win / lose
   ========================================================= */
async function win() {
  G.over = true; G.ended = true; clearHint();
  await sleep(250);
  cheer('Dish complete!');
  await sleep(700);

  // Masala finale: leftover moves become rolling pins
  const n = Math.min(G.moves, 8);
  if (n > 0) {
    for (let i = 0; i < n; i++) {
      const cands = [];
      G.cells.forEach((cell, k) => { if (cell.t && !cell.t.s && !cell.g) cands.push(k); });
      if (!cands.length) break;
      const t = G.cells[cands[rand(cands.length)]].t;
      t.s = Math.random() < 0.5 ? 'belanH' : 'belanV';
      refreshTile(t); flashBorn(t);
      G.moves--; G.score += 250; updateHUD(); Sound.born();
      await sleep(110);
    }
    const set = new Set();
    G.cells.forEach((cell, k) => { if (cell.t && cell.t.s) set.add(k); });
    G.combo = 1;
    await applyClear(set, [], { noAdjacent: true });
    await gravity();
  }
  G.score += G.moves * 250; G.moves = 0; updateHUD();

  const st = G.L.stars;
  const stars = G.score >= st[2] ? 3 : G.score >= st[1] ? 2 : 1;
  const id = G.L.id;
  const firstClear = !save.stars[id];
  save.stars[id] = Math.max(save.stars[id] || 0, stars);
  save.best[id] = Math.max(save.best[id] || 0, G.score);
  const reward = ['pin', 'whisk', 'saffron'][rand(3)];
  save.boosters[reward]++;
  persist();
  Sound.win();
  showWinModal(stars, reward, firstClear);
}

async function lose() {
  G.over = true; G.ended = true; clearHint();
  await sleep(400);
  Sound.lose();
  const left = G.L.goals.filter(g => !goalStatus(g).done).map(g => {
    const s = goalStatus(g);
    return `<li><span class="gi">${goalIcon(g)}</span><span>${g.type === 'score' ? fmtK(s.left) + ' points short' : s.left + ' left'}</span></li>`;
  }).join('');
  openModal(`
    <div class="modal-kicker">${G.L.ghat}</div>
    <h2>Out of moves!</h2>
    <p>So close — the dish isn't finished yet.</p>
    <ul class="goal-list">${left}</ul>
    <div class="modal-btns">
      ${G.extraUsed ? '' : `<button class="btn primary" data-act="extra">${Native.on ? '▶ Watch a video: +5 moves' : '+5 moves'}</button>`}
      <button class="btn ${G.extraUsed ? 'primary' : 'ghost'}" data-act="retry">Try again</button>
      <button class="btn ghost" data-act="map">Map</button>
    </div>`);
}

function starRow(n, animate) {
  return `<div class="stars-row">${[0, 1, 2].map(i => `<span class="mstar ${i < n ? 'got' : ''}" style="${animate ? `animation-delay:${0.25 + i * 0.25}s` : ''}">${STAR_SVG}</span>`).join('')}</div>`;
}

function showWinModal(stars, reward, firstClear) {
  const last = G.idx === LEVELS.length - 1;
  openModal(`
    <div class="modal-kicker">${G.L.ghat}</div>
    <h2>${G.L.finale ? 'The aarti is lit!' : 'Dish complete!'}</h2>
    ${starRow(stars, true)}
    <div class="final-score">${G.score.toLocaleString()}</div>
    <p class="reward">+1 ${BOOSTER_SINGLE[reward]} earned</p>
    <div class="modal-btns">
      ${last ? `<button class="btn primary" data-act="${firstClear || !save.recipeSeen ? 'recipe' : 'map'}">${firstClear || !save.recipeSeen ? 'Your reward' : 'Map'}</button>`
             : '<button class="btn primary" data-act="next">Next level</button>'}
      <button class="btn ghost" data-act="retry">Replay</button>
      ${last ? '' : '<button class="btn ghost" data-act="map">Map</button>'}
    </div>`);
}

function showIntro() {
  const L = G.L;
  openModal(`
    <div class="modal-kicker">${L.ghat} · Level ${L.id}</div>
    <h2>${L.title}</h2>
    <ul class="goal-list">${L.goals.map(g => `<li><span class="gi">${goalIcon(g)}</span><span>${goalText(g)}</span></li>`).join('')}</ul>
    <p class="moves-note">${L.moves} moves</p>
    ${L.tip ? `<div class="tip">${L.tip}</div>` : ''}
    <div class="modal-btns"><button class="btn primary" data-act="start">Start cooking</button></div>`);
}

function showRecipe() {
  save.recipeSeen = true; persist();
  openModal(`
    <div class="modal-kicker">Varanasi complete · Recipe unlocked</div>
    <h2>Malaiyo</h2>
    <p class="recipe-intro">Kashi's winter-morning treat: milk that rests overnight in the cool air is churned at dawn into a cloud-light foam, scented with saffron and cardamom, and sold in clay kulhads before the sun gets warm.</p>
    <div class="recipe">
      <h3>A simple home version</h3>
      <ol>
        <li>Chill 2 cups full-fat milk and ½ cup cream overnight.</li>
        <li>Soak a pinch of saffron in 1 tbsp warm milk.</li>
        <li>Add 3 tbsp sugar and ¼ tsp cardamom powder to the cold milk.</li>
        <li>Whisk hard (or use a milk frother) until a thick foam rises.</li>
        <li>Spoon the foam into cups, drizzle the saffron milk and top with crushed pistachio.</li>
      </ol>
    </div>
    <div class="modal-btns">
      ${CONFIG.recipeLink ? `<a class="btn primary" href="${CONFIG.recipeLink}" target="_blank" rel="noopener">Watch on Anshu Ka Kitchen</a>` : ''}
      <button class="btn ${CONFIG.recipeLink ? 'ghost' : 'primary'}" data-act="map">Back to the map</button>
    </div>`);
}

/* =========================================================
   Modal + screens
   ========================================================= */
function openModal(html) {
  $('#modalCard').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }

$('#modal').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  Sound.unlock(); Sound.click();
  const act = btn.dataset.act;
  switch (act) {
    case 'start': closeModal(); G.busy = false; scheduleHint(); break;
    case 'next': closeModal(); maybeInterstitial(); startLevel(G.idx + 1); break;
    case 'retry': closeModal(); maybeInterstitial(); startLevel(G.idx); break;
    case 'map': closeModal(); maybeInterstitial(); goMap(); break;
    case 'adbooster': {
      const id = btn.dataset.b;
      btn.disabled = true;
      Native.rewarded().then(ok => {
        closeModal();
        if (ok) { save.boosters[id]++; persist(); renderBoosters(); toast(`+1 ${BOOSTER_SINGLE[id]}!`); Sound.born(); }
      });
      break;
    }
    case 'freebooster': {
      btn.disabled = true;
      Native.rewarded().then(ok => {
        if (ok) {
          const r = ['pin', 'whisk', 'saffron'][rand(3)];
          save.boosters[r]++; persist();
          openModal(`<h2>Gift received!</h2><p>+1 ${BOOSTER_SINGLE[r]}</p><div class="modal-btns"><button class="btn primary" data-act="close">Shukriya!</button></div>`);
          Sound.win();
        } else closeModal();
      });
      break;
    }
    case 'close': closeModal(); break;
    case 'recipe': showRecipe(); break;
    case 'extra':
      btn.disabled = true;
      Native.rewarded().then(ok => {
        if (!ok) { btn.disabled = false; return; }
        closeModal(); G.extraUsed = true; G.ended = false; G.moves += 5; G.over = false; G.busy = false;
        updateHUD(); scheduleHint();
      });
      break;
    case 'leave': closeModal(); goMap(); break;
    case 'stay': closeModal(); break;
  }
});

function show(name) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  Native.post({ type: 'screen', name });
}

function goMap() {
  if (G) { clearHint(); G.over = true; }
  renderMap();
  show('map');
  requestAnimationFrame(() => {
    const all = $$('.node.done'); const cur = $('.node.now') || all[all.length - 1];
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
}

/* ---------- map ---------- */
function renderMap() {
  const list = $('#mapList');
  list.innerHTML = '';
  let firstOpen = 0;
  while (firstOpen < LEVELS.length && save.stars[LEVELS[firstOpen].id]) firstOpen++;
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $('#mapStars').textContent = `${total}/${LEVELS.length * 3}`;
  $('#btnRecipe').hidden = !save.stars[LEVELS[LEVELS.length - 1].id];

  let lastGhat = null;
  LEVELS.forEach((L, i) => {
    if (L.ghat !== lastGhat) {
      lastGhat = L.ghat;
      const b = document.createElement('div');
      b.className = 'ghat-banner' + (L.finale ? ' finale' : '');
      b.innerHTML = `<span>${L.ghat}</span>`;
      list.appendChild(b);
    }
    const row = document.createElement('div');
    row.className = 'lvl-row';
    const state = i < firstOpen ? 'done' : i === firstOpen ? 'now' : 'locked';
    const off = Math.round(Math.sin(i * 1.15) * 26);
    const n = save.stars[L.id] || 0;
    row.innerHTML = `
      <button class="node ${state} ${L.finale ? 'finale' : ''}" style="--off:${off}%" data-i="${i}" ${state === 'locked' ? 'aria-disabled="true"' : ''}>
        <span class="num">${state === 'locked' ? '🔒' : L.finale ? '🪔' : L.id}</span>
        ${state === 'done' ? `<span class="nstars">${[0, 1, 2].map(s => `<i class="${s < n ? 'on' : ''}">${STAR_SVG}</i>`).join('')}</span>` : ''}
      </button>
      <span class="node-label" style="--off:${off}%">${L.title}</span>`;
    list.appendChild(row);
  });
}

$('#mapList').addEventListener('click', e => {
  const n = e.target.closest('.node');
  if (!n) return;
  Sound.unlock();
  if (n.classList.contains('locked')) { Sound.bad(); toast('Finish the earlier levels to unlock this one'); return; }
  Sound.click();
  startLevel(Number(n.dataset.i));
});

/* ---------- buttons ---------- */
$('#btnPlay').addEventListener('click', () => { Sound.unlock(); Sound.click(); goMap(); });
$('#btnMapHome').addEventListener('click', () => { Sound.click(); show('title'); });
$('#btnRecipe').addEventListener('click', () => { Sound.click(); showRecipe(); });
if (Native.on) {
  const fb = $('#btnFreeBooster'); fb.hidden = false;
  fb.addEventListener('click', () => {
    Sound.unlock(); Sound.click();
    openModal(`<h2>Free booster</h2><p>Watch a short video and get a random booster.</p>
      <div class="modal-btns"><button class="btn primary" data-act="freebooster">▶ Watch video</button><button class="btn ghost" data-act="close">Maybe later</button></div>`);
  });
}
$('#btnBack').addEventListener('click', () => {
  Sound.click();
  if (!G || G.over) { goMap(); return; }
  openModal(`<h2>Leave the kitchen?</h2><p>Your progress on this level will be lost.</p>
    <div class="modal-btns"><button class="btn primary" data-act="stay">Keep cooking</button><button class="btn ghost" data-act="leave">Leave</button></div>`);
});
function syncMute() { $$('#btnMute, #btnMuteMap').forEach(b => { b.textContent = save.muted ? '🔇' : '🔊'; }); }
$$('#btnMute, #btnMuteMap').forEach(b => b.addEventListener('click', () => {
  save.muted = !save.muted; persist(); syncMute(); Sound.click();
}));
syncMute();

/* ---------- resize ---------- */
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (G && $('#screen-game').classList.contains('active') && (!G.busy || !$('#modal').classList.contains('hidden'))) {
      const sel = G.sel; buildBoardDOM(); if (sel !== null) setSel(sel);
    }
  }, 150);
});

/* ---------- title floaters ---------- */
(function makeFloaters() {
  const f = $('#floaters');
  const spots = [[8, 18], [80, 12], [18, 62], [74, 58], [46, 8], [88, 36], [4, 40]];
  spots.forEach(([x, y], i) => {
    const d = document.createElement('div');
    d.className = 'floater';
    d.style.left = x + '%'; d.style.top = y + '%';
    d.style.animationDelay = (i * 0.7) + 's';
    d.innerHTML = tileSVG({ c: i % TILES.length, s: null });
    f.appendChild(d);
  });
})();

/* ---------- stop iOS Safari zooming (it ignores user-scalable=no) ---------- */
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd < 350 && !e.target.closest('a, button')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1 || e.scale && e.scale !== 1) e.preventDefault();
}, { passive: false });

// debug hook for testing in the console
window.__MM = {
  get state() { return G; }, startLevel, findMove, trySwap,
  allMoves() {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const a = K(r, c), rr = r + dr, cc = c + dc;
      if (!inBounds(rr, cc)) continue;
      const b = K(rr, cc);
      if (!swappable(G.cells[a]) || !swappable(G.cells[b])) continue;
      if (G.cells[a].t.s && G.cells[b].t.s) { out.push([a, b]); continue; }
      swapData(a, b); const m = anyMatch(); swapData(a, b);
      if (m) out.push([a, b]);
    }
    return out;
  }
};
})();
