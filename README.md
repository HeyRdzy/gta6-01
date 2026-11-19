# Solmar Heat

[![Solmar Heat — make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat rank on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat reward on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game set in Solmar Bay, a fictional sun-soaked coastal
city. You are Rio Calder, a driver with a debt to pay. Fixer Mara Voss has
five jobs for you — and the Solmar PD has other plans.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. There is no build step
and no network at runtime: the game is static files under `game/`, with
Three.js vendored at `game/vendor/three.module.min.js`.

## What is in the city

- **A bay built to be looked at** — downtown towers with glowing windows,
  rooftop clutter and textured facades, a beach and a pier on the east edge,
  a park, palms, street lamps and neon signs. The sky holds a deep blue over
  a narrow golden horizon band, drifting from golden hour into dusk and
  night, with soft shadows, thin warm haze and a low sun. A cool fill light
  keeps the shadow side of every building readable.
- **On foot and behind the wheel** — WASD to move, mouse to look (drag works
  too when pointer lock is not available), Shift to run, Space to jump.
  Press E to take a car and drive with arcade handling: Space brakes, hard
  turns drift, the camera leans into the slide and the field of view opens
  with speed. Hard crashes dent the car; a badly damaged car smokes before
  it gives up entirely.
- **Traffic and pedestrians** — sculpted two-tone cars cruise the street
  grid with headlight beams after dark, and low-poly pedestrians of different
  heights stroll the sidewalks with a real walk cycle. Both scatter when
  trouble starts.
- **Wanted heat, 1–5 stars** — stealing, hitting pedestrians, shooting and
  ramming all raise the heat. Cruisers chase and ram with flashing red/blue
  light bars that glow from the rear too, and at 3 stars the PD throws
  striped roadblocks across the road ahead. Get caught on foot and you are
  busted: a fine, and a wake-up at Solmar PD. Lay low and the heat bleeds off.
- **Five story jobs** — Sunset Courier ($300, timed), Getaway Driver ($500,
  survive the chase), Package Run ($400, five drops), Dockyard Standoff
  ($700, clear the Kestrel crew) and The Solmar Heist ($1,500, crack the bank
  vault and run for the pier). A slim pulsing gold beacon marks the next
  objective — it steps aside during a fight — and Mara talks you through
  each job in subtitles. Rivals wear a health bar above their heads.
- **Side work** — taxi fares pay $60–$120 a ride while you drive, and the
  beach stunt ramps pay $80 a jump if you hit them fast enough.
- **Combat** — click to shoot (hitscan with tracers and a muzzle-flash
  light), R or F to reload, a 12-round magazine. Rivals shoot back.
- **Glass HUD and minimap** — cash, health, glowing wanted stars, clock,
  speed, ammo, the current objective, toasts, and a styled canvas minimap
  with streets, beach, landmark dots, the player arrow, police dots and the
  waypoint. Title, pause and WASTED screens, and a save file in
  localStorage so you can continue later.
- **Sound, synthesised live** — a two-oscillator engine that opens up with
  speed, wailing police sirens, gunshots, crashes, pickups and mission
  jingles, plus a slow surf-and-wind bed under everything, all from
  WebAudio. No audio files. M mutes.
- **Steady frame rate** — the renderer caps its pixel ratio and watches the
  real frame cost, stepping the cap down a notch before the frame rate
  drops, so the city stays smooth on weaker machines.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click the game to lock the pointer; drag also works) |
| E | Enter or leave a car / start a job at the gold M |
| Click | Shoot (on foot) |
| R / F | Reload |
| Shift | Run |
| Space | Jump / brake |
| Esc | Pause |
| M | Mute |

## Layout

- `game/index.html` — page, glass HUD, menus, import map for Three.js
- `game/src/boot.js` — renderer, frame loop, damped camera, interactions
- `game/src/visuals.js` — renderer setup, sky dome, lights, texture makers
- `game/src/world.js` — the bay: streets, towers, beach, park, pier, sky cycle
- `game/src/state.js` — cash, health, heat, clock, save file, quality knobs
- `game/src/hero.js` — Rio on foot and driving, drift, damage smoke
- `game/src/traffic.js` — parked cars, traffic AI, pedestrians, walk cycle
- `game/src/cops.js` — wanted stars, cruiser chases, roadblocks, busts
- `game/src/story.js` — the five jobs, taxi fares, stunt ramps, beacons
- `game/src/combat.js` — hitscan shooting, rivals, tracers, muzzle flash
- `game/src/display.js` — HUD, minimap, screens, subtitles, toasts
- `game/src/sound.js` — WebAudio synth: engine, siren, shots, ambience
- `game/src/controls.js` — keyboard, damped mouse look, drag-to-look
- `game/src/stage.js` — the `?shot=` scenes used for the screenshots
- `game/src/util.js` — seedable random, easing, damping, geometry helpers
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/`
  to the output and writes `dossier.json`

## Screenshots

The four shots in `screenshots/` are real renders of the game in a browser,
staged with `?shot=start|play|chase|mission` (see `shots.json`).

## Credits

Solmar Heat is an original game: the city, the characters, the story and the
code are all its own. Nothing is taken from any commercial game.
