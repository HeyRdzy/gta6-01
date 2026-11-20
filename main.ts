// Solmar Heat — build entrypoint for the make.fun dossier.
// Copies game/ and screenshots/ into the output dir, then writes
// dossier.json through the kit's buildDossier. Deterministic: the same
// input tree always produces the same dossier bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is not shippable without its four staged screenshots.
const shotsDir = join(repo, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => f.endsWith('.jpg')) : [];
if (shots.length !== 4) {
  throw new Error(`expected 4 screenshots in screenshots/, found ${shots.length}`);
}
for (const f of shots) {
  if (statSync(join(shotsDir, f)).size === 0) throw new Error(`screenshot ${f} is empty`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repo, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier ${dossier.length} bytes written to ${join(outDir, 'dossier.json')}`);
