# Plan: Design memory, round 2

PRD #1550. The spec is `spec.md`, beside this plan. The feature branch `feat/screen-mockups` is cut
from `main`, and its feature PR (`Closes #1550`) targets `main`. Each slice is a sub-PR from
`feat/screen-mockups--<slice>` into the feature branch (`Part of #1550`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The word pass reads only marked screens: an unmarked page is skipped, sibling elements stay separate strings, and a `[data-primary]` element is a control | `kit/lib/design/words/` `kit/bin/design-words.test.ts` `kit/lib/help/entries.ts` | — | 1 |
| s2 | A screen claims what it is drawn from: the optional `reads` list, the folder warning in `omni check design`, `design.ignore` leaving tests out of `touched`, and the `mock may be stale` line | `kit/lib/design/screens` `kit/lib/design/touched` `kit/lib/design/glob` `kit/lib/design/ignore` `kit/lib/design/check-design.ts` `kit/lib/config.ts` `kit/bin/commands/design.ts` `kit/bin/design.test.ts` `kit/bin/check-design.test.ts` `kit/lib/help/entries.ts` | — | 2 |
| s3 | `omni design gallery`: one generated, self-contained page of the whole library, never committed | `kit/lib/design/gallery/` `kit/bin/commands/design.ts` `kit/bin/design-gallery.test.ts` `kit/lib/help/entries.ts` | s2 | 3 |
| s4 | The skills: `/omni:pixel-perfect mock` and review's stale-mockup note; brainstorm, visual-fix and think-big mark screens and primaries; every screen-writing skill states the `implements`/`reads` rule | `kit/plugin/skills/pixel-perfect/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/visual-fix/` `kit/plugin/skills/think-big/` `kit/plugin/skills/invade/` `kit/plugin/skills/do-work/` `kit/porting/` `kit/test/design-skills.test.ts` | — | 1 |
| s5 | Dogfood on omni-loop: a mockup for each of the four screens, `implements` and `reads` split, and the simulation rerun and written down | `.omni-loop/knowledge/design/screens/` `.omni-loop/delivery/inbox/1550-screen-mockups/dogfood.md` | s1, s2, s4 | 3 |
| s6 | The guide: `reads`, `design.ignore`, `mock`, `gallery` and marked screens in `docs/guide/design.md`, and its diagram | `docs/guide/design.md` `docs/guide/diagrams/` | s2, s3 | 4 |

**Shared ground.** `kit/lib/help/entries.ts` holds the one `design` help entry that s1, s2 and s3
each rewrite a sentence of: s1 is in wave 1, s2 in wave 2 and s3 in wave 3, so they never share a
wave. `kit/bin/commands/design.ts` is s2's (wave 2) and s3's (wave 3). No slice touches
`kit/lib/config.test.ts` or `kit/test/plugin.test.ts`, the proofs of N-PRODUCT laws and
BR-PRODUCT-89: their new tests go in `kit/lib/design/ignore.test.ts` and
`kit/test/design-skills.test.ts`. The generated `kit/dist/` and `apps/omni-app/api/` are rebuilt by
the wave, never listed.

## Per slice: done when

**s1 — the word pass**
- `omni design words` on a page with no `[data-screen]` prints `no screen marked: skipped` and no
  finding, and exits 0.
- Inside a marked screen, `<span>ask.client.ts</span><span>POST</span>` gives two strings; text runs
  inside one element stay one string.
- A `<span data-primary>` inside a marked screen is a control, and two of them report
  `two-primaries`.
- PRD 1407's `before-after.html` still reports its two primaries and its explanation at rest.
- The `design` help entry says an unmarked page is skipped.

**s2 — two lists, ignore, stale**
- A screen with `reads: [...]` parses; one without reads `reads: []`; `omni design screens` is
  unchanged for both.
- `omni check design` prints `<screen>: implements names a folder (<entry>) — …` as a warning for an
  `implements` entry ending in `/` or `/**`, and still exits 0.
- `design.ignore` defaults to `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`, `**/test/**`, and
  accepts `[]` (tested in `kit/lib/design/ignore.test.ts`).
- `omni design touched` on a change of ignored files only prints `ui: no`; with `design.ignore: []`
  it prints `ui: yes`.
- A change under a screen's `reads` shows `reads <screen>` and names no locked screen; a change under
  its `implements` shows it as today.
- A change to a screen's `implements` that leaves its `mock` file alone adds
  `mock may be stale: <screen>`.

**s3 — the gallery**
- `omni design gallery` writes one self-contained HTML page (no script, no remote asset) listing every
  screen, locked first, then drafts, then superseded, each with its status, lock, routes and mockup
  inline or `no mockup`, and prints its path; `--out <file>` writes there.
- An empty library prints `no screen yet` and writes nothing; the flag off prints `design: off`.
- Nothing is written inside the repository unless `--out` names a path there.

**s4 — the skills**
- `kit/plugin/skills/pixel-perfect/reference/mock.md` exists and says: read the screen, its
  `implements` and `reads` and the design form; write `<screen>.html` beside it, self-contained, with
  `data-screen` and `data-primary`; set `mock`; on a locked screen write a draft amendment and raise
  the high item. The skill's command list names `mock`.
- `reference/review.md` reports `mock may be stale` as a note, never a block.
- brainstorm, visual-fix and think-big tell the agent to mark each screen of a mockup with
  `data-screen` and each primary action with `data-primary`, the page's explanation outside them.
- lock, visual-fix, brainstorm, think-big and invade state the rule: a file whose change can change
  what a person sees goes in `implements`; a file the screen only depends on goes in `reads`.
- do-work reads a screen's `reads` for context.
- `kit/test/design-skills.test.ts` checks each of these; the porting notes say what changed.

**s5 — the dogfood**
- `home`, `dashboard`, `game-room` and `prd-dossier` each have `<screen>.html` beside them, drawn by
  `/omni:pixel-perfect mock`, and `mock` set; they stay drafts.
- `game-room`'s `implements` no longer names `apps/galaxy/src/arcade/games/`; it is in `reads`.
- `omni design words` reads each mockup's marked screen; `omni check design` is green.
- `dogfood.md` records the rerun: the word pass over the four mockups and the 12 latest shipped
  before/after pages (no caption finding), and the lock replay over the same 60 merges (no OMNI KART
  physics fix trips), with the numbers before and after.

**s6 — the guide**
- `docs/guide/design.md` explains marked screens, `reads`, `design.ignore`, `/omni:pixel-perfect mock`
  and `omni design gallery`, with one updated diagram under `docs/guide/diagrams/`.
- The galaxy docs tests stay green.
