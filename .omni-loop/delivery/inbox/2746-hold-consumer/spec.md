---
prd: 2746
title: Hold a consumer PR until its provider is served
blocked-by: none
spec: file
phase0: server
---

**Date:** 2026-11-12 · **PRD:** #2746 · **After:** PRD 1089 (the flow and its points), PRD 1118 (the
`## Fixes` record and its `Merge after` lines) · **Touches:** a new `omni hold` command
(`kit/bin/commands/hold.ts`, `kit/lib/hold/`), the points catalog (`kit/lib/flow/points.ts`), the
skills `pr`, `ultra-yolo`, `ultra-wave`, `mega-bug-fix`, `mega-pr-care`, `drive` and `mega-drive`,
`docs/guide/flow.md` and `docs/guide/several-repositories.md`.

## Problem

Work that spans several repositories lands as one pull request per repository. One of them, the
**provider**, adds what another, the **consumer**, needs: a field in a schema, an endpoint, a column.
The consumer only works once the provider is merged, and often only once the provider is deployed
where the consumer reads it.

Today the kit says the order and enforces none of it:

1. `/omni:mega-bug-fix` writes `Merge after <owner/repo>#<n>` on a consumer's fix pull request, and
   nothing reads the line: a person can mark it ready and merge it first.
2. `/omni:ultra-yolo` and `/omni:ultra-wave` know which target provides for which (the plan's
   blockers), and write no such line at all on a consumer's target pull request.
3. Merged is not served: a provider merged an hour ago may not be deployed yet, so a consumer
   merged right after it still breaks the environment it lands on.

**The evidence.** The kit-gaps review (Nov 2026), item 5: in 4 of 16 multi-repository features and
one bug fix, a consumer merged before the provider it needed, twice breaking QA. Cases are cited by
the review's item number only (Decisions).

## Solution

A pull request that declares `Merge after <owner/repo>#<n>` stays a draft until that provider pull
request is merged and, when the provider's repository declares a probe, until the probe says the
provider is served. One pinned command reads the state; every skill that would mark the consumer
ready asks it first; the drive loops ask it again each tick.

### A. `omni hold <owner/repo>#<n> [--json]`

- Reads the pull request's body through `gh` and takes every line `Merge after <owner/repo>#<n>`
  (the shape `/omni:mega-bug-fix` writes today; `<owner/repo>` may be omitted for the same
  repository). A body with no such line prints `clear · no Merge after line` and exits 0.
- For each provider, asks `gh pr view <n> --repo <owner/repo> --json state,mergedAt,mergeCommit`
  and prints one row:

  ```text
  demo-org/api#41   open                       held
  demo-org/api#41   merged · no probe          clear
  demo-org/api#41   merged · probe demo-org/api:.omni-loop/flow/served.md   probe
  demo-org/api#41   closed, not merged         fail
  demo-org/api#41   could not read: <why>      held
  ```

- **The probe.** For a merged provider, it reads the provider repository's `.omni-loop/config.yml`
  from its default branch through `gh api` (read-only: nothing of the provider is run), resolves the
  default area's hooks at the point `merge-after.served`, and names the hook file. It never runs the
  hook: the agent follows it (B).
- **The last line** is `clear` (exit 0) when every row is `clear`; `probe` (exit 0) when the only
  rows left are `probe`, listing each hook to follow; `held: <owner/repo>#<n> <why>` (exit 1) for the
  first `held` row; `fail: <owner/repo>#<n> <why>` (exit 1) for a `fail` row. `--json` prints the
  rows and the verdict as one object, for the drive loops.

### The point `merge-after.served`

Added to the catalog (`kit/lib/flow/points.ts`), declared in the **provider's** config, in its
default area:

- modes: `replace` (the probe) and `after`;
- inputs: `provider` (`<owner/repo>#<n>`), `pr` (its number), `merge-sha`, `consumer`
  (`<owner/repo>#<n>`);
- output: the verdict line `omni-hook merge-after.served: pass`, `… wait <why>` or `… fail <why>`.

What "served" means is the provider's to say, never the kit's: a schema introspection that shows the
new field, a version endpoint that reports the merge commit, a health check. A provider with no hook
needs nothing more than merged. `wait` is new to this point: it means "not yet, ask again".

### B. The skills

- **Writing the lines.** `/omni:ultra-yolo` and `/omni:ultra-wave` add one `Merge after
  <owner/repo>#<n>` line to a consumer target's pull request body for each provider target the plan
  makes it wait for (a slice blocked by a slice of another target), in the plan's order, as
  `/omni:mega-bug-fix` already does. `/omni:mega-bug-fix` keeps its lines as they are.
