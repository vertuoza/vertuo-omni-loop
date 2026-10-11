---
prd: 1550
title: Design memory, round 2 — a quiet word pass, screens that claim what they show, mockups and a gallery
blocked-by: none
spec: file
phase0: server
---

# Design memory, round 2

**Date:** 2026-10-11 · **PRD:** #1550 · **Follows:** PRD 1369 (design craft) and PRD 1407 (design
memory), both on `main`
**Touches:**
- `kit/lib/design/words/` (`omni design words`: marked screens only, strings kept apart, controls)
- `kit/lib/design/screens.ts`, `kit/lib/design/touched.ts`, `kit/lib/design/check-design.ts` (the
  `reads` list, the folder warning, the stale-mockup note)
- `kit/lib/config.ts` (`design.ignore`), `kit/lib/design/glob.ts`
- `kit/lib/design/gallery/` and `kit/bin/commands/design.ts` (`omni design gallery`), the help entries
- `kit/plugin/skills/pixel-perfect/` (`mock`, and `review`'s stale-mockup note), `brainstorm/`,
  `visual-fix/`, `think-big/`, `invade/`, `do-work/`
- `docs/guide/design.md`
- omni-loop's own screen library, `.omni-loop/knowledge/design/screens/` (the dogfood)

## Problem

PRD 1407 gave every repository a design memory: a screen library, locks, and a word pass. A
simulation on `main` (2026-10-11), with omni-loop's own library and the last 60 merges, shows where
it falls short:

- **The word pass is mostly noise.** Of the 12 latest before/after mockups, 11 mark no screen, so
  the pass reads each page whole and flags the page's own captions ("PRD 1342. Nothing on a screen
  changes…") as text a screen explains at rest: 16 findings, none of them on a screen. It also glues
  neighbouring elements into one string (`ask.client.tsPOST`), and a `<span data-primary>` is not a
  control. Its one true find was the deliberate bad example of PRD 1407.
- **A lock would trip on code nobody sees.** With omni-loop's four screens locked, 11 of the 60
  merges would have raised a high outbox item and held for a person; 5 of them were OMNI KART physics
  fixes, because the game room's `implements` names the whole `arcade/games/` folder. A screen's
  `implements` mixes what the screen is drawn from with the engine behind it.
- **`omni design touched` reads a test-only change as UI work** (1 of the 22 UI merges: #1371's docs
  tests), and so starts a design review on it.
- **No screen has a mockup.** omni-loop's four screens are drafts with `mock: null`: there is
  nothing to lock against, nothing for the word pass to read, and no way to see the library at once.

omni-loop runs in any repository. Every fix below is a kit shape and a kit rule; the screens, their
files and their words stay the repository's.

## Solution

### 1. The word pass reads only marked screens

- `omni design words` reads each element `design.words.screen` matches (`[data-screen]` by
  default). A page with **no** marked screen prints `no screen marked: skipped` and has no findings;
  it is no longer read whole.
- **Strings stay apart.** Two sibling elements are two strings: `<span>ask.client.ts</span><span>POST</span>`
  reads `ask.client.ts` and `POST`, never `ask.client.tsPOST`. Text runs inside one element are still
  one string, so `<b>W</b>ord` written inside a word is the mockup's choice, not the pass's.
- **Controls:** an element matching `design.words.primary` (`[data-primary]`) is a control whatever
  its tag, as `button`, `a[href]`, `role=button|link|…` and button-type inputs already are.
- **The skills mark their screens.** `/omni:brainstorm` and `/omni:visual-fix` write `data-screen`
  (with the screen's name) on each screen of their before/after mockups and `data-primary` on each
  primary action; the page's explanation sits outside every marked screen. `/omni:think-big` marks
  the screens of its vision tour the same way.

### 2. A screen claims what it is drawn from

A screen's front matter gains an optional list, **`reads`**:

```markdown
implements: [src/arcade/scenes/games.tsx, src/arcade/scenes/games.css]
reads: [src/arcade/games/]
```

- **`implements`** names only the files the screen is drawn from: its layout, its styles, its
  words. A change there to a **locked** screen raises the high outbox item, as today.
- **`reads`** names the code behind it: engines, data, rules. `/omni:do-work` and
  `/omni:pixel-perfect review` read it for context; a change there **never** trips a lock, and
  `omni design touched`'s `screens:` line names it apart, as `reads <screen>`.
- A screen without `reads` reads as before, with an empty list. Nothing has to be rewritten.
- **`omni check design`** warns, never fails, when an `implements` entry is a folder (it ends in `/`
  or `/**`): `<screen>: implements names a folder (<entry>) — a lock trips on every file in it; put
  the code behind the screen in reads`.
- Each skill that writes a screen (`/omni:pixel-perfect lock`, `/omni:visual-fix`,
  `/omni:brainstorm`, `/omni:think-big`, `/omni:invade`) says which list a file goes in, in one rule:
  *a file whose change can change what a person sees on this screen goes in `implements`; a file the
  screen only depends on goes in `reads`.*

### 3. `touched` leaves tests out

- A new config key, **`design.ignore`**: globs `omni design touched` drops before it matches
  `design.paths` and the library. Its default is the common test shapes, `**/*.test.*`,
  `**/*.spec.*`, `**/__tests__/**` and `**/test/**`; a repository sets its own list, and `[]` gives
  today's behaviour back. The kit names no test framework.
- A change made only of ignored files reads `ui: no`.

### 4. Mockups and the gallery

- **`/omni:pixel-perfect mock <screen>`** draws a screen's mockup: it reads the screen's file, its
  `implements` and `reads`, and the design form, takes a screenshot when the app runs (the design
  form's `review` slot says how), and writes **one self-contained HTML file**, `<screen>.html` beside
  the screen's `.md` (inline CSS and SVG, no script, no remote asset, no base64 raster), with
  `data-screen` on the screen and `data-primary` on each primary action. It sets the screen's `mock`
  to that file. On a **locked** screen it never overwrites the mockup: it writes the new one as a
  draft amendment and raises the high item, as any change to a locked screen does.
- **`omni design gallery [--out <file>]`** writes one local HTML page of the whole library and prints
  its path (by default under the system's temporary folder). Each screen shows its name, its status,
  who locked it and when, its routes, and its mockup inline (or `no mockup`); locked screens first,
  then drafts, then superseded. The page is generated each time and **never committed**: there is no
  index to keep. An empty library prints `no screen yet` and writes nothing; `design: off` while the
  flag is off.
- **A stale mockup is named, never blocked.** When a change touches a screen's `implements` but not
  its mockup, `omni design touched` adds `mock may be stale: <screen>` and
  `/omni:pixel-perfect review` reports it. A draft with no mockup is fine.

### 5. Dogfood on omni-loop

- Each of the four draft screens (`home`, `dashboard`, `game-room`, `prd-dossier`) gets its mockup
  through `/omni:pixel-perfect mock`, and its `implements` and `reads` split by the rule of §2:
  `game-room` moves `apps/galaxy/src/arcade/games/` to `reads`.
- The simulation is rerun and written down: the word pass over the four mockups and the 12 latest
  before/after pages, and the "would a lock trip" replay over the same 60 merges.

## Decisions

- **Two lists, not one tighter list** (2026-10-11, the person): `implements` keeps its meaning for
  the lock, and `reads` records the code behind a screen instead of dropping it. A one-list rule
  would lose what an agent needs to read; tripping on rendered pixels would need a running app in
  every repository.
- **Mockups are HTML drawn by `/omni:pixel-perfect mock`**, not screenshots (2026-10-11, the
  person): the word pass and a lock read text, never pixels, and no image goes into git.
- **The gallery is generated, never committed**: PRD 1407 chose a library with no hand-kept index,
  and a committed gallery would be one.
- **An unmarked page is skipped, not read whole**: every false finding of the simulation came from
  reading a page whole.
- **The objection, accepted** (persona:B-E DEv): "Every screen now wants an HTML mockup next to it —
  one more file to go stale whenever the screen changes, and I'm the one who changes the code under
  it." Settled `accepted`: a change to `implements` that leaves the mockup alone is named
  `mock may be stale`, a note, never a block; and a change under `reads` (the code a back-end
  developer changes) neither trips a lock nor marks a mockup stale.
- **No proof video** (2026-10-11, the person).
- **Still never blocking**: the only block stays a change to a locked screen or law; the folder
  warning, the stale-mockup note and every word finding only report.

## User stories

- As a **front-end developer**, I see word findings only for what is on a screen, so I read them.
- As a **back-end developer**, I fix the engine behind a locked screen without waiting for its owner.
- As a **product manager**, I open one page and see every screen of the product, decided or not.
- As a **lead engineer**, I lock a screen against its mockup and know a lock trips only on what it
  shows.
- As **any repository's owner**, I get all of it by adding `reads` where it helps; nothing I wrote
  under PRD 1407 has to change.

## Scope

**In:** the word pass's marked-screens rule, sibling strings and `data-primary` controls; `reads`;
the folder warning; `design.ignore`; `/omni:pixel-perfect mock`; `omni design gallery`; the
stale-mockup note; the skills that mark screens and split the lists; the guide; omni-loop's four
mockups and the rerun simulation.

**Out:** publishing the gallery to the Omni page; comparing screenshots pixel by pixel; locking
anything automatically; per-area design forms, motion, themes and the other concepts of PRD 1407's
dogfood list.

## Test seams

Unit tests, next to each module, as `omni kb show testing` says; no test reaches the network.

- **Word pass** (`kit/lib/design/words/*.test.ts`): a page with no marked screen is skipped with no
  finding; a page with two marked screens reads each apart; `<span>a</span><span>b</span>` gives two
  strings; `<span data-primary>` is a control and counts toward two-primaries; PRD 1407's
  before/after still reports its two primaries and its explanation at rest.
- **Screens** (`screens.test.ts`, `check-design.test.ts`): a screen with `reads` parses, one without
  reads `reads: []`; a folder in `implements` is a warning line and `omni check design` still exits 0.
- **Touched** (`touched.test.ts`, `kit/bin/design.test.ts`): a test-only change reads `ui: no`;
  `design.ignore: []` reads it `ui: yes`; a change under `reads` names `reads <screen>` and no locked
  screen; a change to `implements` without the mockup adds `mock may be stale`.
- **Config** (`kit/lib/design/ignore.test.ts`, a new file, so `kit/lib/config.test.ts`, a law's
  proof, stays as it is): `design.ignore` defaults to the four globs and accepts `[]`.
- **Gallery** (`gallery/*.test.ts`): a fixture library (locked, draft, superseded, one with no
  mockup) gives one self-contained page in that order, with `no mockup` where there is none; an empty
  library writes nothing; the flag off prints `design: off`.
- **Skills** (`kit/test/design-skills.test.ts`, a new file, so `kit/test/plugin.test.ts`, a law's
  proof, stays as it is): `pixel-perfect` has
  `reference/mock.md` and names `data-screen` and `data-primary`; brainstorm and visual-fix tell the
  agent to mark screens; each screen-writing skill states the `implements`/`reads` rule.
- **Docs** (`apps/galaxy/src/docs/*.test.ts`): the guide page still builds and links.

## Risks

- **What merging publishes:** a new kit version (the `release` workflow bumps it) with a new
  command, a new config key and a new screen field; repositories pick it up on `omni update`. All of
  it is behind `design.enabled`, off by default: a repository with the flag off sees no change.
- **The word pass goes quiet on old pages.** Before/after pages written before this PRD mark no
  screen, so they are skipped. That is the intended fix; a person who wants them read adds
  `data-screen`.
- **A screen's `implements` written too narrow** lets a visible change slip past a lock. The rule in
  §2 and the folder warning lean the other way only for folders; review still screenshots the screen.
- **Rollback:** revert the feature PR. The screen parser is strict (`kit/lib/design/screens.ts`
  refuses an unknown key), so a kit older than this PRD refuses a screen that carries `reads`: a
  repository rolling back moves each `reads` entry back into `implements` (or deletes it) in the
  same revert. omni-loop's own four screens are the only ones written with `reads` by this PRD.

## Acceptance criteria

1. `omni design words` on a page with no `[data-screen]` prints `no screen marked: skipped` and no
   finding; on the 12 latest shipped before/after pages it reports no `explains-at-rest` from a
   caption outside a marked screen.
2. `<span>ask.client.ts</span><span>POST</span>` inside a marked screen reads as two strings.
3. A `<span data-primary>` inside a marked screen counts as a control and as a primary action.
4. A screen may carry `reads: [...]`; `omni design screens` and `omni check design` read it; a screen
   without it reads as before.
5. `omni check design` prints a warning, and still exits 0, for an `implements` entry that is a
   folder.
6. `omni design touched` on a change made only of `**/*.test.*` files prints `ui: no`; with
   `design.ignore: []` it prints `ui: yes`.
7. A change under a locked screen's `reads` names no locked screen on the `screens:` line; a change
   under its `implements` does.
8. A change to a screen's `implements` that leaves its mockup alone adds `mock may be stale: <screen>`.
9. `/omni:pixel-perfect mock <screen>` is documented in `reference/mock.md`: it writes
   `<screen>.html` beside the screen, self-contained, with `data-screen` and `data-primary`, sets
   `mock`, and on a locked screen writes a draft amendment and raises the high item.
10. `omni design gallery` writes one self-contained page listing every screen of the library with its
    status and its mockup or `no mockup`, prints its path, and commits nothing.
11. `/omni:brainstorm` and `/omni:visual-fix` tell the agent to mark each screen of a before/after
    mockup with `data-screen` and each primary action with `data-primary`.
12. omni-loop's four screens each have a mockup that `omni design words` reads, and `game-room`'s
    `implements` no longer names `apps/galaxy/src/arcade/games/`.
13. The rerun replay over the same 60 merges, written in the PRD's folder, shows no OMNI KART physics
    fix tripping a lock.
14. `docs/guide/design.md` explains `reads`, `design.ignore`, `mock` and `gallery`.
