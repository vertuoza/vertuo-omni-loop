# Settled outbox items — PRD 3194

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-brief-reply-shape -->

## s2-01-brief-reply-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-23
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-brief-reply-shape
prd: 3194
slice: s2
rank: medium
bears-on: none
raised: 2026-11-23
wave: 1
---

## The question, in plain words

What does the page send back when someone asks for a mission's brief and retros, so the terminal can write them as files?

## The decision, in plain words

One reply holding the mission's number, its brief as written, its page, and each retro with its proposed changes.

## The intro, for fun

Two slices met in the middle of a reply nobody had drawn yet.

## The punchline, for fun

They agreed on the shape before either one finished.

## The options, in plain words

A. A. One reply with the brief and every retro (built).
B. B. Two replies, one for the brief and one for the retros.

## What I had to decide

The reply of GET /api/missions/brief: { mission, record, brief, retros: [{ k, milestone, content, items: [{ name, content }] }] }. s2 reads it in kit/lib/mission/get.ts; s1 serves it.

## What I did meanwhile

Both slices are merged on that shape; the kit's tests and the app's tests each pin their side.

## What it costs to change later

A field added later is cheap; renaming one means changing the route and get.ts together.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the files to write, not the reply's field names (author)

```

<!-- /omni-outbox-settled: s2-01-brief-reply-shape -->

<!-- omni-outbox-settled: s1-01-retro-file-names -->

## s1-01-retro-file-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-retro-file-names
prd: 3194
slice: s1
rank: medium
bears-on: none
raised: 2026-11-23
wave: 1
---

## The question, in plain words

When a mission's retros are written out as files, how is each one named, and is it an exact copy of what the page shows?

## The decision, in plain words

Each retro is named by its order on the page and its milestone, each proposed change by its number, and the text is rebuilt from what the page stores; the brief itself is copied exactly.

## The intro, for fun

The page keeps retros as data, not as documents.

## The punchline, for fun

So the files are a faithful rendering, not a photocopy.

## The options, in plain words

A. A. Name retros by their order and milestone, rebuilt from the page (built).
B. B. Name retros by milestone only, as the spec's example shows.

## What I had to decide

In apps/galaxy/src/missions/missions.export.ts: k is the retro's 1-based order on the page, files are retros/<k>-<milestone>.md and outbox items <n>.md; retro and item Markdown is rendered from stored JSON; a skipped retro reads 'Skipped: <why>'. mission.md and mission.html are byte for byte.

## What I did meanwhile

omni mission get writes retros/1-mission.md where AC-3's example says retros/mission.md; the spec's Solution form retros/<k>-<milestone>.md is what was built.

## What it costs to change later

Renaming the files is a change in missions.export.ts and its tests only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The page stores retros as JSON, so an exact copy of a file does not exist to give back (author)

```

<!-- /omni-outbox-settled: s1-01-retro-file-names -->

<!-- omni-outbox-settled: s3-01-ready-membership-client-call -->

## s3-01-ready-membership-client-call — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-23
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-ready-membership-client-call
prd: 3194
slice: s3
rank: medium
bears-on: none
raised: 2026-11-23
wave: 2
---

## The question, in plain words

The page call that tells which missions name a PRD did not exist yet in the shared client, and the slice's territory did not list that file. Was it right to add it there?

## The decision, in plain words

I added the one small call to the shared client file and made the ready command start from the page, so a missing sign-in or an unreachable page holds the check instead of saying a PRD is in no mission.

## The intro, for fun

A reader needed a phone number nobody had written in the book.

## The punchline, for fun

So the number went in the book, one line, beside the others.

## The options, in plain words

A. A. Add the call to the shared client file, as built.
B. B. Keep the shared client untouched and make the call from the membership file with its own fetch.

## What I had to decide

Added `missionsOfPrd` to `kit/lib/ask/client.ts` (outside s3's territory; the brief said it was already there, but slice s2 only added `getMission`). Turned `omni ready` into a command that loads its own context, as `omni mission` does, so tests can hand it a sign-in and a fetch. When the page is off, signed out, unreachable or refuses, it prints `mission membership not read: <why>` and exits 1, after the pull request is found and before the verdict.

## What I did meanwhile

Nothing waits on this; the call is a read of a route that already exists.

## What it costs to change later

If a person prefers the call elsewhere, moving one method is a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The brief said the client already had the call; it did not (author).

```

<!-- /omni-outbox-settled: s3-01-ready-membership-client-call -->

<!-- omni-outbox-settled: s4-01-mission-skill-keeps-its-issue -->

## s4-01-mission-skill-keeps-its-issue — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-23
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-mission-skill-keeps-its-issue
prd: 3194
slice: s4
rank: medium
bears-on: none
raised: 2026-11-23
wave: 2
---

## The question, in plain words

A mission is numbered by its GitHub issue. Now that the page is its record, should the mission skill still open that issue?

## The decision, in plain words

The skill still opens the issue, because the mission's number comes from it and the page needs a number; only the branch, the commit and the docs pull request are gone.

## The intro, for fun

A mission loses its pull request but keeps its ticket.

## The punchline, for fun

Numbers still have to come from somewhere.

## The options, in plain words

A. A. Keep opening the issue; the mission number is its number.
B. B. Number missions on the server and open no issue; needs a server change outside this PRD.

## What I had to decide

Kept: step 2 opens the issue and the brief is written to a scratch folder from mktemp. Changing it later means giving a mission its number another way.

## What I did meanwhile

Missions are numbered by their issue, as before.

## What it costs to change later

One issue per mission stays on GitHub; a person may close it at will.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec removes the docs pull request but is silent on the issue (author)

```

<!-- /omni-outbox-settled: s4-01-mission-skill-keeps-its-issue -->
