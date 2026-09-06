// node build/preview.js — renders the layout against invented blocks, so the
// design can be worked on without a token, a network, or the real channel.
// Output goes to preview/index.html and is not published.
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose } from './spreads.js';
import { render } from './render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'preview');

// A plausible channel: mostly images of mixed proportion, a little writing.
const RATIOS = [1.5, 0.75, 1, 1.78, 0.667, 1.33, 0.8, 2.1, 1, 0.62, 1.6, 1.25];
const TEXTS = [
  'There are images you save because they explain something before you know what the explanation is.',
  'A private archive made public through arrangement.',
  'Not every text block should behave as a caption. Longer writing can sit quietly in a readable column, while shorter phrases are allowed to become spatial and graphic.',
  'The loose ones. Kept for no reason that survives being asked.',
];

const COUNT = Number(process.argv[2] || 34);

const blocks = [];
for (let i = 0; i < COUNT; i++) {
  const ratio = RATIOS[i % RATIOS.length];
  const w = 1200, h = Math.round(1200 / ratio);
  blocks.push({
    id: 1000 + i, kind: 'image', type: 'Image', position: i,
    title: i % 5 === 0 ? `Loosie ${i}` : null,
    source: i % 4 === 0 ? 'https://example.com/somewhere' : null,
    provider: i % 4 === 0 ? 'example.com' : null,
    alt: '', files: [`${1000 + i}-medium.svg`, `${1000 + i}-large.svg`],
    image: { width: w, height: h, ratio, updated_at: '', content_type: 'image/svg+xml' },
  });
  if (i % 7 === 3 && TEXTS.length) {
    blocks.push({ id: 9000 + i, kind: 'text', type: 'Text', position: i, title: null, text: TEXTS[(i / 7 | 0) % TEXTS.length] });
  }
}

await mkdir(path.join(out, 'images'), { recursive: true });
for (const b of blocks.filter(b => b.kind === 'image')) {
  const { width: w, height: h } = b.image;
  const tone = 150 + ((b.id * 37) % 80);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="rgb(${tone},${tone - 6},${tone - 14})"/><text x="50%" y="50%" font-family="Arial" font-size="${Math.round(w / 14)}" fill="rgba(0,0,0,.35)" text-anchor="middle" dominant-baseline="middle">${w}×${h}</text></svg>`;
  for (const f of b.files) await writeFile(path.join(out, 'images', f), svg);
}

await copyFile(path.join(root, 'dist/styles.css'), path.join(out, 'styles.css'));
const spreads = compose(blocks);
await writeFile(path.join(out, 'index.html'), render(spreads, { fetched_at: 'preview', channel: { slug: 'preview' } }));
console.log(`preview/index.html — ${spreads.length} spreads from ${blocks.length} invented blocks.`);
