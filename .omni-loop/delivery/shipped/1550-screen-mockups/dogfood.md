---
prd: 1550
slice: s5
run: 2026-10-11
---

# Dogfood: PRD 1550 on omni-loop itself

Slice s5 drew a mockup for each of omni-loop's four draft screens with `/omni:pixel-perfect mock`,
split each screen's `implements` and `reads` by the rule, then reran the simulation the spec's
Problem was built on. Every screen stays a draft; nothing was locked.

## The four mockups

| screen | mockup | implements, before → after | reads |
| --- | --- | --- | --- |
| home | `home.html` | the route and `src/home/` (a folder) → the route, every `.tsx` and `.css` under `src/home/`, and the four files holding its words and pictures (`lingo.ts`, `poster/art.ts`, `spreads/cards.ts`, `spreads/fleets.ts`) | `src/home/` |
| dashboard | `dashboard.html` | the route and `src/dashboard/` (a folder) → the route and the 14 files drawn on `/app`: the six top-level views, `dashboard.css`, the board's `Board.tsx`, `PeriodSwitch.tsx`, `period.ts` and `board.css`, `WaitingTile.tsx`, `counts.css` and `stream/HomeStream.tsx` | `src/dashboard/`, `app/app/layout.tsx` |
| game-room | `game-room.html` | `games.tsx`, `games.css` and `arcade/games/` (a folder) → `games.tsx`, `games.css`, `games/room.ts` (the room's words), `games/index.ts` (the cabinets: titles, order, measure) | `arcade/games/`, `scenes/menu.tsx`, `deep-link.ts` |
| prd-dossier | `prd-dossier.html` | `app/prd/[id]/` and `src/dossier/page/` (two folders) → the route's three files, `src/dossier/page/*.tsx`, `dossier.css`, `view.ts` (the tab labels) and `stage.ts` (the stage's button) | both folders |

`omni check design` is green with no warning (before: five `implements names a folder` warnings).
Each mockup is one self-contained HTML file, no script, no remote asset, its screen marked with
`data-screen` and one `data-primary`, its explanation outside the mark.

## The word pass, before and after

`node kit/dist/omni.mjs design words` on the 12 latest shipped before/after pages and on the four
mockups.

| pages | before PRD 1550 | after |
| --- | --- | --- |
| 12 shipped before/after pages | 16 explains-at-rest, none on a screen | 11 pages `no screen marked: skipped`; 1407's marked screen: 1 explains-at-rest, 1 sentence-on-control, 1 two-primaries, all three the planted bad example. **0 caption findings** |
| home mockup | — | 4 explains-at-rest: the pitch (31 words), the game's lead (13), the two fine-print lines (14, 11) |
| dashboard mockup | — | none |
| game-room mockup | — | 3 sentence-on-control: each lit cabinet (22, 10, 16 words) |
| prd-dossier mockup | — | 6 explains-at-rest: the PRD's title (18), the spec's front-matter line (8), the spec's Problem (19, 15), two Solution headings (8, 9) |

The 13 findings on the mockups are what the product shows today, so they stay in the drawings
and are reported here, never drawn away:

- **home:** a front door explains at rest by design. The pitch and the fine print are the print
  ad's copy.
- **game-room:** each cabinet is one `<button>` holding its marquee, its screen, the crew's top
  five and A · PLAY (`scenes/games.tsx`), so the whole cabinet reads as one control's label.
- **prd-dossier:** five of the six are the PRD's own text (its title, its spec), not the page's
  copy. The sixth is the spec's front matter line.

## The lock replay, before and after

The 60 first-parent commits of `origin/main` from `1f30d52c` back that are not `chore(release)`
(down to `8fb8886b`). A commit trips a screen when it changes a file the screen implements, as if
all four were locked. After, `design.ignore`'s default (tests left out) applies as `touched`
applies it; with `design.ignore: []` the count is the same.

