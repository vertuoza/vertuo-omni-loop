---
screen: planet-overlay
status: draft
kind: page
mock: planet-overlay.html
implements: [apps/galaxy/src/arcade/scenes/planet.tsx, apps/galaxy/src/arcade/scenes/planet.css]
reads: [apps/galaxy/src/arcade/scenes/planet.ts, apps/galaxy/src/data/dossiers.ts, apps/galaxy/src/arcade/deep-link.ts]
routes: [/play#planet-<owner>/<repo>/<n>]
supersedes: null
---

## Purpose

One planet of the galaxy, opened from the map or by its deep link: its title, state and caption, and five tabs, STATUS, ZONES, ENTROPY, LOG and DOSSIER. After PRD 1808 it opens at once from what the map knows; its LOG and DOSSIER tabs read the planet's details when it is opened.

## Regions

- **The header:** `#<prd>`, the title in capitals, the state chip.
- **The caption:** `ZONES <secured>/<n> · ENTROPY <open>`, or the SOS line for a planet in distress.
- **The tabs:** STATUS, ZONES, ENTROPY (with its count), LOG, DOSSIER; ◀ ▶ moves between them.
- **The tab body:** the LOG tab's last 8 lines; the DOSSIER tab's versions (BEFORE/AFTER, SPEC, PLAN), answers and its last answers, and START to open the dossier's page.
- **The hint:** `◀ ▶ TABS · ▲ ▼ NEXT PLANET · B MAP`.

## States

- **LOG and DOSSIER loading:** `LOADING…` until the planet's details arrive (PRD 1808); START waits for the dossier.
- **Loaded:** the tab's content; reopening the planet in the session shows it at once.
- **Out of reach:** `DOSSIERS OUT OF REACH` (and the log's out-of-reach line) when the details could not be read; the next open asks again.
- **No dossier:** `NO DOSSIER YET. ONE OPENS WITH THE PRD'S BRAINSTORM.`

## Words

LOADING… · DOSSIERS OUT OF REACH · NO DOSSIER YET. ONE OPENS WITH THE PRD'S BRAINSTORM. · NONE YET · START OPEN · ◀ ▶ TABS · ▲ ▼ NEXT PLANET · B MAP

## Refusals

- The overlay never shows another planet's details: an answer for a planet no longer selected draws nothing (PRD 1808).
- START opens nothing before the dossier has arrived.

## Open questions

- The LOG tab's out-of-reach line is not written yet: `LOG OUT OF REACH` follows the arcade's pattern, but no copy names it.
- Whether ▲ ▼ NEXT PLANET should show the next planet's tabs as loading or keep the last tab's content while it loads is not said.

## Source

- /omni:brainstorm, PRD 1808: .omni-loop/delivery/inbox/1808-arcade-lazy-details/before-after.html
