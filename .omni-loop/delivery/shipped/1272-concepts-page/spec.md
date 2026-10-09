---
prd: 1272
title: A Concepts page under Work
blocked-by: none
proof: video
spec: file
---

## Problem

`/omni:think-big` records a concept as a folder in a pull request:
`.omni-loop/delivery/inbox/concepts/<nnnn>-<slug>/`, holding `concept.md`, `vision.html`, one
`board-r<k>.html` per round and `debate.md`. Nothing on the Omni page reads it.

The Work group of the menu lists Roadmaps, Ideas, PRDs, Bug Fixes, Visual Updates, Questions and
Knowledge (`apps/galaxy/src/nav/sidebar.ts`), and no Concepts entry. A person who hears about concept
#1269 has to find its pull request and download HTML files to see what it is. Once the PR merges,
the concept sits in a folder on `main` that only a terminal reaches.

PRD 686, which built `/omni:think-big`, put this page out of its own scope and named it as its second
PRD: "a page for concepts on the Omni page … needs a new dossier kind and a migration, and is its own
PRD." Its step-0 draft dossier also stays an orphan, because nothing pushes to it.

## Solution

A concept becomes a **dossier kind**, `concept`, as bug fixes and visual updates are. The Omni page
gets a **Concepts** entry under Work, with a list and a page per concept.

**What is pushed.** `omni dossier push <n> --kind concept` reads the concept's folder,
`<paths.delivery>/inbox/concepts/<nnnn>-*`, where `<n>` is the concept's issue number, and sends:

| file | version kind |
|---|---|
| `concept.md` | `concept-record` |
| `vision.html` | `vision` |
| each `board-r<k>.html` | `board`, with round `k` |
| `debate.md` | `debate` |

The dossier's title is `concept.md`'s front-matter `title`, and its number is the concept's issue. The
concept is parsed with the kit's own `parseConcept` (`kit/lib/concept/parse.ts`) before anything is
sent. A file over the 512 KiB artifact limit is not sent and is named as too large, as for the other
kinds.

**The database.** One migration widens the dossier kinds:

- `dossiers.kind` takes `concept`.
- `dossier_versions.kind` takes `concept-record`, `vision`, `board` and `debate`.
- `dossier_takes` gives a concept exactly those four version kinds.
- `dossier_push` accepts the kind, and dedups `board` per round, as it does `variations`.
- The push request's size cap rises from 2 MiB to 4 MiB, because a concept carries a vision tour and
  several boards. Each file stays at most 512 KiB.

Existing rows, kinds and row-level security are unchanged.

**Who pushes.**

- `/omni:think-big` pushes at step 6, right after it opens the concept PR. Its hand-off then gives
  the concept's page link.
- `/omni:brainstorm --concept` pushes the concept again at step 7, once it has filled the area's PRD
  cell, so the area links to its PRD at once.
- A push that is skipped or refused never stops either skill, as every dossier push already behaves.

**The state.** A concept is **in review** while its concept PR is open, and **in the inbox** once it
has merged. This is read the way a fix's state is, stored in the existing `fix_facts` table
(`{issue, pull}`, a part GitHub could not read kept as `'unread'`). The stages sync refreshes a
concept whose PR has not merged, and stops reading it once it has. The concept's page writes back what
it read. A concept whose PR cannot be read shows **state unknown**, and its page still renders.

**The menu.** A **Concepts** entry in the Work group, between Ideas and PRDs, with its own pixel
sprite, `menu-concepts`, drawn in `packages/design` like the others. Its path is `/concepts`.

**The list, `/concepts`.** One card per concept, newest first. A card shows:

- its title;
- its kind and scale;
- its state chip;
- how many of its areas have a PRD ("2 of 6 areas have a PRD");
- the date it was recorded.

With no concept, the page says how to start one: `/omni:think-big '<your idea>'`.

**A concept, `/concepts/<id>`.** A header holds the title, the state chip, and links to the concept's
issue and its concept PR. Five tabs follow.

