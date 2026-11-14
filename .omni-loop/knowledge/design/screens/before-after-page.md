---
screen: before-after-page
status: draft
kind: page
mock: before-after-page.html
implements: [kit/templates/before-after/page.html]
reads: [kit/lib/before-after/skeleton.ts, kit/lib/before-after/grade.ts, kit/lib/before-after/render.ts]
routes: []
supersedes: null
---

## Purpose

The page a person reads to approve a PRD: today beside after. One self-contained HTML file per PRD,
`before-after.html` in its folder, written from the kit's template by `omni before-after new` and
shown framed in the PRD page's Before/after tab. It is a kit page: every repository that runs the
loop gets it, so it wears the template's own neutral look, in light and dark, never one product's
design system.

## Regions

- **The title:** `PRD <n>: before and after`.
- **The tabs,** in this order: Functional (open when the page loads), Technical, Pixel perfect. The
  third carries the count of screens when it is filled (`Pixel perfect · 2`).
- **Functional:** per service, today beside after, in product words.
- **Technical:** Flow and Deploy order, then per service Database, API / schema and Behaviour.
- **Pixel perfect:** an index, `References` then every reference once, each a link to its frame;
  the `screens:` line; then each reference's frames, today beside after, under a caption
  `<reference> · <screen> · Today|After · <width>` that ends with a `100 %` button. The tab uses the
  window's full width. The agent writes only the marked screens (`data-screen`, `data-ref`,
  `data-when`, `data-viewport`, the markup in a `<template>`), and a heading or a note before them
  when it wants one; the template draws everything else: the frames, their captions, their scale,
  the index and the count.
- **A frame:** the screen laid out at its declared width in a shadow root, with the page's one
  screens' stylesheet (`<template id="screen-css">`), scaled down to fit its column, never up. The
  page's rules never reach inside it, and its rules never reach out. Today sits beside after when
  the window shows both at half their size or more, above it otherwise.

## States

- Functional open (the page as it loads).
- Pixel perfect, filled.
- Pixel perfect of a PRD that changes no screen: the one line `Pixel perfect: no screen changes`.
- A frame opened at 100 %, after its reference (or its `100 %` button) is pressed: the button reads
  `Fit`, and the frame scrolls sideways inside its column. Pressing either again fits it back.
- A reference with no today: its today side is the line `This state does not exist today.`

## Words

- The tab labels: `Functional`, `Technical`, `Pixel perfect`.
- `Today`, `After`, and the section headings of the Technical tab, as the template writes them.
- A reference is a number, a dot and a letter: `2.C`.
- `References`, `100 %` and `Fit`, `This state does not exist today.`

## Refusals

- No primary action: the page is read, nothing is done on it.
- No resource loaded, and no raster image.
- A screen is never drawn outside the Pixel perfect tab, and never as a loose card.

## Open questions

- How a frame opened at 100 % is closed, and whether it scrolls sideways or overlays the page. Drawn
  today: pressing the reference or `Fit` again closes it, and it scrolls sideways in its column.
- Where today sits against after for a phone-width screen (390): beside it at every window width,
  or by the same half-size rule as a desktop screen. Drawn today: the same half-size rule.
- Whether the index shows, per reference, a mark for "no today". Drawn today: no mark.

## Source

/omni:brainstorm, PRD 2850: .omni-loop/delivery/shipped/2850-pixel-perfect-tab/before-after.html
