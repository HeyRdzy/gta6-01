# Solmar Heat

[![Solmar Heat — make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat rank on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat reward on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the fictional sun-soaked coastal city of Solmar Bay.
You are Rio Calder, a driver with a debt to pay. Fixer Mara Voss has five jobs for
you — and the Solmar PD has other plans.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network:
the game is static files under `game/`, and Three.js is vendored in
`game/vendor/three.module.min.js`.

## What is in the city

- **A full 3D bay to explore** — downtown towers with lit windows, a beach and
  a pier on the east edge, a park, palms and street lamps, all under a sunset
  sky that slowly cycles from golden hour into dusk.
- **On foot and behind the wheel** — WASD to move, mouse to look, Shift to run,
  Space to jump. Press E to steal a car and drive with arcade handling; Space
  brakes. Hard crashes dent the car, and a badly damaged car smokes before it
  gives up entirely.
- **Traffic and pedestrians** — cars cruise the street grid and pedestrians
  stroll the sidewalks; both scatter when trouble starts.
- **Wanted heat, 1–5 stars** — stealing, hitting pedestrians, shooting and
  ramming all raise the heat. Cruisers chase and ram, and at 3 stars the PD
  throws roadblocks across the road ahead. Get caught on foot and you are
  busted: a fine, and a wake-up at Solmar PD. Lay low and the heat bleeds off.
- **Five story jobs** — Sunset Courier ($300, timed), Getaway Driver ($500,
  survive the chase), Package Run ($400, five drops), Dockyard Standoff ($700,
  clear the Kestrel crew) and The Solmar Heist ($1,500, crack the bank vault
  and run for the pier). A gold beacon marks the next objective, and Mara
  talks you through each job in subtitles.
- **Side work** — taxi fares pay $60–$120 a ride while you drive, and the
  beach stunt ramps pay $80 a jump if you hit them fast enough.
- **Combat** — click to shoot (hitscan with tracers), R or F to reload, a
  12-round magazine. Rivals shoot back.
- **HUD and minimap** — cash, health, wanted stars, clock, speed, the current
  objective, toasts, a canvas minimap with streets, beach, the player arrow,
  police dots and the waypoint. Title, pause and WASTED screens, and a save
  file in localStorage so you can continue later.
- **Sound, synthesised live** — engine hum, police sirens, gunshots, pickups
  and mission jingles, all from WebAudio. No audio files. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click the game to lock the pointer) |
| E | Enter or leave a car / start a job at the gold M |
| Click | Shoot (on foot) |
| R / F | Reload |
| Shift | Run |
| Space | Jump / brake |
| Esc | Pause |
| M | Mute |

## Layout

- `game/index.html` — page, HUD, menus, import map for Three.js
- `game/src/boot.js` — renderer, frame loop, menus, camera, interactions
- `game/src/world.js` — the bay: streets, towers, beach, park, pier, sky cycle
- `game/src/state.js` — cash, health, heat, clock, save file
- `game/src/hero.js` — Rio on foot and driving, car damage and smoke
- `game/src/traffic.js` — parked cars, traffic AI, pedestrians
- `game/src/cops.js` — wanted stars, cruiser chases, roadblocks, busts
- `game/src/story.js` — the five jobs, taxi fares, stunt ramps
- `game/src/combat.js` — hitscan shooting, rivals, tracers
- `game/src/display.js` — HUD, minimap, screens, subtitles, toasts
- `game/src/sound.js` — WebAudio synth: engine, siren, shots, jingles
- `game/src/controls.js` — keyboard, mouse look, pointer lock
- `game/src/stage.js` — the `?shot=` scenes used for the screenshots
- `game/src/util.js` — seedable random, geometry helpers
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/`
  to the output and writes `dossier.json`

## Screenshots

The four shots in `screenshots/` are real renders of the game in a browser,
staged with `?shot=start|play|chase|mission` (see `shots.json`).

## Credits

Solmar Heat is an original game: the city, the characters, the story and the
code are all its own. Nothing is taken from any commercial game.
