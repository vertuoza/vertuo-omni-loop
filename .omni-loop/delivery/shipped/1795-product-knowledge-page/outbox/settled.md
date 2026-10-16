# Settled outbox items — PRD 1795

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-legal-source-free-text -->

## s1-01-legal-source-free-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-113, P-PRODUCT-94

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-legal-source-free-text
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec says a Legal entry's source law is a link, but its own example is the name of a law and an article. Should the page insist on a web link?

## The decision, in plain words

Any one line of up to 500 characters is accepted as the source law, a link or the law's name, so the spec's own example fits.

## The intro, for fun

A law can live at a web address or on page 53 of a thick book.

## The punchline, for fun

We took both, and the book did not complain.

## The options, in plain words

A. Any one line: a link or the name and article of the law.
B. Only a web address starting with http:// or https://.

## What I had to decide

Answer A to keep the free line, or B to accept only a web address.

## What I did meanwhile

The database takes any one line of text as the source; nothing checks that it is a web address.

## What it costs to change later

Requiring a link later is one changed check in a new migration; entries already stored without a link would then need editing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the people who write Legal entries keep their sources online or cite printed codes (author)

```

<!-- /omni-outbox-settled: s1-01-legal-source-free-text -->

<!-- omni-outbox-settled: s1-02-legal-entry-owner-default -->

## s1-02-legal-entry-owner-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-114, P-PRODUCT-95

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-legal-entry-owner-default
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Each Legal entry names an owner who answers for it. When nobody picks one, who is it?

## The decision, in plain words

The person who writes the entry owns it; for an entry that came from a proposal, the person who proposed it, unless they named someone else.

## The intro, for fun

Every rule of law needs somebody who will pick up the phone about it.

## The punchline, for fun

Whoever writes it down answers the phone, at least until they hand it over.

## The options, in plain words

A. The writer, or the proposer, owns the entry unless someone else is named.
B. The product's Legal owner owns every new entry unless someone else is named.

## What I had to decide

Answer A to keep the writer as the owner, or B to make the product's Legal owner the owner of every new entry.

## What I did meanwhile

A new entry with no owner given is owned by its writer, or by its proposer once approved; anyone allowed can change the owner later.

## What it costs to change later

Changing the default later touches one function; entries already stored keep the owner they got.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a product's Legal owner wants to answer for every entry by default (author)

```

<!-- /omni-outbox-settled: s1-02-legal-entry-owner-default -->

<!-- omni-outbox-settled: s1-03-named-owner-who-left -->

## s1-03-named-owner-who-left — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-115, P-PRODUCT-96

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-named-owner-who-left
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

If the person named as the Legal or Glossary owner leaves the team, who may decide its entries and proposals?

## The decision, in plain words

Someone who left no longer counts as named, so while nobody named is still on the team, the team's owners decide, as they do before anyone is named.

## The intro, for fun

The Glossary owner moved to another company and took the keys with them.

## The punchline, for fun

The spare keys were with the team's owners all along.

## The options, in plain words

A. A person who left names nobody: the team's owners decide until someone new is named.
B. A person who left still holds the kind: nobody decides until a team owner names someone new.

## What I had to decide

Answer A to keep this, or B to keep the departed person named so that only a team owner naming someone new unlocks it.

## What I did meanwhile

Only named people who are still members of the team count; the page shows no owner for a kind whose named person left.

## What it costs to change later

Changing it later is one function; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often a named owner leaves without a successor being named (author)

```

<!-- /omni-outbox-settled: s1-03-named-owner-who-left -->

<!-- omni-outbox-settled: s1-04-naming-an-owner-is-logged -->

## s1-04-naming-an-owner-is-logged — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-116, P-PRODUCT-97

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-naming-an-owner-is-logged
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec lists what the knowledge history records, but naming an owner or a delegate is not on the list. Should naming someone be recorded too?

## The decision, in plain words

Naming, changing or clearing an owner or a delegate is recorded in the history as a change of its own, with who was named before and after.

## The intro, for fun

A history that forgets who held the pen is only half a history.

## The punchline, for fun

So the pen gets a line of its own too.

## The options, in plain words

A. Naming an owner or a delegate is recorded in the history.
B. The history records only changes to entries and proposals.

## What I had to decide

Answer A to keep naming in the history, or B to leave it out.

## What I did meanwhile

The history has one more kind of change, named, beside added, edited, retired, removed, proposed, approved and rejected.

## What it costs to change later

Dropping it later means a migration that stops writing these rows; rows already written stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone will read the history of who was named, beside the entries' history (author)

```

