/* Masala Mayhem — Region 1: Varanasi (Kashi)
 *
 * Layout legend (8 rows x 8 columns):
 *   .  normal cell
 *   X  empty (no cell)
 *   D  unlit diya under the tile — light it by matching on it
 *   g  marigold garland (1 knot)      G  garland (2 knots)
 *   a  diya + garland (1)             b  diya + garland (2)
 *   k  kulhad (clay cup, 1 hit)       K  kulhad (2 hits)
 *
 * currents: row numbers (0 = top) where the Ganga current drifts tiles
 *           one step to the right after every move.
 * goals:    score | collect | diya | kulhad | garland
 * stars:    score thresholds for 1, 2 and 3 stars.
 */

window.MM_CONFIG = {
  // Link shown on the recipe card after the region is finished.
  // Put your Anshu Ka Kitchen video / channel URL here. Leave '' to hide the button.
  recipeLink: ''
};

window.MM_TILES = [
  { id: 'paan',     name: 'Paan leaf',   color: '#3a9a3f' },
  { id: 'saffron',  name: 'Saffron',     color: '#ff7a1a' },
  { id: 'cardamom', name: 'Cardamom',    color: '#1fa79a' },
  { id: 'fennel',   name: 'Fennel',      color: '#d4b12a' },
  { id: 'rose',     name: 'Rose petals', color: '#ee5a8f' },
  { id: 'chili',    name: 'Red chili',   color: '#c62828' }
];

const FULL = ['........', '........', '........', '........', '........', '........', '........', '........'];