- **Before ready.** `/omni:pr` (its Done row), ultra-yolo's finish, `/omni:mega-bug-fix` and
  `/omni:mega-pr-care` run `omni hold` on the pull request before `gh pr ready`. On `probe` they
  follow each named hook, with its inputs filled in, and read its verdict line. They mark the pull
  request ready only when every row is `clear` or `pass`. Otherwise it stays a **draft**, and its
  status comment says `waiting for <owner/repo>#<n> to be served: <why>`.
- **The loops.** `/omni:drive` and `/omni:mega-drive` park a PRD whose pull request is held on that
  line, the way a blocked PRD is parked today, and run `omni hold` again each tick; once it is clear
  (or every probe passes), the next tick marks it ready through `/omni:pr`.

### C. What goes wrong

- `gh` cannot read a provider (no sign-in, no access, no answer) → `held: could not read …`. It is
  never counted as clear.
- A provider closed without merging → `fail`: the consumer cannot be served as planned, which is a
  person's decision. The skill raises one **high** outbox item naming both pull requests, and the
  consumer stays a draft.
- A probe that keeps answering `wait` past `limits.stallDays` → the consumer is reported stuck on its
  status comment, naming the provider and the probe's last reason. Nothing else notifies anyone.
- A hook file the provider's config names but that cannot be read → `held: the probe <path> of
  <owner/repo> cannot be read`.

### What it never does

It never merges, never marks a pull request ready while held, never runs a provider's code, never
writes outside the repository it runs in, and never notifies anyone beyond the status comment and
the outbox the loop already keeps.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | cli | `omni hold <owner/repo>#<n>` | no written convention: follows `omni bug check --product`'s `<owner/repo>#<n>` ← kit/lib/bug/fixes.ts:24 |
| vertuo-omni-loop | cli | point `merge-after.served` | `<skill>.<moment>` names ← kit/lib/flow/points.ts:27 (`wave.merge`, `bug-fix.proof`) |
| vertuo-omni-loop | cli | verdict `omni-hook merge-after.served: pass \| wait <why> \| fail <why>` | the verdict line ← docs/guide/flow.md:206 |
| vertuo-omni-loop | cli | the line `Merge after <owner/repo>#<n>` | the fix PR body ← kit/plugin/skills/mega-bug-fix/SKILL.md:159 |
| vertuo-omni-loop | cli | `kit/lib/hold/` | no written convention: follows `kit/lib/bug/` (one folder per command's logic) |

## Decisions

- **A CLI and a hook point, not an App status or a CI template.** The person chose approach 1. An
  Omni App commit status needs branch protection to block anything and cannot run a target's probe,
  so it covers merged, never served. A CI workflow template must be installed in every target and
  runs again only when the consumer is pushed, never when the provider merges. Both are out.
- **The probe lives in the provider's config.** The person chose it: the provider knows its own
  schema and environment, and every consumer gains from one probe. `omni hold` reads that config and
  the hook file from the provider's default branch through `gh`, and never runs them; the agent
  follows the hook, as with every flow hook.
- **ultra-yolo and ultra-wave write the lines** (in scope, the person's answer): without them the
  hold would fire on bug fixes only, and most cases seen were features.
- **No probe means merged is enough,** and a pull request with no `Merge after` line is never held.
- **`wait` is a verdict of this point only.** Every other point keeps `pass` and `fail`.
- **The evidence is cited by the review's item number only.** The source review is of a private
  delivery; this repository is open source, and never#11 keeps that delivery out of it. The person
  chose item numbers and anonymised shapes; the test fixtures are fictional (`demo-org`).
- **The voice.** persona:Paul - Product Manager objected: *"I want features out fast. Don't park my
  consumer PR forever on a probe nobody wrote."* Settled `accepted`: the design holds only what
  declares a `Merge after` line, and with no probe a merged provider clears it.

## User stories

- As a person merging work that spans repositories, I want the consumer's pull request to stay a
  draft until its provider is merged and served, so I cannot merge it in the wrong order.
- As the owner of a provider repository, I want to say once how to tell that my change is served,
  so every consumer waits for the right thing.
- As an agent driving a multi-repository PRD, I want one command that says whether a pull request may
  be marked ready, and why not, so I park it instead of guessing.
- As a person with a repository that has no probe, I want nothing to change beyond waiting for the
  merge.

## Scope

In: `omni hold` and its `--json`; the point `merge-after.served` with the `wait` verdict; the lines
written by `ultra-yolo` and `ultra-wave`; `omni hold` before ready in `pr`, `ultra-yolo`,
`mega-bug-fix` and `mega-pr-care`; the park and recheck in `drive` and `mega-drive`; the high item on
a provider closed unmerged; the guide pages.

Out: an Omni App commit status; a CI workflow template; running any probe on the kit's side;
deciding what "served" means for any repository; holding on anything but a `Merge after` line;
notifying anyone.

## Test seams

Following `omni kb show testing`: unit tests on pure functions, CLI tests through the command with an
injected `exec`, never a call to GitHub; fixtures fictional (`demo-org/api`, `demo-org/web`).

- `kit/lib/hold/hold.test.ts` (pure): the `Merge after` lines parsed from a body (several, the same
  repository with no `owner/repo`, none); the rows and the verdict from given provider states.
- `kit/bin/hold.test.ts`, **the test that would have caught the cases seen**: a consumer whose body
  says `Merge after demo-org/api#41` while #41 is open → `held`, exit 1. Then: #41 merged and its
  config declares no probe → `clear`, exit 0; #41 merged and its config declares `merge-after.served`
  → `probe` naming the hook file; #41 closed unmerged → `fail`, exit 1; `gh` failing → `held: could
  not read`, exit 1; a body with no line → `clear · no Merge after line`.
- `kit/lib/flow/points.test.ts`: `merge-after.served` is in the catalog with its modes and inputs;
  `omni check config` accepts a provider config declaring it and refuses a `before` hook there.
- A skill-text test that `ultra-wave` writes a `Merge after` line for a slice blocked by another
  target's slice, and that `pr`, `ultra-yolo`, `mega-bug-fix` and `mega-pr-care` run `omni hold`
  before `gh pr ready`.

## Risks

Merging publishes a new kit version. Consumer pull requests that already carry a `Merge after` line
(mega bug fixes) start being held as drafts until their providers merge; a pull request already ready
is not moved back by this change, only checked again the next time a skill would mark it ready.
Rollback: revert the feature PR and release.

- The Legal entries: none touched.
- BR-PRODUCT-5: a feature stays a draft while any question is open. If broken, a person could merge
  work whose open decisions nobody answered. Kept, and extended in spirit: a consumer also stays a
  draft while its provider is not served. Changing it needs @pierrederval or @dervalp to approve the
  pull request on GitHub.
- BR-PRODUCT-3: an agent never applies the override label itself. If broken, an agent could wave its
  own work through the gate. Kept: the hold has no override an agent can set; only a person marks a
  held pull request ready. Changing it needs @pierrederval or @dervalp to approve the pull request on
  GitHub.
- N-PRODUCT-15: only a person merges into the main branch. If broken, unreviewed work reaches every
  user. Kept: `omni hold` and the skills only keep a draft or mark ready; nothing merges. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BL-APPROVALS-1 — An approval covers exactly the files the approver read; a later change voids it. Kept: the hold reads pull request states and never changes an approved file.
- BL-ASK-1 — An answer a person gave is never changed or reworded afterwards. Kept: the hold writes only the agent's own status comment and outbox item.
- BL-GATE-1 — A check that ends without deciding says so, never a pass. Kept: a provider `gh` cannot read, or a hook file that cannot be read, is `held` with its reason, never `clear`; a probe on `wait` is not finished, never passed.

## Acceptance criteria

1. `omni hold demo-org/web#88`, whose body says `Merge after demo-org/api#41` while #41 is open,
   prints the row `demo-org/api#41 open held` and the last line `held: demo-org/api#41 …`, exit 1.
2. Once #41 is merged and demo-org/api's config declares no `merge-after.served` hook, it prints
   `clear`, exit 0.
3. Once #41 is merged and its config declares the hook, it prints `probe` naming the hook file, exit 0,
   and never runs it.
4. A provider closed without merging prints `fail`, exit 1; a provider `gh` cannot read prints
   `held: … could not read`, exit 1.
5. A body with no `Merge after` line prints `clear · no Merge after line`, exit 0.
6. `merge-after.served` is a point of the catalog (`replace`, `after`; inputs `provider`, `pr`,
   `merge-sha`, `consumer`) and its verdict may be `pass`, `wait <why>` or `fail <why>`.
7. `/omni:ultra-yolo` and `/omni:ultra-wave` write one `Merge after` line per provider target on a
   consumer target's pull request.
8. `/omni:pr`, `/omni:ultra-yolo`, `/omni:mega-bug-fix` and `/omni:mega-pr-care` run `omni hold`
   before marking a pull request ready, follow each probe it names, and leave the pull request a
   draft, with the waiting line in its status comment, unless every row is clear or passes.
9. `/omni:drive` and `/omni:mega-drive` park a held PRD on that line, run `omni hold` again each tick,
   and mark it ready once clear; a probe on `wait` past `limits.stallDays` is reported stuck; a
   provider closed unmerged raises one high outbox item.
