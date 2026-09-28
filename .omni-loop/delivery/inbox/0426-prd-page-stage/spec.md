---
prd: 426
title: The PRD page shows its stage and what to do next
blocked-by: none
spec: file
---

# The PRD page shows its stage and what to do next

**Date:** 2026-09-28 · **PRD:** #426 · **Follows:** PRD 384 · **Touches:** the dossier page in the
galaxy app (`apps/galaxy/app/prd/[id]`, `apps/galaxy/src/dossier/`), and a new GitHub reader beside
it. No migration, no change to the kit or to the GitHub App.

## Problem

The PRD page (`/prd/<id>`, the dossier) keeps a PRD's spec, plan, before/after and questions. It does
not say where the PRD is, nor what anyone has to do about it:

- **No stage.** Nothing on the page says whether the PRD is being brainstormed, waiting for its
  spec to be approved, being built, waiting for answers, shipped, or retro'd. A reader has to go to
  GitHub and piece it together from an issue and three pull requests.
- **No links.** "PRD #347" is plain text, though it is the number of a GitHub issue. The phase-0 PR
  (where a person approves the spec), the feature PR and the retro PR are nowhere on the page.
- **No outbox, no retro.** The decisions the agents took while building, and the retro written when
  the PRD merged, live only on GitHub branches.
- **Nothing stores any of it.** The dossier knows its PRD number and its repository (`home_repo`),
  never an issue, a pull request, a stage, an outbox or a retro. `omni dossier push` sends only the
  spec, the plan and the before/after, and runs before the pull requests exist. The galaxy app holds
  the Omni Loop GitHub App's key (for sign-up, PRD 359) but never reads a repository with it.

## Solution

### 1. The galaxy app reads the PRD's GitHub state

A new server-only reader, `apps/galaxy/src/dossier/github/`, is the only code in the app that reads
a repository. For a numbered dossier (`prd` not null), given its `home_repo` and `prd`:

1. **Token.** It finds the App's installation on `home_repo` (`GET /repos/{owner}/{repo}/installation`,
   signed with the App JWT that `src/signup/github-app.ts` already makes), then creates an
   installation access token (`POST /app/installations/{id}/access_tokens`). The token is kept in
   server memory until a minute before it expires, and never reaches the browser.
2. **Config.** It reads the repository's `.omni-loop/config` from its default branch, and takes the
   branch shapes (`branches.feature`, `branches.phase0`, `branches.retro`) and the delivery path
   (`paths.delivery`) from it. No branch name or path is written in the app.
3. **Folder.** It finds the PRD's folder, `<nnnn>-<topic>`, under the delivery path's `inbox` or
   `shipped` on the default branch, or under `inbox` on the feature branch; `<topic>` fills the
   branch shapes.
4. **Issue and pull requests.** It reads issue `#prd` (open or closed), and the most recent pull
   request whose head is each of the phase-0, feature and retro branches (open or merged; a closed,
   unmerged one counts as absent).
5. **Slices.** It counts the sub-PRs merged into the feature branch (pull requests whose base is the
   feature branch, merged).
6. **Outbox.** While the PRD is not shipped, the open items and `settled.md` of
   `<delivery>/outbox/<folder>/` on the feature branch; once shipped, `<delivery>/shipped/<folder>/outbox/`
   on the default branch. Items are parsed with the kit's own reader (`kit/lib/outbox/outbox.mjs`,
   `parseOutboxItem`; settled entries by their `omni-outbox-settled` marker), as `home/scores.ts`
   already imports `kit/lib`.
7. **Retro.** `retro.md` in the shipped folder, from the retro branch while its pull request is
   open, from the default branch once merged.
8. **The outbox comment.** The feature PR's comment the loop posts with the outbox (found by its
   marker, `markers.prefix`), for its link.

