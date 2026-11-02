# Settled outbox items — PRD 2583

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-db-types-and-ci-check-outside-territory -->

## s1-02-db-types-and-ci-check-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-02
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-db-types-and-ci-check-outside-territory
prd: 2583
slice: s1
rank: medium
bears-on: none
raised: 2026-11-02
wave: 1
---

## The question, in plain words

Two files outside this slice's ground still need the new domains: the database's generated types, and the database workflow, which must run the new domains check. Who should change them, and when?

## The decision, in plain words

This slice left both alone. The next slice extends the same database change, so the types are best regenerated once after it, and the workflow gains its one line for the domains check at the same time, on the feature branch.

## The intro, for fun

The new room is built, but the floor plan on the wall still shows the old house.

## The punchline, for fun

Someone has to redraw it, ideally once the second room is done too.

## The options, in plain words

A. Regenerate the database types and add the workflow step for the domains check on the feature branch once slice s2 has merged.
B. Add both to this slice now, outside its declared ground, and regenerate the types again after slice s2.

## What I had to decide

Answer A to have the wave regenerate the types and add the workflow line on the feature branch after slice s2 merges; answer B to have them added to this slice before it merges.

## What I did meanwhile

The feature branch's database types check will fail until the types are regenerated; the domains check is proven locally but does not yet run in CI.

## What it costs to change later

Either way it is one regenerated file and one workflow step; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Proven locally: supabase/checks/product_domains.sql and product_knowledge.sql pass on a database built from every migration; CI has not run the domains check (author).

```

<!-- /omni-outbox-settled: s1-02-db-types-and-ci-check-outside-territory -->

<!-- omni-outbox-settled: s2-01-business-read-and-fixtures-outside-territory -->

## s2-01-business-read-and-fixtures-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-02
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-business-read-and-fixtures-outside-territory
prd: 2583
slice: s2
rank: medium
bears-on: none
raised: 2026-11-02
wave: 2
---

## The question, in plain words

The page and the agents' business read both had to learn about domains, and the agents' read sits in files this slice does not own. Is it right that this slice made the small change there rather than leaving it for a later slice?

## The decision, in plain words

The agents' business read was made to accept the new domains fields, and three test fixtures were given an empty domains list so they still read as before. Without it, the read would have refused every answer once the database sends domains, for every terminal and agent.

## The intro, for fun

The glossary grew a new column and the back door had a strict bouncer.

## The punchline, for fun

A one-line note to the bouncer, and everyone gets in again.

## The options, in plain words

A. A. Keep the small changes made here, in the business read's schema and in one fixture line of the knowledge API test.
B. B. Have the owner of those files make them in a later slice, leaving the business read to refuse the database's answer until then.

## What I had to decide

Answer A to keep the two small changes made outside the slice's own files (the business read's schema and one fixture line in the knowledge API test); answer B to have them made by the slice that owns those files instead, accepting that the business read refuses the database's answer until then.

## What I did meanwhile

The business read accepts the optional domains fields, and the fixture lines are updated; every existing test still passes.

## What it costs to change later

Undoing it is removing one optional field from two schemas and one line from a fixture; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice names the product knowledge files and the migration, not apps/galaxy/src/business-api/ or apps/galaxy/src/knowledge-api/, yet the criterion that the business read carries the domains needs the first, and the typed glossary entry needs the second.

```

<!-- /omni-outbox-settled: s2-01-business-read-and-fixtures-outside-territory -->

<!-- omni-outbox-settled: s2-02-clearing-a-terms-domains-keeps-retired-links -->

## s2-02-clearing-a-terms-domains-keeps-retired-links — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-02
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-clearing-a-terms-domains-keeps-retired-links
prd: 2583
slice: s2
rank: medium
bears-on: none
raised: 2026-11-02
wave: 2
---

## The question, in plain words

When someone clears a term's domains, should the links to domains that were retired since also go? This slice keeps them, because the spec says a link made before retirement stays.

## The decision, in plain words

Emptying a term's domains removes the links to the domains that are still active and keeps the ones to retired domains, which the term keeps showing as retired. A person who wants one gone has no control for it yet.

## The intro, for fun

A retired domain left the building, but its name tag stayed on the term.

## The punchline, for fun

Clearing the list is tidying, not erasing history.

## The options, in plain words

A. A. Keep retired links when a term's domains are cleared or replaced.
B. B. Remove retired links as well when the list is cleared or replaced.
C. C. Keep them, and add a control on the term's page to remove one retired link at a time.

## What I had to decide

Answer A to keep retired links when a term's domains are cleared or replaced; answer B to remove them too, so clearing really empties the list.

## What I did meanwhile

The wave carries on with retired links kept, as the spec words it.

## What it costs to change later

Undoing it is changing one delete rule in the database function and its check; the links already kept stay in the table.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a link made before a domain was retired stays, but not whether a person may remove it on purpose.

```

<!-- /omni-outbox-settled: s2-02-clearing-a-terms-domains-keeps-retired-links -->

<!-- omni-outbox-settled: s3-01-count-of-folders-off-the-list -->

## s3-01-count-of-folders-off-the-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-02
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-count-of-folders-off-the-list
prd: 2583
slice: s3
rank: medium
bears-on: none
raised: 2026-11-02
wave: 3
---

## The question, in plain words

The number on the Domains tab says how many folders are not on the list. Should it count a folder whose name cannot be a key, and a retired domain still found in a repository?

## The decision, in plain words

The number counts every folder the list does not hold, including one whose name cannot be a key, because the owner needs to know it exists. A retired domain still in a repository is shown but not counted, and a repository that was not read yet adds nothing.

## The intro, for fun

Counting what is missing turns out to need a rule of its own.

## The punchline, for fun

The tab now counts the strays, and only the strays.

## The options, in plain words

A. A. Count every folder off the list, a name that cannot be a key included; leave out retired domains and unread repositories.
B. B. Count the retired domains still in a repository as well.
C. C. Count only the folders that can be added, leaving out those whose name cannot be a key.

## What I had to decide

Answer A to keep the count as built; answer B to count retired domains still in a repository too; answer C to leave out folders whose name cannot be a key.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

The tab counts every folder off the list, the ones that cannot be a key included, and leaves retired ones out.

## What it costs to change later

Changing it is one line in the module that works out the folders; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the number not on the list is shown, but not whether a folder that cannot be a key, or a retired domain still in a repository, belongs to it.

```

<!-- /omni-outbox-settled: s3-01-count-of-folders-off-the-list -->
