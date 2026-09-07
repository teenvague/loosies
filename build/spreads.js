// The layout grammar.
//
// A rigid twelve-column grid. Most bands are two or three images sharing a
// baseline and touching — no gap between them, and deliberately unequal
// heights, since equal heights would read as a strip rather than a
// composition. Between those, single images: sometimes very large, sometimes
// small, and the two alternate so scale keeps moving.
//
// Two variations run underneath that, both deliberately less frequent than the
// default: a band may hang from a shared *top* line instead of a baseline, and
// a band may open white space between its images while still holding the
// shared line. Roughly one band in five does each.
//
// Height is not a free choice. An image's height on the page is its column
// span divided by its aspect ratio, so the assigner picks *which* image goes
// in *which* span — searching a short window of the channel — to make the
// heights inside a baseline group come out different.

const WINDOW = 12;        // how far ahead the assigner may look
const MIN_SEPARATION = 0.18;  // neighbours must differ in height by ≥18%
const MAX_SEPARATION = 3.0;   // …but not so much that one is a stamp
const MAX_HEIGHT = 8.5;       // column-units; ~0.8 of the page width

// Bands, in the order they rotate. Multi-image bands fill all twelve columns,
// so the grid's edges stay hard; solos sit on a column line and leave the rest
// of the row empty.
const BANDS = [
  { kind: 'group', spans: [7, 5] },
  { kind: 'group', spans: [4, 3, 5] },
  { kind: 'solo',  spans: [10], col: 1, maxHeight: 7.5 },
  { kind: 'group', spans: [5, 7], align: 'start' },        // shared top line
  { kind: 'group', spans: [8, 4] },
  { kind: 'solo',  spans: [5],  col: 8 },
  { kind: 'group', spans: [3, 5, 4] },
  { kind: 'group', spans: [5, 4], gaps: [3], mobileGap: true },             // baseline held across a gap
  { kind: 'solo',  spans: [12], col: 1, maxHeight: 6.5 },
  { kind: 'group', spans: [4, 8] },
  { kind: 'group', spans: [6, 3, 3], align: 'start' },     // shared top line, three
  { kind: 'solo',  spans: [4],  col: 9 },
  { kind: 'group', spans: [5, 4, 3] },
  { kind: 'group', spans: [7, 5] },
  { kind: 'solo',  spans: [9],  col: 4, maxHeight: 7.5 },
  { kind: 'group', spans: [3, 3, 4], gaps: [1, 1] },       // three, loosely spaced
  { kind: 'group', spans: [4, 8] },
  { kind: 'solo',  spans: [3],  col: 1 },
  { kind: 'group', spans: [6, 6] },
  { kind: 'group', spans: [3, 4], gaps: [2], col: 2, align: 'start', mobileGap: true },
  { kind: 'group', spans: [4, 3, 5] },
  { kind: 'group', spans: [8, 4] },
];

// Text is placed on the same column lines and never inside a baseline group.
const TEXT_BANDS = [
  { col: 1, span: 5, size: 'small' },
  { col: 7, span: 6, size: 'medium' },
  { col: 2, span: 7, size: 'large' },
  { col: 4, span: 5, size: 'medium' },
];
const TEXT_EVERY = 4;     // one text band after every four image bands

const ratioOf = (b) => b.image?.ratio || 1;
const isPortrait = (b) => ratioOf(b) < 0.87;
const heightOf = (span, block) => span / ratioOf(block);

export function compose(blocks) {
  const images = blocks.filter(b => b.kind === 'image');
  const texts = blocks.filter(b => b.kind === 'text');
  const out = [];
  let band = 0, sinceText = 0, textIndex = 0;

  while (images.length) {
    const spec = BANDS[band++ % BANDS.length];
    const picked = spec.kind === 'solo'
      ? pickSolo(images, spec)
      : pickGroup(images, spec.spans);
    if (!picked.length) break;

    out.push({
      name: spec.kind === 'solo' ? (spec.spans[0] >= 9 ? 'solo-large' : 'solo-small') : `group-${picked.length}`,
      slots: layout(spec, picked),
    });

    if (texts.length && ++sinceText >= TEXT_EVERY) {
      sinceText = 0;
      out.push(textBand(texts.shift(), textIndex++));
    }
  }

  while (texts.length) out.push(textBand(texts.shift(), textIndex++));
  return out;
}

function textBand(block, i) {
  const spec = TEXT_BANDS[i % TEXT_BANDS.length];
  return {
    name: 'text',
    slots: [{
      kind: 'text', size: spec.size, block,
      col: spec.col, span: spec.span, row: 1,
      mcol: Math.min(9 - 6, Math.max(1, Math.round((spec.col - 1) * 8 / 12) + 1)), mspan: 6, mrow: 1,
      scol: 1, sspan: 4, srow: 1,
    }],
  };
}

// --- choosing images -------------------------------------------------------

// A group's images are chosen together: the assigner tries orderings of the
// next few blocks and keeps the one whose heights are most clearly unequal
// while staying closest to the channel's own order.
function pickGroup(queue, spans) {
  const n = spans.length;
  if (queue.length < n) return queue.splice(0, queue.length);

  const window = queue.slice(0, Math.min(WINDOW, queue.length));
  let best = null, fallback = null;

  for (const idx of permutations(window.length, n)) {
    const heights = idx.map((i, k) => heightOf(spans[k], window[i]));
    const lo = Math.min(...heights), hi = Math.max(...heights);
    const drift = idx.reduce((a, i, k) => a + Math.abs(i - k), 0);
    const gap = minGap(heights);
    const score = drift - gap * 24;

    if (!fallback || score < fallback.score) fallback = { idx, score };
    if (gap < MIN_SEPARATION) continue;
    if (hi > MAX_HEIGHT || hi / lo > MAX_SEPARATION) continue;
    if (!best || score < best.score) best = { idx, score };
  }

  const chosen = (best ?? fallback).idx;
  // Remove highest index first so the earlier ones stay valid.
  const blocks = chosen.map(i => window[i]);
  for (const i of [...chosen].sort((a, b) => b - a)) queue.splice(i, 1);
  return blocks;
}

