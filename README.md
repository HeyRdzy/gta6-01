[![Solmar Heat — make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat rank on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat reward on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Heat

A top-down open-world crime game set in the fictional city of **Solmar Bay**,
in the spirit of the original 2D Grand Theft Auto games. You are **Rio Calder**,
a driver who owes fixer **Mara Voss** one last job — five jobs, $3,400 on the
table, and the Solmar PD watching every corner.

## Play it

```sh
node serve.ts   # or: npx serve game
```

Open the page it prints and press **START ENGINE**. No build step, no network
at runtime — the game is static files under `game/` and runs entirely in the
browser. No libraries: the whole game is plain Canvas 2D and WebAudio.

## What is in the game

- **A living city**: a street grid with downtown towers to the north-west, a
  park and pond in the south-west, a beach and a pier to the east, and a
  dockyard to the south-east. Golden-hour light, a full day/dusk cycle, neon
  signs, traffic lights, palms and an animated sea.
- **On foot**: WASD to walk and run, mouse to aim, click to shoot (12-round
  magazine, R reloads), Space to jump.
- **Driving**: press E near a car to get in — W/S accelerate and brake, A/D
  steer, Space handbrakes into a drift. Steal a car and the cops notice; grab
  a taxi and drive fares for cash. Stunt ramps pay $50 a jump. Wreck the car
  and it smokes.
- **Traffic**: AI cars loop the grid in the right-hand lane with headlights
  and taillights, pedestrians walk the sidewalks and flee gunfire.
- **Wanted level**: 0–5 stars. Cruisers chase and ram with flashing red/blue
  light bars; at 3+ stars the PD throws up roadblocks. Break line of sight
  and stay away to cool off.
- **Five story jobs from Mara Voss** ($300–$1,500): Sunset Courier,
  Getaway Driver, Package Run, Dockyard Standoff and The Solmar Heist.
  Follow the gold beacon and the pulsing waypoint on the minimap.
- **HUD**: health bar, cash, glowing wanted stars, ammo, speed, a canvas
  minimap (streets, player arrow, cop dots, gold waypoint, landmarks),
  objective line, pause on Esc, and save/load through localStorage.
- **Sound**: everything is synthesized with WebAudio — engine hum tied to
  speed, two-tone siren, gunshots, pickup chimes and a surf/wind bed. M mutes.

## Screenshots

`shots.json` lists the four staged shots in `screenshots/`, taken with
`?shot=start|play|chase|mission` at golden hour.

## Files

- `game/index.html` — page and HUD.
- `game/src/` — the game, one module per system: `config`, `util`, `state`,
  `world`, `visuals`, `hero`, `traffic`, `cops`, `combat`, `story`,
  `display`, `sound`, `stage`, `controls`, `boot`.
- `main.ts` — builds the make.fun dossier into
  `$MAKEFUN_OUTPUT_DIR` (or `/output`).