<!-- /omni-outbox-settled: s1-04-naming-an-owner-is-logged -->

<!-- omni-outbox-settled: s1-05-app-read-knowledge-version -->

## s1-05-app-read-knowledge-version — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Stays here: A local plumbing choice that is cheap to move (one function and one read) and stores nothing lasting; no product guarantee or lasting architecture rides on it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-app-read-knowledge-version
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The phase-0 check must judge a spec again when a Legal entry changes. Where does it learn that something changed?

## The decision, in plain words

The business read the phase-0 check uses also answers the number of the product's newest knowledge change, so the check can key its stored verdict on it.

## The intro, for fun

A judge who never hears that the law changed keeps ruling by the old one.

## The punchline, for fun

Now the judge finds a note on the desk each morning.

## The options, in plain words

A. The phase-0 check's business read carries the newest knowledge change.
B. The phase-0 check asks for the newest knowledge change in a read of its own.

## What I had to decide

Answer A to keep the number in that read, or B to have the check ask for it separately.

## What I did meanwhile

The read the phase-0 check uses carries one more field beside the Legal entries and the glossary; the terminal's and agents' read does not.

## What it costs to change later

Moving it later is one function and the check's read; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How slice s7 will build its cache key; it is designed for this field but not yet built (author)

```

<!-- /omni-outbox-settled: s1-05-app-read-knowledge-version -->

<!-- omni-outbox-settled: s2-01-knowledge-tab-one-route-reload -->

## s2-01-knowledge-tab-one-route-reload — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s2
- Wave: 2
- Stays here: A local build choice inside the Knowledge tab, cheap to change in one slice, with no lasting product guarantee beyond what the code already shows.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-knowledge-tab-one-route-reload
prd: 1795
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The Knowledge tab sends every change (add, edit, retire, propose, approve, reject, name an owner) through one route, and the page reloads after a change. Is that the shape you want?

## The decision, in plain words

One route takes all seven kinds of change, and the page reloads once a change is saved, so the screen always shows what the database now holds. A new entry's owner is the person who adds it; the page has no control to give an entry to someone else.

## The intro, for fun

The Knowledge tab keeps one front door for every change.

## The punchline, for fun

Seven kinds of change walk in, and the page reloads to greet the result.

## The options, in plain words

A. A. One route for all changes, page reloads after a change (built)
B. B. One route per verb (links, entries, proposals, owners), same reload
C. C. One route, rows update in place without a reload

## What I had to decide

Option A is built. B changes one route into one per verb, and C updates the rows in place without a reload; each is a follow-up slice that touches only the Knowledge tab.

## What I did meanwhile

People use the tab as built: a reload after each change, owners as the person who added the entry.

## What it costs to change later

B or C is one small slice each, inside apps/galaxy/src/product-knowledge/.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reload is acceptable on a product with dozens of entries (author)

```

<!-- /omni-outbox-settled: s2-01-knowledge-tab-one-route-reload -->

<!-- omni-outbox-settled: s2-02-knowledge-screen-mockup-file -->

## s2-02-knowledge-screen-mockup-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s2
- Wave: 2
- Stays here: A one-off choice about a design draft file for this slice; it states nothing lasting about the product's behaviour and is cheap to change.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-knowledge-screen-mockup-file
prd: 1795
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The new Knowledge screen's library entry needs a mockup page beside it, but the plan lists only the entry itself as this slice's ground. Is a mockup page the right thing to add?

## The decision, in plain words

The screen library asks every entry to point at a mockup page, so the slice added one next to the entry, drawn by hand from the built screen. It is a draft and was not rendered in a browser here.

## The intro, for fun

Every screen in the library wants a picture, even a young one.

## The punchline, for fun

This one posed from memory, so someone should check the likeness.

## The options, in plain words

A. A. A hand-drawn mockup page beside the entry (built)
B. B. No mockup page, and no mock line in the entry
C. C. A mockup page drawn by /omni:pixel-perfect mock from the running screen

