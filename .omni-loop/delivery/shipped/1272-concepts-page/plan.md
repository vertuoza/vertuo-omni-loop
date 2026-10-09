# Plan: A Concepts page under Work

This is the plan for PRD #1272. Its spec, `spec.md`, sits beside it.

- **Feature branch:** `feat/concepts-page`, merged into `main`. Its pull request says
  `Closes #1272`.
- **Slices:** each is built on its own `feat/concepts-page--<slice>` branch and merged into the
  feature branch through a sub-PR that says `Part of #1272`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | **A concept is a dossier kind.** The migration lets a dossier be a `concept` with the version kinds `concept-record`, `vision`, `board` and `debate`, and dedups boards per round. The push cap rises to 4 MiB. `omni dossier push <n> --kind concept` reads the concept's folder and sends its files. | `supabase/migrations/20261119090000_concept_dossiers.sql` `supabase/checks/dossiers.sql` `kit/lib/dossier/folder` `kit/bin/commands/dossier` `kit/lib/ask/client` `apps/galaxy/src/dossier/store` `apps/galaxy/src/dossier/api` | — | 1 |
| s2 | **Concepts under Work, and its list.** Work in the menu lists Concepts between Ideas and PRDs, with its `menu-concepts` sprite. `/concepts` shows one card per concept (title, kind, scale, areas with a PRD, date), newest first, and its empty state. | `apps/galaxy/src/nav/` `packages/design/src/sprites` `apps/galaxy/app/concepts/page` `apps/galaxy/app/concepts/layout` `apps/galaxy/app/concepts/loading` `apps/galaxy/src/concepts/list` `apps/galaxy/src/concepts/ConceptList` `apps/galaxy/src/dossier/page/work` | s1 | 2 |
| s3 | **A concept's page.** `/concepts/<id>` shows the header and five tabs: Overview, Areas (PRD links and the next brainstorm line), Vision tour and Boards (in the sandboxed frame) and Debate. A file too large to send shows as "not sent: too large", and anyone outside the workspace gets the not-found page. | `apps/galaxy/app/concepts/[id]/` `apps/galaxy/src/concepts/ConceptPage` `apps/galaxy/src/concepts/areas` `apps/galaxy/src/dossier/page/view` `apps/galaxy/src/dossier/page/source` `apps/galaxy/src/dossier/page/sandbox` `apps/galaxy/src/dossier/page/work` | s1 | 3 |
| s4 | **The concept's state.** A concept is in review, in the inbox, or state unknown. Its facts are stored in `fix_facts`, refreshed by the stages sync until the concept PR merges, and shown as a chip on the list's cards and on the concept's page. | `apps/galaxy/src/dossier/github/fix` `apps/galaxy/src/fixes/facts/` `apps/galaxy/src/stages/sync/` `apps/galaxy/src/dossier/page/fix-facts` `apps/galaxy/src/concepts/state` `apps/galaxy/src/concepts/list` `apps/galaxy/src/concepts/ConceptList` `apps/galaxy/src/concepts/ConceptPage` | s2, s3 | 4 |
| s5 | **The skills push concepts.** `/omni:think-big` pushes the concept right after opening its concept PR and gives the page link in its hand-off. `/omni:brainstorm --concept` pushes the concept again once it fills an area's PRD cell. The help entries, the guide pages and the delivery README describe the Concepts page. | `kit/plugin/skills/think-big/` `kit/plugin/skills/brainstorm/` `kit/lib/help/` `docs/guide/` `.omni-loop/delivery/README.md` `kit/test/brainstorm-concept` `kit/test/skills-dossier-link` | s1 | 2 |

**Shared ground.** Two slices declare `apps/galaxy/src/dossier/page/work`:
- **s2** adds the `concept` kind's path and name to the kind maps.
- **s3** routes a misrouted id of another kind to its own page.

s2 runs in wave 2 and s3 in wave 3, so the second one builds on the first. Its test,
`work.test.ts`, is under the same prefix.

s4 shares three prefixes with the slices before it, and runs in wave 4, after both:
- `apps/galaxy/src/concepts/list` and `apps/galaxy/src/concepts/ConceptList`, with s2;
- `apps/galaxy/src/concepts/ConceptPage`, with s3.

s5 shares no ground with s2, so the two run side by side in wave 2.

`kit/dist/` is generated: a slice rebuilds it only to test it, and commits none of it.

