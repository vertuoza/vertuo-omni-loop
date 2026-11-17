---
prd: 3015
title: A new rule's id is never taken twice
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge, gate]
---

## Problem

Two PRDs built at the same time can each add a new knowledge rule under the same id. Nothing sees it
until both reach the default branch, where it shows as a merge conflict in a `rules.md`; someone then
renumbers one rule and its ledger's `Became:` line by hand.

Two writers pick a new id today, and each looks at only part of what is taken:

- **The knowledge harvest** (`apps/omni-app/src/knowledge-harvest/`, run by the Omni App after a
  feature PR merges) numbers one past the highest id of the default branch and of every open
  **knowledge** pull request (`takenElsewhere()` in `github.ts`, which keeps only heads matching
  `branches.knowledge`). An open feature PR that adds a rule is not looked at.
- **`/omni:yolo-fix`** writes a rule on the feature branch itself when a person's answer states
  something true about the product (**Write back what was just settled**). The agent picks the id by
  reading its own branch: neither the default branch since it branched nor any other pull request.

So a harvest's knowledge PR and another PRD's feature PR can both take `BR-<DOMAIN>-<n>`, as can two
feature PRs. `omni check knowledge` refuses an id written twice in one tree (`check-knowledge.ts`,
"an id is never reused"), but each branch on its own holds it once, so both stay green.

## Solution

### 1. `omni kb next-id <prefix>`

A new verb prints the next free id of a register prefix, one past the highest number in use in:

- the working tree;
- `<repo.remote>/<repo.defaultBranch>`, as last fetched;
- the head of every open pull request into the default branch, whatever its branch, read through
  `gh` (the knowledge folder of each head, nothing else).

`<prefix>` is an id without its number, as `idParts()` splits it (`BR-PIPELINE`, `N-PRODUCT`,
`P-GATE`); a prefix that is not one is a usage error (exit 2). It prints the id alone on one line
(`BR-PIPELINE-48`), exit 0. With `--json` it prints `{ id, past: [{ where, id }] }`, `where` being
`tree`, `base` or `#<pr>`, naming each place that held the highest number it numbered past.

When the pull requests cannot be read (`gh` missing, not signed in, no network), it numbers past the
tree and the base only, prints the id, and writes one line on stderr:
`open pull requests not read: <why>; the id may still be taken by one`. Exit 0: it never blocks.
When the base cannot be read either, it says so on the same stderr line and numbers past the tree.

The numbering is one function, `nextFreeId(prefix, idSets)` in a new `kit/lib/knowledge/next-id.ts`,
pure: given the ids each place holds, it returns the next one. Reading the places is a thin layer
around it.

### 2. `/omni:yolo-fix` takes its id from it

**Write back what was just settled** gains one sentence: a new rule, invariant or principle takes the
id `omni kb next-id <prefix>` prints, never one read off the branch. An amended entry keeps its id,
as today.

### 3. The harvest numbers past every open pull request

`takenElsewhere()` reads the knowledge folder of every open pull request into the default branch,
not only the knowledge branches, still leaving out the run's own branch. The ids and record numbers it
returns feed `writeKnowledge`'s `taken` as today: no change to the writer.

### 4. `omni check knowledge` refuses an id the base gave to another entry

`omni check knowledge` takes `--base <ref>` like the other guards (default
`<repo.remote>/<repo.defaultBranch>`). An id is **new on this branch** when the tree holds it and the
merge base of the base and HEAD does not. For each id new on this branch that the base, as it is now,
also holds with a different statement, it refuses:

```
<file>: <id> is taken on <base> by another entry ("<the base's statement, first 80 characters>").
Renumber this one to <next free id>, and its ledger's Became: line with it.
```

The next free id is the one `nextFreeId` gives from the tree and the base. An entry the branch
amended was already there at the merge base, so it is never new and keeps its id. The same id with the
same statement on both sides is one entry that reached both, never a clash. The base is read **as it
is now**, not at the merge base: what matters is what the branch will meet when it merges. When the base cannot be read, the check prints `ids not compared — no <base>` and grades
the rest as today (the same as `omni check design` with no base, ADR-0004).

`omni check all` passes its base to it, so the check runs wherever `check all` already runs.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | cli | `omni kb next-id` | no written convention: follows the `omni kb <verb>` verbs in `kit/bin/commands/kb.ts:753` |
| vertuo-omni-loop | cli | `nextFreeId` | no written convention: follows `next` in `kit/lib/playbook/decisions.ts:181` |
| vertuo-omni-loop | cli | `kit/lib/knowledge/next-id.ts` | no written convention: follows `kit/lib/knowledge/` one module per concern |

## Decisions

- **One numbering function for every writer.** `nextFreeId` is pure; the CLI verb and the check call
  it. The App's harvest keeps its own `writeKnowledge` numbering (it already takes `taken`), widened
  in what it reads.
