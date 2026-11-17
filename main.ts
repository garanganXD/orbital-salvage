// ORBITAL SALVAGE — the best-game-01 entry hand-in (Node 22, standard library only).
//
// The playable game lives beside this file in game/: plain static files a desktop browser opens
// offline (game/index.html and its ES modules, no library, no network request). The three
// screenshots live in screenshots/. This program stages both into the output directory and writes
// dossier.json — the summary the judge reads — with the vendored make.fun library. Nothing else is
// needed: the game has no build step.
//
// Play it locally with `node serve.ts` (http://localhost:8080), or stage the entry with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The directory this file sits in (the repository root). */
const here = fileURLToPath(new URL('.', import.meta.url));

/** Where the entry is handed in: /output on the grader, else $MAKEFUN_OUTPUT_DIR locally. */
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * The scorer's own caps (reference/gate.json). Only text_max_bytes shapes the dossier's bytes; the
 * rest refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB; more
 * than 993 files under game/ or 48 MiB of them; a path under game/ longer than 1000 bytes).
 */
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy game/ and screenshots/ from beside this file into the output directory. */
function stageEntry() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  }
}

stageEntry();
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, GATE));
