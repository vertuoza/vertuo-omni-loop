---
prd: 1584
slice: s4
run: 2026-10-11
---

# Dogfood: PRD 1584 on omni-loop itself

Slice s4 drew omni-loop's two shared screens with `/omni:pixel-perfect mock` (its new **Standing
in** section included), moved the shell's files into `reads` on the pages that sit in it, marked
content with `data-content`, then reran PRD 1550's word pass and lock replay
(`.omni-loop/delivery/shipped/1550-screen-mockups/dogfood.md`). Every screen stays a draft; nothing
was locked. `kit/dist` was rebuilt for the run and not committed.

## The library

| screen | kind | implements | reads |
| --- | --- | --- | --- |
| app-shell | shared | `nav/AppShell.tsx`, `Sidebar.tsx`, `AppBar.tsx`, `BrandLogo.tsx`, `UserMenu.tsx`, `sidebar.ts` (the entries' words), `sidebar.css`, `app-bar.css`, `brand-logo.css`, `drawer.css`, `user-menu.css` | `src/nav/`, the eight section layouts that wrap it, `ask/theme-switch.tsx` and `switch/GameModeButton.tsx` (the public bar draws them too), `src/waiting/` |
| notifications | shared | `nav/Bell.tsx`, `nav/bell.ts` (the panel's words), `nav/bell.css`, `waiting/alerts.ts` (`Blocked by the browser`) | `src/waiting/`, `people/PersonChip.tsx`, `nav/AppBar.tsx` |
| dashboard | page | unchanged | + `app/app/layout.tsx` (already), the shell's views and the bell's (`AppShell`, `Sidebar`, `AppBar`, `BrandLogo`, `UserMenu`, `sidebar.ts`, `Bell`, `bell.ts`) |
| prd-dossier | page | unchanged | + `app/prd/layout.tsx` and the same shell and bell files |

Both shared screens name the eight app routes they wrap in `routes` (`/app`, `/prd/<id>`, `/ask`,
`/knowledge`, `/roadmaps`, `/concepts`, `/bugs`, `/visual`). home and game-room are not in the shell
and list none of its files. `omni design screens` prints `draft · shared` beside the two;
`omni check design` is green: 6 screens, 0 locked.

## The word pass, before and after

`node kit/dist/omni.mjs design words` on the six mockups. Before: PRD 1550's numbers (its kit, its
mockups). Middle: this PRD's kit (s2's sentences and spaced controls) on the mockups as s4 found
them. After: the same kit with s4's `data-content` marks.

| mockup | before (PRD 1550) | middle | after |
| --- | --- | --- | --- |
| home | 4 explains-at-rest | 4 | 4, the same |
| dashboard | none | none | none; `content · 26 words` |
| game-room | 3 sentence-on-control | 3 | 3, the same |
| prd-dossier | 6 explains-at-rest, 5 of them the PRD's text | 5 | **none**; `content · 98 words` |
| app-shell | — | — | none; `content · 2 words` (the workspace's name, the release) |
| notifications | — | — | 4 sentence-on-control, each a line of the panel (below) |

**The joined-string faults are gone.**

- `on <code>main</code> (2026-10-11)`: PRD 1550 split the spec's Problem in two (19 and 15 words);
  with s2's kit it reads as one 35-word sentence, before it was marked content.
- `<b>CREW TOP 5</b><span>NO SCORES YET</span>` now reads `SUPER OMNI WORLD CREW TOP 5 NO SCORES
  YET A · PLAY`: the parts are spaced. The cabinet is still one control holding 11 words, so its
  finding stays: it is what the product shows (`scenes/games.tsx`).

**The dossier's content findings are gone.** Its title, its front-matter line and its Spec pane are
`data-content`: 98 words counted apart, none judged. What remains is the page's own copy (60
words): the tabs, the facts, the buttons.

home's four and game-room's three findings are the product as it is, as PRD 1550 reported, and stay
in the drawings.

## The lock replay, with the shell a screen of its own

PRD 1550's 60 first-parent commits of `origin/main` from `1f30d52c` back that are not
`chore(release)` (down to `8fb8886b`), each as the diff from its first parent with
`design.ignore`'s default (tests left out). A commit trips a screen when it changes a file the
screen implements, as if all six were locked. `08487bef`, the merge of #1159, brings only knowledge
files to `main` by that diff, so it trips nothing here; PRD 1550 counted it apart for the same reason.