// The smallest relative difference between any two heights in the group.
function minGap(heights) {
  let gap = Infinity;
  for (let i = 0; i < heights.length; i++)
    for (let j = i + 1; j < heights.length; j++)
      gap = Math.min(gap, Math.abs(heights[i] - heights[j]) / Math.max(heights[i], heights[j]));
  return heights.length < 2 ? 1 : gap;
}

// A solo takes the next image that will not blow past its height ceiling —
// a portrait at twelve columns would be taller than the screen.
function pickSolo(queue, spec) {
  const cap = spec.maxHeight ?? MAX_HEIGHT;
  const limit = Math.min(WINDOW, queue.length);
  for (let i = 0; i < limit; i++) {
    if (heightOf(spec.spans[0], queue[i]) <= cap) return queue.splice(i, 1);
  }
  return queue.splice(0, 1);
}

function* permutations(size, n, used = [], start = 0) {
  if (used.length === n) { yield [...used]; return; }
  for (let i = 0; i < size; i++) {
    if (used.includes(i)) continue;
    used.push(i);
    yield* permutations(size, n, used, start);
    used.pop();
  }
}

// --- placing them ----------------------------------------------------------

function layout(spec, blocks) {
  const gaps = spec.gaps ?? [];
  const twelve = runningCols(spec.col ?? 1, spec.spans, gaps);
  const eight = fit(spec, blocks, 8);
  const four = fit(spec, blocks, 4);

  // Every image in a band shares a line: the baseline by default, the top line
  // where the band asks for it. Only the four-column phone layout ever wraps a
  // third image onto a row of its own.
  const align = spec.align === 'start' ? 'start' : 'end';

  return blocks.map((block, i) => ({
    kind: 'image', block, align,
    col: twelve[i], span: spec.spans[i], row: 1,
    mcol: eight[i].col, mspan: eight[i].span, mrow: eight[i].row,
    scol: four[i].col, sspan: four[i].span, srow: four[i].row,
  }));
}

function runningCols(start, spans, gaps = []) {
  const cols = []; let c = start;
  for (let i = 0; i < spans.length; i++) {
    cols.push(c);
    c += spans[i] + (gaps[i] ?? 0);
  }
  return cols;
}

// Narrower grids keep the idea — a shared line, unequal heights, and whatever
// gap the band asked for — with spans rescaled. Below eight columns a gap
// costs more than it says, so the phone grid closes them up.
function fit(spec, blocks, cols) {
  const n = spec.spans.length;

  if (spec.kind === 'solo') {
    const wide = spec.spans[0] >= 9;
    const span = wide ? cols : Math.max(2, Math.round(cols / 2));
    const col = wide ? 1 : (spec.col > 6 ? cols - span + 1 : 1);
    return [{ col, span, row: 1 }];
  }

  // On phones, three-image bands stay on one shared baseline.
  // Give one image two columns and the other two one column each,
  // following whichever image had the largest desktop span.
  if (cols === 4 && n === 3) {
    const patterns = [
      [1, 1, 2],
      [1, 2, 1],
      [2, 1, 1],
    ];

    const patternIndex = Math.abs(spec.spans.join('').split('').reduce((a, n) => a + Number(n), 0) + (spec.col ?? 1)) % patterns.length;
    const spans = patterns[patternIndex];

    let col = 1;
    return spans.map(span => {
      const slot = { col, span, row: 1 };
      col += span;
      return slot;
    });
  }

  if (cols === 4 && n === 2) {
    const patterns = [
      [1, 3],
      [3, 1],
      [2, 2],
      [1, 3],
      [3, 1],
    ];

    const patternIndex = Math.abs(spec.spans[0] * 3 + spec.spans[1] + (spec.col ?? 1)) % patterns.length;
    const spans = patterns[patternIndex];

    return [
      { col: 1, span: spans[0], row: 1 },
      { col: spans[0] + 1, span: spans[1], row: 1 },
    ];
  }

  const k = cols / 12;
  const min = blocks.map(b => (cols === 4 && isPortrait(b) ? 1 : 2));
  const spans = spec.spans.map((s, i) => Math.max(min[i], Math.round(s * k)));
  const gaps = (spec.gaps ?? []).map(g => {
    if (cols === 4) return spec.mobileGap ? 1 : 0;
    return g > 0 ? 1 : 0;
  });
  let start = Math.max(1, Math.round(((spec.col ?? 1) - 1) * k) + 1);

  // Rounding can push the band past the edge; give back gap first, then the
  // widest span, before finally sliding the whole band left.
  const width = () => spans.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (start - 1 + width() > cols && guard++ < 24) {
    const g = gaps.findIndex(v => v > 0);
    if (g !== -1) { gaps[g]--; continue; }
    const widest = spans.reduce((best, v, i) => (v - min[i] > spans[best] - min[best] ? i : best), 0);
    if (spans[widest] > min[widest]) { spans[widest]--; continue; }
    if (start > 1) { start--; continue; }
    break;
  }

  return runningCols(start, spans, gaps).map((col, i) => ({ col, span: spans[i], row: 1 }));
}
