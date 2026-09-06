// Reads a channel out of the Are.na v3 API and flattens it into the
// shape the renderer wants. Nothing here knows about layout.
import { API, CHANNEL, NEWEST_FIRST } from './config.js';

const PER = 100;

async function get(path) {
  const token = process.env.ARENA_TOKEN;
  if (!token) {
    throw new Error(
      'ARENA_TOKEN is not set. The v3 API needs a bearer token even for your own ' +
      'channels — make one at are.na → Settings → Applications, then export it ' +
      'locally or add it as the ARENA_TOKEN repository secret.'
    );
  }
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${path} → ${res.status} ${res.statusText}\n${body.slice(0, 400)}`);
  }
  return res.json();
}

export async function fetchChannel() {
  const channel = await get(`/channels/${CHANNEL}`);
  const contents = [];
  for (let page = 1; ; page++) {
    const { data, meta } = await get(`/channels/${CHANNEL}/contents?per=${PER}&page=${page}`);
    contents.push(...data);
    if (!meta?.has_more_pages) break;
  }
  return {
    fetched_at: new Date().toISOString(),
    channel: {
      id: channel.id,
      slug: channel.slug,
      title: channel.title,
      updated_at: channel.updated_at,
      count: channel.counts?.contents ?? contents.length,
    },
    blocks: contents.map(normalize).filter(Boolean).sort(byPosition),
  };
}

function byPosition(a, b) {
  const d = a.position - b.position;
  return NEWEST_FIRST ? -d : d;
}

// Are.na block types we can place. Channel blocks (nested channels) and
// anything still processing are dropped rather than rendered empty.
function normalize(item) {
  if (item.base_type !== 'Block' || item.state !== 'available') return null;
  const common = {
    id: item.id,
    type: item.type,
    position: item.connection?.position ?? 0,
    title: item.title || null,
    href: `https://www.are.na/block/${item.id}`,
    connected_at: item.connection?.connected_at ?? item.created_at,
  };

  if (item.type === 'Text') {
    const text = item.content?.plain?.trim();
    if (!text) return null;
    return { ...common, kind: 'text', text, html: item.content?.html ?? null };
  }

  if (item.type === 'Image' || item.type === 'Link') {
    const img = item.image;
    if (!img?.src) return null;
    return {
      ...common,
      kind: 'image',
      source: item.source?.url ?? null,
      provider: item.source?.url ? hostOf(item.source.url) : null,
      alt: img.alt_text || item.title || '',
      image: {
        width: img.width ?? null,
        height: img.height ?? null,
        // aspect_ratio is width/height; fall back to a square if Are.na has neither
        ratio: img.aspect_ratio ?? (img.width && img.height ? img.width / img.height : 1),
        content_type: img.content_type ?? null,
        updated_at: img.updated_at ?? item.updated_at,
        original: img.src,
        medium: img.medium?.src ?? img.src,
        large: img.large?.src ?? img.medium?.src ?? img.src,
      },
    };
  }

  return null; // Media, Attachment — not part of this site's vocabulary yet
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}
