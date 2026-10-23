---
screen: anti-work
status: draft
kind: page
mock: anti-work.html
implements: [apps/galaxy/app/anti/work/page.tsx]
reads: [apps/galaxy/src/nav/, apps/galaxy/app/anti/layout.tsx, packages/design/src/tokens.ts]
routes: [/anti/work]
supersedes: null
---

## Purpose

Anti-work, a page of the anti-loop mode (concept #1964): the place of the tech team's harness,
architecture and retro work. A placeholder for now: it says what it will hold and that it is not
open yet (PRD 2490).

## Regions

- **The app shell in anti-loop mode** (the shared `app-shell` screen): the ANTI LOOP lockup with the
  mirrored crest, the Anti-loop group (Anti-work marked current, Anti-dashboard), the trail
  `Anti-loop › Anti-work`, the switch reading `Omni loop`.
- **The page:** its title, then two lines.

## States

- One state: the placeholder. Signed out, the shell's own signed-out state applies.

## Words

Anti-work · The tech team's harness, architecture and retros. · Not open yet.

## Refusals

- No data, no count and no link on the page: it is a placeholder (PRD 2490 › Scope).

## Open questions

- What the page holds once it opens is left to a later PRD.

## Source

- /omni:brainstorm, PRD 2490: .omni-loop/delivery/shipped/2490-anti-loop-placeholder/before-after.html
