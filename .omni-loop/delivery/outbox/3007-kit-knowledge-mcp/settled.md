# Settled outbox items — PRD 3007

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-one-key-two-workspaces -->

## s1-02-one-key-two-workspaces — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-one-key-two-workspaces
prd: 3007
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

A person who belongs to two workspaces may find a product with the same short name in each. Which one does their agent read?

## The decision, in plain words

Their agent reads the oldest of those products whose knowledge is switched on. A product that is off, archived, or in a workspace they are not in is never chosen.

## The intro, for fun

Two products, one name, one curious agent.

## The punchline, for fun

The elder sibling answers the door first.

## The options, in plain words

A. As built: the oldest of the products of that key whose knowledge is on, among the person's workspaces.
B. Refuse when two of the person's workspaces hold a product of that key that is on, until the terminal names the repository, so the route can pick the product that holds it.
C. Have the terminal send the repository too, and pick the product that holds it, falling back to the oldest.

## What I had to decide

Whether the route picks one product when a person's workspaces hold two with the same key, or refuses until the request names which.

## What I did meanwhile

The new database function picks, among the products of that key in the person's workspaces that are on and not archived, the one created first (then by id), as the existing product lookup by key picks among a person's products. An API key never meets the question: it belongs to one workspace.

## What it costs to change later

A constant in one database function; changing it is one new migration redefining that function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The terminal sends only the product's key, never the repository, so the route cannot prefer the workspace that holds the session's repository as the existing lookup does when it is given one.

```

<!-- /omni-outbox-settled: s1-02-one-key-two-workspaces -->

<!-- omni-outbox-settled: s1-03-database-types-outside-territory -->

## s1-03-database-types-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-database-types-outside-territory
prd: 3007
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The new database change also changes the generated description of the database, a file this slice's plan did not list. May the slice carry it?

## The decision, in plain words

The slice carries the regenerated file, exactly as the generator wrote it, because every push and every database check refuses a database change without it.

## The intro, for fun

A map that does not show the new road gets a traveller lost.

## The punchline, for fun

So the map came along, drawn by the machine, not by hand.

## The options, in plain words

A. As built: the slice carries the regenerated file with its migration.
B. Leave it out of the slice, and have the wave regenerate it once after merging, accepting a red database check on the slice until then.

## What I had to decide

Whether the regenerated database types ride with this slice, or a later step of the wave regenerates them.

## What I did meanwhile

The slice commits supabase/database.types.ts as node scripts/supabase-types.ts wrote it from a fresh local database with every migration applied: seven added lines (the log's new column, the new function), nothing else. The conventions form asks for it on every migration change, and the pre-push hook and the supabase workflow check it. No other slice of the plan touches the file.

## What it costs to change later

None to undo: the file is regenerated from the migrations whenever they change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names the migrations folder but not the generated types file the conventions require beside every migration.

```

<!-- /omni-outbox-settled: s1-03-database-types-outside-territory -->

<!-- omni-outbox-settled: s2-01-product-key-from-which -->

## s2-01-product-key-from-which — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-product-key-from-which
prd: 3007
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The terminal asks the Omni page which product this repository is in, and the page answers with the product's name, not its short key. Which key should the knowledge search use when this checkout has not named a product?

## The decision, in plain words

When the checkout remembers no product, the search turns the product's name into a key by lowercasing it and joining its words with dashes, so Omni Loop becomes omni-loop. A checkout that named its product with omni product use always uses that key.

## The intro, for fun

A product has a name for people and a key for machines.

## The punchline, for fun

Today the terminal has to guess the machine one.

## The options, in plain words

A. A. Rewrite the name as a key, and prefer the key the checkout remembers
B. B. Add the product's key to the page's answer, in a change to the page
C. C. Ask the person to run omni product use <key> before the first search

## What I had to decide

The route takes the product's key and omni product which answers names only. Rewriting the name is a constant to change, not a migration, and a wrong guess prints the knowledge-off line, never a wrong answer.

## What I did meanwhile

A product whose key is not its name in lower case reads the knowledge-off line until its checkout runs omni product use <key>.

## What it costs to change later

If the page later answers the key beside the name, the rewriting is deleted in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the products read of the Omni page should carry the key (author)

```

<!-- /omni-outbox-settled: s2-01-product-key-from-which -->

<!-- omni-outbox-settled: s3-01-plugin-server-test-home -->

## s3-01-plugin-server-test-home — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-plugin-server-test-home
prd: 3007
slice: s3
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

Where should the check that the plugin carries the knowledge server live?

## The decision, in plain words

The check sits in the new test file of the server itself, not in the plugin's existing test file, so no test that proves a locked rule is touched and nobody has to approve a change to one.

## The intro, for fun

Where do you hang a new sign: on the old wall, or on a fresh one?

## The punchline, for fun

A fresh one, so the old wall needs nobody's signature.

## The options, in plain words

A. A. As built: the check lives beside the server's other tests, and the plugin test file is untouched.
B. B. As planned: add the check to the plugin test file, with a high item a person answers, since that file proves locked rules.
C. C. Keep it in both files, with the same high item.

## What I had to decide

Whether the plan's wish, that the plugin test file checks the declaration, outweighs keeping that file untouched.

## What I did meanwhile

The test of the declaration (the server is named omni-knowledge, runs omni mcp, holds no key or token) is in the server's own test file, and the plugin test file is unchanged.

## What it costs to change later

Moving the two tests into the plugin test file later is a copy of about twenty lines, plus a high item, since that file proves locked rules.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the plugin test file for this check; the grader treats any edit to it as a change to a law's proof, which only a high item accounts for.

```

<!-- /omni-outbox-settled: s3-01-plugin-server-test-home -->
