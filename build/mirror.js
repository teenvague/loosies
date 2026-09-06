// Copies each block's image into dist/images so the published page does not
// depend on Are.na (the channel is private, and CDN URLs are not forever).
// A manifest keyed on the block id + Are.na's own image updated_at means a
// rebuild only downloads what actually changed.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { MIRROR_SIZES } from './config.js';

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
};

export async function mirror(blocks, { outDir, manifestPath, log = console.log }) {
  await mkdir(outDir, { recursive: true });
  const manifest = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : {};

  let fetched = 0, reused = 0, failed = 0;

  for (const block of blocks) {
    if (block.kind !== 'image') continue;
    const stamp = block.image.updated_at ?? '';
    const cached = manifest[block.id];
    if (cached && cached.stamp === stamp && cached.files.every(f => existsSync(path.join(outDir, f)))) {
      block.files = cached.files;
      reused++;
      continue;
    }

    // Are.na's resizer strips GIF animation, so animated files come through whole.
    const wanted = block.image.content_type === 'image/gif'
      ? [['large', block.image.original]]
      : MIRROR_SIZES.map(size => [size, block.image[size]]);

    try {
      const files = [];
      for (const [size, url] of wanted) {
        const file = await download(url, outDir, `${block.id}-${size}`);
        files.push(file);
      }
      block.files = files;
      manifest[block.id] = { stamp, files };
      fetched++;
    } catch (err) {
      failed++;
      log(`  ! image ${block.id} could not be mirrored: ${err.message}`);
      // Fall back to whatever we already had; otherwise the block is dropped.
      block.files = cached?.files ?? null;
    }
  }

  // Forget blocks that have left the channel, but leave their files on disk —
  // deleting them is a separate, deliberate act (npm run prune).
  const live = new Set(blocks.map(b => String(b.id)));
  for (const id of Object.keys(manifest)) if (!live.has(id)) delete manifest[id];

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  log(`  images: ${fetched} fetched, ${reused} unchanged${failed ? `, ${failed} failed` : ''}`);
  return blocks.filter(b => b.kind !== 'image' || b.files?.length);
}

async function download(url, outDir, stem) {
  // webp where the resizer offers it; the response header decides the extension.
  const res = await fetch(url, { headers: { Accept: 'image/webp,image/*' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXT[type] ?? 'jpg';
  const name = `${stem}.${ext}`;
  await writeFile(path.join(outDir, name), Buffer.from(await res.arrayBuffer()));
  return name;
}
