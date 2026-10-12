# Plan: A design memory that compounds

PRD #1407. The spec is `spec.md`, beside this plan. The feature branch `feat/design-memory` is cut
from `feat/design-craft` (PRD 1369, #1371) and its feature PR targets that branch until #1371 merges,
then `main`. Each slice is a sub-PR from `feat/design-memory--<slice>` into the feature branch.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The `design` form's optional `language` slot: laws with a lock line and dated amendments | `kit/lib/playbook/` `kit/templates/playbook/design.md` | — | 1 |
| s2 | The screen library: its folder (`design.screens`), its file format, a reader, and `omni design screens` | `kit/lib/design/screens` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/bin/commands/design.ts` `kit/bin/design.test.ts` `kit/lib/help/` | — | 1 |
| s3 | `omni check design`, run by `omni check all`: a locked screen or law changed without an amendment, a bad front matter, an orphan `superseded` | `kit/lib/design/check-design` `kit/bin/commands/check.ts` `kit/bin/check-design.test.ts` | s1, s2 | 2 |
| s4 | `omni design words`: the word pass, its four rules, `data-screen` / `data-primary` and a repository's own selectors, always exit 0 | `kit/lib/design/words` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/bin/commands/design.ts` `kit/bin/design-words.test.ts` `kit/lib/help/` | s2 | 2 |
| s5 | `omni design touched` names the library screens a diff touches, with status and routes | `kit/lib/design/touched` `kit/bin/commands/design.ts` `kit/bin/design.test.ts` | s2 | 3 |
| s6 | `/omni:pixel-perfect lock` (a person's words only), the review against a locked screen and its mock, the high item on a locked change; `/omni:do-work` reads the library | `kit/plugin/skills/pixel-perfect/` `kit/plugin/skills/do-work/` `kit/porting/plugin--pixel-perfect.md` `kit/porting/plugin--do-work.md` `kit/test/plugin.test.ts` | s3, s4, s5 | 4 |
| s7 | visual-fix, brainstorm and think-big write draft screens, mark mockups and run the word pass; invade drafts screen entries, never locks | `kit/plugin/skills/visual-fix/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/think-big/` `kit/plugin/skills/invade/` `kit/porting/plugin--brainstorm.md` `kit/test/plugin.test.ts` `kit/test/brainstorm-concept.test.ts` | s6 | 5 |
| s8 | The guide: the library, locking, the word pass, and a diagram of a screen's life | `docs/guide/` `apps/galaxy/src/docs/` | s7 | 6 |
| s9 | Dogfood: design on in omni-loop, its form filled from evidence, draft screens, the word pass over our before/after pages in `dogfood.md`, missing concepts as outbox items | `.omni-loop/config.yml` `.omni-loop/knowledge/playbook/design.md` `.omni-loop/knowledge/design/` `.omni-loop/delivery/shipped/1407-design-memory/dogfood.md` | s7 | 6 |

Shared ground:

- `kit/lib/config.ts`, `kit/lib/config.test.ts`, `kit/bin/commands/design.ts` and `kit/lib/help/`: s2
  (`design.screens`, `screens`) and s4 (`design.words.*`, `words`); s4 waits for wave 2. s5 also adds
  to `kit/bin/commands/design.ts`, in wave 3.
- `kit/bin/design.test.ts`: s2 and s5, waves 1 and 3.
- `kit/test/plugin.test.ts`: s6 and s7, waves 4 and 5.

`kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and the wave rebuilds them.

## Per slice: done when

**s1**
- `omni kb show design` shows a `Language` section; a law in the shape of the spec (heading, lock
  line, text, `#### Amended` lines) resolves under it, and a repository with none prints it empty.

**s2**
- `design.screens` defaults to `<paths.knowledge>/design/screens/`.
- A reader parses each screen's front matter (`screen`, `status`, `locked-by`, `locked-on`, `quote`,
  `mock`, `implements`, `routes`, `supersedes`) and its sections, and names a file that does not
  read.
- `omni design screens` lists name, status, locker, date and routes, sorted, and says so when the
  library is empty; with the flag off it prints `design: off`. Exit 0.

**s3**
- `omni check design` refuses a locked screen or a locked law whose text changed against the
  default branch without a new amendment line; passes it with one; lets a draft change; names a bad
  front matter and an orphan `superseded`; is part of `omni check all`. Tested on a temporary git
  repository.

**s4**
- `omni design words <page>…` prints each screen's strings and word count, then flags
  `sentence-on-control`, `two-primaries`, `explains-at-rest` and `avoided-word`, one fixture each.
- `design.words.sentence` (default 7), `design.words.screen` (default `[data-screen]`),
  `design.words.primary` (default `[data-primary]`) and `design.words.avoid` (default `[]`) are read
  from config; a repository's own selectors are honoured; a page with no marked screen is read
  whole and says so. Exit 0 in every case.

**s5**
- `omni design touched` adds `screens: <name> 🔒 (<routes>) · …` for every library screen whose
  `implements` the diff touches, and no line when none does. Still exit 0.

**s6** (`ui: no`: Markdown only)
- `/omni:pixel-perfect lock <screen>` (and a law) records `locked-by`, `locked-on` and the
  person's quote, and runs only on a person's words; no other skill locks.
- `review` reads `omni design touched`'s screens, screenshots their routes, compares a locked screen
  with its mock, raises a high outbox item for a change to a locked screen, and runs
  `omni design words` in its critique.
- `/omni:do-work` reads the library before building a UI slice and builds a locked screen as
  written.
- `kit/test/plugin.test.ts` holds each line.

**s7** (`ui: no`: Markdown only)
- visual-fix writes the pick as a draft screen (or a draft amendment), brainstorm the approved
  "after", think-big the crowned concept's screens, each with its mockup and its source.
- Each marks its mockups with `data-screen` and `data-primary` and runs `omni design words` before
  showing them.
- invade drafts screen entries from evidence, fills Open questions, never locks or writes a law,
  and ends with the list of drafts for the owner.
- `kit/test/plugin.test.ts` holds each line.

**s8**
- `docs/guide/design.md` explains the library, locking, amendments and the word pass, with a new
  diagram `docs/guide/diagrams/screen-life.svg` (draft → locked → amended → superseded); the docs
  tests pass.

**s9** (`ui: no`: config and knowledge only)
- omni-loop's config has `design.enabled: true` and `design.paths` for `apps/galaxy/src/`,
  `apps/omni-app/src/` and `packages/design/`.
- `.omni-loop/knowledge/playbook/design.md` is filled from evidence with `path@hash`, a
  `TODO(human)` where it does not decide.
- Draft screens for HOME, the game room, a PRD page and the dashboard, none locked.
- `dogfood.md` holds the word pass over every before/after page in the inbox and shipped folders.
- Each missing concept is a medium outbox item with the fix it would make.
- `omni check design` and `omni check kb` green on omni-loop.
