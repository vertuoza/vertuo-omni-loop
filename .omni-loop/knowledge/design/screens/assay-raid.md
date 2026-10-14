---
screen: assay-raid
status: draft
kind: page
mock: assay-raid.html
implements: []
reads: []
routes: [/play#planet-<owner>/<repo>/<n>]
supersedes: null
---

## Purpose

The Assay, Breach Night's raid mini-game: The Recurrent dive at the repository's wall of lessons.
Each bunker is a lesson of the Lessons ledger: a landed lesson holds, a never-landed one is a gap, a
lesson kept on purpose is no breach. A dive on a gap exposes the breach and points at the one way to
repel it, landing the lesson. Launched from `breach-night`; in the arcade's look, pixel art at
whole-number scale, with `anti-loop-mode`'s lockup in the header.

## Regions

- **The header:** the ANTI LOOP lockup, THE ASSAY · RAID ON #1628, TROPHY ONLY · NO XP.
- **The wall:** the raiders above; five bunkers below, each labelled with its lesson and state
  (MIGRATION ORDER HELD; TYPES DRIFT, TERRITORY, OUTBOX NOTES NEVER LANDED; LINE CHURN KEPT); a guard
  with no rule fires blind at the side (GUARD, NO RULE · FIRES BLIND); the lane marker over the
  aimed bunker.
- **The controls:** ◀, **A · DIVE**, ▶.
- **The side:** THE WALL and its counts (HELD 1 · LANDED, OPEN 3 · NEVER LANDED, KEPT 1 · ON PURPOSE,
  READ 10 OF 171 RETROS), the result, and TO REPEL IT · LAND THE LESSON with a link to the lesson PR.
- **The hint:** `◀ ▶ AIM · A DIVE · B MAP`.

## States

- **At rest:** AIM, THEN DIVE.
- **Breach exposed** (a gap): BREACH EXPOSED, the lesson, A NEVER-LANDED LESSON, and the way to repel
  it.
- **The wall held** (a landed lesson): THE WALL HELD, the lesson · LANDED.
- **No breach** (kept on purpose): NO BREACH, the lesson · KEPT ON PURPOSE.

## Words

THE ASSAY · RAID ON · TROPHY ONLY · NO XP · HELD · NEVER LANDED · KEPT · GUARD, NO RULE · FIRES BLIND ·
A · DIVE · THE WALL · OPEN · ON PURPOSE · READ 10 OF 171 RETROS · AIM, THEN DIVE · BREACH EXPOSED · A
NEVER-LANDED LESSON · THE WALL HELD · NO BREACH · TO REPEL IT · LAND THE LESSON · THE LESSON PR · ◀ ▶
AIM · A DIVE · B MAP.

## Refusals

- The raid earns a trophy only, never points or XP (`game/README.md`:224).
- The wall's counts are the Lessons ledger's, copied from evidence.
- The only motion the anti-loop authors is the mode's wipe: the diver lands on its lane without a
  tween.

## Open questions

- Whether the raid keeps a play score of its own (the Skeptic: play score is fine) is not decided.
- What the lesson PR link opens when no lesson PR exists yet is not said.
- B-E DEv calls the game "fluff"; three personas preferred The Assay as a cabinet of its own, the
  person folded it into Breach Night.
- `breach` is not in `WOUND_KINDS` yet (see `breach-night`).
- How a phone aims and dives (the controls are buttons; the arcade's keys are ◀ ▶ A B) is not checked.

## Source

- /omni:think-big, concept #1964, crowned M on 2026-10-14: .omni-loop/delivery/inbox/concepts/1964-anti-loop/vision.html