## What I had to decide

Option A is built: a hand-drawn mockup beside the entry. B removes the mockup and the entry's mock line; C replaces it with one drawn by the screen skill from the running app.

## What I did meanwhile

The entry stays a draft, never locked, with its open questions listed.

## What it costs to change later

B or C touches only the two files in the screens folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The mockup was drawn from the source, not from a screenshot of the running tab (author)

```

<!-- /omni-outbox-settled: s2-02-knowledge-screen-mockup-file -->

<!-- omni-outbox-settled: s5-01-retired-legal-reads-as-not-held -->

## s5-01-retired-legal-reads-as-not-held — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s5
- Wave: 2
- Stays here: An interim choice waiting on a later slice that adds retired entries to the business read; it is not a lasting guarantee, so it stays in the ledger.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-retired-legal-reads-as-not-held
prd: 1795
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

When a rule names a Legal entry that the product retired, the check cannot tell it from one that never existed, because the page only lists active entries. Should the page also say which entries were retired?

## The decision, in plain words

The check says the product does not hold the entry for both a retired and an unknown entry. The separate retired message waits until the page lists retired entries.

## The intro, for fun

The page forgets retired entries the moment they leave the list.

## The punchline, for fun

So the check can only say they are gone, not why.

## The options, in plain words

A. A. Say not held for both, as built.
B. B. Add retired ids to the business read and print the retired message.

## What I had to decide

Add a retired list to the business read in a later slice, then the check can print the retired message.

## What I did meanwhile

A retired entry fails the check with the not-held message.

## What it costs to change later

A small addition to the business read and one more line in the check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for a retired message but fixes the business read to active entries only (author)

```

<!-- /omni-outbox-settled: s5-01-retired-legal-reads-as-not-held -->

<!-- omni-outbox-settled: s6-01-words-check-own-copy-reader -->

## s6-01-words-check-own-copy-reader — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s6
- Wave: 2
- Stays here: A local code-organisation choice made to keep slice boundaries; no lasting product guarantee or architectural decision to record.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-words-check-own-copy-reader
prd: 1795
slice: s6
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The words check needs to read the saved copy of the product's glossary, but the reader that already exists belongs to another slice's files. Should the words check keep a small reader of its own, or share the existing one?

## The decision, in plain words

The words check has a small reader of its own for the saved glossary copy, so no file outside this slice was touched.

## The intro, for fun

Two readers, one little file, and a strict seating plan.

## The punchline, for fun

For now each keeps its own chair; merging them is a later tidy-up.

## The options, in plain words

A. A. The words check reads the copy with its own small reader (as built)
B. B. Export the existing reader from the product-knowledge module and use it here

## What I had to decide

Pick A to keep the second small reader, or B to export the existing reader and have the words check use it.

## What I did meanwhile

The words check works fully offline with its own reader.

## What it costs to change later

Two short readers of the same file could drift apart if the copy's shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether sharing the reader is worth touching the product-knowledge module (author)

```

<!-- /omni-outbox-settled: s6-01-words-check-own-copy-reader -->

<!-- omni-outbox-settled: s7-01-canon-change-the-entry-button -->

## s7-01-canon-change-the-entry-button — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s7
- Wave: 2
- Stays here: A sequencing choice about slice territory, cheap to change and with nothing lasting to keep; it belongs in the ledger, not the knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-canon-change-the-entry-button
prd: 1795
slice: s7
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

When the check turns red on a Legal entry, the spec asks for a button called Change the entry that opens the entry on the Knowledge tab. Where should that button be built?

## The decision, in plain words

The check now judges a spec against the product's Legal entries and names the sentence and the entry, but the button lives in code outside this slice's allowed folder, so it was not built here.

## The intro, for fun

The law is read, the sentence is quoted, but the button is still in another room.

## The punchline, for fun

Somebody has to carry it down the hall.

## The options, in plain words

A. A. Leave the button for a follow-up slice that owns the inbox check's canon actions (what was built)
B. B. Widen this slice's territory to the inbox check folder and build the button now

## What I had to decide

Add the Change the entry button and its link in the inbox check's canon actions (a follow-up slice that owns that folder), or widen a slice's territory to include it.

## What I did meanwhile

A red canon check on a Legal entry names the entry and quotes the spec; the existing Change the line button still opens Settings, Business.

## What it costs to change later

One small follow-up slice; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The product page address a Knowledge tab link needs was not available inside the canon folder (author)

```

