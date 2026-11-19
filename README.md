# Solmar Heat

[![Solmar Heat — make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat rank on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Solmar Heat reward on make.fun](https://make.fun/badge/gta6-01/HeyRdzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Solmar Heat is a 3D open-world crime game in the fictional coastal city of Solmar Bay, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) ("Make GTA 6"). You are Rio Calder, a driver with nothing but a fast car and a debt to pay. Mara Voss has five jobs for you — courier runs, a getaway, a dockyard standoff and one last bank heist. Steal cars, dodge the Solmar PD, and own the city before the sun goes down.

## How to play

Start on the title screen, then follow the gold **M** marker to pick up your next mission. Each mission has waypoint beacons, on-screen objectives and a cash reward at the end. Crime raises your heat with the Solmar PD — heat becomes wanted stars, and stars bring the cops. Lay low and the heat cools off; get wasted and you wake up at Solmar General, $100 lighter, with the story still waiting.

### Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move / drive |
| Mouse | Look |
| Click | Shoot |
| E | Enter car / start mission |
| Shift | Run |
| Space | Jump (on foot) / brake (driving) |
| R | Reload |
| Esc | Pause |
| M | Mute |

The HUD shows your cash, wanted stars, health, the in-game clock, your speed, the current objective and a minimap of Solmar Bay. Progress is saved, so you can continue where you left off.

## Missions

Five story missions, in order:

1. **Sunset Courier** — Mara Voss: pick up a package at Rosa's Diner and run it to the Marina Gate before the sun drops. ($300)
2. **Getaway Driver** — Mara Voss: grab a car, pick Mara up, and lose the cops at the Old Cannery. ($500)
3. **Package Run** — Dario Fen: collect five stashed packages around Solmar Bay and bring the haul back to the diner. ($400)
4. **Dockyard Standoff** — Mara Voss: clear the Kestrel crew at the docks, then report back to Mara. ($700)
5. **The Solmar Heist** — Mara Voss: grab the vault cash at Solmar Trust Bank and escape to the boat on the beach. ($1,500)

## Tech

- Three.js (vendored, no CDN) rendering a full 3D city: streets, traffic, pedestrians, the marina, the dockyard and the beach, under a day-cycle sky.
- Plain ES modules in `game/src/` — one module per system: city, player, vehicles, pedestrians, police/wanted, missions, HUD, audio and input. No build step, no network requests; the game plays offline straight from `game/index.html`.
- `main.ts` (Node 22, standard library only) hands the entry in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` is a tiny static server for local play.

## Run locally

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. Use `node serve.ts --port 9000` for a different port.

## Verify the entry build

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes the handed-in game and `out/dossier.json`. The `out/` directory is git-ignored.

## Screenshots

Four screenshots live in `screenshots/`: the title screen, open-world play, a police chase and a mission.

## License

MIT — see [LICENSE](LICENSE).
