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

<!-- omni-outbox-settled: s3-01-gh-bridge-callers -->

## s3-01-gh-bridge-callers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-gh-bridge-callers
prd: 1665
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The board is now built from the Omni page, but three other commands build the same board and are moved by later slices. Until then, where should those three read the board from?

## The decision, in plain words

Those three keep reading the board the old way, through a small bridge, so they behave exactly as today, while the board command itself reads only the Omni page. The later slices switch the three over and delete the bridge.

## The intro, for fun

Three passengers still hold paper tickets on the day the train goes digital.

## The punchline, for fun

They board as before, and the next two stops swap their tickets.

## The options, in plain words

A. Keep the three on the gh bridge until s4 and s5 move them, as built.
B. Move the three to the Omni page now, rewriting their board fixtures in s4's and s5's test files.
C. Keep a second copy of the board builder that reads the old way, beside the new one.

## What I had to decide

Whether omni next, omni care and the status line's refresh, which call buildBoard and belong to s4 and s5, keep their gh reads through a transitional BoardReads adapter (kit/lib/loop-reads/gh-bridge.ts) until s4 and s5 hand them the Omni page's LoopReads. Building it meant small edits outside s3's territory: buildBoard is now async, so kit/bin/commands/next.ts (boardFacts, readFacts), kit/bin/commands/care.ts (waveClaims, runState, run) and kit/bin/commands/statusline.ts (refreshPrdBoard, which checks lockHeld before reading since refreshBoard takes a sync build) await it; GhPrListSchema and GhPrCommitsSchema moved from kit/bin/schema.ts (and their cases from kit/bin/schema.test.ts) into the bridge, the only reader left.

## What I did meanwhile

Built the bridge with the very gh calls the board ran (same args, same environment), mapping each pull request to a LoopChange; what gh throws holds that repository only. next.test.ts, care.test.ts and statusline.test.ts pass unchanged.

## What it costs to change later

s4 and s5 replace one ghBoardReads(...) call each with boardReads(omniLoopReads(...)); s6's guard test then deletes gh-bridge.ts and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The status line's refresh now reads the board before it takes its lock (it skips when the lock is held), so two refreshes that start in the same instant can both read; before, the second waited on the lock and read nothing.
- (author) Whether s4 and s5 would rather have had the callers moved straight to the Omni page here, with their tests, was not asked.

```

<!-- /omni-outbox-settled: s3-01-gh-bridge-callers -->

<!-- omni-outbox-settled: s3-02-contract-one-copy -->

## s3-02-contract-one-copy — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-contract-one-copy
prd: 1665
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The page and the kit must read the same answer shapes, and the kit may not borrow the page's code. Where does the one copy of those shapes live now that the kit reads them?

## The decision, in plain words

The one copy now lives with the kit's reader, and the page builds its own stricter answers from it, as the earlier decision planned. The kit tolerates extra fields so an older kit still reads a newer page.

## The intro, for fun

One rulebook, two players, and only one of them may walk into the other's house.

## The punchline, for fun

So the rulebook moved to the house both are allowed into.

## The options, in plain words

A. One copy in the kit, the page building strict answers from it, as built.
B. Two copies, one per side, held equal by the shared examples only.
C. One copy in the kit, the page re-exporting it as is, loose.

## What I had to decide

Settled item s1-01 (option A) said to move the contract next to the kit's reader in the slice that shares it. Built: kit/lib/loop-reads/contract.ts holds the fields (z.object, unknown keys dropped, so a newer page still reads), with Loop-prefixed names (LoopChangeSchema, LoopChange…) so no export name is declared twice; apps/galaxy/src/loop/loop.contract.ts, outside s3's territory, now builds its strict answer schemas from those shapes (z.strictObject, url as z.url(), the 200 caps), its own query schemas unchanged. The kit's copy drops LoopRefusal for LoopErrorSchema. Two copies held equal only by the shared examples were refused by the repository's duplication gate.

## What I did meanwhile

Both sides still parse apps/galaxy/src/loop/fixtures/contract.json (kit/lib/loop-reads/contract.test.ts reads it by path); the galaxy's loop tests and typecheck pass unchanged.

## What it costs to change later

A file's imports: the galaxy contract can go back to its own fields in one edit, the routes and their tests keep their imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The galaxy now answers with schemas whose fields come from kit/lib; a kit change to a shape changes what the page sends on its next deploy. The shared examples catch a mismatch on either side, but the order of deploys still matters (landing 1 first).
- (author) The Loop prefix on the kit's names is mine; the spec names the shapes Change, Issue and so on.

```

