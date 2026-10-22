# Settled outbox items — PRD 2346

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-guide-page-tests -->

## s1-01-guide-page-tests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1
- Stays here: A one-off maintenance choice to keep tests green after adding a guide page; nothing lasting about product behaviour or architecture to record.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-guide-page-tests
prd: 2346
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

Adding the Knowledge map page to the guide changed the page count that two docs tests of the site hold. Should the slice have updated them?

## The decision, in plain words

The slice updated the page lists and counts in the two docs tests of the site so they include the new page, instead of leaving them red.

## The intro, for fun

A new page walks into the guide and every counter has to shuffle along.

## The punchline, for fun

Somebody had to move the chairs.

## The options, in plain words

A. A. Update the two docs test files to hold the new page (built).
B. B. Leave the test files alone and let the next slice that owns them update them, with the checks red meanwhile.

## What I had to decide

Edit the page list, titles, next links and counts in the two docs test files, nothing else.

## What I did meanwhile

The tests list the new page after Repository flow, its Next link pointing at Design craft.

## What it costs to change later

Moving the page, or renaming it, is one line in the guide's meta file and the same lines in the tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page belongs after Repository flow or elsewhere in the guide order (author).

```

<!-- /omni-outbox-settled: s1-01-guide-page-tests -->

<!-- omni-outbox-settled: s5-01-outside-territory-role-fixtures -->

## s5-01-outside-territory-role-fixtures — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s5
- Wave: 2
- Stays here: A one-off choice about fixing outside-territory test fixtures within this slice; the role rule itself is recorded elsewhere, nothing lasting here.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-outside-territory-role-fixtures
prd: 2346
slice: s5
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Two test files outside this slice's list held old role words that the new rule refuses, so they were updated to the new words. Are you fine with that?

## The decision, in plain words

The database check for repository links and the test for the targets command used old role words such as back-end. Once only the nine new roles are accepted, they would fail, so they now use new words and gained a case for an old word.

## The intro, for fun

The old role names were still on the guest list after the door policy changed.

## The punchline, for fun

The tests have been given new badges.

## The options, in plain words

A. A. Update the two files in this slice (built).
B. B. Leave them and let a later slice or person fix them, with the checks red meanwhile.

## What I had to decide

Updated supabase/checks/product_repositories.sql and kit/bin/commands/targets.test.ts to canonical roles, and added a case for a refused new role, an accepted null and a kept old role.

## What I did meanwhile

Every other test and check is untouched; the two files only changed role words and gained cases for the new rule.

## What it costs to change later

Reverting means putting the old role words back in both files, which also reverts the rule they test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The supabase checks could not be run here: no local database was available, so the new SQL check cases are unproven until CI runs them.

```

<!-- /omni-outbox-settled: s5-01-outside-territory-role-fixtures -->

<!-- omni-outbox-settled: s3-01-unmapped-governs-applies -->

## s3-01-unmapped-governs-applies — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 3
- Became: BR-PRODUCT-124, P-PRODUCT-102

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-unmapped-governs-applies
prd: 2346
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a repository has drawn no map of its areas and layers, should a rule that names the changed files still show in the top group, the one that says what applies here, or should everything sit in the global group?

## The decision, in plain words

A rule that names the changed files shows in the top group, saying it names them; every other law shows in the global group. The list holds exactly what it held before the map existed, only grouped.

## The intro, for fun

No map drawn, yet one rule still points straight at the file you are editing.

## The punchline, for fun

We let it raise its hand instead of hiding it in the crowd.

## The options, in plain words

A. Show a rule that names the changed files under Applies here, marked governs, and every other law under Global (built).
B. Show every entry under Global when nothing is mapped, a rule that names the files marked governs there.

## What I had to decide

Where a rule that names the changed files is shown when the repository has no map: in Applies here, marked governs, or under Global with every other entry.

Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

In a repository with no map, a rule whose Governs: line matches a changed file prints under Applies here, marked governs; every other locked law prints under Global, and no law is hidden. The entries listed are the ones the lookup listed before PRD 2346.

## What it costs to change later

One condition in the lookup and the expectations of the unmapped tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says both that a Governs: match applies and that, with no map, every entry is global; it does not say which wins for a Governs: match in an unmapped repository.

