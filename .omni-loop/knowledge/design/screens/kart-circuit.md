---
screen: kart-circuit
status: draft
kind: page
mock: kart-circuit.html
implements: [apps/galaxy/src/arcade/scenes/kart.tsx, apps/galaxy/src/arcade/scenes/kart.css, apps/galaxy/src/arcade/scenes/kart.ts]
reads: [apps/galaxy/src/arcade/kart/track.ts, apps/galaxy/src/arcade/kart/options.ts, apps/galaxy/src/arcade/kart/art.ts, apps/galaxy/src/data/scores.ts]
routes: []
supersedes: null
---

## Purpose

OMNI KART's CIRCUIT step: where a player picks the circuit before a race, COMET RING or FROST EIGHT,
seeing each one's shape and their own best time on it. It comes after SINGLE and after MULTI on the
ready screen (PRD 1923).

## Regions

- **The panel** (`scenes/kart.tsx`, the ready screen's `j-panel kt-panel`), centred low over the
  chosen circuit's start:
  - the title `CIRCUIT`;
  - the circuit's name between ◀ and ▶, `◀ FROST EIGHT ▶`;
  - its minimap, 72 px square, drawn from the circuit's road (`roadAt`), FROST EIGHT's lake in ice;
  - the player's best time on that circuit, `BEST 1:38.4`, or `NO TIME YET`;
  - the hint `◀ ▶ CHOOSE · A RACE · B BACK`.
- **Behind the panel:** the circuit picked, at its start line, with its own scenery and sky.

## States

- **After SINGLE:** A races the circuit shown; the hint reads `A RACE`.
- **After MULTI:** A goes to the grid with the circuit shown; the hint reads `A GRID`. The grid
  races the circuit of its first arrival.
- **Opening:** on the circuit kept in `omni-loop:kart-options` as `track`; a store without one, or
  naming no circuit, opens on COMET RING.
- **A best time:** `BEST m:ss.t`; none yet: `NO TIME YET`.
- **B** goes back to the ready screen, whose title and ready line name the circuit kept:
  `FROST EIGHT · 3 LAPS`.

## Words

CIRCUIT · COMET RING · FROST EIGHT · BEST · NO TIME YET · ◀ ▶ CHOOSE · A RACE · A GRID · B BACK

## Refusals

- The step never offers a circuit outside the register: ◀ ▶ moves between COMET RING and FROST
  EIGHT only.
- A stored `track` that names no circuit is never shown: the step opens on COMET RING.

## Open questions

- The tall grid (320×288) is not drawn: whether the minimap keeps 72 px there is not said.
- What `BEST` shows when the scores cannot be read is not said: `NO TIME YET`, or nothing.
- The circuits' names live in the register in `kart/track.ts`, an engine file this screen only
  reads: should they move to a file of words this screen implements?

## Source

/omni:brainstorm, PRD 1923: .omni-loop/delivery/inbox/1923-kart-frost-eight/before-after.html
