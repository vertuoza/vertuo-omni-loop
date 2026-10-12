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

<!-- omni-outbox-settled: s2-01-threads-by-graphql -->

## s2-01-threads-by-graphql — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-threads-by-graphql
prd: 1665
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The plan said the page reads a change's review the plain way, but that way cannot tell whether a review conversation was closed, nor which changes close an issue. How should the page learn those two facts?

## The decision, in plain words

The page asks those two facts the one other way the code host offers, from the server, under the same budget, while everything else stays the plain way. The kit still never needs the host's own tools.

## The intro, for fun

Two questions the front desk cannot answer, so the page walks to the back office.

## The punchline, for fun

Same badge, same budget, and the kit never leaves the lobby.

## The options, in plain words

A. A. Read threads and closing changes by GraphQL from the server, the rest by REST (built).
B. B. Read everything by REST and answer every thread as unresolved, with no closing changes.
C. C. Read the whole review by GraphQL, one call per change.

## What I had to decide

Whether apps/galaxy/src/loop/github.ts may read review threads (isResolved, the thread's node id that care reply's addPullRequestReviewThreadReply names) and an issue's closedByPullRequestsReferences through GitHub GraphQL, when the spec says review state is read by REST. REST has neither field.

## What I did meanwhile

Built both as POST /graphql through @omni/github's client (resource 'graphql', budgeted, never stored, so no ETag); checks (check runs and commit statuses on the head) and mergeable stay REST with ETags. Threads page 100 at a time, at most 10 pages; GraphQL errors answered with a 200 throw and the route answers 500.

## What it costs to change later

Swapping the two reads for another source is a change inside github.ts and its tests; the contract does not move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A board read of one change now spends GraphQL budget on every call, since GraphQL answers are never served from an ETag; the spec's acceptance 6 (304s on a repeated read) holds for the REST calls only.
- (author) Whether the GitHub App's installation token is granted GraphQL for review threads in every workspace was not checked against a live install.

```

<!-- /omni-outbox-settled: s2-01-threads-by-graphql -->

<!-- omni-outbox-settled: s2-02-issue-shape-additions -->

## s2-02-issue-shape-additions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-issue-shape-additions
prd: 1665
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The kit's watch over a feature finds its linked bugs by reading each bug's text, but the planned answer for a list of issues carried no text. Should the page send it?

## The decision, in plain words

Each issue in a list now carries its text, and a list may ask for closed issues as well as open or all. What closes an issue names only changes in the same repository, and a review conversation's comments carry no link.

## The intro, for fun

A list of bugs with no words in it is a very short story.

## The punchline, for fun

So each bug brings its text along, and nobody has to knock twice.

## The options, in plain words

A. A. Keep the four as built.
B. B. Keep the spec's shapes exactly, and let care read bug bodies one issue at a time.
C. C. Add each closing change's repository, and each thread comment's link, to the contract now.

## What I had to decide

Four contract choices the spec left open: IssueSchema gains body (care's linkedBugs filters by linksPrd(issue.body)); the issues query accepts state=closed beside all and open; closedBy keeps only pull requests of the same repository, since the contract names them by number alone; ThreadSchema's comments are {author, body, createdAt} as the spec writes them, without the url and avatarUrl care's CareComment reads today.

## What I did meanwhile

Built the four in apps/galaxy/src/loop/loop.contract.ts and its fixtures; s4 builds care's thread url from the change's url or leaves it null.

## What it costs to change later

Each is a field in the contract and the fixtures, changed before the kit's adapter reads them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a bug-record pull request can live in another repository than its issue; if so, closedBy needs the repository too.

```

<!-- /omni-outbox-settled: s2-02-issue-shape-additions -->

<!-- omni-outbox-settled: s2-03-shared-fixtures-home -->

## s2-03-shared-fixtures-home — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-shared-fixtures-home
prd: 1665
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The page and the kit must agree on sample answers, but the kit may not borrow the page's code. Where should the one set of samples live?

## The decision, in plain words

The samples sit in one plain data file beside the page's shapes. The page checks every sample against its shapes, and the kit's own test will read the same file by its path, which borrows no code.

## The intro, for fun

One recipe card, two kitchens, and only one is allowed to cook from the other's pantry.

## The punchline, for fun

So the card is pinned on the wall where both can read it.

## The options, in plain words

A. A. Keep the samples beside the page's shapes, read by the kit's test by path (built).
B. B. Move them beside the kit's reader in landing 2, read by the page's test by path.
C. C. Keep two copies, one per side, held equal by a check.

## What I had to decide

Where the contract's shared fixtures live: apps/galaxy/src/loop/fixtures/contract.json (built, inside this slice's territory), read by s3's kit adapter test through fs, which ADR-0058's import rules do not cover; or under kit/lib/loop-reads/ in landing 2, with the galaxy reading it there.

## What I did meanwhile

Wrote apps/galaxy/src/loop/fixtures/contract.json with one example per answer (changes, change with review, comments, issues, issue, refusal) and apps/galaxy/src/loop/loop.contract.test.ts, which parses each unchanged and checks every check state appears.

## What it costs to change later

A file move and two paths, in either landing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a kit test reading a file under apps/galaxy by path is welcome, given the kit ships to other repositories; it is a test, not shipped code.

```

<!-- /omni-outbox-settled: s2-03-shared-fixtures-home -->