```

<!-- /omni-outbox-settled: s3-01-unmapped-governs-applies -->

<!-- omni-outbox-settled: s3-02-what-stays-global -->

## s3-02-what-stays-global — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 3
- Became: BR-PRODUCT-125, P-PRODUCT-103

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-what-stays-global
prd: 2346
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

Should a rule tagged only with layers that no file of the repository belongs to be shown for every change or for none? And should a past decision record with no area and no layer be listed for every change, or left out?

## The decision, in plain words

A rule no file can ever reach is shown for every change, so no rule goes unseen. A decision record with no tag is left out, as before, and a tagged one shows only when its tag meets a changed file.

## The intro, for fun

Some rules wear a badge for a club with no members yet.

## The punchline, for fun

Until the club opens, they stand in the main hall where everyone sees them.

## The options, in plain words

A. An entry whose layers nothing maps is global; an untagged decision record is never listed (built).
B. Any layer tag narrows an entry, mapped or not, so one tagged with an unmapped layer is hidden; untagged records still left out.
C. As built, and every untagged decision record listed under Global too.

## What I had to decide

Whether an entry whose only tags are layers the repository maps no path to is global or hidden, and whether an untagged decision record is listed under Global or not at all.

## What I did meanwhile

An entry is global when nothing on the map can narrow it: no Governs: line, a domain no area maps, and no layer the repository maps. A decision record is listed only under Applies here, when its Domain or Layers meet a changed file; a tagged one that does not is counted as hidden, and an untagged one is neither listed nor counted.

## What it costs to change later

One condition each in the lookup, and the tests that pin them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec defines global as naming no layer, and reachable as a layer the repository maps; it says nothing of decision records with no tag, which number in the hundreds here.

```

<!-- /omni-outbox-settled: s3-02-what-stays-global -->

<!-- omni-outbox-settled: s3-03-legal-from-local-copy -->

## s3-03-legal-from-local-copy — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 3
- Became: ADR-0120

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-legal-from-local-copy
prd: 2346
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The lookup now lists the product's legal entries for every change. Should it read them from the copy the last session start saved, or ask the Omni page each time?

## The decision, in plain words

It reads the saved copy and never calls the page, as the knowledge graph already does. With no copy saved yet, it lists no legal entry and says nothing about it.

## The intro, for fun

The legal entries live on the page, but the lookup runs in the terminal.

## The punchline, for fun

So it reads the copy in its pocket instead of phoning home every time.

## The options, in plain words

A. Read the saved copy, with no network call, and say nothing when there is none (built).
B. Read the saved copy, and print one line when there is none, pointing at omni kb legal.
C. Ask the Omni page on each call, falling back to the copy when it cannot be reached.

## What I had to decide

Where omni kb laws --paths and --slice read the Legal entries from: the local copy every session start refreshes, or the Omni page on each call; and what it says when there is no copy.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

The lookup reads the Legal entries from the product knowledge copy under .omni-loop/local/, written by omni kb legal and the session start, and makes no network call. No copy, or one that does not read, lists no Legal entry and prints no line about it.

## What it costs to change later

A line in the command: read the page through the same call omni kb legal makes, or print one line when the copy is missing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says every Legal entry prints under Global, not where the lookup reads them; whether a missing copy deserves a line is not settled.

```

<!-- /omni-outbox-settled: s3-03-legal-from-local-copy -->

<!-- omni-outbox-settled: s4-01-graph-paths-start-in-kb-command -->

## s4-01-graph-paths-start-in-kb-command — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 4
- Stays here: A local choice about where an edit landed across slice boundaries; it records nothing lasting about how the product behaves or is built.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-graph-paths-start-in-kb-command
prd: 2346
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

Making the graph command look files up the same way as the laws command meant a small edit in the shared knowledge command file, which belongs to an earlier slice. Is that edit fine?

## The decision, in plain words

The command that starts a graph from file names lived in the same file as the laws command. I swapped its old path matching for the shared lookup, and kept every other line of that file as it was.

## The intro, for fun

The graph asked for directions, and the laws command already had the map.

## The punchline, for fun

One borrowed lookup, and both commands now agree on where a file lives.

## The options, in plain words

A. A. Edit the graph command's start in the shared knowledge command file, nothing else in it (built).
B. B. Leave the graph command's old path matching and add a separate flag for the lookup later.

## What I had to decide

Edit the start of the graph command in the shared knowledge command file to call the lookup, and leave the rest of that file untouched.

## What I did meanwhile

The graph command starts from the rules, invariants and laws the lookup says apply to the files, and from the decision records when no rule applies.

## What it costs to change later

Moving the call into a helper elsewhere is a small edit, since the matching itself lives in a library file of this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan puts the shared knowledge command file in another slice's territory, yet the done-when asks the graph command to resolve files as the lookup does.

```