**After the merge.** This is not a slice. Once the feature PR has merged and the migration is
deployed, a person runs `omni dossier push 746 --kind concept` and `omni dossier push 1269 --kind
concept`. Concept #1269 needs its concept PR, #1270, merged or checked out first.

## Per slice: done when

### s1: A concept is a dossier kind

- The migration widens `dossiers.kind` to take `concept`, and `dossier_versions.kind` to take
  `concept-record`, `vision`, `board` and `debate`.
- `dossier_takes` gives a concept exactly those four version kinds. `dossier_push` accepts the
  kind and dedups `board` per round.
- `supabase/checks/dossiers.sql` proves five things:
  - a concept refuses a `spec`;
  - a PRD refuses a `board`;
  - two pushes of the same board round add one version;
  - pushes of `prd`, `visual` and `bug` dossiers still work;
  - a non-member reads no concept.
- The push route accepts a request of up to 4 MiB. A single file still refuses more than 512 KiB.
- `omni dossier push <n> --kind concept`, run through `main()` on a fixture repository with a
  stubbed client, sends:
  - `concept.md` as `concept-record`;
  - `vision.html` as `vision`;
  - each `board-r<k>.html` as `board` with round `k`;
  - `debate.md` as `debate`.

  The dossier's title is the front matter's `title`.
- The command refuses a `concept.md` that `parseConcept` refuses, naming its errors, and sends
  nothing. A file over 512 KiB is named as too large and not sent. A folder with no `vision.html`
  sends the rest.

### s2: Concepts under Work, and its list

- `SIDEBAR`'s Work group lists `concepts` ("Concepts", `/concepts`, sprite `menu-concepts`) between
  Ideas and PRDs. The sidebar and app-bar tests list it there.
- The `menu-concepts` sprite is drawn in `packages/design/src/sprites.ts`, and its hash is pinned
  in `sprites.test.ts`.
- `/concepts` renders one card per concept dossier of the workspace, newest first. Each card shows:
  - its title;
  - its kind and scale, from `concept.md`;
  - "<k> of <m> areas have a PRD";
  - the date it was recorded.
- With no concept, the page shows how to start one: `/omni:think-big '<your idea>'`.
- A render test covers a fixture of #1269, "0 of 6 areas have a PRD", and the empty state.

### s3: A concept's page

- `/concepts/<id>` renders the title, links to the concept's issue and its concept PR (on
  `branches.concept`), and the tabs Overview, Areas, Vision tour, Boards and Debate.
- **Overview** renders The brief, The vision, Why this one, Killed and why and Fuel from
  `concept.md` as Markdown, with raw HTML off.
- **Areas** lists the areas in build order with the wedge marked. An area's PRD links to the PRD's
  dossier page, or to its issue when it has none. The first area without a PRD shows
  `/omni:brainstorm --concept <n> <area>` with a copy button.
- **Vision tour** and **Boards** frame their pages through the sandboxed route, with the sandbox
  headers the before/after route sends. Boards picks each round. A render test and a route test
  cover both.
- A version that was too large to send shows its tab as "not sent: too large".
- A non-member, and an id of another kind, get the not-found page for the page and its frame
  routes.

### s4: The concept's state

- A concept's facts (`{issue, pull}`) are read from the concept's issue and the pull request whose
  head is its `branches.concept` branch. They are stored in `fix_facts`, with a part that could not
  be read kept as `'unread'`.
- The stages sync refreshes a concept until its pull request has merged, and does not read it
  after that.
- The chip reads:
  - **in review** while the pull request is open;
  - **in the inbox** once it has merged;
  - **state unknown** when it could not be read. The page still renders.

  It shows on the list's cards and on the concept's page. A render test covers each state.
- Tests run against a stubbed GitHub and the fake facts store, never against GitHub.

### s5: The skills push concepts

- `/omni:think-big` step 6 follows `/omni:dossier-push <n> --kind concept` right after opening the
  concept PR. Whatever it prints, the skill carries on. The hand-off names the concept's page link
  from `omni dossier link <n> --kind concept`.
- `/omni:brainstorm --concept` step 7 pushes the concept again from the feature worktree, once the
  area's PRD cell is filled. Whatever it prints, the skill carries on.
- `kit/test/brainstorm-concept.test.ts` and `kit/test/skills-dossier-link.test.ts` pin the two push
  lines and the hand-off link.
- The help entries for `think-big` and `brainstorm`, `docs/guide/use-cases.md`,
  `docs/guide/loop.md` and the delivery README name the Concepts page under Work.
