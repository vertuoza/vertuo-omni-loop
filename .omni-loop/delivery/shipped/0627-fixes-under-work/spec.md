---
prd: 627
title: Bug fixes and visual updates under Work
blocked-by: none
spec: file
---

# Bug fixes and visual updates under Work

**Date:** 2026-09-29 · **PRD:** #627 · **Touches:** `supabase/migrations/` (one new column, two new
version kinds), `supabase/checks/dossiers.sql`, `apps/galaxy/src/nav/` (the Work group),
`apps/galaxy/src/dossier/` (list, page view, a timeline reader), `apps/galaxy/app/` (two lists, two
page routes), `apps/galaxy/app/api/dossiers/` (push takes a kind), `game/dossiers/` (the fallback
reads two more folders), `kit/bin/commands/dossier.mjs`, `kit/lib/dossier/`, `kit/lib/visual/`,
`kit/lib/help/`, and the `visual-fix` and `bug-fix` `SKILL.md`.

## Problem

A visual fix (`/omni:visual-fix`, PRD 541) and a bug fix (`/omni:bug-fix`, PRD 556) each leave an
issue, a `fix/` pull request and a record in the repository:
`<delivery>/visual/<nnnn>-<slug>/before-after.html` or `<delivery>/bugs/<nnnn>-<slug>/bug.md`.
Nothing on the Omni page reads any of them. The Work menu lists PRDs only, the dossier store knows
only PRDs, and both skills say "never open a dossier". So nobody can see, from the page, which fixes
are open, in review or merged, and nobody can answer "who asked for this, who picked this look, who
approved it, who merged it, and when" without digging through GitHub.

The variations a person picks from (four or five rendered directions, sometimes several rounds) are
written to the session's scratch folder and lost: only the before/after page survives.

## Solution

**The Work menu** gets three entries for three kinds of work, in this order, before Questions and
Knowledge:

| Entry | Route | Lists |
|---|---|---|
| PRDs | `/prd` | dossiers of kind `prd` (today's list, unchanged) |
| Bug Fixes | `/bugs` | dossiers of kind `bug` |
| Visual Updates | `/visual` | dossiers of kind `visual` |

**A fix is a dossier with a kind.** `dossiers` gains `kind text not null default 'prd'`, checked to
`prd | visual | bug`. Every existing row stays `prd`. The unique key becomes
`(workspace_id, home_repo, kind, prd)`. For a fix, the `prd` column holds its issue's number (a fix
is never a draft, so it is always numbered). `dossier_versions.kind` gains `variations` (one version
per round) and `bug-record` (`bug.md`). A dossier of kind `visual` takes only `before-after` and
`variations` versions; kind `bug` only `bug-record`; kind `prd` keeps `spec`, `plan` and
`before-after`. `dossier_push` refuses any other pairing.

**Variations are committed.** `/omni:visual-fix` writes each round's page, as shown to the person,
to `<delivery>/visual/<nnnn>-<slug>/variations-r<k>.html` (k = 1, 2, …), beside
`before-after.html`. They are reviewed in the fix PR like the before/after page, under the same
rules: self-contained, no base64 raster image, at most `limits.beforeAfterMaxBytes` bytes each.
`omni visual <n>` checks them. On the page, each round is one `variations` version, labelled
*Round k*, in round order.

**The pick line.** `before-after.html` carries one line, in a fixed shape, naming the pick, who made
it and when:

```html
<p data-omni-pick>Picked C by @pierre-derval on 2026-09-29</p>
```

The login is whoever answered the variations question: the GitHub login the Omni page gives with
the answer in ask mode, otherwise the login of the person at the terminal
(`gh api user --jq .login`). The same line goes in the fix PR's **The pick** section.

**Filling it.**

- **From the kit.** `omni dossier push <n> --kind visual|bug` reads the fix's folder
  (`visual/<nnnn>-*/` or `bugs/<nnnn>-*/`) and sends `{repo, prd: n, kind, title, artifacts}`. The
  title is the issue title without its `Visual: ` or `Bug: ` prefix. `omni dossier push <n>` with no
  `--kind` is today's PRD push, unchanged. `omni dossier link <n> --kind …` finds a fix's page.
