// Solmar Heat — the gta6-01 entrypoint (Node 22, standard library only).
// The game itself is static: a Three.js open world under game/, vendored
// so it runs with no build step and no network at runtime. All this file
// does is hand the entry over — it copies game/ and screenshots/ next to
// this file into the output folder, then asks the vendored library to
// write dossier.json there, the summary the make.fun judge reads.
//
// Try it first with `node serve.ts` (http://localhost:8080), then build:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Without the entry page there is nothing for the grader to open,
// so refuse to build instead of shipping an empty folder.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('Solmar Heat is missing game/index.html');
}

mkdirSync(dest, { recursive: true });
cpSync(join(here, 'game'), join(dest, 'game'), { recursive: true });
mkdirSync(join(dest, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(dest, 'screenshots'), { recursive: true });
}

// Kit limits: at most 4 screenshots of 256 KiB each, game/ under 993
// files and 48 MiB, and the dossier text itself under 160 KiB.
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
