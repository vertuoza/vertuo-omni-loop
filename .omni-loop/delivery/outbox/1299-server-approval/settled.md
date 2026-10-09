# Settled outbox items — PRD 1299

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-phase0-flag-database-check -->

## s1-01-phase0-flag-database-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-phase0-flag-database-check
prd: 1299
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Should the rule that only the workspace owner can switch where phase 0 is approved also be proven by the automatic database check that runs on every pull request?

## The decision, in plain words

The rule lives in the database and is covered by tests of the page and the route, but no database check proves it yet, because this slice was only allowed to touch the migration, the types and the galaxy files.

## The intro, for fun

A lock on the door, and nobody has rattled the handle yet.

## The punchline, for fun

The tests trust the lock; the database check would try it.

## The options, in plain words

A. Ship the flag without a database check of its own; the migration mirrors the tracked switch, which is already checked.
B. Add the owner-only, default-pr and unknown-repository cases to the repositories database check in a follow-up slice.

## What I had to decide

Whether a follow-up adds the owner-only and default-pr cases for the new flag to the repositories database check.

## What I did meanwhile

The migration refuses anyone but the owner exactly as the tracked switch does; the galaxy tests cover the refusal as the page and the route read it, against a stubbed database.

## What it costs to change later

Adding the check later is one small change to the database checks file, with no migration and no data change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No run of the migration against a local database in this slice: the supabase workflow applies it in CI (author)

```

<!-- /omni-outbox-settled: s1-01-phase0-flag-database-check -->

<!-- omni-outbox-settled: s4-01-phase0-in-the-spec-schema -->

## s4-01-phase0-in-the-spec-schema — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-phase0-in-the-spec-schema
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

A spec may now say it was born on the server, but the rule that lists what a spec may say lives in a file this slice was not given. Should it change that file?

## The decision, in plain words

Yes: the shared list of what a spec may say now accepts the one new value, server, and still refuses every other value by name.

## The intro, for fun

The plan handed us the keys to the wrong door, right next to the right one.

## The punchline, for fun

We used the right one and left a note on the fridge.

## The options, in plain words

A. A. Add an optional phase0 (server only) to the spec schema, as built
B. B. Strip phase0 inside the inbox guard alone and keep the schema as it was, so every other reader of the inbox would refuse a server-born spec
C. C. Leave phase0 refused and amend the plan first

## What I had to decide

Whether the slice may add the optional phase0 field to the shared spec schema, outside the territory the plan named.

## What I did meanwhile

The schema accepts phase0: server and refuses any other value; the inbox guard and every reader of the inbox read it as before.

## What it costs to change later

Undoing it is removing one optional field from the schema; nothing stored depends on it until a server-born PRD exists.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan named kit/lib/front-matter.ts, which only splits key: value lines; the strict schema that refuses unknown fields is kit/lib/schema/front-matter.ts. I read the plan's entry as a slip for that file.

```

<!-- /omni-outbox-settled: s4-01-phase0-in-the-spec-schema -->

<!-- omni-outbox-settled: s4-02-approval-route-shape -->

## s4-02-approval-route-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-approval-route-shape
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The page and the terminal must agree on how an approval is described before the page side is built. What does the page answer?

## The decision, in plain words

The page answers the PRD page's link and the approval in force, or none yet: who approved, whether they are still in the workspace, when, and each approved file with its kind, its place, its fingerprint and, when it can, its approved text. A PRD with no page is refused.

## The intro, for fun

Two teams are building a bridge from both banks at once.

## The punchline, for fun

This item is the drawing they both tape to the wall.

## The options, in plain words

A. A. This shape, the approved text optional, as built
B. B. The route sends a whitespace-free fingerprint beside each one instead of the text
C. C. Drop the whitespace-only wording and always say content

## What I had to decide

The reply shape of GET /api/dossiers/approval that slice s2 must honour, and how the kit pairs and words a drift.

## What I did meanwhile

The kit reads { url, approval: null | { approver: { login, member }, approvedAt, files: [{ kind, path, sha256, versionId, content? }] } }; a 404 (no dossier) reads as refused (404); any other shape as refused (malformed reply). Kinds the PRD folder keeps (spec, plan, before-after, voice) are paired by kind; any other kind (a scenario) is read at its pinned path. Whitespace only is told only when the route sends the approved text; without it a change says content. Either way it refuses.

## What it costs to change later

Each field is one line on both sides while neither has shipped; after s2 merges, a rename is a coordinated change to the route and the kit's schema.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the route answers the approver's login, membership, time and pinned files, but not the field names, the dossier link, nor how the kit can tell whitespace from content with only a hash. The optional approved text is my answer to the last.

```

<!-- /omni-outbox-settled: s4-02-approval-route-shape -->

<!-- omni-outbox-settled: s4-03-signed-out-is-held -->

## s4-03-signed-out-is-held — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-signed-out-is-held
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

When this computer is not signed in to the Omni page, or no page is set up, what should the check of a server-approved PRD say?

## The decision, in plain words

It holds the PRD as if the server could not be reached, with the same line, and adds one line saying why: no page set, or sign in first. It asks nothing of the server.

## The intro, for fun

Knocking on a door you have no key for looks a lot like knocking on a door nobody answers.

## The punchline, for fun

Either way you wait on the porch, but now a note says why.

## The options, in plain words

A. A. Held as unreachable, saying why, as built
B. B. Refused, as refused (no sign-in)
C. C. A sixth state, signed out

## What I had to decide

Which of the five states a missing sign-in or a missing Omni page reads as.

## What I did meanwhile

omni approval prints server unreachable · held, not failed, exits 1, and writes the reason on stderr; prdState gives the PRD the unreachable stage.

## What it costs to change later

Changing it is one branch in the approval reader and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's table names unreachable as no answer within 5 seconds and one token refresh, and refused as a non-member approver or an error from the page; a terminal never signed in is neither.

```

<!-- /omni-outbox-settled: s4-03-signed-out-is-held -->
