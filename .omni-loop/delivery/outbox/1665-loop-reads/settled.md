# Settled outbox items — PRD 1665

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-contract-home -->

## s1-01-contract-home — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-contract-home
prd: 1665
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The shapes the Omni page answers for the loop's reads now live with the page, while the kit, which cannot read the page's code, will need the same shapes. Where should the one copy live?

## The decision, in plain words

I kept the shapes with the page for now, so the page could be built and tested alone, and left moving them next to the kit's reader for the slices that share them.

## The intro, for fun

Two programs, one handshake, and only one of them holds the rulebook.

## The punchline, for fun

For now the page writes the rules, and the kit learns them by heart.

## The options, in plain words

A. Keep the shapes with the page for this slice, and move them next to the kit's reader in the slice that shares them.
B. Move them next to the kit's reader now, before the kit's reader is written.
C. Keep two copies, held equal by shared sample answers.

## What I had to decide

Whether the loop contract's zod shapes stay in apps/galaxy/src/loop/loop.contract.ts, or move to kit/lib/loop-reads/ with the galaxy re-exporting them, as the product links' contract already does (kit/lib/product/targets.ts).

## What I did meanwhile

Wrote apps/galaxy/src/loop/loop.contract.ts with Change, ChangeDetail, the list query and the refusal shape. The kit may not import apps/galaxy (ADR-0058), so s2's shared fixtures or s3's adapter will have to hold a copy or move the shapes into kit/lib/loop-reads/.

## What it costs to change later

A file move and a re-export: the routes and their tests keep their imports through loop.contract.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The list's `state` defaults to `open` when the kit names none, as `gh pr list` does; the spec does not say. (author)

```

<!-- /omni-outbox-settled: s1-01-contract-home -->

<!-- omni-outbox-settled: s1-02-call-sites-list -->

## s1-02-call-sites-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-call-sites-list
prd: 1665
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The page keeps a list of every place it calls GitHub, and the new reader is one more. Adding it meant changing a test outside this slice's ground: is that fine?

## The decision, in plain words

I added the new reader to the list, as a reader that goes through the shared, budget-aware client, so the guard still sees every call to GitHub.

## The intro, for fun

Every door to GitHub has a name on the guest list.

## The punchline, for fun

The new door signed in at the front desk, one line, no forged badge.

## The options, in plain words

A. Keep the one-line entry: the guard lists the new reader beside the others.
B. Route the reader through an existing listed reader instead, so the list does not change.

## What I had to decide

Whether a one-line entry in apps/galaxy/src/github-call-sites.test.ts, outside s1's territory, is the right way to let apps/galaxy/src/loop/github.ts call GitHub.

## What I did meanwhile

Listed 'apps/galaxy/src/loop/github.ts' as a 'client' site; the test also proves it reaches @omni/github.

## What it costs to change later

Removing one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person keeps that list by hand on purpose, so an agent should not add to it. (author)

```

<!-- /omni-outbox-settled: s1-02-call-sites-list -->

<!-- omni-outbox-settled: s1-03-missing-change-404 -->

## s1-03-missing-change-404 — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-missing-change-404
prd: 1665
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

When the kit asks for a change the repository does not have, the page answers not found, which the kit also reads as a page that cannot read the loop yet: how should the kit tell the two apart?

## The decision, in plain words

The page answers 'not found' with its own words, naming the change and the repository, so the kit can tell it from a page that has no such reads at all.

## The intro, for fun

Two kinds of nobody home: the house is empty, or there is no house.

## The punchline, for fun

The page leaves a note on the door saying which one it is.

## The options, in plain words

A. Answer 404 with the plain words naming the change; the kit tells it from a missing route by the words.
B. Answer 200 with no change, and let the kit say nothing was found.
C. Answer another status for a missing change, kept apart from a missing route.

## What I had to decide

What GET /api/loop/changes/<n> answers for a number with no pull request: 404 `{error: 'No change <n> in <repo>.'}` (built), or another status, given the spec maps a bare 404 to `refused (404): this Omni page cannot read the loop yet`.

## What I did meanwhile

Answered 404 with the plain words 'No change <n> in <repo>.'; a page without the routes answers Next's own 404, without a JSON `error`. s3's adapter can print the `error` when one is there and the spec's line otherwise.

## What it costs to change later

A constant in the controller and one test, before the kit reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3 already plans to read the error words on a 404. (author)

```

<!-- /omni-outbox-settled: s1-03-missing-change-404 -->
