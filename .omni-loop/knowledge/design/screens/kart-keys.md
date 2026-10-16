---
screen: kart-keys
status: draft
kind: page
mock: kart-keys.html
implements: [apps/galaxy/src/arcade/scenes/kart.tsx, apps/galaxy/src/arcade/scenes/kart.css, apps/galaxy/src/arcade/scenes/kart.ts]
reads: [apps/galaxy/src/arcade/kart/options.ts, apps/galaxy/src/arcade/keys.ts]
routes: []
supersedes: null
---

## Purpose

OMNI KART's OPTIONS › KEYS: where a player sees and changes the key behind each of the six driving
actions, GAS, BRAKE, LEFT, RIGHT, ITEM and HOP. HOP is new with PRD 1963, and ITEM moves from SPACE
to SHIFT so that SPACE can hop.

## Regions

- **The panel** (`scenes/kart.tsx`, `j-panel kt-panel kt-mid kt-options`), centred on the screen:
  - the title `KEYS`;
  - one row per action, in the order GAS, BRAKE, LEFT, RIGHT, ITEM, HOP: the action's name, then
    its key by `keyLabel` (`▲ ▼ ◀ ▶` for the arrows, `SPACE`, other keys uppercased);
  - the cursor's row in yellow, led by `▶`;
  - the hint `A CHANGE B BACK`.
- **Behind the panel:** the arcade's starfield.

## States

- **Browsing:** ▲ ▼ move the cursor through the six rows; A starts a capture on the row; B goes back
  to OPTIONS.
- **Capturing:** the row's key reads `PRESS A KEY` and the hint `B CANCEL`; the next key pressed
  becomes that action's, unless it is reserved; a key another action holds swaps the two. B or ESC
  cancels.
- **Refused:** a reserved key (ENTER, TAB, ESC, M, F) shows `KEY USED BY THE ARCADE` under the rows
  and keeps the capture open. SHIFT is no longer reserved.
- **Defaults:** `▲ ▼ ◀ ▶`, ITEM `SHIFT`, HOP `SPACE`.
- **Saved with five keys:** the old defaults read back as the six new ones; five keys the player
  chose are kept, and HOP takes the first of SPACE, X, C, V none of them uses.

## Words

KEYS · GAS · BRAKE · LEFT · RIGHT · ITEM · HOP · SPACE · SHIFT · A CHANGE · B BACK · PRESS A KEY · B CANCEL · KEY USED BY THE ARCADE

## Refusals

- A key bound to two actions is never kept: the store reads back as the defaults (or, with five
  keys saved, as **Saved with five keys** says).
- ENTER, TAB, ESC, M and F are never bound.

## Open questions

- The tall grid (320×288) is not drawn: whether six rows still fit the panel there is not said.

## Source

/omni:brainstorm, PRD 1963: .omni-loop/delivery/shipped/1963-kart-drift/before-after.html