| | old implements | new implements |
| --- | --- | --- |
| merges that trip a screen | 12 of 60 (11 without the merge commit `08487bef`, whose files `git show` does not list: the spec's 11) | **8 of 60** (7 without `08487bef`) |
| of them OMNI KART | 5 | 3, none a physics fix |

Each merge that trips a screen after:

| merge | screen | files |
| --- | --- | --- |
| `56df281f` feat(arcade): OMNI KART keeps the best race time, not points (PRD 1440) | game-room | `games/index.ts`, `scenes/games.tsx`: the cabinet's top five shows a time |
| `1cddb704` fix(galaxy): the OMNI KART cabinet shows Space Invaders art instead of its own game | game-room | `scenes/games.css`, `scenes/games.tsx`: the cabinet's own screen |
| `1fe06612` feat(arcade): OMNI KART, a Mode 7 kart racer unlocked at LV 3 | game-room | `games/index.ts`: a third cabinet |
| `a80c210a` feat(products): Products hold everything (2/3) | prd-dossier | `DossierPage.tsx`, `ProductPicker.tsx`: the Product cell |
| `a5950cd4` fix(dossier): the approve moment on a phone | prd-dossier | `ApproveButton.tsx`, `DossierPage.tsx`, `SealScroll.tsx`, `dossier.css` |
| `a6cf334a` feat(approval): The approval handshake | prd-dossier | `DossierPage.tsx`, `DossierRoute.tsx`, `dossier.css`, `view.ts` |
| `0bdc0008` feat(phase-0): Phase 0 approved on the server | prd-dossier | `ApproveButton.tsx`, `DossierPage.tsx`, `DossierRoute.tsx`, `dossier.css`, `view.ts` |
| `08487bef` Merge pull request #1159 | dashboard | `board/Board.tsx`, `board/board.css` |

No longer tripping: the two OMNI KART physics fixes, `aec29e55` (floats in open space, falls only
once tipped) and `ab3ae824` (the circuit floats in the void), which changed only `arcade/games/`
code now under `reads`; `4440e512` and `a5e90f34` (dossier data code: `approval.ts`, `work.ts`,
`source.ts`, `fix-facts.ts`); and `08487bef`'s dossier half (the same data code). Each of the eight
left changes what a person sees on its screen.

## What the skill and the kit lacked when used for real

1. **The gallery was not there yet.** `omni design gallery` is s3's, built in the same wave, so
   this slice could not look at the four mockups side by side. The mock skill names the gallery as
   where a mockup is seen, but nothing in it says what to do without it.
2. **No face reaches a mockup.** "No remote asset" keeps the product's own fonts out (Anton, Press
   Start 2P, Jersey 10, Atkinson Hyperlegible Next are served from the app's origin). Each mockup
   names the faces with fallbacks, so it renders in system faces. The skill says nothing about
   fonts.
3. **Pixel art cannot be drawn faithfully.** The planet, the crest, OmniMan, the heroes and the
   cabinets' stills are drawn on the server or on a canvas from `@omni/design`. No base64 raster
   and no script leave only hand-drawn SVG placeholders. The skill could say a picture may stand in
   at its size.
4. **No screenshot was taken.** The app was not run here (no session browser for a subagent), so
   all four were drawn from the source, as step 3 allows. The game room cannot be reached by URL
   anyway: it opens from the arcade's menu.
5. **Example data is not addressed.** A dashboard, a game room and a dossier show data. The
   mockups use example figures (the demo's DAM-DEV, a crew's scores, PRD 1550 itself) and say so
   outside the mark. "Nothing invented" in the skill reads as forbidding them.
6. **The word pass cannot tell copy from content.** On the dossier, five of six findings are the
   PRD's own text in the Spec pane. A mark for "content shown, not written by the screen" (or
   reading `data-screen` regions only up to a `data-content` boundary) would quiet them.
7. **The word pass splits a paragraph at an inline element.** `on <code>main</code> (2026-10-11)`
   became two strings, and `Join <em>the loop!</em>` two more: s1 keeps sibling elements apart, and
   an inline child counts as one.
8. **A control's text is joined without spaces.** A cabinet's `<b>CREW TOP 5</b><span>NO SCORES
   YET</span>` read as `CREW TOP 5NO SCORES YET`.
9. **The rule leaves three cases open.** Shared chrome (`app/app/layout.tsx`, the sidebar and top
   bar around every app page) changes what a person sees on the dashboard, yet would trip every
   app screen: put in `reads` here. A view file shared by two screens (`scenes/menu.tsx` draws the
   game room's badge and the whole menu): `reads` here. A data file that holds the screen's words
   (`room.ts`, `view.ts`, `period.ts`): `implements` here. The skill's one-line rule does not say
   which way each goes.
10. **One primary is a choice the screen leaves open.** Each of home, dashboard and prd-dossier
    has "which is the primary action" in its Open questions. The mock still has to mark one. Each
    mockup marks one and says so outside the mark: the skill could say that is the way.
