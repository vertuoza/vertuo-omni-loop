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
- **Pixel perfect:** an index of every reference, the `screens:` line, then each screen whole in a
  frame, today beside after, under a caption `<reference> · <screen> · Today|After · <width>`. The
  tab uses the window's full width.

## States

- Functional open (the page as it loads).
- Pixel perfect, filled.
- Pixel perfect of a PRD that changes no screen: the one line `Pixel perfect: no screen changes`.
- A frame opened at 100 %, after its reference is pressed.

## Words

- The tab labels: `Functional`, `Technical`, `Pixel perfect`.
- `Today`, `After`, and the section headings of the Technical tab, as the template writes them.
- A reference is a number, a dot and a letter: `2.C`.

## Refusals

- No primary action: the page is read, nothing is done on it.
- No resource loaded, and no raster image.
- A screen is never drawn outside the Pixel perfect tab, and never as a loose card.

## Open questions

- How a frame opened at 100 % is closed, and whether it scrolls sideways or overlays the page.
- Where today sits against after for a phone-width screen (390): beside it at every window width,
  or by the same half-size rule as a desktop screen.
- Whether the index shows, per reference, a mark for "no today".

## Source

/omni:brainstorm, PRD 2850: .omni-loop/delivery/inbox/2850-pixel-perfect-tab/before-after.html
