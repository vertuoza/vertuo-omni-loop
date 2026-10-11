# Plan: Design memory, round 3

PRD #1584. The spec is `spec.md`, beside this plan. The feature branch `feat/shared-screens` is cut
from `main`, and its feature PR (`Closes #1584`) targets `main`. Each slice is a sub-PR from
`feat/shared-screens--<slice>` into the feature branch (`Part of #1584`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Shared screens: `kind: page` or `kind: shared` in the screen file, `shared` in `omni design screens`, and the gallery's group of shared screens | `kit/lib/design/screens` `kit/lib/design/gallery/` `kit/bin/commands/design.ts` `kit/bin/design.test.ts` `kit/bin/design-gallery.test.ts` `kit/lib/help/entries.ts` | — | 1 |
| s2 | The word pass: `design.words.content` counted apart, sentences whole across phrasing elements, a control's parts spaced | `kit/lib/design/words/` `kit/bin/design-words.test.ts` `kit/lib/config.ts` `kit/lib/help/entries.ts` | — | 2 |
| s3 | The skills: touched-only holds and `Seen, not touched` in review, **Standing in** in `mock.md`, the rule's four lines, shared screens, the Functional and Pixel perfect parts in brainstorm, and the Pixel perfect line in `/omni:pr` | `kit/plugin/skills/pixel-perfect/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/visual-fix/` `kit/plugin/skills/think-big/` `kit/plugin/skills/invade/` `kit/plugin/skills/do-work/` `kit/plugin/skills/pr/` `kit/porting/` `kit/test/design-skills.test.ts` | — | 1 |
| s4 | Dogfood on omni-loop: `app-shell` and `notifications` as shared screens with mockups, the shell moved to `reads`, `data-content` marked, and the rerun written down | `.omni-loop/knowledge/design/screens/` `.omni-loop/delivery/inbox/1584-shared-screens/dogfood.md` | s1, s2, s3 | 3 |
| s5 | The guide: shared screens, `Seen, not touched`, `data-content`, **Standing in** and the two parts of the before/after | `docs/guide/design.md` `docs/guide/diagrams/` | s1, s2, s3 | 3 |

**Shared ground.** `kit/lib/help/entries.ts` holds the one `design` help entry that s1 and s2 each
rewrite a sentence of: s1 is in wave 1 and s2 in wave 2. No slice touches `kit/lib/config.test.ts`
or `kit/test/plugin.test.ts`, the proofs of laws: `design.words.content` is optional, its default
applied where it is read, and the skills' tests go in `kit/test/design-skills.test.ts`. The
generated `kit/dist/` and `apps/omni-app/api/` are rebuilt by the wave, never listed.

## Per slice: done when

**s1 — shared screens**
- `kind: shared` parses; a screen without `kind` reads `page`; `kind: other` is refused by name.
- `omni design screens` prints `shared` beside a shared screen and nothing new beside a page.
- `omni design gallery` shows shared screens in a group of their own, after the pages.
- The `design` help entry names `kind`.

**s2 — the word pass**
- Text inside `[data-content]` (or the selector `design.words.content` sets) prints
  `content · <n> words` and raises no finding; `design.words.content` is optional, its default
  applied where it is read.
- `on <code>main</code> (2026-10-11)` inside a marked screen is one string.
- `<b>CREW TOP 5</b><span>NO SCORES YET</span>` inside a control reads `CREW TOP 5 NO SCORES YET`.
- Sibling blocks, and a layout built of spans with no running text, stay separate strings.
- The `design` help entry names `data-content`.

**s3 — the skills**
- `reference/review.md`: a lock trips only on a change to the screen's own `implements`; a fault in
  an untouched part goes under `Seen, not touched`, never against the slice, never blocking,
  suggested as a bug of its own; a touched shared screen is screenshotted on one page it appears on.
- `mock.md` has **Standing in**: fonts, pixel art and images, example data, no screenshot, no
  gallery, an undecided primary action.
- lock, mock, visual-fix, brainstorm, think-big and invade state the rule's four lines, and know
  `kind: shared`.
- brainstorm, with `design.enabled` on, writes a Functional part, then a Pixel perfect part when a
  screen changes or `Pixel perfect: no screen changes`; visual-fix keeps its page as the Pixel
  perfect part alone.
- `/omni:pr`'s feature body has a Pixel perfect line (the screens, or `none`).
- do-work runs no pixel-perfect work for a PRD whose before/after says no screen changes.
- `kit/test/design-skills.test.ts` checks each; the porting notes say what changed.

**s4 — the dogfood**
- `app-shell` and `notifications` are `kind: shared` screens with mockups drawn by
  `/omni:pixel-perfect mock`; they stay drafts.
- `dashboard` and `prd-dossier` list the shell's files in `reads`; the dossier's PRD text and the
  dashboard's figures are `data-content` in their mockups.
- `omni check design` is green; `dogfood.md` records the rerun: the word pass over the six mockups
  (the dossier's content findings gone) and the lock replay of PRD 1550's 60 merges with the shell
  as its own screen (no page tripped by a shell-only change).

**s5 — the guide**
- `docs/guide/design.md` explains shared screens, `Seen, not touched`, `data-content`, **Standing
  in** and the before/after's two parts, with one updated diagram under `docs/guide/diagrams/`.
- The galaxy docs tests stay green.
