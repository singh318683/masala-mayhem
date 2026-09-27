# Masala Mayhem — The Ghats of Varanasi

A match-3 spice puzzle game. Region 1 travels up the Varanasi ghats — Assi, Tulsi, Kedar — to the Ganga Aarti finale at Dashashwamedh.

Plain HTML, CSS and JavaScript. No build step, no dependencies, so it deploys to Vercel as a static site.

## Play locally
Open `index.html` in a browser, or run any static server in this folder, for example:

```
npx serve .
```

## What's in Region 1
- **12 levels** across 4 ghats, with an intro card and tip for each new mechanic
- **Tiles:** paan leaf, saffron, cardamom, fennel, rose petals, red chili
- **Specials**
  - 2×2 square → **Mortar & Pestle** (clears 3×3)
  - 4 in a line → **Rolling Pin** (clears the row or column)
  - 5 in a line, L or T → **Tadka Burst** (clears 5×5 and scatters Masala Dabba wildcards)
  - Swap two specials together to fire both
- **Obstacles:** unlit diyas (match on them), marigold garlands (lock a tile), clay kulhads (crack with adjacent matches), Ganga currents (rows drift right after each move)
- **Boosters:** Rolling Pin, Whisk (shuffle), Saffron Drop (turns one spice into Rolling Pins). You earn one after every win.
- Stars, a scrolling ghat map, saved progress (browser storage), synthesized sound, hints after 6 seconds idle
- Region reward: a **Malaiyo** recipe card

## Files
| File | Purpose |
|---|---|
| `index.html` | Screens: title, map, game |
| `style.css` | All styling and animation |
| `levels.js` | Tiles, 12 level definitions, config (edit levels here) |
| `game.js` | Match engine, specials, obstacles, boosters, map, save |

## Editing levels
Each level in `levels.js` has an 8×8 `layout`:

```
.  normal    X  no cell     D  diya
g  garland   G  garland ×2  a/b  diya + garland
k  kulhad    K  kulhad ×2
```

Plus `moves`, `colors` (5 or 6), `goals`, `stars` thresholds and optional `currents` (row numbers).

To link the recipe card to a video, set `recipeLink` in `MM_CONFIG` at the top of `levels.js`.

## Deploy
Push this folder to a GitHub repo, then in Vercel choose **Add New → Project**, import the repo and click **Deploy**. Leave the framework preset as **Other**; there is no build command.