window.MM_LEVELS = [
  /* ---------------- Assi Ghat ---------------- */
  {
    id: 1, ghat: 'Assi Ghat', title: 'Sunrise at Assi',
    moves: 20, colors: 5, stars: [7500, 14000, 20000],
    goals: [{ type: 'score', target: 6000 }],
    layout: FULL,
    tip: 'Swap two neighbouring spices to line up 3 or more. Make a 2×2 square to grind a <b>Mortar &amp; Pestle</b> — it clears the 3×3 area around it.'
  },
  {
    id: 2, ghat: 'Assi Ghat', title: 'The Chai Stall',
    moves: 22, colors: 5, stars: [7500, 14000, 20000],
    goals: [{ type: 'collect', tile: 'paan', count: 18 }, { type: 'collect', tile: 'saffron', count: 18 }],
    layout: FULL,
    tip: 'Line up 4 in a row to roll out a <b>Rolling Pin</b> — it flattens the whole line.'
  },
  {
    id: 3, ghat: 'Assi Ghat', title: 'Lamps on the Steps',
    moves: 24, colors: 5, stars: [10000, 16000, 22500],
    goals: [{ type: 'diya' }],
    layout: [
      '........',
      '..DDDD..',
      '.DDDDDD.',
      '.DDDDDD.',
      '.DDDDDD.',
      '.DDDDDD.',
      '..DDDD..',
      '........'
    ],
    tip: 'Glowing red cells hold unlit <b>diyas</b>. Make a match on each one to light it.'
  },
  {
    id: 4, ghat: 'Assi Ghat', title: 'Kachori Corner',
    moves: 22, colors: 5, stars: [10000, 16000, 22500],
    goals: [{ type: 'collect', tile: 'cardamom', count: 24 }],
    layout: [
      'XX....XX',
      'X......X',
      '........',
      '........',
      '........',
      '........',
      'X......X',
      'XX....XX'
    ],
    tip: 'Match 5 in an L, a T or a straight line for a <b>Tadka Burst</b> — it blasts a wide area and scatters <b>Masala Dabba</b> wildcards that match with anything.'
  },

  /* ---------------- Tulsi Ghat ---------------- */
  {
    id: 5, ghat: 'Tulsi Ghat', title: 'The Garland Seller',
    moves: 22, colors: 5, stars: [10000, 16000, 22500],
    goals: [{ type: 'garland' }],
    layout: [
      '........',
      '........',
      '.gg..gg.',
      '.gg..gg.',
      '.gg..gg.',
      '.gg..gg.',
      '........',
      '........'
    ],
    tip: '<b>Marigold garlands</b> tie a spice in place. Include it in a match (or blast it) to untie the knot.'
  },
  {
    id: 6, ghat: 'Tulsi Ghat', title: 'Kulhad Pile',
    moves: 25, colors: 5, stars: [10000, 17500, 25000],
    goals: [{ type: 'kulhad' }],
    layout: [
      '........',
      '........',
      '........',
      '..k..k..',
      '.kkkkkk.',
      'kk.kk.kk',
      'kkkkkkkk',
      '........'
    ],
    tip: 'Clay <b>kulhads</b> crack when you make a match right next to them. Blasts break them too.'
  },
  {
    id: 7, ghat: 'Tulsi Ghat', title: 'Tulsi at Dusk',
    moves: 26, colors: 5, stars: [12500, 20000, 27500],
    goals: [{ type: 'diya' }, { type: 'garland' }],
    layout: [
      'DDDDDDDD',
      'D......D',
      'D.gggg.D',
      'D.gDDg.D',
      'D.gDDg.D',
      'D.gggg.D',
      'D......D',
      'DDDDDDDD'
    ],
    tip: 'Untie the garlands to reach the diyas in the middle.'
  },
  {
    id: 8, ghat: 'Tulsi Ghat', title: 'Double-fired Clay',
    moves: 25, colors: 5, stars: [12500, 20000, 27500],
    goals: [{ type: 'kulhad' }, { type: 'collect', tile: 'rose', count: 20 }],
    layout: [
      '........',
      '.K....K.',
      '..K..K..',
      '...KK...',
      '...KK...',
      '..K..K..',
      '.K....K.',
      '........'
    ],
    tip: 'Thick kulhads (with a white band) need two hits.'
  },

  /* ---------------- Kedar Ghat ---------------- */
  {
    id: 9, ghat: 'Kedar Ghat', title: 'The River Moves',
    moves: 22, colors: 5, stars: [15000, 22500, 30000],
    goals: [{ type: 'score', target: 15000 }],
    currents: [3, 4],
    layout: FULL,
    tip: 'Rippling blue rows are <b>Ganga currents</b>. After every move, their spices drift one step to the right.'
  },
  {
    id: 10, ghat: 'Kedar Ghat', title: 'Boats and Lamps',
    moves: 24, colors: 5, stars: [15000, 22500, 30000],
    goals: [{ type: 'diya' }],
    currents: [2, 5],
    layout: [
      '........',
      '........',
      'DDDDDDDD',
      '........',
      '........',
      'DDDDDDDD',
      '........',
      '........'
    ],
    tip: 'The diyas are floating on the current — time your matches.'
  },
  {
    id: 11, ghat: 'Kedar Ghat', title: 'Festival Crowd',
    moves: 32, colors: 6, stars: [17500, 25000, 35000],
    goals: [{ type: 'diya' }, { type: 'kulhad' }, { type: 'garland' }],
    layout: [
      'kk....kk',
      'k.gDDg.k',
      '..DDDD..',
      '.gD..Dg.',
      '.gD..Dg.',
      '..DDDD..',
      'k.gDDg.k',
      'kk....kk'
    ],
    tip: 'Six spices now — bigger combos are harder to come by. Save your boosters for the tough spots.'
  },

  /* ---------------- Dashashwamedh Ghat (finale) ---------------- */
  {
    id: 12, ghat: 'Dashashwamedh Ghat', title: 'Ganga Aarti', finale: true,
    moves: 34, colors: 5, stars: [22500, 32500, 42500],
    goals: [{ type: 'diya' }, { type: 'garland' }],
    currents: [3, 4],
    layout: [
      'DDDDDDDD',
      'DbDDDDbD',
      'DDDDDDDD',
      'DDDaaDDD',
      'DDDaaDDD',
      'DDDDDDDD',
      'DbDDDDbD',
      'DDDDDDDD'
    ],
    tip: 'The evening aarti is about to begin. Light every lamp on the ghat!'
  }
];