| | the four pages (before s4) | the six screens (after s4) |
| --- | --- | --- |
| commits that trip a screen | 7 of 60 | 8 of 60 |
| commits that trip a page | 7 | 7, the same commits |
| commits that trip a shared screen | — | 4 |

Each commit that trips a screen after:

| merge | trips | files |
| --- | --- | --- |
| `56df281f` feat(arcade): OMNI KART keeps the best race time | game-room | `games/index.ts`, `scenes/games.tsx` |
| `1cddb704` fix(galaxy): the OMNI KART cabinet shows Space Invaders art | game-room | `scenes/games.css`, `scenes/games.tsx` |
| `1fe06612` feat(arcade): OMNI KART, a Mode 7 kart racer | game-room | `games/index.ts` |
| `a80c210a` feat(products): Products hold everything (2/3) | prd-dossier · **app-shell** | `DossierPage.tsx`, `ProductPicker.tsx` · `nav/sidebar.ts` (the Products entry) |
| `a5950cd4` fix(dossier): the approve moment on a phone | prd-dossier · **app-shell** | `ApproveButton.tsx`, `DossierPage.tsx`, `SealScroll.tsx`, `dossier.css` · `nav/app-bar.css` (the status-bar strip) |
| `a6cf334a` feat(approval): The approval handshake | prd-dossier · **notifications** | `DossierPage.tsx`, `DossierRoute.tsx`, `dossier.css`, `view.ts` · `Bell.tsx`, `bell.ts`, `alerts.ts` (the Approvals group) |
| `0bdc0008` feat(phase-0): Phase 0 approved on the server | prd-dossier | `ApproveButton.tsx`, `DossierPage.tsx`, `DossierRoute.tsx`, `dossier.css`, `view.ts` |
| `a5e90f34` feat(galaxy): a Concepts page under Work | **app-shell** only | `nav/sidebar.ts` (the Concepts entry); `app/concepts/layout.tsx` is `reads` |

**No page is tripped by a shell-only change.** The commits that changed the shell or the bell and no
page file are `a5e90f34` (trips app-shell; dashboard and prd-dossier read it), `9f536325` (the
bell's client, controller, service and repository: `reads` of app-shell and notifications, trips
nothing) and `aa63e2de` (a signed-out tab stops polling: the same). Where a commit tripped a page and
a shared screen, it changed both, each through its own files. Before s4 the shell was in no screen's
`implements`, so these four shell and bell changes were guarded by nothing.

## What the skills and the kit still lacked, used for real

1. **Content inside a control is still read as the control's label.** `data-content` on an element
   inside a link or a button is ignored: the pass reads a control whole (`textOf`). So the bell's
   four lines, each a link holding a PRD's title and a question, give four sentence-on-control
   findings made mostly of data; the dashboard's stage counts (`1 idea`) and Waiting for you's
   figure, and the game room's crew scores, cannot be marked. The mark should count a control's
   content apart too, judging only the control's own words.
2. **A shared screen with no primary action.** Standing in covers "an undecided primary action",
   assuming there is one. The shell and the bell are frames: they have none, and the pass accepts
   none. The skill could say a shared screen may mark none.
3. **How much of the host to draw.** A shared screen drawn on its own still needs somewhere to sit
   (the bell needs a strip of the bar), and a page that sits in the shell may draw it as a frame or
   not. `mock.md` says a page draws only its own part in detail, and nothing about the host around
   a shared screen. Here the host is drawn outside the mark and named.
4. **The section layouts are left open by the rule.** Each `app/<section>/layout.tsx` wires the
   shell to its pages and also imports the page's own stylesheet: neither structure alone nor a
   view two pages share. It is `reads` on both the shell and the page here, so changing a layout
   trips nothing.
5. **A shared screen's `routes` is kept by hand.** The eight routes repeat in both shared screens and
   nothing checks them against the layouts that use `AppShell`; a new section (Concepts,
   `a5e90f34`) would be missed silently.
6. **No screenshot, again.** A subagent has no session browser, so both shared screens were drawn
   from the source, as Standing in says; the crest and the sprites stand in as squares at their
   sizes.