<!-- /omni-outbox-settled: s4-01-graph-paths-start-in-kb-command -->

<!-- omni-outbox-settled: s7-02-chart-test-reads-product-domain-only -->

## s7-02-chart-test-reads-product-domain-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s7
- Wave: 5
- Stays here: A test-scope choice inside one test file; the chart's behaviour is unchanged and nothing a person relies on depends on it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-chart-test-reads-product-domain-only
prd: 2346
slice: s7
rank: medium
bears-on: none
raised: 2026-10-22
wave: 5
---

## The question, in plain words

An arcade test of the knowledge chart read this repository's own knowledge and expected it to hold exactly one area. Now that it holds ten, may the test look at the product area alone, as it meant to?

## The decision, in plain words

The test now lays out this repository's product area by itself, so it still checks that a single area sits in the middle at full size, however many areas the repository grows.

## The intro, for fun

The chart test counted one sun in the sky, and this morning there were ten.

## The punchline, for fun

It now looks at the one sun it came for.

## The options, in plain words

A. Narrow the test to this repository's product area alone (built).
B. Let the test expect every area this repository holds, and update it whenever an area is added.

## What I had to decide

Keep the narrowed test (A), or have the test count every area this repository holds (B).

## What I did meanwhile

Only the test changed, outside this slice's folders; the chart itself is untouched, and every other chart test passes as before.

## What it costs to change later

One line of a test to change back or rewrite; nothing a person sees depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the chart was meant to be tested on this repository's live knowledge at all, or on a fixed one, is not written anywhere (author).

```

<!-- /omni-outbox-settled: s7-02-chart-test-reads-product-domain-only -->

<!-- omni-outbox-settled: s1-02-config-test-law-proof -->

## s1-02-config-test-law-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-22T09:09:03Z
- Channel: feature pull request #2348
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2348#issuecomment-6337062546
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Stays here: where a few config tests sit is a choice for this PRD's files only; no lasting product rule or decision.
- Wave: 1

### The answer, as it was given

```text
A. A. Keep the new tests and the two updated expectations in the config test file (built).
```

### The item, as it was raised

```text
---
id: s1-02-config-test-law-proof
prd: 2346
slice: s1
rank: high
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The config test file also proves a locked rule, and this slice added tests to it and changed two old expectations for the new alias tables. Are you fine with that file changing?

## The decision, in plain words

The slice put its new config tests in the existing config test file and updated the two expectations that held the old, unaliased words, as the spec says an alias reads as its canonical word.

## The intro, for fun

The old words got new names, so two old expectations had to learn them.

## The punchline, for fun

Same rule, same test, a few more words.

## The options, in plain words

A. A. Keep the new tests and the two updated expectations in the config test file (built).
B. B. Move the new tests to a file of their own and leave only the two updated expectations in the config test file.

## What I had to decide

Keep the new tests and the two updated expectations in the existing config test file; the law's own assertions are untouched.

## What I did meanwhile

A kind written rest reads as api, and a role written back-end reads as api, in every config the kit parses.

## What it costs to change later

Moving the new tests to a file of their own is a copy of those blocks; the two updated expectations stay either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which locked rule the config test file proves, and whether its owner wants the tests of other behaviour kept out of it (author).

