---
screen: notifications
status: draft
kind: shared
mock: notifications.html
implements: [apps/galaxy/src/nav/Bell.tsx, apps/galaxy/src/nav/bell.ts, apps/galaxy/src/nav/bell.css, apps/galaxy/src/waiting/alerts.ts]
reads: [apps/galaxy/src/waiting/, apps/galaxy/src/people/PersonChip.tsx, apps/galaxy/src/nav/AppBar.tsx]
routes: [/app, /app/waiting, /prd/<id>, /ask, /knowledge, /roadmaps, /concepts, /bugs, /visual]
supersedes: null
---

## Purpose

The bell in the app shell's top bar, signed in, and the panel it opens: what waits for you, on every
app page (`apps/galaxy/src/nav/Bell.tsx`, `nav/bell.ts`). The badge counts what waits on you
(questions, approvals, reviews, outbox items); the panel lists them, each line opening where it is answered.
It has no route of its own: it appears on each page the app shell wraps.

## Regions

- **The bell:** a 36 px button with the bell icon, its accessible name `Waiting for you: <n>` (or
  `Nothing waiting for you`), and a red badge with the count when it is above 0.
- **The panel** (`role="region"`, `Waiting for you`), under the bell, 360 px wide: its groups in
  order, each only when it has a line or a problem to say:
  - **Questions:** the round's title, the question, how long it has waited (`3 min`, `2 h`), and who
    shared it as a person chip.
  - **Approvals:** `PRD <n> · <title>`, `Waits for your approval`, how long.
  - **Reviews** (PRD 2377): `PRD <n>` (or `Bug fix #<n>`, `Visual update #<n>`), what waits on you
    (`Review`, `Merge`, `Law <id>`), how long; it opens the pull request on GitHub, the PRD's title as
    its tooltip. Counted. Approvals and outbox items are never repeated here.
  - **Outbox:** `PRD <n> · <title>`, the item's question, its rank.
  - **New documents:** `PRD <n> · <title>`, `New spec, plan, before/after`, how long. Never counted.
  - **Business:** `Business · <n> to check`, `Proposed, disputed or fading claims`. Never counted.
- **The foot:** the Desktop alerts and Chime switches; Desktop alerts says `Blocked by the browser`
  when the browser refuses it (`waiting/alerts.ts`).

## States

- **Closed** (mostly seen): the bell and its badge.
- **Open:** the panel; Escape (the focus back on the bell), a click outside or choosing a line closes
  it (`nav/bell.ts`, `bell`).
- **Nothing waits:** no badge; the panel says `Nothing waiting for you.`
- **A part could not be read:** `Questions couldn't be read — retrying.` in its group's place, above
  the lines it last had; `<n> PRDs couldn't be read` under Outbox.
- **Phone, below 900 px:** the panel hangs from the top bar, the screen's width (`nav/bell.css`).
- **Signed out:** no bell at all (the app shell's state).

## Words

Waiting for you · Nothing waiting for you. · Questions · Approvals · Reviews · Review · Merge · Law · Outbox · New documents ·
Business · Waits for your approval · New spec, plan, before/after · to check · Proposed, disputed or
fading claims · couldn't be read — retrying. · shared by · Desktop alerts · Chime · Blocked by the
browser.

## Refusals

- New documents and Business are news, not waits: they never add to the badge or the bell's name
  (`nav/bell.ts`).
- A part whose read failed says so in its place and keeps the lines it last had: the panel never
  empties silently.

## Open questions

- The panel has no primary action; each line is a link of equal weight. The mockup marks none.
- A question's line text is cut to one line with an ellipsis (`bell.css`): how long may a
  question be before the line stops saying what it asks?

## Source

- apps/galaxy/src/nav/Bell.tsx
- apps/galaxy/src/nav/bell.ts
- apps/galaxy/src/nav/bell.css
- apps/galaxy/src/waiting/alerts.ts
- PRD 1584 s4, 2026-10-11 (drawn by `/omni:pixel-perfect mock`, from the source)
- /omni:brainstorm, PRD 2377: .omni-loop/delivery/shipped/2377-waiting-board/before-after.html (the Reviews group)
