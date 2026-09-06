// node build/build.js            rebuild the page from the committed snapshot
// node build/build.js --fetch    re-read the channel from Are.na first
// node build/build.js --mirror   also copy any new images into dist/images
//
// The snapshot in dist/data/channel.json is committed, so a design-only change
// rebuilds the page with no network and no token.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchChannel } from './arena.js';
import { mirror } from './mirror.js';
import { compose } from './spreads.js';
import { render } from './render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = path.join(root, 'dist/data/channel.json');
const MANIFEST = path.join(root, 'dist/data/images.json');
const IMAGES = path.join(root, 'dist/images');
const PAGE = path.join(root, 'dist/index.html');

const args = new Set(process.argv.slice(2));
const wantFetch = args.has('--fetch');
const wantMirror = args.has('--mirror') || wantFetch;

const run = async () => {
  let snapshot;

  if (wantFetch) {
    console.log('Reading the channel from Are.na…');
    snapshot = await fetchChannel();
    await mkdir(path.dirname(SNAPSHOT), { recursive: true });
    await writeFile(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`  ${snapshot.blocks.length} usable blocks of ${snapshot.channel.count} in the channel`);
  } else {
    if (!existsSync(SNAPSHOT)) {
      throw new Error('No snapshot yet — run with --fetch (and ARENA_TOKEN set) at least once.');
    }
    snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
    console.log(`Using the snapshot collected ${snapshot.fetched_at}`);
  }

  let blocks = snapshot.blocks;
  if (wantMirror) {
    blocks = await mirror(blocks, { outDir: IMAGES, manifestPath: MANIFEST });
    // Remember which file belongs to which block, so a design-only rebuild
    // does not need the network to know what to point at.
    await writeFile(SNAPSHOT, JSON.stringify({ ...snapshot, blocks }, null, 2) + '\n');
  }

  const usable = blocks.filter(b => b.kind === 'text' || b.files?.length);
  if (!usable.length) throw new Error('Nothing to lay out — the channel came back empty.');

  const spreads = compose(usable);
  await writeFile(PAGE, render(spreads, snapshot));
  console.log(`Wrote dist/index.html — ${spreads.length} spreads from ${usable.length} blocks.`);
};

run().catch(err => { console.error(`\n${err.message}\n`); process.exit(1); });
