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
- Became: BR-ACCESS-10

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
- Became: ADR-0169

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
- Stays here: A stopgap until the page answers the product key, removable in one function. A wrong guess only shows the knowledge-off line, so there is no lasting guarantee to record.

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
- Stays here: A local choice of test placement, cheap to move later; nothing lasting about the product's behaviour to keep in the knowledge base.

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

<!-- omni-outbox-settled: s1-01-sign-in-refusals -->

## s1-01-sign-in-refusals — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-17T18:06:29Z
- Channel: feature pull request #3008
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3008#issuecomment-6956613185
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: ADR-0067
- Raised: 2026-11-17
- Slice: s1
- Became: BR-ACCESS-9
- Wave: 1

### The answer, as it was given

```text
A. As built: a sign-in that is no longer valid is refused so the terminal renews it once by itself; a person who is not a member, or a closed product, gets the 'nothing here' answer a working key gets.
```

### The item, as it was raised

```text
---
id: s1-01-sign-in-refusals
prd: 3007
slice: s1
rank: high
bears-on: ADR-0067
raised: 2026-11-17
wave: 1
---

## The question, in plain words

When an agent's sign-in cannot read a product's knowledge, how should the knowledge server say no?

## The decision, in plain words

A sign-in that is no longer valid is told so plainly, so the terminal renews it once by itself. A person who is not a member, or a product that is off or archived, gets the same 'nothing here' answer a working key gets, so nobody learns whether a product exists.

## The intro, for fun

Every door needs a polite way of saying no.

## The punchline, for fun

This one says it in two flavours, and never hints at what is behind it.

## The options, in plain words

A. As built: a sign-in that is no longer valid is refused so the terminal renews it once by itself; a person who is not a member, or a closed product, gets the 'nothing here' answer a working key gets.
B. Answer every refused sign-in the way a refused key is answered: the agent connects, and each search answers one line saying the sign-in does not work. The terminal then never renews on its own.
C. As built, but tell a valid sign-in of a person in none of the product's workspaces to ask to be added, at the price of saying the product exists.

## What I had to decide

Whether a refused sign-in answers like a refused key (a tool answer saying the key does not work) or like every other call of the terminal (a refusal the terminal renews its sign-in on).

## What I did meanwhile

The route answers 401 to a token the sign-in service refuses, 503 when that service cannot be reached, and 404 to a valid sign-in of a person who is not a member of the product's workspace now, or a product off, archived or unknown. Only a bearer shaped like a sign-in token (three dot-separated parts) goes to the sign-in service; any other bearer is checked as a key, exactly as before.

## What it costs to change later

A few lines in the route's controller and its tests; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a person who left is refused 'as a bad API key is'; a bad key answers a tool error, while a person who left now answers 404, as a working key of another workspace does: the route cannot tell 'left' from 'off' without saying whether the product exists.
- (author) The terminal's failure table (slice s2) then reads a person who left as 'This product's knowledge is off', which is not quite their case.

```

<!-- /omni-outbox-settled: s1-01-sign-in-refusals -->