- **From the skills.** `/omni:visual-fix` (after it pushes the fix branch in step 9) and
  `/omni:bug-fix` (after step 12's push) follow `/omni:dossier-push <n> --kind …`, and carry on
  whatever it prints, as `/omni:brainstorm` does. Their hand-off prints the page's link beside the
  PR. The "never open a dossier" line in both skills becomes "never open a PRD, an inbox folder, a
  plan or an outbox item"; the rest of both skills stays as it is.
- **From GitHub.** The fallback sync (`game/dossiers/`) also reads `<delivery>/visual/` and
  `<delivery>/bugs/` on each repository's default branch, with `source='github'`. The records
  already merged (#548, #561, #571) appear after its next run, with no step by a person.

**The lists** (`/visual`, `/bugs`) share the PRD list's layout. Each row shows `#n`, the title, the
repo chip, who asked, a state pill and the last activity. Bug rows also show the issue's risk label
and a *regression* badge when it carries `labels.regression`. The filters are Mine/All, repo, state
and search. The state is read live from GitHub, through the same cached (60 s) reader as the PRD
outbox counts:

| State | When |
|---|---|
| Asked | the issue is open and no `fix/<n>-…` PR is open |
| In review | a `fix/<n>-…` PR is open |
| Merged | that PR is merged |

When GitHub does not answer, the pill reads `—`.

**A fix's page** is `/visual/<id>` or `/bugs/<id>`, rendered by the same page component as
`/prd/<id>`, with tabs chosen by kind:

| Kind | Tabs, in order |
|---|---|
| visual | Timeline · Before/after · Variations · Questions |
| bug | Timeline · Bug record · Questions |

Variations has a round picker (`?v=`); Bug record renders `bug.md` as markdown. There is no Spec,
Plan, Outbox or Retro tab and no stage pill row. The header shows a *Visual* or *Bug* badge and
links to the issue and the PR. `/prd/<id>` of a fix redirects to its own route, and the other way
around.

**The Timeline** lists five moments, each with who and when, read live from GitHub (and the pick
line), cached 60 s:

| Moment | Read from | Kinds |
|---|---|---|
| Asked | the issue's author and creation time | both |
| Picked X | the `data-omni-pick` line of the latest before/after version | visual |
| Approved | each `APPROVED` review on the fix PR: reviewer and time | both |
| Merged | the fix PR's `merged_by` and `merged_at` | both |
| Released | the first GitHub release published after the merge: its tag, linked | both |

A moment that has not happened reads *not yet*. One that GitHub could not answer reads *unknown*.
A before/after page with no pick line (the two already merged) reads *Picked: not recorded*.

## Decisions

- **One store, a kind column**, rather than separate fix tables: a fix reuses dossiers' versions,
  row-level security, push API, fallback and page. Chosen in the brainstorm over separate tables and
  over a GitHub-only view (which could not keep the variations).
- **Three sidebar entries**, not one list with a filter: the person asked for PRDs, Bug Fixes and
  Visual Updates as separate items under Work.
- **Variations committed and uploaded**, not uploaded only: a repository copy survives the app being
  off, is reviewed in the PR, and lets the GitHub fallback fill the page.
- **Who picked lives in the record**, not in a new events table: one line in `before-after.html`
  and the PR body, parsed by the page.
- **The fix states are read live**, not through PRD 587's stored stages: three states taken from one
  issue and one PR need no sync, and this PRD does not wait on 587.
- **Names:** the menu says *Visual Updates* and *Bug Fixes*; the skills keep their names
  (`/omni:visual-fix`, `/omni:bug-fix`).

## User stories

1. As a person in the workspace, I open **Work → Visual Updates** and see every visual fix of my
   repositories, with its state, so I know what is waiting for review.
2. As a person in the workspace, I open **Work → Bug Fixes** and see every bug fix, its risk and
   whether it is a regression.
3. As a reviewer, I open a visual update and see today beside the pick, and every round of
   variations the person chose from, so I understand the choice before I approve.
4. As a lead, I open any fix and read who asked, who picked, who approved, who merged and which
   release it went out in, with dates.
5. As the person running `/omni:visual-fix` or `/omni:bug-fix`, I get the fix's page link in the
   hand-off and send it to whoever asked.

## Scope

**In:** the `kind` column and version kinds; `dossier_push` and the push API taking a kind; the kit's
`--kind` on `dossier push` and `dossier link`; committed variations and `omni visual` checking them;
the pick line; the fallback reading `visual/` and `bugs/`; the Work entries, the two lists and the
fix page with Timeline; both skills and their help entries.

**Out:** dashboards counting fixes by kind (PRD 572's tallies stay as they are); stored stages for
fixes (PRD 587); notifications or bell entries for fixes; a fix's page for repositories whose
dossier switch is off; rewriting the two existing before/after pages to add a pick line.

## Test seams

Read `omni kb show testing`. Unit tests beside the code, no network in a unit test.

- **Migration:** `supabase/checks/dossiers.sql` covers: a new row defaults to `prd`; a `visual` and
  a `prd` dossier can share a number; a `bug` dossier refuses a `spec` version and a `prd` dossier
  refuses a `variations` one; the row-level security rules hold for the new kinds.
- **Kit:** `kit/lib/dossier/folder` reads a `visual/` folder into `before-after` plus ordered
  `variations` rounds, and a `bugs/` folder into `bug-record`; `dossier push --kind` sends the kind;
  no `--kind` sends what it sends today. `kit/lib/visual/verdict` fails a round page that is too big
  or holds a raster image, and passes a folder with only `before-after.html`.
- **Fallback:** `game/dossiers/folders` reads `visual/` and `bugs/` tree fixtures into the right
  kinds and titles.
- **Galaxy:** the sidebar order test; the list model filters by kind and state; the page view model
  picks tabs by kind; the timeline builder, from a GitHub fixture, produces each moment, *not yet*,
  *unknown* and *not recorded*; the pick-line parser reads the shape above and ignores anything
  else; the redirect between `/prd/<id>` and a fix's route.

## Risks

- **Publishes** a migration on the shared Supabase project (a new column with a default, a changed
  unique key, widened checks) and a new `kit` release (`v0.0.N`) carrying `--kind`. Read
  `omni kb show releasing`. Rolled back by reverting the feature PR and a follow-up migration that
  drops the fix rows and the column; PRD dossiers are untouched by either.
- **The changed unique key** is the one step that touches every dossier: the migration adds the new
  key before dropping the old one, in one transaction.
- **PRD 587** (on `feat/real-stages`) also migrates `dossiers`. Whichever merges second renames its
  migration to sort after the other's, as PRD 517 did.
- **Committed variations** make visual fix PRs bigger (up to `limits.beforeAfterMaxBytes` per
  round).
- **Old kits** that push without a kind keep working: the API reads a missing kind as `prd`.

## Acceptance criteria

1. The Work group reads, in order: PRDs, Bug Fixes, Visual Updates, Questions, Knowledge.
2. `/visual` lists every `visual` dossier of the viewer's workspace, and only those; `/bugs` lists
   every `bug` dossier, and only those; `/prd` lists what it lists today.
3. After its next run, the GitHub fallback has made pages for #548, #561 (Visual Updates) and #571
   (Bug Fixes).
4. A new `/omni:visual-fix` run commits `variations-r<k>.html` for every round shown, and a
   `before-after.html` holding a pick line; `omni visual <n>` refuses a round page with a raster
   image or over the size limit.
5. The same run pushes its dossier and prints the page's link in the hand-off. On that page,
   Before/after shows the page, Variations shows every round, and the Timeline shows Asked and
   Picked with login and date.
6. After the fix PR is approved and merged and a release is cut, the Timeline shows Approved,
   Merged and Released with who and when, and the list pill reads *Merged*.
7. A new `/omni:bug-fix` run pushes its dossier; its page shows the Bug record tab rendering
   `bug.md`, and a Timeline without a Picked moment.
8. `omni dossier push <n>` without `--kind` behaves exactly as today on a PRD.
9. A PRD's page, list and filters are unchanged.
