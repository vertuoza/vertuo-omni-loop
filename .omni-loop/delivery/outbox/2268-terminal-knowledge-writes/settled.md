# Settled outbox items — PRD 2268

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-constituent-change-body -->

## s1-01-constituent-change-body — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-constituent-change-body
prd: 2268
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The spec says how a terminal sends a Legal entry or a glossary term to the new route, but not a Statement or a Never line. How should it send one?

## The decision, in plain words

An addition sends its text under the name of what it adds, the Statement or a Never line, as the command's own options name it. An edit names the line it changes and sends the new text.

## The intro, for fun

Two kinds of line, one door, and nobody wrote down which knock means which.

## The punchline, for fun

So each knock now says its own name, the way the command already does.

## The options, in plain words

A. The text goes under the name of what it adds, and an edit names its line and sends the new text, as built.
B. One shape for both: an addition names the Statement or Never as its line too, and every change sends its text the same way.

## What I had to decide

The body of a constituent change on POST /api/knowledge/changes, which slice s3 (`omni constituents add|edit`) sends and the spec leaves open.

## What I did meanwhile

Built: `kind: 'constituent'`, `action: 'add'` with `fields: {statement}` or `fields: {never}`; `action: 'edit'` with `entry: 'statement' | 'never#<n>'` and `fields: {text}`, read by `apps/galaxy/src/knowledge-api/knowledge-api.contract.ts`. Any other shape is a 400 naming the field.

## What it costs to change later

A constant: another shape is one schema in the contract and the matching lines in s3's client, with no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slice s3 is built from the spec alone, in parallel: it must read this contract or this item to send the same shape (author)

```

<!-- /omni-outbox-settled: s1-01-constituent-change-body -->

<!-- omni-outbox-settled: s1-02-proposal-names-who-it-waits-for -->

## s1-02-proposal-names-who-it-waits-for — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-proposal-names-who-it-waits-for
prd: 2268
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a member's change is only proposed, the terminal must say who it waits for, but the answer the spec describes carries no name. Where does the name come from?

## The decision, in plain words

The route's answer gains one more field: the login of the section's owner, or its delegate when it has no owner, and nothing when the section names nobody and its workspace's owners decide.

## The intro, for fun

The note said it waits for someone, then forgot to say who.

## The punchline, for fun

Now the note carries a name, unless nobody signed up for the job.

## The options, in plain words

A. The answer names the section's owner, else its delegate, else nobody, as built.
B. The answer names nobody, and the terminal prints the list's link alone.

## What I had to decide

How the terminal learns who a proposal waits for, which the spec's line `proposed · waits for @<owner> · <url>` needs and the spec's answer `{done, id, url}` does not carry.

## What I did meanwhile

Built: every answer of POST /api/knowledge/changes carries `waitsFor`, the owner's login, else the delegate's, else null; it is null for an applied change. Slice s2's `proposed · waits for @<owner>` line can read it from there.

## What it costs to change later

A constant: one additive field of a JSON answer, read by the kit's client alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slice s2 is built from the spec alone, in parallel: it must read this field to print the owner (author)
- What the terminal prints when the section names nobody is s2's to word (author)

```

<!-- /omni-outbox-settled: s1-02-proposal-names-who-it-waits-for -->

<!-- omni-outbox-settled: s1-04-database-check-needs-its-ci-step -->

## s1-04-database-check-needs-its-ci-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-database-check-needs-its-ci-step
prd: 2268
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The new database check proves how the product is found from a repository, but a check only counts once the automatic build runs it, and the build's file is outside this slice's ground. Who adds it?

## The decision, in plain words

The slice wrote the check and ran it green on a local copy of the database, and left the build file alone. The step that runs it is one line for the feature branch to add before the feature is marked ready.

## The intro, for fun

A smoke alarm in the box still counts as a smoke alarm, technically.

## The punchline, for fun

One screw on the ceiling and it starts earning its keep.

## The options, in plain words

A. The feature branch adds the step after this wave merges, before the feature is marked ready.
B. Grow this slice's ground to the build file and add the step here.

## What I had to decide

Where the step that runs `supabase/checks/knowledge_product_for_repo.sql` goes: the conventions form says each check is its own step of the `supabase` workflow's `check` job, added in the pull request that adds the check, and `.github/workflows/supabase.yml` is outside s1's territory.

## What I did meanwhile

Built the check and ran it green against every migration applied to a local Postgres (supabase/postgres 17.6.1.167); `knowledge-api.migration.test.ts` pins the function's rules in the unit run meanwhile. No workflow file changed.

## What it costs to change later

A constant: one named step in `.github/workflows/supabase.yml`, `psql … -f supabase/checks/knowledge_product_for_repo.sql`, beside the `product_archive.sql` step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The local copy stubbed what the Supabase platform adds to the auth, storage and realtime schemas, so the run in CI is the one that counts (author)

```

<!-- /omni-outbox-settled: s1-04-database-check-needs-its-ci-step -->

<!-- omni-outbox-settled: s2-01-proposal-owner-in-answer -->

## s2-01-proposal-owner-in-answer — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-proposal-owner-in-answer
prd: 2268
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a member who does not own Legal or Glossary proposes a change from the terminal, how does the command know whose approval it waits for?

## The decision, in plain words

The command reads an optional owner name from the page's answer and prints 'waits for @name'. When the answer carries none, it says 'waits for the section's owner' instead of guessing a name.

## The intro, for fun

A proposal is a letter; someone has to be named on the envelope.

## The punchline, for fun

Until the page names the owner, the letter goes to 'the owner'.

## The options, in plain words

A. Read an optional owner from the answer and fall back to the generic line (built).
B. Make the route always answer the owner and require it in the kit.

## What I had to decide

The spec's answer shape is {done, id, url} and its line says 'waits for @<owner>'. The kit reads an optional owner field of the answer, so the route can add it without a kit change.

## What I did meanwhile

A proposal prints the generic line, which is still true.

## What it costs to change later

One extra optional field on the route's answer, in slice s1, if the owner's name is wanted in the line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether slice s1's route answers an owner for a proposal (author)

```

<!-- /omni-outbox-settled: s2-01-proposal-owner-in-answer -->