<!-- /omni-outbox-settled: s3-02-contract-one-copy -->

<!-- omni-outbox-settled: s3-03-read-error-lines -->

## s3-03-read-error-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-read-error-lines
prd: 1665
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The spec names six lines a read can stop on, but a few cases it does not name came up, and the board needs to know which refusals stop everything and which stop one repository only. What should those say and do?

## The decision, in plain words

A refusal that concerns one repository marks only that repository's work unreadable; no sign-in, no answer, or a page without these reads stops the whole board. Three unnamed cases got a plain line of their own, and the page's own words are printed when it gives some.

## The intro, for fun

Six warning signs were painted; the road turned out to have nine bends.

## The punchline, for fun

The extra bends got plain signs in the same paint.

## The options, in plain words

A. Keep the lines and scopes as built.
B. Print the kit token's own refusal line instead of the no sign-in line when a kit token is in use.
C. Make every refusal stop the whole board, as a missing gh did.

## What I had to decide

Lines and scopes the spec does not settle, in kit/lib/loop-reads/omni.ts: 403, 424, 429, and a 404 carrying the page's words (a missing change, settled item s1-03) hold one repository; 401, no sign-in, a timeout or no network, and a bare 404 hold everything (exit 1). The page's {error} is printed after 'refused (<status>): ' without its closing full stop; without one, the spec's words. Unnamed: no ask.url prints 'no Omni page is set here (ask.url)' (as the approval reader says); another status prints 'refused (<status>): <words, or: the Omni page answered <status>>'; an answer the contract does not read prints 'the Omni page answered outside the loop's contract (<path>)'. A kit-token exchange refused (401) prints 'no sign-in (omni signin)', not the token's own line. The reads go through a new askClient method, readLoop (kit/lib/ask/client.ts, outside s3's territory).
Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built and tested each line through the adapter with an injected fetch, and through omni board's main().

## What it costs to change later

A constant or a status set in omni.ts and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) With OMNI_TOKEN set, an expired or revoked kit token now prints the generic no sign-in line, losing the token's own clearer line.
- (author) Whether a 404 with the page's words should hold one repository or everything was judged from s1-03 alone.

```

<!-- /omni-outbox-settled: s3-03-read-error-lines -->

<!-- omni-outbox-settled: s4-01-care-state-from-loop-facts -->

## s4-01-care-state-from-loop-facts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-care-state-from-loop-facts
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The plan asked that the old GitHub question behind a pull request's care be gone, but the code that reads its answer lives outside this slice's ground. Is it fine that this slice rewrote it?

## The decision, in plain words

I rewrote that reader so it reads the Omni page's answer instead, and removed the old question. The care state says the same things, except that it no longer carries links to a check's run, a review comment or an avatar, which the page does not send.

## The intro, for fun

The old question was retired, but its answer sheet lived next door.

## The punchline, for fun

So the neighbour got a new sheet, same boxes, three fewer links.

## The options, in plain words

A. A. Read care from the page's answer in the shared reader, the links left empty (built).
B. B. Keep the reader as it was and have the two commands rebuild the old GitHub answer from the page's, leaving the old question in place.
C. C. Add the links to the page's answer first, then read them here.

## What I had to decide

kit/lib/care/state.ts and kit/lib/care/state.test.ts are outside s4's territory, yet 'CARE_QUERY is gone' (s4's done-when) means editing them: CARE_QUERY, CareResponseSchema and the GraphQL parser are removed, and careState({change, comments}, options) reads LoopChangeDetail (review.checks, review.mergeable, review.threads) and LoopComment. The rollup is drawn from the check states (red if any failure, running if any pending, green otherwise, none with no check); a failed check's url, a thread's url and a thread comment's url and avatarUrl are now always null, since the contract (settled item s2-02) carries none. The galaxy keeps its own CARE_QUERY copy (apps/galaxy/src/dossier/github/care.ts), untouched.

## What I did meanwhile

Rewrote state.ts and its tests on loop facts; next.ts and care.ts call it with reads.change and reads.comments. care state's JSON keeps every field, with null links.

## What it costs to change later

A field added to the contract (a check's or a comment's link) and one line each in state.ts to read it again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether /omni:pr-care or the Omni page leans on a failed check's link or a thread's link from care state's JSON was not checked beyond the kit's own tests.
- (author) No other slice lists kit/lib/care/, so the edit cannot collide in this landing, but the plan did not give it to s4.

```

