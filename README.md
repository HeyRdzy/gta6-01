[![Solmar Heat — make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat rank on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat reward on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Heat

An open-world 3D crime game set in the fictional city of **Solmar Bay**.
You are **Rio Calder**, a driver who owes fixer **Mara Voss** one last
job — five jobs, $3,400 on the table, and the Solmar PD watching every
corner.

## Play it

```sh
npx serve game   # or: node serve.ts
```

Open the page it prints and press **START ENGINE**. No build step, no
network at runtime — the game is static files under `game/` and runs
entirely in the browser.

## What is in the game

- **A living city**: a street grid with downtown towers to the
  north-west, a park pond in the south-west, a beach and a pier to the
  east, and a dockyard to the south-east. Golden-hour sky, drifting
  clouds, a day/dusk cycle, neon signs, traffic lights, palms and an
  animated sea.
- **On foot**: WASD to walk and run, mouse look (pointer lock, drag
  works too), Space to jump, click to shoot (12-round magazine, R
  reloads).
- **Driving**: press E near a car to get in — W/S accelerate and
  brake, A/D steer, hard fast turns drift. Steal a car and the cops
  notice; grab a taxi and drive fares for cash. Stunt ramps pay $50
  a jump. Wreck the car and it smokes.
- **Traffic**: AI cars loop the grid with headlights and taillights,
  pedestrians walk the sidewalks with a real walk cycle.
- **Wanted level**: 0–5 stars. Cruisers chase and ram with flashing
  red/blue light bars; at 3+ stars the PD throws up roadblocks. Break
  line of sight and stay away to cool off.
- **Five story jobs from Mara Voss** ($300–$1,500): Sunset Courier,
  Getaway Driver, Package Run, Dockyard Standoff and The Solmar Heist.
  Follow the gold beacon and the pulsing waypoint on the minimap.
- **HUD**: health bar, cash, glowing wanted stars, ammo, speed, a
  canvas minimap (streets, player arrow, cop dots, rivals, gold
  waypoint, landmarks), objective line, pause on Esc, and save/load
  through localStorage.
- **Sound**: everything is synthesized with WebAudio — engine hum
  tied to speed, two-tone siren, gunshots, pickup chimes and a
  surf/wind bed. M mutes.

## Screenshots

`shots.json` lists the four staged shots in `screenshots/`, taken with
`?shot=start|play|chase|mission` at golden hour.

## Files

- `game/index.html` — page, HUD and import map (`three` is vendored).
- `game/src/` — the game, one module per system: `state`, `visuals`,
  `world`, `traffic`, `hero`, `cops`, `combat`, `story`, `display`,
  `sound`, `stage`, `controls`, `boot`.
- `game/vendor/three.module.min.js` — vendored Three.js r160.
- `main.ts` — builds the make.fun dossier into
  `$MAKEFUN_OUTPUT_DIR` (or `/output`).