- **Overview:** `concept.md`'s sections (The brief, The vision, Why this one, Killed and why, Fuel),
  rendered as Markdown with raw HTML off, as the other Markdown tabs are.
- **Areas:** the Areas table in build order, the wedge marked. An area with a PRD links to that PRD's
  page, or to the PRD's issue when it has no page. The first area without a PRD shows its line,
  `/omni:brainstorm --concept <n> <area>`, with a copy button.
- **Vision tour:** `vision.html` in the sandboxed frame the dossier pages already use, so its scripts
  run but cannot reach the app.
- **Boards:** a round picker (Round 1, Round 2, …), each board in the same sandboxed frame. Each board
  shows as it was recorded, the person's reactions line at its top.
- **Debate:** `debate.md`, rendered as Markdown.

A file that was too large to send shows its tab as "not sent: too large". It never shows as missing.
Who may read a concept is decided as for every dossier: a member of its workspace reads it, and
anyone else gets the not-found page.

**The backfill.** Once merged, the two concepts that exist today, #746 (business-context) and #1269
(products-umbrella), are pushed once with `omni dossier push <n> --kind concept`.

## Decisions

- **A dossier kind, not GitHub reads.** The page lives from pushed files. Reading the folder from
  GitHub on every view would spend the App quota this repository is trying to cut. PRD 686 named a
  dossier kind as the way.
- **Shown as soon as it is recorded.** A concept appears when its PR opens, marked in review, not
  only once merged (the person's choice). The one GitHub fact it needs, merged or not, rides the
  existing `fix_facts` table and stages sync. It adds no new loop, and it stops reading a concept once
  it has merged.
- **Areas link through a re-push.** `/omni:brainstorm --concept` pushes the concept again after
  filling an area's PRD cell (the person's choice), so the link appears without waiting for that
  PRD's phase-0 PR to merge and without a GitHub read.
- **The orphan draft.** `/omni:think-big`'s step-0 draft dossier stays as it is. Drafts are PRD-only,
  so a concept is its own dossier, numbered by its issue, and needs no draft.
