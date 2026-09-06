# teenvague/loosies

A page made out of the Are.na channel **betty-wang/teenvague-loosies**.
Images and text blocks are collected each morning, laid out on a rotating set
of spreads, and published to GitHub Pages.

Live at `teenvague.github.io/loosies` (once Pages is switched on — see Setup).
Sits parallel to `teenvague/nowplaying` and `teenvague/library`.

---

## The one thing that needs you first

Are.na is retiring its v2 API. The v3 API wants a bearer token **even for a
channel you own**, and `teenvague-loosies` is private, so nothing can read it
without one.

1. Go to are.na → Settings → Applications and make a **personal access token**.
2. In this repo: Settings → Secrets and variables → Actions → New repository
   secret, named `ARENA_TOKEN`, pasted in there.
3. Settings → Pages → Source: **GitHub Actions**.

Don't paste the token into a file in the repo, and don't send it to me — the
secret is the only place it should live.

To run a refresh on your own machine, put it in the environment for that one
command instead:

```sh
ARENA_TOKEN=... npm run refresh
```

---

## Running it

```sh
npm run build      # rebuild the page from the committed snapshot — no token, no network
npm run refresh    # re-read Are.na, mirror any new images, rebuild
node build/preview.js 40   # invented blocks, into preview/ — design work without the channel
```

`npm run build` is the one you want while changing the design. The channel is
kept in `dist/data/channel.json` and committed, so the page can be rebuilt
offline and a design edit doesn't cost an API call.

---

## How it fits together

```
build/config.js    the decisions: channel, ordering, mirror sizes, indexability
build/arena.js     reads the v3 API, flattens blocks into {kind, image|text}
build/mirror.js    copies images into dist/images, cached on Are.na's own updated_at
build/spreads.js   the layout grammar — eight spreads and the rules for filling them
build/render.js    spreads → index.html
build/preview.js   the same, against invented blocks
dist/styles.css    the design. Hand-written. Not generated.
dist/index.html    generated. Don't edit it; edit styles.css or spreads.js.
```

**Images are copied into the repo, not hotlinked.** The channel is private, so
its CDN URLs are not something a public page should depend on. Two sizes per
block (1200 and 1800 on the long edge, webp where Are.na offers it). The repo
grows accordingly; nothing is deleted when a block leaves the channel, only
forgotten.

---

## The layout

The draft is in `design/draft.html`. `build/spreads.js` turns its grammar into
a rotation of bands on a rigid twelve-column grid:

- **Most bands are two or three images sharing a baseline and touching** — no
  gap, and deliberately unequal heights. Equal heights would read as a strip
  rather than a composition.
- **Between them, single images**, alternating between very large (nine to
  twelve columns) and small (three to four), so scale keeps moving.
- **Less often, a band hangs from a shared top line** instead of a baseline,
  or opens white space between its images while still holding the line.
  Roughly one band in five does each.

Unequal height is not left to chance. An image's height is its column span
divided by its aspect ratio, so the assigner chooses *which* image takes
*which* span — searching about a dozen blocks ahead — so that no two
neighbours in a band come out within 18% of each other, and no image exceeds
roughly 0.8 of the page width in height. Where the channel can't supply a
combination that works, it takes the best available rather than stalling.

**Nothing is cropped.** Each frame takes its image's true proportions straight
from Are.na's `aspect_ratio`; the composition is made of column spans and
shared lines, not of forcing pictures into fixed rectangles.

The grid never dissolves into a stack. It re-proportions to eight columns below
900px and four below 560px, with spans worked out at build time so bands still
tile exactly and still hold their shared line. Only a three-image band on the
four-column grid wraps, dropping its third image to a row of its own.

To change the layout, edit the band table at the top of `build/spreads.js` and
run `node build/preview.js`. To change type, colour, or spacing, edit
`dist/styles.css` and reload — no build needed.

---

## Two things to know

- **The page is set to `noindex`,** and `dist/robots.txt` disallows crawlers.
  Flip `INDEXABLE` in `build/config.js` and empty `robots.txt` when it should
  be findable.
- **Blocks link to their source,** where one exists, and to nothing otherwise.
  Are.na block URLs would 404 for everyone but you.

---

## Pushing

Same as nowplaying: I edit files here and stage the commit; you push from
Terminal with your own credentials.

```sh
cd ~/Documents/teenvague-loosies
git push
```

The first time, after making the empty `teenvague/loosies` repo on GitHub:

```sh
git remote add origin git@github.com:teenvague/loosies.git
git push -u origin main
```
