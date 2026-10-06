---
title: Landings
description: One PRD, several ordered pull requests into the default branch — so a database migration ships alone, before the code that reads it.
---

A PRD normally reaches your default branch in one pull request: the feature PR. That is wrong when
part of the change must be **deployed apart** from the rest. The usual case is a database migration:
if the migrations run in their own deployment job before the service, a migration must work without
the code that will use it, and the code must be able to roll back while the schema stays. So the
migration ships in its own pull request, merged and deployed first, and the code follows.

A **landing** says exactly that. A PRD can be delivered in several landings: each landing is one
branch with its own pull request into the default branch, stacked on the landing before it. Inside
a landing nothing changes (slices, sub-PRs, waves, territories, the preflight). The loop builds the
landings in order, and a person merges them in order.

A PRD with no landings has one, and is built exactly as before. Nothing on this page applies to it.

## The worked example: add a column, then read it

A PRD adds a `total` column to quotes and shows it on the quote screen. It lands in three steps:

| landing | what it holds | merge it when |
|---|---|---|
| 1 `expand` | the migration that adds the nullable column | — |
| 2 `code` | the code that writes and reads `total`, the screen | landing 1 is deployed |
| 3 `contract` | the migration that makes the column `not null` | landing 2 is deployed |

The plan says so in two places. The slice table gains a `landing` column, and a `## Landings` table
follows it, naming each landing and what must be true before it is merged:

```markdown file=plan.md
## Slices

| id | slice | territory | blocked by | wave | landing |
| --- | --- | --- | --- | --- | --- |
| s1 | the column exists | `kernel-migrations/database/migrations/` | — | 1 | 1 |
| s2 | a quote's total is stored | `src/Quote/` | — | 1 | 2 |
| s3 | the screen shows the total | `src/Ui/Quote/` | s2 | 2 | 2 |
| s4 | the column is required | `kernel-migrations/database/migrations/` | — | 1 | 3 |

## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | expand | — |
| 2 | code | landing 1 is deployed |
| 3 | contract | landing 2 is deployed |
```

## The rules `omni plan check` holds

- **Landing numbers run from 1 with no gap.** A plan using landings 1 and 3 is refused, naming
  landing 2.
- **Waves are counted within a landing.** A slice's wave is 1 with no blockers, else one more than
  its highest blocker's, and every blocker is in the same landing. s3 above is wave 2 of landing 2.
- **No blocker crosses a landing.** A landing waits for the one before it by its order alone; a
  `blocked by` naming a slice of another landing is refused.
- **Territories collide only within a landing.** s1 and s4 share the migrations directory, but they
  never run side by side, so it is no collision.
- **The `## Landings` table names exactly the landings the slices use.** Without the table, each
  landing is named `landing-<n>`, with no merge condition. A name is kebab-case: it goes into the
  branch and the title.

`omni plan check <n>` prints one line per landing, with its name, its waves and its slices.

## Paths that land alone

Landings are the mechanism; a repository decides whether to impose the cut. In its
`.omni-loop/config.yml`:

```yaml file=.omni-loop/config.yml
landings:
  alone:
    - '^kernel-migrations/database/migrations/'
    - '/db/migrations/'
```

`landings.alone` is a list of regular expressions over repository paths, empty by default. When it
holds any, `omni plan check` refuses:

- a slice whose territory touches a path one pattern matches **and** anything else, naming the
  slice, its landing and the other path;
- a landing holding such a slice **and** a slice that touches none, naming both.

So a migration always travels in a landing of its own, holding only migrations. A PRD whose every
slice lands alone needs no split: one landing passes. A repository with no pattern sees no new
refusal. The finer cut (one expand landing, one landing per large backfill, one contract landing)
is advice in the repository's releasing form (`omni kb show releasing`), not a check.

## Branches and pull requests

When the plan is green, `/omni:plan` reads the chain with `omni plan landings <n> --json` and opens
it:

