---
prd: 541
title: /omni:visual-fix, a fast lane for small visual changes
blocked-by: none
spec: file
---

# /omni:visual-fix, a fast lane for small visual changes

**Date:** 2026-09-29 · **PRD:** #541 · **Follows:** PRD 7 (the loop's skills), PRD 39 (`omni
init`) · **Touches:** the kit only: a new skill `kit/plugin/skills/visual-fix/`, a new verb
`kit/bin/commands/visual.mjs`, the config schema (`kit/lib/config.mjs`), the label list
(`kit/lib/init/labels.mjs`), the help entries (`kit/lib/help/entries.mjs`), the guide's use-cases
page (`docs/guide/use-cases.md`, which `/docs` renders) and the delivery README. No migration, and
no change to the galaxy app's code, the GitHub App or the game.

**First of three.** This PRD is the visual lane only. `/omni:bug-fix` (a port of the bug-fixing
skill that `omni kb show bug-fixing` already describes) and the Bugs and Visual views in the Omni
menu are their own PRDs, to be brainstormed after this one. The menu view reads the label and folder
this PRD defines.

## Problem

The only way into the loop is `/omni:brainstorm`, followed by `/omni:yolo`: design questions, a spec,
a before/after page, a plan, a phase-0 PR a person merges, then waves of sub-PRs into a feature
branch, an outbox gate and a feature PR. That is the right weight for a feature. It is far too much
for "the sidebar background is too light": one slice, a few lines of CSS, and a decision only a
person looking at the screen can take.

Today such a change is either pushed through the whole loop, taking an hour and two merges for a
colour, or done by hand outside the loop, leaving no issue, no label and no record anyone can track.

## Solution

A new skill, `/omni:visual-fix`, takes a small visual change from one line to one pull request that a
person merges. There is no spec, plan, phase-0 PR, feature branch, wave or outbox, because the person
picks every visual decision themselves while the skill runs.

### The flow

`/omni:visual-fix '<one line>'`, or `/omni:visual-fix <n>` for an existing issue.

1. **Start.** `omni config`, then `omni kb show briefing` (its rules bind every step) and `omni kb
   show verification` (how this repository sees a change working).
2. **Issue.** With a line: open an issue titled `Visual: <line>`, labelled `labels.visual`, signed.
   With a number: read that issue (`gh issue view <n> --comments`); it is used as it is, and the
   skill adds `labels.visual` when the issue does not carry it. `<n>` below is the issue's number.
3. **Locate.** Find the screen or screens the line is about, and where their look comes from:
   design tokens, stylesheets, component markup. Say in one line what will be touched, then check
   the **boundary** (below). A repository with no screen at all stops here: the skill comments on
   the issue that there is nothing visual to change, and stops.
4. **Variations, always.** Write one self-contained HTML page to the session's scratchpad (never the
   repository), built from the real screen's markup and styles: **today** first, then **four or
   five distinct variations**, labelled A to E, each a real direction and not a shade of the same
   one. Open it in the person's browser when the session can, and give its path either way. Then
   ask which one, as one question with A to E as its options (the person may answer "another
   round" with a note). A new round writes a new page. Repeat until one variation is picked. The
   question goes through the session's question tool, so ask mode carries it to the Omni page.
5. **Branch.** A worktree on `branches.fix` with `{topic}` = `<n>-<slug>`, cut from
   `<remote>/<repo.defaultBranch>`. It never commits on the default branch.
6. **Apply** the pick in code, in the repository's own patterns (its tokens before a raw value). A
   small component tweak that changes logic is written test-first; a change of styles or copy alone
   needs no new test. Then run `commands.preflight` until it is green.
7. **Real check.** Run the app as `omni kb show verification` says, and look at the changed screen
   once, with a screenshot when the session has a browser tool. When that cannot be done here, the
   skill says so plainly and the PR's preview becomes the check. Nothing is reported as seen that
   was not.
8. **Record.** Write `<paths.delivery>/visual/<nnnn>-<slug>/before-after.html`: today beside the
   pick, then the variations not picked, smaller, under "Not picked". It is self-contained (inline
   CSS and SVG, no base64 raster image) and at most `limits.beforeAfterMaxBytes` bytes. `<nnnn>`
   is the issue number, zero-padded to four digits.
9. **Ship.** Commit as `fix(<scope>): <line> (#<n>)`, with the session's co-author trailer, then the
   `omni sign trailer` line. Run `omni visual <n>` until it prints `ok`. Push, then open the PR
   through `/omni:pr`: base the default branch, label `labels.visual`, a body starting
   `Closes #<n>`, then **What changed**, **The pick** (its letter and a sentence), **Before/after**
   (the page's repository path), **Verified** (the `commands.preflight` result, the `omni visual`
   line, and the real check or the sentence saying it was not done), **Risk and rollback**, and
   the `omni sign footer` line.
10. **Hand off.** The issue, the PR, what was verified and what was not, then: open the PR's
    preview and merge it if it looks right. **A person merges.** The skill never merges.

### The boundary

- **Allowed:** styles, design tokens, copy, markup and layout of screens that already exist, and
  small presentational logic in a component: a prop that shows or hides an element, a hover or
  focus state, a class chosen by an existing value.
- **Not allowed:** data, fetching, routes, APIs, a stored shape, a new screen, a new flow, or any
  behaviour a user did not have before.

Crossing the line, at step 3 or at any later step, stops the skill. It comments on the issue with
what crossed the line and the command to run instead, `/omni:brainstorm <the issue's line>`, then
stops. A worktree it had already cut stays, unpushed, and the hand-off names it.

### The kit pieces

| Piece | What it is |
|---|---|
| `kit/plugin/skills/visual-fix/SKILL.md` | The skill, carrying the flow and the boundary above. It names every label, branch and path through `omni config`. |
| `labels.visual` | A new config key, default `omni:visual`. `omni init` creates it with the other labels (`kit/lib/init/labels.mjs`). |
| Branch | The existing `branches.fix`, default `fix/{topic}`. No new key. |
| Folder | `<paths.delivery>/visual/<nnnn>-<slug>/`, holding `before-after.html` only. The delivery README gains one paragraph about it. |
| `omni visual <n>` | The proof step, mirroring `omni phase0 <n>`, run on the fix branch. It prints `ok` when all of the checks below hold, and otherwise `not ok` with one line per failed check. |
| `/omni:help`, `/docs` | An entry in `kit/lib/help/entries.mjs`, and a row plus a short section in `docs/guide/use-cases.md`, naming the new command and when to use it. |

`omni visual <n>` checks that:

- exactly one folder `<paths.delivery>/visual/<nnnn>-*` exists for `<n>`, and it holds
  `before-after.html`;
- the page passes the same before/after checks `omni check inbox` applies to a PRD's page (size,
  no base64 raster image), reusing that code;