<!-- /omni-outbox-settled: s4-01-care-state-from-loop-facts -->

<!-- omni-outbox-settled: s4-02-care-target-default-branch -->

## s4-02-care-target-default-branch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-care-target-default-branch
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the care command looks after another repository's pull request, it needs that repository's main branch name, which the Omni page does not give. Where should it read it?

## The decision, in plain words

It still asks GitHub's own tool for that one name, and only for another repository: everywhere else the care command reads the Omni page alone. A bug's closing changes are now taken from the plan's own repository, as the page names them by number only.

## The intro, for fun

The map came from the new office, all but one street name.

## The punchline, for fun

For that one, we still phone the old office.

## The options, in plain words

A. A. Keep the one default-branch read on gh, for a target only (built).
B. B. Add a repository read (its default branch) to the page's contract and use it here.
C. C. Take the target's default branch from the plan repository's config instead.

## What I had to decide

care state --repo <target> read the target's default branch with `gh repo view` (scopeOf); the contract has no repository read. Built: kept on gh, called only for a target (githubEnv is no longer computed for any other round, so a session without gh reads the plan repository's care with no gh at all). `gh repo view` is not among the reads the s6 guard refuses. Also: care list's bug records come from LoopIssueDetail.closedBy, which names closing changes of the issue's own repository only (settled item s2-02), where the gh read took each change's repository from its link.

## What I did meanwhile

Tested: a target round still reads `develop` for acme/backend; a round with github.user set runs no gh.

## What it costs to change later

A repository read in the contract and one call in care.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) In a cloud session without gh, `omni care state --repo <target>` still fails on the default branch read.
- (author) A bug record PR opened in a target repository, rather than the plan repository, is no longer listed.

```

<!-- /omni-outbox-settled: s4-02-care-target-default-branch -->

<!-- omni-outbox-settled: s4-03-next-stops-on-no-sign-in -->

## s4-03-next-stops-on-no-sign-in — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-next-stops-on-no-sign-in
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The loop's next-step command used to answer 'wait, GitHub is unreachable' on any failed read, while the spec now asks every command to print one line and stop when it cannot read at all. Which should it do?

## The decision, in plain words

When nothing can be read at all (no sign-in, no answer, a page that cannot read the loop yet), it prints that one line and stops. When only one repository is refused, it still answers 'wait' for that work, as before, and carries on.

## The intro, for fun

A traffic light that is off is not the same as a red one.

## The punchline, for fun

So the command now says the light is off, and stops waiting at it.

## The options, in plain words

A. A. Stop with the one line when nothing can be read; keep wait for one repository refused (built).
B. B. Keep answering wait for every read failure, as before, and print no line.
C. C. Stop with the line on any read failure, one repository refused included.

## What I had to decide

omni next caught every read failure into the verdict `wait: github unreachable` (exit 0). The spec's behaviour table and acceptance 3 say no sign-in, no answer and a page without the routes print one line and exit 1, for next too. Built: a LoopReadError of scope `everything` stops the whole run (stderr line, exit 1, no verdict printed); scope `repository` (403/424/429, a 404 with the page's words) keeps today's `wait: github unreachable` for that PRD, and a target refused alone stays `unreadable`. The care command does the same. s6 tells /omni:drive and the other skills to treat the line as held, not failed.

## What I did meanwhile

Tested both: a refused repository still answers wait with exit 0; each of the three whole-run lines prints alone with exit 1.

## What it costs to change later

One condition in next.ts (stopsEverything) and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Until s6 updates /omni:drive, a loop that reads exit 1 from omni next as a failure may stop instead of holding; landing 2 ships s4 and s6 together.

```