- **One branch per landing**, from `branches.landing` (default
  `feat/{topic}-{landing}of{landings}-{name}`): landing 1 cut from the default branch, landing n from
  landing n-1's branch. The example gives `feat/quote-total-1of3-expand`, then `…-2of3-code`, then
  `…-3of3-contract`.
- **One draft pull request per landing**: landing 1 into the default branch, landing n into landing
  n-1's branch, so each diff shows only its own landing. Each title ends with ` (n/N)`.
- **Each body** lists its own slices, then a `## Landings` overview of every landing PR with its
  state and merge condition, and, from landing 2 on, the line *Merge after landing n-1 (name) is
  deployed.*

The merge and the deployment are two moments. The loop gates on the merge, because GitHub can tell
it; the body carries the deployment reminder, because only a person knows when the deploy ran. For
a contract migration that gap is the whole point.

## Building: `/omni:yolo`

`/omni:yolo` builds the **current landing** (the first whose slices are not all merged; `omni board
<n>` names it) through its waves, finishes it, runs the outbox gate on its branch, then moves on to
the next landing **without waiting** for anyone to merge the first: landing 2 is built on landing
1's branch, so its code and its tests run against the new schema.

**The ready rule.** Landing n's PR is marked ready only when every slice of landing n is merged into
its branch, its gate and its CI are green, and landing n-1's PR is **merged**, checked on GitHub. A
landing finished while the one before it is still open stays in draft, its status comment says
which merge it waits for, and a later run marks it ready. `omni ship`, which moves the PRD's folder
to the shipped folder, runs once, on the last landing.

While you wait, `omni board <n>` shows each landing's PR as draft, ready or merged, and
`omni status` lists your PRD's landings with the merge each waits for.

## After a merge: `/omni:pr-care`

When landing n merges, `/omni:pr-care` keeps the stack straight: it checks that GitHub retargeted
landing n+1's PR onto the default branch (GitHub does so only when the merged branch was deleted)
and retargets it otherwise, rebases landing n+1's branch onto the default branch past landing n's
own commits, pushes, and does the same down the chain. A rebase conflict stops the chain at that
landing and is reported, never resolved blindly.

## Opening the PRs through your repository's skill

Your repository may already have a skill that opens its pull requests the way the team likes them
(a template, a title format, an advisory review). Name it in the config:

```yaml file=.omni-loop/config.yml
pr:
  openWith: /create-pr
```

With `pr.openWith` set (it is `null` by default), every pull request into the default branch or a
landing branch is opened by that skill, called as
`/create-pr --base <branch> --draft --non-interactive --prd <owner/repo>#<n>`, plus `--landing <n>/<N>`
for a PRD of several landings and `--issue #<n>` when there is one. The skill prints the pull
request's URL as its last line; the loop then adds its own lines (the link line, the slices, the
landings overview) above what the skill wrote. Sub-PRs never use it.

## Several repositories

Landings work in a plan repository too ([Several repositories](/docs/several-repositories)). A
landing may span targets, and each target gets **its own chain**: only the landings with a slice
there, numbered within it. If landing 1 holds the back-end's migration and landing 2 the back-end's
code and the front-end's screen, the back-end gets two stacked PRs, `(1/2)` and `(2/2)`, and the
front-end gets a single PR with no suffix. A target's landing PR is marked ready once the previous
landing **in that target** is merged; one target never waits on another's. Each target's own
`pr.openWith` opens its PRs, in its clone.

## The three config keys

| key | default | what it does |
|---|---|---|
| `landings.alone` | `[]` | regular expressions over paths that must land alone; the back-end lists its migrations directories |
| `branches.landing` | `feat/{topic}-{landing}of{landings}-{name}` | the branch of each landing of a PRD of more than one |
| `pr.openWith` | `null` | the skill that opens pull requests into the default branch; the back-end names `/create-pr` |

[Next → Repository flow](/docs/flow)
