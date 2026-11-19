// Solmar Heat, gta6-01 entrypoint (Node 22, standard library only).
// The game itself is the static Three.js open world under game/ — no build
// step, no network at runtime, it opens straight from game/index.html.
// This file only hands the entry in: it copies game/ and screenshots/ next
// to this file into the output directory and writes dossier.json there,
// the summary the make.fun judge reads, via the vendored library.
//
// Try it locally first with `node serve.ts` (http://localhost:8080), then:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Without an entry page there is no game for the grader to open.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('Solmar Heat is missing game/index.html');
}

mkdirSync(dest, { recursive: true });
cpSync(join(here, 'game'), join(dest, 'game'), { recursive: true });
mkdirSync(join(dest, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(dest, 'screenshots'), { recursive: true });
}

// Caps from the kit gate: at most 4 screenshots of 256 KiB, game/ under
// 993 files and 48 MiB, and the dossier itself under 160 KiB of text.
writeFileSync(
  join(dest, 'dossier.json'),
  buildDossier(dest, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
