---
screen: prd-dossier
status: draft
mock: prd-dossier.html
implements: ["apps/galaxy/app/prd/[id]/page.tsx", "apps/galaxy/app/prd/[id]/not-found.tsx", "apps/galaxy/app/prd/[id]/loading.tsx", "apps/galaxy/src/dossier/page/*.tsx", "apps/galaxy/src/dossier/page/dossier.css", "apps/galaxy/src/dossier/page/view.ts", "apps/galaxy/src/dossier/page/stage.ts"]
reads: ["apps/galaxy/app/prd/[id]/", "apps/galaxy/src/dossier/page/", "apps/galaxy/src/dossier/review/", "apps/galaxy/app/prd/layout.tsx", "apps/galaxy/src/nav/AppShell.tsx", "apps/galaxy/src/nav/Sidebar.tsx", "apps/galaxy/src/nav/AppBar.tsx", "apps/galaxy/src/nav/BrandLogo.tsx", "apps/galaxy/src/nav/UserMenu.tsx", "apps/galaxy/src/nav/sidebar.ts", "apps/galaxy/src/nav/Bell.tsx", "apps/galaxy/src/nav/bell.ts"]
routes: [/prd/<id>, /prd/<id>?tab=<tab>, /prd/<id>/review]
supersedes: null
---

## Purpose

The page to share for one PRD, rebuilt in Calm 2 (omni-loop-20). It answers one question first:
who acts next. Its head says it in one subtitle line ("You: approve the spec and plan"), its one
primary button carries the same verb, and the page opens on the tab that waits on the reader.
Everything else is one of seven tabs, in a fixed order, under the head. No panel floats above a tab.

The page is rendered per request as the signed-in person, so row-level security decides what each
read returns (`apps/galaxy/src/dossier/page/DossierRoute.tsx`). It sits inside the app shell
(`apps/galaxy/app/prd/layout.tsx`), a shared screen of its own, `app-shell`, with the bell its own
`notifications`: their files are in `reads`. The PRD's own text (its title, its spec, its plan) is
content, marked `data-content` in the mockup.

Its parts are `@omni/ui`'s (`packages/ui/`), composed from the page anatomy (`page-anatomy`):
`PageHeader` (breadcrumb, title, subtitle, meta row, the one primary action, the Actions menu),
`StageTrack` (the stage said once), `Tabs` (the one tab row), `SegmentedControl` (sub-views and
versions, never a second tab row), `SectionHeading`, `DefinitionList` (the side facts), `ListRow`,
`Notice`, `EmptyState`, `Button`, `Badge`, `Card`, `Stack` and `Text`. The page's own CSS keeps
layout only. The page spans the full app width; only running prose in a pane keeps a 900 px measure.

## Regions

