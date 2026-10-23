---
screen: anti-dashboard
status: draft
kind: page
mock: anti-dashboard.html
implements: [apps/galaxy/app/anti/page.tsx]
reads: [apps/galaxy/src/nav/, apps/galaxy/app/anti/layout.tsx, packages/design/src/tokens.ts]
routes: [/anti]
supersedes: null
---

## Purpose

Anti-dashboard, a page of the anti-loop mode (concept #1964): the place of the tech team's harness,
architecture and retro work. A placeholder for now: it says what it will hold and that it is not
open yet (PRD 2490).

## Regions

- **The app shell in anti-loop mode** (the shared `app-shell` screen): the ANTI LOOP lockup with the
  mirrored crest, the Anti-loop group (Anti-dashboard marked current, Anti-work), the trail
  `Anti-loop › Anti-dashboard`, the switch reading `Omni loop`.
- **The page:** its title, then two lines.

## States

- One state: the placeholder. Signed out, the shell's own signed-out state applies.

## Words

Anti-dashboard · Harness, architecture and retros, at a glance. · Not open yet.

## Refusals

- No data, no count and no link on the page: it is a placeholder (PRD 2490 › Scope).

## Open questions

- What the page holds once it opens is left to a later PRD.

## Source

- /omni:brainstorm, PRD 2490: .omni-loop/delivery/inbox/2490-anti-loop-placeholder/before-after.html