```

<!-- /omni-outbox-settled: s1-02-config-test-law-proof -->

<!-- omni-outbox-settled: s2-01-knowledge-test-law-proof -->

## s2-01-knowledge-test-law-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-22T09:09:03Z
- Channel: feature pull request #2348
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2348#issuecomment-6337062546
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-95
- Raised: 2026-10-21
- Slice: s2
- Stays here: where a few knowledge-check tests sit is a choice for this PRD's files only; the rule it changed (a law needs no Governs:) is already the spec's and PRD 2346's.
- Wave: 2

### The answer, as it was given

```text
A. A. Keep the new tests and the changed expectation in the existing knowledge check test file (built).
```

### The item, as it was raised

```text
---
id: s2-01-knowledge-test-law-proof
prd: 2346
slice: s2
rank: high
bears-on: BR-PRODUCT-95
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The knowledge check's test file also proves a locked rule, and this slice replaced one of its expectations: a locked law with no list of paths is now accepted instead of refused, as the spec asks. Are you fine with that file changing?

## The decision, in plain words

The spec says a locked law no longer needs a list of paths, so the old expectation that refused one became one that accepts it. The new tests for layers and decision tags sit in the same file, and the rule's own assertions are untouched.

## The intro, for fun

A law lost its mandatory address, so the test that demanded one had to move on.

## The punchline, for fun

The check now asks where a law lives only if it knows.

## The options, in plain words

A. A. Keep the new tests and the changed expectation in the existing knowledge check test file (built).
B. B. Move the new tests to a file of their own and keep only the changed expectation in the existing file.

## What I had to decide

Keep the new tests and the one changed expectation in the existing knowledge check test file; the proof of the locked rule itself is untouched.

Decided by: Jev (hardToRevert 0.56) · agent said true

## What I did meanwhile

A locked law with no path list passes the knowledge check and is global or reached through its domain or layers.

## What it costs to change later

Moving the new tests to a file of their own is a small edit; restoring the old refusal is one expectation and one check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner wants the new tests beside the rule's proof or apart from it (author)

```

<!-- /omni-outbox-settled: s2-01-knowledge-test-law-proof -->

<!-- omni-outbox-settled: s7-01-laws-move-into-domain-folders -->

## s7-01-laws-move-into-domain-folders — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-22T09:25:32Z
- Channel: feature pull request #2348
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2348#issuecomment-6337389798
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-22
- Slice: s7
- Became: ADR-0117
- Wave: 5

### The answer, as it was given

```text
A. Move the laws and their areas' rules into nine area folders, and tag the 40 decisions (built).
```

### The item, as it was raised

```text
---
id: s7-01-laws-move-into-domain-folders
prd: 2346
slice: s7
rank: high
bears-on: none
raised: 2026-10-22
wave: 5
---

## The question, in plain words

Every locked law now sits in the folder of the area it protects, with its number and its words unchanged, so an agent working in that area sees it first and no longer sees the laws of other areas. Do you approve the move?

## The decision, in plain words

The twenty locked laws and 53 other rules of the same areas moved into nine area folders, word for word, each marked as moved; 40 design decisions now say which parts of the code they concern.

## The intro, for fun

Twenty laws packed their bags and moved to the neighbourhoods they guard.

## The punchline, for fun

Same words, same numbers, new street names.

## The options, in plain words

A. Move the laws and their areas' rules into nine area folders, and tag the 40 decisions (built).
B. Keep every law in the product list, shown for every file as today, and move only the rules that are not laws.
C. Move nothing yet: keep the map in the config only, and let a person sort the entries into areas later.

## What I had to decide

An owner of the laws (@pierrederval or @dervalp) approves this pull request on GitHub to keep the move, or answers B or C to have it reworked. A law moved into the wrong area would hide it from the agents working where it matters, so check each area's list in the pull request's body.

## What I did meanwhile

The nine areas are declared in the repository's config with no rule and no hook, so planning and merging are unchanged; every moved entry keeps its id, and the check that compares laws with the base branch reads it by that id.

## What it costs to change later

Cheap to undo: reverting the two commits puts every entry back in the product list and the config back as it was; no code reads the area folders by name.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The 40 decision tags were chosen from each decision's title and opening lines (author).
- Two rules stay global because no area holds them yet, BR-PRODUCT-109 and BR-PRODUCT-119 (author).
- Comments in a few tests still name the old product rules file for a law they prove (author).

```

<!-- /omni-outbox-settled: s7-01-laws-move-into-domain-folders -->
