# Settled outbox items — PRD 1705

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-route-move-outside-territory -->

## s1-01-route-move-outside-territory — adopted

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
id: s1-01-route-move-outside-territory
prd: 1705
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Moving the sign-in pages into their own folder also meant updating two checks the plan did not list for this step: one that confirms every menu entry opens a real page, and the list of known structure exceptions. Is it fine that this step changed them?

## The decision, in plain words

Both were updated only so they find the same pages at their new place. No check was loosened and no exception was added.

## The intro, for fun

Two pages moved house, and two checklists needed the new address.

## The punchline, for fun

Nobody new moved in; the post just goes to the right door now.

## The options, in plain words

A. Keep the updates in this slice: the two checks follow the move in the same change that makes it.
B. Move them to their own slice: revert them here and add a slice whose territory holds them; the build is red in between.

## What I had to decide

Keep the two updates (A), or have the plan list them for a follow-up slice (B).

## What I did meanwhile

The checks pass with the new paths; the feature branch stays green.

## What it costs to change later

None to keep. Undoing means a red build until the paths are fixed elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 missed apps/galaxy/src/switch/switch.test.ts and layering/baseline.json (author)

```

<!-- /omni-outbox-settled: s1-01-route-move-outside-territory -->

<!-- omni-outbox-settled: s2-01-closed-signup-words -->

## s2-01-closed-signup-words — adopted

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
id: s2-01-closed-signup-words
prd: 1705
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The sign-up page has one more message the plan did not list, shown when a site cannot create workspaces at all, and its old sentence was too long for the short-sentence rule. Is the new, shorter one right?

## The decision, in plain words

It now says only that this site cannot make a workspace, without naming the missing piece.

## The intro, for fun

One last long sentence was hiding behind a closed door.

## The punchline, for fun

It now says the door is closed, without listing every missing hinge.

## The options, in plain words

A. Keep the short line: This deployment cannot make a workspace.
B. Name the missing piece: a short line saying the database or the GitHub App is missing.

## What I had to decide

Keep the short line (A), or name the missing piece again in a short form (B).

## What I did meanwhile

The short line ships; it only shows on a deployment that cannot create workspaces.

## What it costs to change later

A one-line text change either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's word table left out the closed and failed reasons; failed already fit (author)

```

<!-- /omni-outbox-settled: s2-01-closed-signup-words -->
