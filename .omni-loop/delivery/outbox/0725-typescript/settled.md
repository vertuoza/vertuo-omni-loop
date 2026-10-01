# Settled outbox items — PRD 725

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-arcade-keeps-erasable-syntax-off -->

## s1-01-arcade-keeps-erasable-syntax-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-arcade-keeps-erasable-syntax-off
prd: 725
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

About 25 files of the web app use code the new strict rule forbids, the rule that keeps only what Node can simply strip. Should the web app keep that one rule off for now?

## The decision, in plain words

The web app keeps that one rule off until a later slice clears its files. It is built by its own bundler, not run by Node directly, so nothing breaks meanwhile.

## The intro, for fun

Twenty-five files wrote their class fields the short way, and the new rulebook frowns at it.

## The punchline, for fun

The rulebook got a sticky note instead of a bonfire.

## The options, in plain words

A. A: the web app keeps the strip-only rule off for now; the final tightening slice turns it on once the web app slices rewrite those files
B. B: leave it off in the web app for good, since its own bundler compiles it and Node never strips it
C. C: rewrite the 25 web app files in a slice of their own before the final tightening, then turn the rule on

## What I had to decide

Whether the arcade must also forbid non-erasable syntax, and which slice clears its 25 files using parameter properties.

## What I did meanwhile

apps/galaxy/tsconfig.json sets erasableSyntaxOnly to false beside noUncheckedIndexedAccess false; the root project and the base config keep it on.

## What it costs to change later

One line in apps/galaxy/tsconfig.json to remove, and 25 arcade files (classes with parameter properties, mostly test stubs and stores) rewritten to declare their fields: a mechanical change in the arcade slices (s24 to s28) or the ratchet (s29).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's ratchet slice (s29) names only noUncheckedIndexedAccess for the arcade; who turns erasableSyntaxOnly on there is not planned (author)

```

<!-- /omni-outbox-settled: s1-01-arcade-keeps-erasable-syntax-off -->

<!-- omni-outbox-settled: s2-01-rename-leaves-records-as-written -->

## s2-01-rename-leaves-records-as-written — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-rename-leaves-records-as-written
prd: 725
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

The rename changes the names of about five hundred files. Should the written records that name them, such as past plans and decisions, be rewritten to the new names too?

## The decision, in plain words

Everything that says how things are today now uses the new names: the readme files, the team's playbook and the code-quality settings. Past plans, past decisions and recorded test data keep the old names, as they were written.

## The intro, for fun

Five hundred files changed their surname overnight, and the family album still has the old one.

## The punchline, for fun

The album stays as it was; only the address book got updated.

## The options, in plain words

A. A: rewrite readme files, the playbook and the code-quality settings; leave past plans, past decisions and recorded test data as written
B. B: rewrite everything, the past plans and decisions included
C. C: rewrite only the slice's own folders and the playbook, and leave the code-quality settings to a later change

## What I had to decide

Which files outside the slice's folders the rename may rewrite: the readme files, the playbook forms and the product registers, the code-quality tool's settings and saved findings were rewritten; the delivery records, the decision records, the kit's porting notes, the design specs and plans, the migrations and the recorded test fixtures were left as written.

## What I did meanwhile

scripts/ts-rename.mjs rewrites every text file except those under .omni-loop/delivery/, .omni-loop/knowledge/adr/, kit/porting/, docs/superpowers/, supabase/migrations/ and any fixtures/ folder. Inside the territory it changed the README files of game/, apps/ and packages/; outside it, .omni-loop/knowledge/playbook/ (four forms), .omni-loop/knowledge/product/invariants.md (one line), .fallowrc.jsonc and the three fallow/*.json baselines (file names only). The playbook had to follow: `omni check kb` fails when a form's evidence names a file that no longer exists.

## What it costs to change later

Running the script with a shorter frozen list rewrites the past records in one commit; putting a readme or the playbook back is a revert of its few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s2 does not name .omni-loop/knowledge/, .fallowrc.jsonc or fallow/, yet the spec asks the rename to rewrite every path that names a renamed file
- (author) Whether a decision record that names a file should follow a rename is not written down

```

<!-- /omni-outbox-settled: s2-01-rename-leaves-records-as-written -->

<!-- omni-outbox-settled: s2-02-code-quality-baselines-after-rename -->

## s2-02-code-quality-baselines-after-rename — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-code-quality-baselines-after-rename
prd: 725
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

After the rename, the code-quality check mistakes old known problems for new ones, because every file moved by a line and is read as a new language. Who refreshes its saved list of known problems, and when?

## The decision, in plain words

The saved list now uses the new file names, but it was not regenerated: the house rule says never to regenerate it just to turn the check green. Until someone refreshes it, the check on the final feature change will report old problems as new.

## The intro, for fun

Every known problem in the codebase moved one seat to the left, and the guest list no longer matches.

## The punchline, for fun

Nobody new came to the party; the seating chart just needs reprinting.

## The options, in plain words

A. A: keep the saved lists as renamed only, and refresh them once on the feature branch after the last typing slice
B. B: refresh them now in the rename slice, and again after each typing wave
C. C: refresh them only when the feature pull request's audit goes red, naming the rename as the reason

## What I had to decide

Whether to regenerate the fallow baselines (dead code, duplication, health) in the rename slice, against fallow/README.md's rule never to regenerate one to turn a red audit green.

## What I did meanwhile

fallow/dead-code.json, fallow/dupes.json and fallow/health.json carry the renamed file names and nothing else. A local `fallow audit` against the feature branch still reports inherited findings as new (clone groups and complexity under shifted line numbers, a duplicate export now seen between apps/galaxy/src/jev/mask.ts and kit/lib/openrouter.ts). The audit runs only on the feature pull request into main, not on this sub-pull request.

## What it costs to change later

Three commands from fallow/README.md, run once on the feature branch after the last typing slice (s29), in a commit of their own that says why.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a rename that moves every line counts as clearing findings, the one case fallow/README.md allows a regeneration, is not settled
- (author) Later typing slices move lines again, so a refresh now would go stale before the feature pull request is graded

```

<!-- /omni-outbox-settled: s2-02-code-quality-baselines-after-rename -->