<!-- /omni-outbox-settled: s4-03-next-stops-on-no-sign-in -->

<!-- omni-outbox-settled: s4-04-replies-without-standing -->

## s4-04-replies-without-standing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-replies-without-standing
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

To tell whether the open questions were answered, the next-step command counted only replies from people allowed to change the repository, but the Omni page does not say who is allowed. Whose replies should count?

## The decision, in plain words

Every person's reply counts for this hint. It only decides that answers may be waiting; the step it then launches reads the replies again and keeps only those of people allowed to change the repository.

## The intro, for fun

The guest list went missing, so the doorman lets everyone into the lobby.

## The punchline, for fun

The real check still happens at the ballroom door.

## The options, in plain words

A. A. Count every person's reply for this hint (built).
B. B. Add the author's standing to the page's answer for comments, and keep counting writers only.
C. C. Count no reply here, and let the outbox gate alone say answers are waiting.

## What I had to decide

outboxFacts in next.ts fed planReplies GitHub's comments with author_association, and isCountedReply keeps OWNER, MEMBER and COLLABORATOR only. LoopComment is {id, author, body, createdAt, updatedAt}, with no association. Built: each LoopComment is handed to planReplies as a COLLABORATOR's (replyCommentOf), so any person's numbered reply makes `answered` true and the verdict `act yolo-fix`. kit/lib/outbox/replies.ts is unchanged. The other comment reads (the status comment's updatedAt for a running step, the roadmap issue's answers and ticks) never used the association.

## What I did meanwhile

Built and tested: a numbered reply on the feature PR gives act yolo-fix, as before.

## What it costs to change later

