# Settled outbox items — PRD 2213

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-concept-refresh-reads-pr-list -->

## s2-01-concept-refresh-reads-pr-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-concept-refresh-reads-pr-list
prd: 2213
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

A merged concept's issue is now read on every sync, but the lookup that does it still asks GitHub for the concept's pull request too, and throws that answer away. Should the lookup skip the pull request request?

## The decision, in plain words

The sync and the touch keep the stored merged pull request and ignore what the second request says, so the page is right but each merged concept costs one extra GitHub request per run.

## The intro, for fun

A merged concept still gets asked about a pull request it already finished.

## The punchline, for fun

We kept the answer we had and politely ignored the new one.

## The options, in plain words

A. A. Keep the stored merged pull request and accept the extra read (as built).
B. B. Add a skip-the-pull-request option to the reader in a later slice.

## What I had to decide

Skipping the request needs a change to the shared GitHub reader (apps/galaxy/src/dossier/github/reader.ts), which is outside this slice's territory, so the merge keeps the stored merged pull request instead. Answer A keeps this; B asks a later slice to add an option to the reader.

## What I did meanwhile

Nothing breaks: the stored pull request is kept and the issue state is stored each run.

## What it costs to change later

One extra cheap GitHub read per merged concept per sync run (ETag-cached).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the extra read matters at the workspace size is unmeasured (author)

```

<!-- /omni-outbox-settled: s2-01-concept-refresh-reads-pr-list -->

<!-- omni-outbox-settled: s2-02-concept-page-still-final -->

## s2-02-concept-page-still-final — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-concept-page-still-final
prd: 2213
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

A concept's own page still treats a merged concept as settled and does not re-read GitHub in the background, so a close or reopen done on GitHub shows on the page only after the next sync or the instant GitHub event. Should the page re-read too?

## The decision, in plain words

Only the sync and the GitHub event refresh a merged concept now; the page keeps showing what is stored, which is at most one sync old.

## The intro, for fun

The page believes a merged concept never changes its mind.

## The punchline, for fun

The sync knows better and quietly keeps it up to date.

## The options, in plain words

A. A. Leave the page reading a merged concept as settled (as built).
B. B. Make the page re-read a merged concept in the background.

## What I had to decide

The page's read rule lives in apps/galaxy/src/dossier/page/fix-facts.ts, outside this slice's territory, and still uses isConceptFinal, which stays exported unchanged. Answer A leaves the page as is; B has s3 or a follow-up make the page re-read a merged concept.

## What I did meanwhile

The page can be up to one sync run behind a change made on GitHub; the event refreshes it at once.

## What it costs to change later

A merged concept page would add one background read per view if changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the extra read matters at the workspace size is unmeasured (author)

```

<!-- /omni-outbox-settled: s2-02-concept-page-still-final -->