Each read succeeds or fails on its own; a branch or file that does not exist is an answer ("none
yet"), not a failure. The whole answer, the **GitHub summary**, is cached in server memory for
**60 seconds** per dossier.

### 2. The stage, worked out

A pure function, `stage.ts`, takes the dossier and the GitHub summary and gives the stage and the
next action:

| Stage | When | Next action |
|---|---|---|
| idea | the dossier is a draft (no PRD number) | none; the caption reads "Brainstorm in progress" |
| PRD | the issue exists and the phase-0 PR is not merged | **Approve spec** → the phase-0 PR (when none is open yet: no button, "Spec being written") |
| inbox | the phase-0 PR is merged and no sub-PR is merged into the feature branch | **Build it** → copies `/omni:yolo <n>` |
| outbox | a sub-PR is merged into the feature branch and the feature PR is not merged | open outbox items → **Answer the outbox** (the outbox comment, else the feature PR); none open and the feature PR ready → **Review & merge** (the feature PR); otherwise no button, "Being built · <merged>/<total> slices" |
| shipped | the feature PR is merged and there is no retro PR | none; "Shipped · the retro is written next" |
| retro | a retro PR exists (open or merged) | **Read the retro** → the retro PR |

The rows are tried from the bottom up: the latest stage whose condition holds wins. When the GitHub
summary could not be read at all, the stage is **unknown**, and nothing is guessed. The total of
slices is the plan's slice count (`plan.md`'s table, as the dossier's latest plan version holds it).

### 3. The header

Above the tabs, `StageHeader.tsx`, rendered on the server:

- **The title line:** "PRD #n" as a link to `https://github.com/<home_repo>/issues/<n>` whenever
  the dossier is numbered (no GitHub call needed), then the title. A draft shows DRAFT, as today.
- **The track:** idea ─ PRD ─ inbox ─ outbox ─ shipped ─ retro. Stages passed carry a ✓, the
  current one is lit and named in words ("Stage: outbox"), the rest are dim. Unknown: no stage lit,
  and "Stage unknown: GitHub did not answer."
- **The next action:** one button, as in the table. **Build it** copies the command to the
  clipboard and says "Copied"; the others are links that open GitHub.
- **The links line:** issue #n · phase-0 #p · feature #f · retro #r, each present only when it
  exists, each marked merged (✓) or open.

The repository chips, "opened by …", Copy link and Delete draft stay as they are, below the header.

### 4. The Outbox and Retro tabs

The tabs read **Questions · Before/after · Spec · Plan · Outbox · Retro**. The default tab stays
PRD 384's rule.

- **Outbox** (`OutboxPane.tsx`). Badge: "<k> open" when any item is open, else "<k> settled", else
  none. On top, **Answer on the PR** (the outbox comment) when an item is open. Then the open
  items, highest rank first: rank, the question in plain words, the options and the recommendation.
  Then the settled items, in the order `settled.md` holds them: the item's title, its verdict, and
  the answer as it was given. Empty: "No decision yet: the outbox fills while the PRD is built."
- **Retro** (`RetroPane.tsx`). Badge: "open PR" or "merged". On top, **Open the retro PR**. Then
  `retro.md`, rendered with the dossier's markdown renderer (`src/dossier/markdown.ts`). Empty:
  "The retro is written when the feature PR merges."
- An empty Outbox or Retro tab stays in the bar, dimmed, so the journey reads left to right.
- GitHub unreadable: both tabs say "GitHub did not answer. The page tries again within a minute."

### 5. Staying current

PRD 384's 2-second change check (`live.ts`, `signature`) also covers the stage and the number of
open outbox items. The page re-renders when either changes; since the GitHub summary is cached for
60 seconds, a change on GitHub shows within about a minute, and the 2-second check never calls
GitHub itself.

### 6. Demo mode

With no database (demo mode), the page shows a built-in sample summary (a PRD in the outbox stage,
with open and settled items and no retro), and makes no GitHub call.

## Decisions

- **The galaxy app reads GitHub** (chosen over the GitHub App writing to Supabase, and over the kit
  pushing the stage): one source of truth, every workspace whose repository has the App, and it sees
  what people do on GitHub (merging the phase-0 or feature PR), which no kit push can.
- **The installation is found by repository**, not from `workspaces.github_installation_id`, so a
  workspace made before PRD 359 (Vertuoza) works too.
- **Nothing is stored.** A 60-second in-memory cache per dossier; no migration.
- **Header: the track and one action**, chosen over a stage chip, a linked track or a sidebar.
- **Outbox and Retro are read-only,** with a link to act on GitHub. Answering the outbox stays on
  the feature PR.
- **The config is read from the repository,** so branch names and paths follow each repository's
  own `.omni-loop` config.

## User stories

1. As anyone following a PRD, I see its stage at a glance, in words, not only in colour.
2. As the person who approves specs, I click **Approve spec** and land on the phase-0 PR.
3. As the person answering the outbox, I see the open decisions on the page and click **Answer the
   outbox** to reply on the feature PR.
4. As a reviewer, I click **Review & merge** once the feature PR is ready and nothing is open.
5. As anyone, I click "PRD #n" to open its issue, and read the retro on the page once it exists.

## Scope

**In:** the server-only GitHub reader and its 60-second cache; the stage and next-action rules; the
header (title link, track, action, links); the Outbox and Retro tabs; the stage and open-outbox count
in the 2-second signature; demo mode's sample.

**Out:** answering the outbox or approving the phase-0 PR from the page; storing anything in
Supabase; any change to the kit, `omni dossier push`, the GitHub App or the game; the `/prd` history
list; showing sub-PRs one by one.

## Test seams

Following `omni kb show testing`: Vitest, beside the code, no call to GitHub or Supabase.

- **`stage.ts`, pure:** each row of the stage table and its next action; the bottom-up order (a
  merged feature PR with a retro PR is retro); a PRD with no phase-0 PR yet; outbox with open items,
  with none and the feature PR ready, with none and a draft PR; unknown when the summary is missing.
- **The reader, against a stubbed `fetch`:** installation found by repository and token created;
  the token reused until it nears expiry; the config's branch shapes used for each lookup; each pull
  request found by head branch (open, merged, closed-unmerged as absent); sub-PRs counted; the outbox
  read from the feature branch before shipping and the shipped folder after; the retro read from its
  branch, then from the default branch once merged; one read failing while the others answer; the
  App not installed (installation 404) as unknown; the 60-second cache (no call on a second read
  within it).
- **Rendering** (`renderToStaticMarkup`): the header in each stage, with its button and links; the
  stage written in words; unknown; the Outbox tab with open and settled items and empty; the Retro
  tab rendered and empty; the six tabs in order, empty ones dimmed.
- **The route** (`page.test.ts`, fake Supabase, stubbed reader): a signed-out visitor triggers no
  GitHub read; a draft triggers none; demo mode triggers none.
- **The signature:** it changes with the stage and with the open outbox count, and not otherwise.

## Risks

Following `omni kb show releasing`: no migration and no kit file, so a merge publishes only the
galaxy app when it deploys. Rollback is reverting the merge.

- **GitHub load:** at most one read of about 8 calls per open dossier per minute, against 5,000 an
  hour per installation.
- **Secrets:** the page uses the App's existing `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`, already
  set on galaxy for sign-up. An installation token lives only in server memory.
- **Access:** the reader runs only for a signed-in member of the dossier's workspace, and only for
  the dossier's own `home_repo`. It exposes the PRD's outbox and retro to every member of the
  workspace, as the dossier already exposes its spec and plan.
- **Private repositories:** links go to github.com; a reader without access there gets GitHub's own
  404, as the knowledge page's issue links already do.
- **A repository without the App:** its dossiers show "Stage unknown" and empty Outbox and Retro;
  everything PRD 384 shows still works.

## Acceptance criteria

1. On a numbered dossier, "PRD #n" links to `https://github.com/<home_repo>/issues/<n>`; a draft
   shows DRAFT with no link.
2. The header shows the six stages in order, the current one lit and named in words, with each of
   the six stage rules and next actions of part 2 (checked with stubbed GitHub answers).
3. In the PRD stage with a phase-0 PR open, **Approve spec** links to that pull request.
4. In the inbox stage, **Build it** copies `/omni:yolo <n>` and says "Copied".
5. In the outbox stage with an open item, **Answer the outbox** links to the feature PR's outbox
   comment; with none open and the feature PR ready, **Review & merge** links to the feature PR.
6. In the retro stage, **Read the retro** links to the retro PR.
7. The links line lists only the issue and pull requests that exist, each marked merged or open.
8. The tabs read Questions, Before/after, Spec, Plan, Outbox, Retro; an empty Outbox or Retro tab is
   dimmed and says why it is empty.
9. The Outbox tab lists the open items (rank, question, options, recommendation), then the settled
   ones (title, verdict, answer), read from the feature branch before shipping and from the shipped
   folder after.
10. The Retro tab renders `retro.md`, from the retro branch while its pull request is open and from
    the default branch once merged.
11. When GitHub cannot be read, the page still renders everything PRD 384 shows, the header reads
    "Stage unknown: GitHub did not answer." and nothing else is guessed.
12. Two renders of the same dossier within 60 seconds make GitHub calls only once.
13. A change of stage or of open outbox items on GitHub shows on an open page within about a minute,
    with no reload.
14. A signed-out visitor, a draft and demo mode make no GitHub call.
15. PRD 384's dossier on the preview shows the retro stage and links to its retro PR (manual check).