A field in the contract (the author's standing) and one line in next.ts to pass it on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A reply from someone outside the repository's writers now launches a yolo-fix run that will find nothing to settle; whether that run stops cleanly was not checked.

```

<!-- /omni-outbox-settled: s4-04-replies-without-standing -->

<!-- omni-outbox-settled: s4-06-gate-test-reads-fake -->

## s4-06-gate-test-reads-fake — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-06-gate-test-reads-fake
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

One test of the next-step command, outside this slice's ground, stood in for GitHub with empty answers. Once the command read the Omni page instead, that test failed, so I changed it: is that fine?

## The decision, in plain words

The test now hands the command the shared empty stand-in for the Omni page's answers. Its three checks on approvals are unchanged and pass.

## The intro, for fun

The understudy learned new lines, and the old script still had the old ones.

## The punchline, for fun

One line of the old script changed, the play is the same.

## The options, in plain words

A. A. Hand the gate test the shared empty fake (built).
B. B. Route its fetch by URL so the loop's reads answer empty lists from the same stub.

## What I had to decide

kit/lib/next/gate.test.ts (PRD 1299's approval gate of omni next) stubbed gh to answer `[]`; once next reads LoopReads, its fetch, which answers the approval body to every URL, reached the loop's reads too and the answer fell outside the contract (exit 1). Built: it passes `reads: fakeLoopReads()` to main(), and its two header comments say so. No assertion changed.

## What I did meanwhile

The three gate tests pass; the full suite is green.

## What it costs to change later

Two lines in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether other tests outside the kit's command tests reach omni next or omni care through main() with a gh stub was checked only by the full suite, which is green.

```

<!-- /omni-outbox-settled: s4-06-gate-test-reads-fake -->

<!-- omni-outbox-settled: s5-02-statusline-last-value -->

## s5-02-statusline-last-value — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-statusline-last-value
prd: 1665
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the status line's background refresh cannot read the loop, what should the status line show?

## The decision, in plain words

It shows what it shows today when the refresh fails: the PRD's line without the slices, never an error, and it tries again a minute later.

## The intro, for fun

The scoreboard lost its feed, so it kept the match title up and the score off.

## The punchline, for fun

A minute later it asks again, politely, without a single red light.

## The options, in plain words

A. A. Keep today's behaviour: on a failed read the line drops the slices and tries again a minute later.
B. B. Keep the last good slices on screen, marked as old, until a read works again.

## What I had to decide

Whether 'keeps the last value it drew' (spec, Behaviour; plan s5 done-when) means today's behaviour, where a failed refresh writes the error entry and the line drops the board, or keeping the last good slices on screen past a failed read.

## What I did meanwhile

refreshPrdBoard writes the LoopReadError's own line as the error entry (kit/lib/statusline/board-cache.ts unchanged); the status line then draws the stage alone, and kit/bin/statusline.test.ts proves the line drawn after a failed read is the line drawn before it, with no error text.

## What it costs to change later

Keeping the last slices means writing the old slices back with their old time in board-cache.ts, outside this slice: a small change, but it would also need its own retry timer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'as it does today when gh fails', which is what was built; the done-when's 'draws its last value' could also mean the last slices.

```

<!-- /omni-outbox-settled: s5-02-statusline-last-value -->

<!-- omni-outbox-settled: s5-03-roadmap-closed-date-and-links -->

## s5-03-roadmap-closed-date-and-links — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-roadmap-closed-date-and-links
prd: 1665
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The Omni page does not say when a change was closed, nor give a link to each comment, but the roadmap page shows both: where should they come from?

## The decision, in plain words

A closed change counts as closed when it was last updated, a merged one when it merged, and a comment's link is built from the issue's address and the comment's number.

## The intro, for fun

The calendar lost the closing date, so it trusted the last time anyone touched the door.

## The punchline, for fun

Close enough, and usually exactly the same minute.

## The options, in plain words

A. A. Keep the dates and links as built.
B. B. Add a closing date and a comment link to the loop's contract, and read them.
C. C. Send no end date and no comment link when the page does not give them.

## What I had to decide

How kit/lib/roadmap/push.ts fills a feature PR's closedAt and a clarification comment's url when the loop contract's Change has no closedAt and its Comment no url.

## What I did meanwhile

featurePrOf takes closedAt from mergedAt for a merged change and from updatedAt for a closed one; issueComments links each comment as https://github.com/<repo>/issues/<n>#issuecomment-<id>, as the push already builds the roadmap issue's own address. Tested in kit/lib/roadmap/push.test.ts.

## What it costs to change later

Adding closedAt to the contract's Change, or url to its Comment, is a field on both sides and one line here each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A closed change edited after it closed would show a later end date than it really had.

```

<!-- /omni-outbox-settled: s5-03-roadmap-closed-date-and-links -->

<!-- omni-outbox-settled: s5-04-roadmap-answers-and-ticks -->

## s5-04-roadmap-answers-and-ticks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-roadmap-answers-and-ticks
prd: 1665
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Besides each PRD's progress, the roadmap commands also read the answers and the ticks left as comments on the roadmap's issue: should those be read through the Omni page too?

## The decision, in plain words

Yes: the answers, the ticks and the comments the progress needs are read through the Omni page as well, so a roadmap push works without GitHub's own tool, and a failed read says which read stopped it.

## The intro, for fun

Moving house, the movers took the furniture and asked about the mail.

## The punchline, for fun

The mail came along too; only the outgoing letters still leave by the old post office.

## The options, in plain words

A. A. Read the answers and the ticks through the Omni page, as built.
B. B. Read only the feature PRs through the Omni page, and keep the comments on GitHub's tool.

## What I had to decide

Whether omni roadmap's reads of the roadmap issue's comments (answers in push, ticks in prereqs), done by githubClientFor(...).listComments(), move to LoopReads.comments with the feature PRs, and what a failed read prints.

## What I did meanwhile

kit/bin/commands/roadmap.ts reads the feature PRs, their comments, the answers and the ticks through LoopReads; a failed read prints its own line (no sign-in, unreachable, refused ...) where push printed 'github unreachable', which stays for any other failure; prereqs says '(<line>)' when the ticks cannot be read. Posting an answer or a tick still goes through gh. Tested in kit/bin/roadmap.test.ts.

## What it costs to change later

Putting listComments back is two lines in roadmap.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names only the gate's 'gh pr list'; reading the comments the same way was judged from 'every read that decides is in scope'.

```

<!-- /omni-outbox-settled: s5-04-roadmap-answers-and-ticks -->

<!-- omni-outbox-settled: s6-01-approval-through-the-page -->

## s6-01-approval-through-the-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-approval-through-the-page
prd: 1665
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The merge check for a slice can ask that a person approved it, a fact that came from GitHub directly and that the Omni page does not give yet: where should it come from now?

## The decision, in plain words

I let the page's answer carry who approved, as an optional fact, and until the page sends it nobody counts as having approved, so a slice that needs a person's approval waits rather than merging without one.

## The intro, for fun

The doorman now reads the guest list from the front desk, which has not printed the names yet.

## The punchline, for fun

So for now nobody gets in on a name alone, which is the safe kind of rude.

## The options, in plain words

A. A. The page's answer carries who approved, optional; absent reads as nobody, so the slice waits (built).
B. B. The same field, but absent reads as not known, with its own line naming the page as too old.
C. C. Keep reading approvals from GitHub through the command-line tool for this one check.

## What I had to decide

`omni flow check merge` read `approvedBy` from `gh pr view --json reviews` (personApproved: each non-bot login whose last deciding review approves). The loop's contract had no approval field, so LoopReads could not carry it. Built: kit/lib/loop-reads/contract.ts's LoopReviewSchema gains `approvedBy: z.array(z.string()).optional()` (the page's strict ReviewSchema spreads the kit's shape, so it accepts the field without requiring it); flow.ts reads `review.approvedBy ?? []`. Until apps/galaxy/src/loop/github.ts answers it (landing 1's ground, not this slice's), an area with `approval: person` holds every sub-PR with `no person has approved #n`. contract.ts is s3's territory, not s6's.

## What I did meanwhile

Tested: an approval the fake page answers lets the kernel sub-PR merge, and a page that answers none holds it with the approval reason. No flow in this repository sets `approval: person`, so nothing here is held by it today.

## What it costs to change later

A field on the page's GitHub adapter (the reviews of the pull request, grouped as personApproved does), or one constant if the field is renamed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page should answer approvals in this PRD (a follow-up to landing 1) or in a later one.
- (author) Whether a page that does not answer the field should read as nobody approved (built) or as not known, with its own line.

```

<!-- /omni-outbox-settled: s6-01-approval-through-the-page -->

<!-- omni-outbox-settled: s6-02-harvest-reads-and-bridge -->

## s6-02-harvest-reads-and-bridge — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-harvest-reads-and-bridge
prd: 1665
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The shared GitHub helper file was to keep only what writes, but the knowledge harvest, left out of this change, still reads two facts through it: where should those two reads live?

## The decision, in plain words

I moved the harvest's two reads into the harvest command itself, its only user, unchanged, and deleted the old bridge that turned GitHub answers into the new reads, since nothing used it any more.

## The intro, for fun

Spring cleaning found two borrowed mugs in the shared cupboard.

## The punchline, for fun

They went back to the one desk that drinks from them.

## The options, in plain words

A. A. The harvest's two reads move into the harvest command; the unused bridge is deleted (built).
B. B. Leave the harvest's two reads in the shared helper file, against the plan's wording.
C. C. Move them to a new helper file of their own beside the shared one.

## What I had to decide

kit/bin/github.ts held pullRequestFor and pullRequestFilesFor (gh api repos/<r>/pulls/<n> and its files), used only by kit/bin/commands/harvest.ts, which the spec keeps on gh. Done-when: github.ts keeps only its write helpers and githubEnv. Built: both moved, private, into harvest.ts (outside s6's territory: one import line and two functions; the harvest tests pass unchanged). kit/lib/loop-reads/gh-bridge.ts and its test (s3's ground) are deleted: no file imports it after s4 and s5. ghClient's listComments stays: it reads only to find the comment a write updates. The guard test follows the seven commands' imports and does not reach harvest.ts.

## What I did meanwhile

Ran the harvest, flow, github and loop-reads tests: green.

## What it costs to change later

Moving two functions back, or restoring the bridge from git history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the harvest's reads should later move to the Omni page too (the spec keeps the setup commands on gh for now).

```

<!-- /omni-outbox-settled: s6-02-harvest-reads-and-bridge -->

<!-- omni-outbox-settled: s6-03-guard-reach -->

## s6-03-guard-reach — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-guard-reach
prd: 1665
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The new guard checks that the loop's deciding commands never read GitHub through the command-line tool: how far should it look, and does a write that uses the same tool count?

## The decision, in plain words

It looks at the seven commands and every file they use, followed step by step, and counts the seven read forms the spec names; a write through the same tool is let through when its file holds only writes.

## The intro, for fun

A smoke alarm that rings for toast is soon taken off the ceiling.

## The punchline, for fun

This one rings for reading only, and leaves the writing alone.

## The options, in plain words

A. A. The seven forms in the seven commands and every file they import; writes with mutations only pass (built).
B. B. The same, and every REST read through the tool too.
C. C. Only the seven command files themselves, not what they import.

## What I had to decide

kit/test/no-gh-reads.test.ts parses each file's syntax tree (comments never count) and fails on an argument list holding pr list, pr view, pr diff, pr checks, issue view or issue list, the same as one string, and on api graphql when the file holds a GraphQL query (a document that does not start with `mutation`). care.ts's reply and resolve mutations pass (s4-02). Its reach is the seven command files plus every kit file they import, followed transitively, tests left out. Not counted: `gh api` REST calls (comment listing before a write, care's `gh repo view` for a target's default branch), which the spec's list does not name.

## What I did meanwhile

Proven red first on fixtures for each form and on the branch before flow moved (three hits in kit/bin/github.ts), green after.

## What it costs to change later

A line in the guard's list of forms, or its list of files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a REST read through `gh api` on the loop's path should also fail the guard (care's default-branch read would then need the page).

```

<!-- /omni-outbox-settled: s6-03-guard-reach -->

<!-- omni-outbox-settled: s4-05-law-proofs-on-loop-reads -->

## s4-05-law-proofs-on-loop-reads — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-12T12:03:06Z
- Channel: feature pull request #1667
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1667#issuecomment-6123882696
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-72
- Raised: 2026-10-12
- Slice: s4
- Became: BR-PRODUCT-72
- Wave: 2

### The answer, as it was given

```text
A. A. The proofs as moved, the record read from the plan repository only (built).
```

### The item, as it was raised

```text
---
id: s4-05-law-proofs-on-loop-reads
prd: 1665
slice: s4
rank: high
bears-on: BR-PRODUCT-72
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The tests that prove three of the loop's rules now feed them the Omni page's answers instead of GitHub's, and one rule now finds a bug's record only in the plan's own repository. Do these tests still prove the rules as you meant them?

## The decision, in plain words

I kept every check of those tests and only changed where their facts come from. The bug rule still takes its record from the changes that close the bug, but now only those of the plan's own repository, because the page names them by number alone.

## The intro, for fun

Same exam, same answers, new paper.

## The punchline, for fun

One question now only accepts answers from the home team.

## The options, in plain words

A. A. The proofs as moved, the record read from the plan repository only (built).
B. B. The proofs as moved, and the closing changes' repository added to the page's answer first, so a record in a target is listed again.
C. C. Keep the bug list on GitHub's own tool until the page carries the repository.

## What I had to decide

kit/bin/care.test.ts proves BR-PRODUCT-72 and kit/bin/next.test.ts proves BR-PRODUCT-87 and BR-PRODUCT-88; check coverage reads any change to a law's proof as needing a person. Both files now build the shared fake LoopReads from the same data their gh fixtures held; every assertion of the law tests is unchanged except that a failed check's link is now null. BR-PRODUCT-72's behaviour narrowed: care list's bug records come from LoopIssueDetail.closedBy (settled item s2-02: closing changes of the issue's own repository, by number), so a record PR opened in a target repository is no longer listed; the gh read took each record's repository from its link.

## What I did meanwhile

Ran both files green on the fake; the law test BR-PRODUCT-72 lists acme/plan#51 as the record, as before.

## What it costs to change later

For the narrowing: the repository added to closedBy in the contract (s2-02's option C) and one line in care.ts. For the proofs: none.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a bug's record PR is ever opened outside the plan repository was not checked against /omni:mega-bug-fix's practice; its skill says the record PR is in the plan repository.

```

<!-- /omni-outbox-settled: s4-05-law-proofs-on-loop-reads -->

<!-- omni-outbox-settled: s5-01-law-proofs-read-the-loop -->

## s5-01-law-proofs-read-the-loop — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-12T12:03:06Z
- Channel: feature pull request #1667
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1667#issuecomment-6123882696
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-86
- Raised: 2026-10-12
- Slice: s5
- Stays here: the answer keeps BR-PRODUCT-86's words as they are, for its owner to reword in a later knowledge pass
- Wave: 2

### The answer, as it was given

```text
A. A. Keep the proofs on the shared pretend Omni page, and leave the rule's words as they are.
```

### The item, as it was raised

```text
---
id: s5-01-law-proofs-read-the-loop
prd: 1665
slice: s5
rank: high
bears-on: BR-PRODUCT-86
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Three rules about roadmaps and the status line were proven by tests that pretended to be GitHub, and those tests now pretend to be the Omni page instead, while one rule still names GitHub in its words: is that change to the proofs fine, and should the rule's words follow?

## The decision, in plain words

I moved the tests onto the same pretend Omni page the other commands use, kept every outcome they check, and left the rule's words as they are for its owner to reword.

## The intro, for fun

The rule still names the old messenger, though the letters now come by a new road.

## The punchline, for fun

Same letters, same answers; only the stamp on the envelope changed.

## The options, in plain words

A. A. Keep the proofs on the shared pretend Omni page, and leave the rule's words as they are.
B. B. Keep the proofs on the shared pretend Omni page, and reword the rule to say the loop, not GitHub.
C. C. Keep a copy of the old GitHub-shaped tests beside the new ones.

## What I had to decide

Whether the proofs of BR-PRODUCT-86 (kit/lib/roadmap/push.test.ts, kit/bin/roadmap.test.ts), BR-PRODUCT-81 (kit/lib/roadmap/push.test.ts) and BR-PRODUCT-91 (kit/bin/statusline.test.ts) may move from gh stubs to the shared fake LoopReads, and whether BR-PRODUCT-86's 'If GitHub is unreadable, nothing is pushed' should now read 'If the loop cannot be read'.

## What I did meanwhile

Every case those tests checked still runs on the same data through fakeLoopReads; the push still sends nothing when a read fails, now printing the read's own line ('no sign-in (omni signin)', 'unreachable', 'refused (403): …') where it printed 'github unreachable'. The rule's text in .omni-loop/knowledge/product/rules.md is untouched.

## What it costs to change later

A sentence in the rule's text, or reverting the test files with the kit's landing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the knowledge register wants the rule reworded in this PRD or left for a later knowledge pass.

```

<!-- /omni-outbox-settled: s5-01-law-proofs-read-the-loop -->
