---
screen: breach-night
status: draft
kind: page
mock: breach-night.html
implements: []
reads: []
routes: [/play#planet-<owner>/<repo>/<n>]
supersedes: null
---

## Purpose

The anti-hero game: you play **The Recurrent**, a conqueror race that can land only where something
keeps happening again ("We return where you never learned."). On the real galaxy map, only planets
whose lesson never landed can be breached. The BREACH tab of a planet shows the breach and launches
the raid, `assay-raid`. A breach is a wound; defenders repel it only by landing the lesson. In the
arcade's look, pixel art at whole-number scale, with `anti-loop-mode`'s lockup in the header. The
other tabs of the planet are `planet-overlay`'s.

## Regions

- **The header:** the ANTI LOOP lockup, YOU ARE THE RECURRENT, the planet (`#1628 CLOUD SIGN-IN`),
  its state chip and BREACHABLE.
- **The tabs:** `planet-overlay`'s, with BREACH beside ENTROPY, current.
- **The map:** the galaxy, never-landed planets breachable, others dim (`1904 · NO BREACH`). The
  echo trail runs from the first planet the cause hit to this one; the warlord stands on each, one
  rank larger on 1628 than on 1322.
- **The side:** the breach (TYPES DRIFT, WARLORD · SEEN ON 2 PLANETS), its facts (1322 RED ON 7
  COMMITS · #1349; 1628 RED ON 3 COMMITS · #1649; KB NO RULE · PROPOSED TWICE; GUARD YES, SINCE 725),
  the quote, the RULES box, what else is breachable, and **A · LAUNCH RAID**.
- **The hint:** `◀ ▶ TABS · ▲ ▼ NEXT BREACH · B MAP`.

## States

- **Breachable:** the planet has a never-landed lesson; the raid can launch.
- **No breach:** a planet with nothing never landed is dim and cannot be raided.
- **Repelled:** the lesson lands, the wound closes and pays whoever landed it.

## Words

YOU ARE THE RECURRENT · BREACHABLE · BREACH · TYPES DRIFT · WARLORD · SEEN ON 2 PLANETS · NO BREACH ·
Only never-landed planets are breachable. · "WE RETURN WHERE YOU NEVER LEARNED." · RULES · VILLAIN
EARNS A TROPHY ONLY · PLAYING EARNS NO XP · A BREACH IS A WOUND · LANDING THE LESSON CLOSES IT · A ·
LAUNCH RAID · ◀ ▶ TABS · ▲ ▼ NEXT BREACH · B MAP.

## Refusals

- The villain earns a trophy only: playing a game never earns points or XP (`game/README.md`:224).
- A breach is a wound like `aftershock`, closed by the existing `woundClose` and paid to whoever
  lands the lesson, never to the raider.
- A breach attacks a cause, never a person.
- The anti-hero faction is our own: no name, likeness or design from any comic.

## Open questions

- `breach` is not in `WOUND_KINDS`: it needs its rulebook entries, and must not knock a terraformed
  planet back toward PLANET_LOST and its clawback.
- The lesson-landed event's weight (the Skeptic: at or below `aftershock`'s 20, under
  `featureMerged`'s 30) and what fires it are not settled.
- B-E DEv calls the game "fluff"; the game must work as a layer, with the findings standing without it.
- What the trophy is, and where it shows, is not drawn.
- How the warlord's rank is counted (one per planet the cause hit?) is not said.
- Feasibility rests on matching findings by cause and on retros: with 10 of 171 shipped PRDs read,
  most planets cannot show a breach yet.
- The quote's face: Craft asked for Jersey 10, the tour set it in the pixel face.

## Source

- /omni:think-big, concept #1964, crowned M on 2026-10-14: .omni-loop/delivery/inbox/concepts/1964-anti-loop/vision.html