- **The head, one `PageHeader`:** the breadcrumb (Products › product › PRD number, the last crumb
  names the item), the 32 px title, the subtitle. On an item that waits on someone the subtitle
  names who acts and what ("You: approve the spec and plan"); otherwise it says where the PRD is in
  one sentence. The meta row has at most five unlabelled facts (Repo or Repos, On GitHub with when
  it was last read, Opened with the opener's face, Main for a shipped PRD) and never repeats the
  stage. The one primary action sits at the right, shown only to the person who acts, its label the
  subtitle's verb: **Review and approve**, **Review the plan** (tech approval), **Review the
  feature** (ready to merge), **Answer the outbox**, or **Fix with answers** once every high
  question has a counted reply. The **Actions** menu holds the rare ones: Copy link, Send to
  terminal (its picker, then `Queued for <target>`), Delete draft for a draft's opener.
- **The stage, once:** `StageTrack` under the title, the stage's words said one time, accent while
  agents work, signal while it waits on the reader. Its time line reads `Idea → merged: <total> ·
  Longest: <step>, <duration>`, or `Running for <total> · Now: <step>, <duration>`.
- **The tab row, `Tabs`:** one row, under the head, always all seven in this order: Brainstorm,
  Specifications, User voice, Outbox, Feature, Retro, Timeline. A count is a mono pill; the pill is
  yellow only when that tab waits on the reader. An empty tab stays visible, dimmed, with its reason.
  There is no More menu.
- **The pane of the tab shown** (`?tab=`, its version by `?v=`):
  - **Brainstorm:** the progress as a section heading with its meter, each round as a list row
    (mark, rule, category, count, when, outcome); answered rounds folded with the chosen option, an
    open round unfolded with Open the question.
  - **Specifications:** a `SegmentedControl` named in the address, Before/after · Spec · Plan ·
    Approval record. Before/after is the framed page on its sandboxed route; Spec and Plan are
    Markdown with raw HTML off, Plan with its slice table. Approval record holds each seal, the
    attestation table, the business-law verdict, and `About this PRD` as a `DefinitionList` beside
    them. While a version waits for the reader, the tab shows one line linking to the review screen
    (`prd-review`), never an approve panel. The version picker is one button opening the list of
    versions.
  - **User voice:** the persona by round grid and the rounds, with Rework with this feedback and its
    command; empty states say why.
  - **Outbox:** the items waiting on the reader, each with its rank, options and reason; decisions an
    agent took stay labelled as agents' (L-AIACT-1); answers are shown and sent exactly as given
    (BL-ASK-1).
  - **Feature:** the five Ready checks as a record at the top, then PR care (the feature PR, CI,
    conflicts and reviews as facts, the watcher line with `/omni:pr-care`), Proof (run, verdicts,
    clips) and After merge (the status line, breaks, the rewind's findings with Approve / Reject).
    Each part sits under a section heading.
  - **Retro:** the retro, then Pitch.
  - **Timeline:** the PRD lane, the steps between, the longest marked, and one lane per repository.
- **The review screen** is not a pane: `Review and approve`, `Review the plan` and `Review the
  feature` open `prd-review`, a full-width route of its own (`/prd/<id>/review`).
- **The play dock** in the corner while the agent works on the dossier (`LiveRefresh`).

## States

- **Waiting on the reader:** the subtitle names the reader and the verb, the primary button reads
  the same verb, and the page opens on the tab that waits: Specifications for an approval or a tech
  approval, Outbox while items wait, Feature when ready, Retro when shipped, Brainstorm for a draft,
  Feature › After merge when main broke.
- **Nothing waits on the reader:** no primary action; the page opens on the last tab the reader
  used, or Brainstorm.
- **Signed out:** a sign-in card, "Sign in to read this PRD", that comes back here.
- **Not a member, or no such PRD:** "Not found", in the same words either way, with Switch account.
- **Loading:** the dossier's skeleton inside the layout's frame; the parts only GitHub knows say
  they are being read.
- **An empty tab:** dimmed in the row, its pane says why in one line, muted. Outbox empty: "No
  decision yet: the outbox fills while the PRD is built." Retro empty: "The retro is written when the
  feature PR merges." Main with no rewind yet: "No rewind yet" with the `/omni:rewind <n>` line.
- **Old links:** `?tab=questions` opens Brainstorm; `before-after`, `spec` and `plan` open
  Specifications with that segment; `care`, `proof` and `main` open Feature with that section;
  `pitch` opens Retro › Pitch. Each is a redirect that keeps `v` and the other parameters. A link to
  `#approve` reaches the review screen, and `#attestation` the Approval record.
- **Fix pages:** `/prd/<id>` for a fix id goes to `/visual/<id>` or `/bugs/<id>`, the query kept.
  Those pages keep their own tabs and share the head.
- **Demo:** the demo PRD opens on its moment's tab, without a database.
- **After a draft is deleted:** `?deleted=1` says it is gone.

## Words

Tabs, in order: Brainstorm, Specifications, User voice, Outbox, Feature, Retro, Timeline. Segments of
Specifications: Before/after, Spec, Plan, Approval record. Feature's parts: Ready checks, PR care,
Proof, After merge. Retro's parts: the retro, Pitch. Actions: Review and approve, Review the plan,
Review the feature, Answer the outbox, Fix with answers, Approve, Request changes, Merge on GitHub,
Copy link, Send to terminal, Delete draft. Facts: Repo, Repos, On GitHub, Opened, Main. Business
laws keep their words: Business laws ✗ n, Business laws ✓ n judged, Business laws not judged, Why,
The spec says, The judge says, Ask to amend this law. The Ready panel's words are those of its
library screen, `ready-checks`.

## Refusals

- The page tells nobody whether a link they may not read is real: a dossier of another workspace and
  one that never was get the same Not found.
- The tabs and the version picker are links and a GET form, so the page works before any script runs.
- Approval happens on the review screen only: no approve control on any tab of this page.
- An answer a person gave is never reworded or changed on the page (BL-ASK-1).

## Open questions

- Which of the seven tabs a reader lands on when two moments hold at once (an approval and an outbox
  item): the spec gives Specifications first, the order of the moments is not written beside it.
- Whether Timeline, the least-visited tab, should keep its place at the end or move beside Feature.
- What a play dock is for on a reading page is still not said in the page's copy.
- Whether the Actions menu needs a label of its own beyond its icon.

## Source

- omni-loop-20 spec, the Calm 2 design canvas https://claude.ai/artifact/7X6gzD4EjPCdPNxuKFzze7 (seven tabs, the review screen, the Coverage board of 121 items)
- apps/galaxy/app/prd/[id]/page.tsx
- apps/galaxy/app/prd/[id]/not-found.tsx
- apps/galaxy/app/prd/[id]/loading.tsx
- apps/galaxy/src/dossier/page/view.ts (`PAGE_TABS`)
- apps/galaxy/src/page-width.test.ts
- BR-PRODUCT-12, BR-PRODUCT-94, BL-APPROVALS-1, BL-ASK-1, L-AIACT-1 (the laws the page holds)