- every commit on the branch since it left the default branch carries the `omni sign trailer`
  line, as `omni phase0` checks.

It exits `0` on `ok`, `1` on `not ok`, and `2` when the kit is not installed or its config does not
read, like the other verbs.

## Decisions

- **A fast lane beside the loop, not inside it.** A visual fix never gets a PRD, a dossier, an inbox
  folder, a plan or an outbox: the person decided everything by picking.
- **It opens its own issue** from one line, so the future Visual view has something to list before a
  PR exists, and the PR closes it.
- **Variations always,** even for a precise ask: four or five rendered directions, picked by the
  person.
- **A mockup page first, then one real check.** The variations are drawn on a scratchpad page from
  the real markup and styles; only the pick is applied in code and looked at in the running app.
- **"Look plus small component tweaks"** is the boundary. A size limit alone was considered and not
  chosen: a small diff can still change behaviour.
- **The record is committed:** `before-after.html` under `delivery/visual/`, reviewable in the PR
  and readable by the future Visual view.
- **One new label, no new branch key:** `labels.visual`, and `branches.fix`, which already exists.
- **No release note and no retro** for a visual fix. The kit's version still moves on every merge,
  as for any PR.

## User stories

- As a person who wants a colour changed, I type one line and pick from four or five rendered
  options, and a PR is waiting within minutes, with no spec, plan or phase-0 PR to merge first.
- As the reviewer of that PR, I open one before/after page showing today beside the pick and the
  options that were not picked, and I merge.
- As anyone in the team, I find every visual fix as an issue labelled `omni:visual`, closed by its
  PR.