- **The check compares with the base as it is now.** A merge base would miss the id another PR took
  after this branch was cut, which is the case this PRD exists for.
- **The open-PR read never blocks.** `next-id` is advice taken before writing; the base check is the
  guard. A race between two agents asking at once is caught by the base check when the first merges.
- **No open-PR read in `omni check knowledge`.** It stays offline: CI and hooks run it everywhere.
- **The voice's objection** (persona:B-E DEv): "a third way to get a number, and two agents asking at
  once still race; I'd rather the check told me the clash at merge time." Settled `none`: the person
  approved the design as shown; the base check (section 4) is the merge-time guard it asks for.

## User stories

- As whoever runs two PRDs at once, I never meet a merge conflict between two rules that took the same
  id.
- As an agent settling a person's answer, I get a free id from one command instead of guessing it.
- As a reviewer, a branch whose new rule took an id the default branch already gave away is red, with
  the id to renumber it to.

## Scope

In: the `next-id` verb, its help entry, the yolo-fix sentence, the harvest's wider read, the
`check knowledge` base comparison and `check all` passing its base.

Out: ADR record numbers in `omni check knowledge` (the decisions form already names the next free
number); reserving an id on the server; renumbering an existing clash automatically.

## Test seams

Unit tests in vitest, as `omni kb show testing` says: `nextFreeId` over id sets; the verb through
`main()` with a fake `exec` answering `gh` and `git`; the base comparison through `main()` on a
`makeRepo({ git: true })` repository with an `origin/main` ref; `takenElsewhere()` against the fake
Octokit its tests already use. No test calls GitHub.

## Risks

- Merging publishes a new CLI verb and a stricter `omni check knowledge`: a branch that today passes
  with an id the default branch gave to another entry turns red. Rolled back by reverting the
  feature PR; the release workflow cuts the next version.
- The harvest reads more pull requests (every open one into the default branch): one more snapshot
  per open PR on each harvest run. A repository with many open PRs takes longer; the reads stay inside
  the knowledge folder.
- The Legal entries: none touched.
- N-PRODUCT-15: an agent merging into the main branch would ship unreviewed work to every user;
  nothing here merges. Changing it needs @pierrederval or @dervalp to approve the pull request on
  GitHub.
- The business laws:
  - BL-GATE-1 (a check that ends without deciding says "not judged", with the reason, never a pass):
    kept. With no base, the id comparison prints `ids not compared — no <base>` instead of passing it,
    and `next-id` says on stderr when the open pull requests were not read.
  - BL-PRODUCTKNOWLEDGE-4 (a merge that changes knowledge reaches its product on its own): kept; the
    ids change nothing in how knowledge is synced.
  - BL-APPROVALS-1, BL-ASK-1, BL-PRODUCTKNOWLEDGE-1, BL-PRODUCTKNOWLEDGE-2, BL-PRODUCTKNOWLEDGE-3:
    kept, not touched; the design changes no approval, answer, Legal entry or glossary term.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: next-id numbers past an open pull request
  Given the default branch holds BR-PIPELINE-46
  And an open pull request adds BR-PIPELINE-47
  When omni kb next-id BR-PIPELINE runs
  Then it prints BR-PIPELINE-48
```

### AC-2 · test

```gherkin
Scenario: next-id still answers when the pull requests cannot be read
  Given the default branch holds BR-PIPELINE-46
  And gh cannot list the open pull requests
  When omni kb next-id BR-PIPELINE runs
  Then it prints BR-PIPELINE-47 and exits 0
  And stderr says the open pull requests were not read
```

### AC-3 · test

```gherkin
Scenario: the check refuses an id the base gave to another entry
  Given the default branch holds BR-PIPELINE-47 "A quote is signed once"
  And this branch adds BR-PIPELINE-47 "An order backlog is counted in months"
  When omni check knowledge runs
  Then it is red, naming BR-PIPELINE-47 as taken on the default branch
  And it names BR-PIPELINE-48 as the id to renumber to
```

### AC-4 · test

```gherkin
Scenario: an amended entry keeps its id
  Given the default branch holds BR-PIPELINE-47
  And this branch rewords BR-PIPELINE-47 in place
  When omni check knowledge runs
  Then it is green
```

### AC-5 · test

```gherkin
Scenario: the harvest numbers past an open feature pull request
  Given an open feature pull request adds BR-PIPELINE-47
  When the harvest writes a new rule in the pipeline domain
  Then the rule is BR-PIPELINE-48
```

### AC-6 · test

```gherkin
Scenario: no base, no comparison
  Given the default branch cannot be read
  When omni check knowledge runs
  Then it prints that ids were not compared
  And it grades the rest as before
```