- **The voice objected** in design (persona:B-E DEv: "Another page on the Omni site I'll never open;
  concepts are PM talk, and I see this tool as fluff already."), settled `none`: the person approved
  the design without answering it.

## User stories

- As a PM, I open Work › Concepts and see every concept the workspace recorded, which are in review
  and which are in the inbox, and how far each one has turned into PRDs.
- As anyone in the workspace who hears about concept #1269, I open its page and click through its
  vision tour without downloading a file or opening a pull request.
- As a reviewer of a concept PR, I read the brief, the verdict and the dissent on the Overview tab,
  and every board as the person saw it on the Boards tab.
- As the PM about to build a concept, I open its Areas tab, see which areas already have a PRD, and
  copy the brainstorm line of the next one.
- As a developer handed a PRD made from a concept, I follow the PRD's area back to the concept and
  read why that direction was crowned.

## Scope

**In:**

- The migration (kinds, version kinds, `dossier_takes`, `dossier_push`, the board round dedup).
- The push cap of 4 MiB.
- `omni dossier push --kind concept` and its folder reader.
- The galaxy store's kind maps, the API's route map and the sandboxed route reader for the two HTML
  kinds.
- `/concepts`, `/concepts/<id>` and their tab, frame and not-found routes.
- The concept's state through the fix facts.
- The sidebar entry and the `menu-concepts` sprite.
- The push steps in `/omni:think-big` (step 6 and the hand-off) and `/omni:brainstorm --concept`
  (step 7).
- The help entries, the guide pages and the delivery README that describe concepts.
- The rebuilt bundle.
- The backfill of #746 and #1269.

**Out:**

- Team votes or comments on a concept.
- Editing a concept on the page.
- Showing a PRD's concept on the PRD's own page.
- `omni status` and the board counting concepts.
- Deleting the step-0 draft dossier.

## Test seams

Tests never call GitHub or Supabase. Everything runs on fixtures (`omni kb show testing`).

- **The kit (unit tests).** The concept folder reader: which files it takes, the board rounds, the
  title from the front matter, a missing `vision.html`, a file over 512 KiB, a `concept.md` the parser
  refuses. Then `omni dossier push <n> --kind concept` through `main()` on a fixture repository, with
  a stubbed client, checking the artifacts it sends.
- **The database.** The Supabase checks under `supabase/checks` (ADR-0028):
  - a concept dossier takes only its four version kinds;
  - a PRD dossier refuses them;
  - boards dedup per round;
  - a non-member reads nothing.
- **Galaxy (unit and render tests).**
  - The sidebar entry, its place in the Work group and its sprite.
  - The sprite's pinned hash.
  - The list's cards: state chip, areas count, empty state.
  - Each tab, the Areas links (PRD page, PRD issue, brainstorm line) and the "not sent: too large"
    tab.
  - The sandbox headers on the vision and board routes.
  - The not-found page for a non-member and for an id of another kind.
- **The skills.** The skill text tests cover the push lines in `/omni:think-big` and
  `/omni:brainstorm`.

## Risks

**What merging publishes** (`omni kb show releasing`):

- the migration, applied to the production Supabase project by its workflow;
- the kit bundle and the plugin, which change what `/omni:think-big` and `/omni:brainstorm` do in
  every installed repository;
- the galaxy app's new pages.

**The risks:**

- **A wrong `dossier_push` redefinition** could refuse pushes of the existing kinds. The Supabase
  checks push one of each existing kind against the new function.
- **A board with scripts** is shown only in the sandboxed frame, under the same headers as the
  before/after page. A board that tried to reach the app or the network is refused by that sandbox.
- **The 4 MiB cap** raises how much one push carries. Each file keeps its 512 KiB limit.

**Rollback.** Revert the PR. The migration only widens checks and recreates two functions, so
existing rows are untouched. A follow-up migration narrows the checks again, once any concept rows
are deleted.

## Acceptance criteria

1. Work in the menu lists **Concepts** between Ideas and PRDs, with its own sprite, and it opens
   `/concepts`.
2. `/concepts` lists concept #1269 with its title, its kind (platform) and scale (vast), its state
   chip, "0 of 6 areas have a PRD" and its date. With no concept in the workspace, the page shows the
   `/omni:think-big` line.
3. Concept #1269's page shows its title, the state chip, and links to issue #1269 and PR #1270. Its
   Overview tab renders The brief, The vision, Why this one, Killed and why and Fuel.
4. Its Areas tab lists the six areas in build order, the wedge (server-approval) first and marked,
   and the first area without a PRD shows `/omni:brainstorm --concept 1269 server-approval` with a
   copy button.
5. Its Vision tour tab plays `vision.html` in a sandboxed frame: the tour's screens click through, and
   the frame's response carries the sandbox headers.
6. Its Boards tab picks Round 1 and Round 2, each showing the board as recorded with the person's
   reactions line at its top. Its Debate tab renders `debate.md`.
7. A concept whose concept PR is open shows **in review**; once merged, **in the inbox**; when the PR
   cannot be read, **state unknown**, and the page still renders.
8. `omni dossier push <n> --kind concept` sends `concept.md`, `vision.html`, every `board-r<k>.html`
   with its round, and `debate.md`. It refuses, naming the errors, a `concept.md` the parser refuses,
   and names any file over 512 KiB as too large.
9. After `/omni:brainstorm --concept <n> <area>` fills an area's PRD cell and pushes, that area on
   the concept's Areas tab links to its PRD's page, or to its issue when the PRD has no page.
10. `/omni:think-big` pushes the concept right after opening its concept PR, and its hand-off gives
    the concept's page link. A skipped or refused push is said in one line, and the skill carries on.
11. A concept dossier takes only `concept-record`, `vision`, `board` and `debate`, and pushes of the
    `prd`, `visual` and `bug` kinds keep working unchanged.
12. A person outside the concept's workspace gets the not-found page for `/concepts/<id>` and for
    its frame routes.