<!-- /omni-outbox-settled: s7-01-canon-change-the-entry-button -->

<!-- omni-outbox-settled: s3-01-mcp-server-test-proves-br-product-66 -->

## s3-01-mcp-server-test-proves-br-product-66 — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-16T07:13:21Z
- Channel: feature pull request #2032
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2032#issuecomment-6210174090
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-66
- Raised: 2026-10-16
- Slice: s3
- Wave: 2
- Became: playbook/testing#layout

### The answer, as it was given

```text
A. Keep the new tests in the same file as that rule's proof (what was built)
```

### The item, as it was raised

```text
---
id: s3-01-mcp-server-test-proves-br-product-66
prd: 1795
slice: s3
rank: high
bears-on: BR-PRODUCT-66
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The agent link's tests now also check the legal entries and the glossary, in the same file that proves the rule "Jev judges an agent's question only on the report that first stores it". Is that all right?

## The decision, in plain words

The new tests sit beside that rule's own tests, and none of the rule's tests or the code it governs changed.

## The intro, for fun

A new shelf went up in the room where the rule's proof lives.

## The punchline, for fun

Nobody moved the rule's own furniture.

## The options, in plain words

A. Keep the new tests in the same file as that rule's proof (what was built)
B. Move the new tests to a file of their own, so the rule's proof is left alone

## What I had to decide

Whether tests of the agent link's two new fields may live in the test file that also proves BR-PRODUCT-66.

## What I did meanwhile

Kept them in `apps/galaxy/src/agent-connect/mcp/server.test.ts`, next to the `get_business` tests already there. Every test of BR-PRODUCT-66 still passes unchanged.

## What it costs to change later

Moving the new tests to another file is a small follow-up change; nothing stored changes.

## What I could not know

(author) Whether the owner of BR-PRODUCT-66 wants its proof file to hold only that law's tests.

```

<!-- /omni-outbox-settled: s3-01-mcp-server-test-proves-br-product-66 -->

<!-- omni-outbox-settled: s7-02-canon-test-proves-br-product-68 -->

## s7-02-canon-test-proves-br-product-68 — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-16T07:13:21Z
- Channel: feature pull request #2032
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2032#issuecomment-6210174090
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-68
- Raised: 2026-10-16
- Slice: s7
- Wave: 2
- Stays here: the owner kept BR-PRODUCT-68's words as written; the canon gate already holds Legal entries to it in code and tests

### The answer, as it was given

```text
A. Keep the rule's words, and hold legal entries to it in the code and its tests (what was built)
```

### The item, as it was raised

```text
---
id: s7-02-canon-test-proves-br-product-68
prd: 1795
slice: s7
rank: high
bears-on: BR-PRODUCT-68
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The spec check now also judges a spec against the product's legal entries, under the rule "it turns red only when it quotes the spec and names the Never line or Statement broken". Should that rule's words also name legal entries?

## The decision, in plain words

A legal entry is held to the same rule: red only with a word-for-word quote and a live entry, never a retired one. The rule's words were left as they are.

## The intro, for fun

The guard learned a new rulebook to read from.

## The punchline, for fun

It still won't shout without a quote.

## The options, in plain words

A. Keep the rule's words, and hold legal entries to it in the code and its tests (what was built)
B. Reword the rule to name legal entries beside Never lines and Statements, in a follow-up change
C. Give legal entries a rule of their own

## What I had to decide

Whether judging a spec against Legal entries in the canon gate, proven in BR-PRODUCT-68's own test file (`apps/omni-app/src/canon/canon.test.ts`), needs that law's text to change.

## What I did meanwhile

Five new tests: a red finding needs a word-for-word quote and a live `L-<CODE>-<n>`, a retired entry is never cited, and a changed entry changes the cache key. No existing test was changed or removed.

## What it costs to change later

Rewording the law is a knowledge-only change; the code already follows the stricter reading.

## What I could not know

(author) Whether the law's owner wants its words to name Legal entries.

```

<!-- /omni-outbox-settled: s7-02-canon-test-proves-br-product-68 -->