- As a person whose "small" change turns out to need data or a new flow, I am told so on the issue
  and handed the `/omni:brainstorm` line, rather than getting a PR that hides a feature.

## Scope

**In:** the skill, `labels.visual` and its creation by `omni init`, the `omni visual` verb and its
tests, the delivery README paragraph, the help entry and the use-cases page.

**Out:**

- `/omni:bug-fix`: its own PRD, next.
- The Bugs and Visual views in the Omni menu: their own PRD, after `/omni:bug-fix`.
- Any change to the Omni app's merge handling: a visual PR closes an issue that is not labelled
  `labels.prd`, and the plan confirms that the retro, knowledge harvest and release note run only
  for a PRD's feature PR.
- Batching several visual fixes into one PR.

## Test seams

Read with `omni kb show testing`. Kit tests are vitest, next to the code they cover, and use the
fixtures in `kit/test/` for a repository on disk. No test calls GitHub or the network.

- **Config** (`kit/lib/config.test.mjs`): `labels.visual` defaults to `omni:visual` and can be
  overridden.
- **Labels** (`kit/lib/init/labels.test.mjs`): `omni init`'s label list holds `visual`, with a
  colour and a description.
- **`omni visual <n>`** (`kit/bin/visual.test.mjs`, shaped like `kit/bin/phase0.test.mjs`), on a
  fixture repository with a fix branch:
  - `ok` for a signed commit carrying a valid page;
  - `not ok` naming each failure alone: no folder for `<n>`, two folders for `<n>`, no
    `before-after.html`, a page over `limits.beforeAfterMaxBytes`, a base64 raster image, and an
    unsigned commit;
  - exit `2` outside an installed repository.
- **The skill** passes the plugin's existing guards: `kit/test/plugin.test.mjs` (it parses, names
  only commands the CLI has, signs the loop's work) and `kit/test/no-literals.test.mjs` (it names
  no label, branch or path literally).
- **Help** (`kit/lib/help/entries.test.mjs`): the entries hold `visual-fix`, usage
  `/omni:visual-fix <line or n>`.

The skill's conversation (variations, the pick, the real check) has no automated test. It is
proven by one live run on this repository, recorded in the feature PR.

## Risks

Read with `omni kb show releasing`. Merging publishes a new kit release, `v0.0.N`, and a new plugin
version. Repositories take the skill with `omni update`. Nothing changes for a repository that never
runs `/omni:visual-fix`, apart from one more label that `omni init` creates.

- **A visual PR that hides behaviour.** The boundary is judged by the model. The reviewer is the
  last guard: the PR body says what changed, and its diff is small by construction.
- **The mockup differs from the real screen.** Step 7 looks at the real screen once, and says so
  when it could not.
- **Rollback:** revert the feature PR. `omni:visual` issues and `delivery/visual/` folders already
  created stay; they are plain issues and docs, and nothing reads them yet.

## Acceptance criteria

Acceptance scenarios are off in this repository (`acceptance.enabled` is false); every criterion
becomes ordinary tests or the live run.

1. `omni config` shows `labels.visual`, default `omni:visual`, and `omni init` creates that label.
2. `omni visual <n>` prints `ok` and exits `0` on a fix branch whose one
   `<paths.delivery>/visual/<nnnn>-<slug>/` folder holds a valid `before-after.html` and whose
   commits are all signed.
3. `omni visual <n>` prints `not ok` and exits `1`, naming the failure, for each of: no folder, two
   folders, no page, a page over the size limit, a base64 raster image, an unsigned commit.
4. `kit/plugin/skills/visual-fix/SKILL.md` exists and passes the plugin's guards and the
   no-literals guard.
5. `/omni:help` lists `/omni:visual-fix` with one line on when to use it, and the use-cases page's
   table has a row for it, linked to its own section.
6. **Live run:** `/omni:visual-fix` on one real line in this repository opens an `omni:visual`
   issue, shows a page of today plus four or five variations, applies the pick, and opens one PR
   labelled `omni:visual` that closes the issue, carries its `before-after.html`, and has
   `omni visual <n>` printing `ok`. The feature PR links that PR.
7. **Live stop:** `/omni:visual-fix` on a line that needs data or a new flow comments on its issue
   with the `/omni:brainstorm` line and opens no PR.
