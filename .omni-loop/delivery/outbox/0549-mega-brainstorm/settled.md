# Settled outbox items — PRD 549

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-repo-refusal-is-a-violation -->

## s1-01-repo-refusal-is-a-violation — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-repo-refusal-is-a-violation
prd: 549
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When an ordinary repository's plan names a repository per slice, should the plan check list that among its other findings, or stop at once with a single error line?

## The decision, in plain words

It is listed among the plan's other findings, so a person sees everything wrong with the plan in one run.

## The intro, for fun

A plan walks into the wrong repository carrying a map of five others.

## The punchline, for fun

The check reads the whole map aloud before showing it the door.

## The options, in plain words

A. List it as a finding beside the others and exit 1 (built).
B. Stop at once with one error line and exit 2, grading nothing else.

## What I had to decide

Whether a plan-repository table found outside a plan repository is one finding among others (exit 1) or a usage error that stops the check (exit 2).

## What I did meanwhile

It is a finding: the check still grades waves, blockers and collisions, and exits 1 with every finding listed.

## What it costs to change later

Switching is a few lines in the plan command and two test expectations; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says 'refused' without naming the exit code (author).

```

<!-- /omni-outbox-settled: s1-01-repo-refusal-is-a-violation -->

<!-- omni-outbox-settled: s3-01-s3-rebuilds-the-bundle -->

## s3-01-s3-rebuilds-the-bundle — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-s3-rebuilds-the-bundle
prd: 549
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The help page's list of skills is packed into the installable command file, so adding the new skill to help changes that file too, which the plan had not given this piece of work. Should this piece rebuild it?

## The decision, in plain words

It rebuilds the installable command file so the new skill shows in help once installed; the other piece of the same round also rebuilds it, and the second to land simply rebuilds it again.

## The intro, for fun

The plan said this piece would not touch the packed command file. The packed command file disagreed.

## The punchline, for fun

One rebuild each, and the last one to land presses the button again.

## The options, in plain words

A. This piece rebuilds the packed command file; the round rebuilds it again when it merges the second piece (built).
B. This piece leaves the packed command file stale, with its check red, and the round rebuilds it once after merging both pieces.
C. Move this piece to the next round and give it the packed command file, so the two pieces never both rebuild in one round.

## What I had to decide

Whether slice s3 may rebuild the committed bundle kit/dist/omni.mjs, outside its territory, because its help entry is bundled.

## What I did meanwhile

s3 commits a rebuilt kit/dist/omni.mjs. s1, in the same wave, also rebuilds it; whichever sub-PR merges second conflicts only on that generated file, which is resolved by running pnpm kit:build on the merged tree.

## What it costs to change later

A constant: dropping the commit and rebuilding the bundle on the feature branch undoes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's shared-ground note says s3 changes no bundled source; kit/lib/help/entries.mjs is bundled, so the note was wrong (author).

```

<!-- /omni-outbox-settled: s3-01-s3-rebuilds-the-bundle -->
