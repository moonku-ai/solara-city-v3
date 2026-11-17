// Solara City — hand-in program for the make.fun gta6-01 bounty.
//
// What this little program does, in plain terms: it takes the finished
// game (the files under game/) and the screenshots (under screenshots/)
// that sit next to this file, drops copies of both into the hand-in
// folder, and then asks the kit's library to describe the whole entry
// in a single dossier.json inside that same folder.
//
// The hand-in folder comes from MAKEFUN_OUTPUT_DIR when that variable
// is set, and is /output otherwise — /output is where the grader looks.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the dossier lands when nobody says otherwise.
const DEFAULT_OUTPUT = '/output';

// The limits the bounty sets for the dossier. They come straight from
// the competition rules: how much source text may be quoted, how many
// screenshots and how big each may be, and how large game/ may grow.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// The two folders that make up the entry, named as they sit in the repo.
const ENTRY_FOLDERS = ['game', 'screenshots'] as const;

// Folder holding this file, i.e. the repository root.
function repoRoot(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

// Pick the hand-in folder: the environment wins, /output is the fallback.
function pickOutputDir(): string {
  const wanted = process.env.MAKEFUN_OUTPUT_DIR;
  return wanted !== undefined && wanted !== '' ? wanted : DEFAULT_OUTPUT;
}

// Count every regular file below a folder, walking it by hand.
function tallyFiles(root: string): number {
  let total = 0;
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        total += 1;
      }
    }
  }
  return total;
}

// Copy one entry folder from the repo into the hand-in folder, wiping
// any stale copy of it there first so nothing old can linger.
function handOverFolder(sourceRoot: string, targetRoot: string, name: string): number {
  const from = path.join(sourceRoot, name);
  const to = path.join(targetRoot, name);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  return tallyFiles(to);
}

// Make sure the game is really there before we hand anything in:
// a game without its front page is not a game at all.
function checkGameFrontPage(sourceRoot: string): void {
  const frontPage = path.join(sourceRoot, 'game', 'index.html');
  if (!fs.existsSync(frontPage) || !fs.statSync(frontPage).isFile()) {
    throw new Error(`game/index.html is missing — cannot hand in ${sourceRoot}`);
  }
}

function main(): void {
  const root = repoRoot();
  const target = pickOutputDir();

  checkGameFrontPage(root);
  fs.mkdirSync(target, { recursive: true });

  let copied = 0;
  for (const name of ENTRY_FOLDERS) {
    copied += handOverFolder(root, target, name);
  }

  // Ask the kit library to write the dossier from what we just copied.
  const dossier = buildDossier(target, DOSSIER_LIMITS);
  const dossierPath = path.join(target, 'dossier.json');
  fs.rmSync(dossierPath, { force: true });
  fs.writeFileSync(dossierPath, dossier);

  console.log(`handed in ${copied} files to ${target} (dossier.json: ${dossier.length} bytes)`);
}

main();
