// The layout grammar, taken from the draft: a twelve-column grid with no
// column gap, blocks spanning three to ten columns, some hung from the top of
// their row and some sitting on its baseline, text treated as a placed element
// rather than a caption.
//
// A spread is one band of that grid. Six of them rotate down the page so the
// composition never settles into an obvious repeat. Slots ask for an
// orientation; the assigner honours it where the queue allows and otherwise
// takes what is next, so the channel's own order is broadly preserved.

export const SPREADS = [
  {
    name: 'opening',            // the draft's own top band
    slots: [
      { kind: 'image', col: 1,  span: 6, row: 1, align: 'end',   want: 'landscape' },
      { kind: 'image', col: 7,  span: 3, row: 1, align: 'end',   want: 'portrait'  },
      { kind: 'image', col: 10, span: 3, row: 1, align: 'end',   want: 'landscape' },
      { kind: 'text',  col: 2,  span: 7, row: 2, size: 'large' },
      { kind: 'image', col: 2,  span: 3, row: 3, align: 'start', want: 'square'    },
    ],
  },
  {
    name: 'pair',
    slots: [
      { kind: 'image', col: 1, span: 4, row: 1, align: 'end', want: 'portrait'  },
      { kind: 'image', col: 5, span: 8, row: 1, align: 'end', want: 'landscape' },
    ],
  },
  {
    name: 'aside',              // text and image share a row
    slots: [
      { kind: 'text',  col: 1, span: 5, row: 1, size: 'small' },
      { kind: 'image', col: 7, span: 6, row: 1, align: 'start', want: 'landscape' },
      { kind: 'image', col: 1, span: 4, row: 2, align: 'start', want: 'portrait'  },
    ],
  },
  {
    name: 'wide',
    slots: [
      { kind: 'image', col: 1, span: 10, row: 1, align: 'start', want: 'landscape' },
      { kind: 'text',  col: 7, span: 5,  row: 2, size: 'medium' },
      { kind: 'image', col: 3, span: 3,  row: 3, align: 'start', want: 'square'    },
    ],
  },
  {
    name: 'scatter',
    slots: [
      { kind: 'image', col: 1, span: 4, row: 1, align: 'start', want: 'landscape' },
      { kind: 'image', col: 6, span: 2, row: 1, align: 'end',   want: 'portrait'  },
      { kind: 'image', col: 9, span: 4, row: 1, align: 'start', want: 'landscape' },
      { kind: 'image', col: 2, span: 3, row: 2, align: 'start', want: 'any'       },
    ],
  },
  {
    name: 'stack',
    slots: [
      { kind: 'image', col: 2, span: 5, row: 1, align: 'start', want: 'landscape' },
      { kind: 'image', col: 8, span: 4, row: 1, align: 'end',   want: 'portrait'  },
      { kind: 'image', col: 1, span: 3, row: 2, align: 'start', want: 'square'    },
    ],
  },
  {
    name: 'bleed',
    slots: [
      { kind: 'image', col: 1, span: 12, row: 1, align: 'start', want: 'landscape' },
      { kind: 'image', col: 9, span: 4,  row: 2, align: 'start', want: 'portrait'  },
    ],
  },
  {
    name: 'quiet',
    slots: [
      { kind: 'image', col: 4, span: 5, row: 1, align: 'start', want: 'portrait' },
      { kind: 'text',  col: 4, span: 5, row: 2, size: 'medium' },
    ],
  },
];

const orientationOf = (ratio) => (ratio > 1.15 ? 'landscape' : ratio < 0.87 ? 'portrait' : 'square');

// How far ahead the assigner will look for an image of the orientation a slot
// wants. Small, so the page still reads roughly in channel order.
const LOOKAHEAD = 6;

export function compose(blocks) {
  const images = blocks.filter(b => b.kind === 'image');
  const texts  = blocks.filter(b => b.kind === 'text');
  const spreads = [];

  let variant = 0;
  while (images.length) {
    // Once the text has run out, skip past variants built around it rather
    // than leaving their rows standing empty.
    let template = SPREADS[variant % SPREADS.length];
    let guard = 0;
    while (!texts.length && template.slots.some(s => s.kind === 'text') && guard++ < SPREADS.length) {
      variant++;
      template = SPREADS[variant % SPREADS.length];
    }
    variant++;

    const filled = [];
    for (const slot of template.slots) {
      if (slot.kind === 'text') {
        if (!texts.length) continue;
        filled.push({ ...slot, block: texts.shift() });
        continue;
      }
      if (!images.length) continue;
      filled.push({ ...slot, block: take(images, slot.want) });
    }
    if (!filled.some(s => s.kind === 'image')) break;
    spreads.push({ name: template.name, slots: filled });
  }

  // Any text left over (a channel of mostly writing) becomes its own quiet band.
  while (texts.length) {
    spreads.push({
      name: 'quiet',
      slots: [{ kind: 'text', col: 4, span: 5, row: 1, size: 'medium', block: texts.shift() }],
    });
  }

  return spreads;
}

function take(queue, want) {
  if (want && want !== 'any') {
    const limit = Math.min(LOOKAHEAD, queue.length);
    for (let i = 0; i < limit; i++) {
      if (orientationOf(queue[i].image.ratio) === want) return queue.splice(i, 1)[0];
    }
  }
  return queue.shift();
}
