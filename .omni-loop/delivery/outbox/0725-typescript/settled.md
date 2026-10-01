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

<!-- omni-outbox-settled: s3-01-bundle-rebuilt-on-zod-4 -->

## s3-01-bundle-rebuilt-on-zod-4 — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-bundle-rebuilt-on-zod-4
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The tool other repositories install is one big file, and the new library version makes it about sixty percent larger. Is that size acceptable?

## The decision, in plain words

The file was rebuilt with the new library and grows by about two thirds, to under two megabytes. It behaves the same and prints the same settings as before.

## The intro, for fun

The library came back from its upgrade with a suitcase full of languages.

## The punchline, for fun

Nobody asked for the French error messages, but they are on board now.

## The options, in plain words

A. Keep the larger rebuilt file, which behaves the same
B. Strip the library's foreign-language messages out of the file when it is built, and rebuild
C. Switch to the library's slimmer edition and rewrite the shapes to fit it

## What I had to decide

Moving to Zod 4 changes the code the committed bundle carries, so kit/test/dist.test.ts fails until kit/dist/omni.mjs is rebuilt, and kit/dist/ is outside s3's territory. Zod 4's classic entry exports every locale, which esbuild cannot shake out: the bundle grows from 1 071 145 to 1 715 301 bytes.

## What I did meanwhile

Rebuilt kit/dist/omni.mjs with `node kit/build.ts` and committed it alone. `node kit/dist/omni.mjs config` prints the same JSON as the bundle on the feature branch did.

## What it costs to change later

Cheap: a later slice can trim the locales (an esbuild alias for zod's locales, or `zod/mini`) and rebuild; the bundle is regenerated on every release anyway.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a 1.7 MB bundle matters to anyone installing the kit (author)
- Whether s17, which owns kit/build, would rather trim the locales there (author)

```

<!-- /omni-outbox-settled: s3-01-bundle-rebuilt-on-zod-4 -->

<!-- omni-outbox-settled: s3-02-kit-keeps-zod-3-wording -->

## s3-02-kit-keeps-zod-3-wording — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-kit-keeps-zod-3-wording
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The new library words its error messages differently, so the tool would start printing new wording for the same mistakes. Should the tool keep its old wording?

## The decision, in plain words

The tool keeps the old wording for every mistake it reports, so people see the same messages as before. The web app and the game take the new wording.

## The intro, for fun

The library learned to say 'Invalid input: expected string, received undefined' instead of 'Required'.

## The punchline, for fun

The tool politely asked it to keep using its inside voice.

## The options, in plain words

A. The tool keeps the old wording; the web app and the game take the new
B. Every part keeps the old wording, the web app and the game included
C. Everyone takes the new wording, and the tool's tests change with it

## What I had to decide

Zod 4 rewrote every default issue message ('Required' became 'Invalid input: expected string, received undefined'). The kit prints those messages (config errors, inbox, outbox and account front matter, the item command), and the PRD says a person running omni must notice nothing; apps/galaxy's release sync test caught the change.

## What I did meanwhile

Added kit/lib/schema/messages.ts: KIT_MESSAGES, an error map giving Zod 3's words issue by issue, passed at each kit parse (`safeParse(value, { error: KIT_MESSAGES })`). A message a schema names itself still wins. The arcade's and the game's own schemas print Zod 4's default words.

## What it costs to change later

Cheap: drop the option at each parse site to take Zod 4's words, or pass it in the arcade and the game too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone relies on the exact default wording in the arcade's or the game's errors (author)

```

<!-- /omni-outbox-settled: s3-02-kit-keeps-zod-3-wording -->

<!-- omni-outbox-settled: s3-04-config-schema-stays-in-config -->

## s3-04-config-schema-stays-in-config — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-config-schema-stays-in-config
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The plan asks for the settings' shape to sit with the other shared shapes, but a check allows the default addresses in one file only. Where should it live?

## The decision, in plain words

The settings' shape stays where it was, and the shared shapes folder points to it. Nothing about the settings changed.

## The intro, for fun

The settings were packed and ready to move to the new shared folder.

## The punchline, for fun

Then the guard at the door said their name was only on one list.

## The options, in plain words

A. The settings' shape stays where it was, and the shared folder points to it
B. Move the settings' shape into the shared folder, and move the check's exception with it

## What I had to decide

Moving ConfigSchema to kit/lib/schema/config.ts fails kit/test/no-literals.test.ts: the config's defaults (branch shapes, labels, signature.home) are the repository literals it exempts in lib/config.ts only, as ADR-0047 records. The test is outside s3's territory.

## What I did meanwhile

ConfigSchema stays defined in kit/lib/config.ts, which is now typed (no @ts-nocheck); kit/lib/schema/config.ts re-exports it, and Config in kit/lib/types.ts is z.infer of it. Its sections now default through prefault, because a Zod 4 default no longer parses the value it fills in.

## What it costs to change later

Cheap: move the block and add lib/schema/config.ts to the test's exemptions, in a slice owning kit/test/.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s29's review wants the definition itself under kit/lib/schema/ (author)

```

<!-- /omni-outbox-settled: s3-04-config-schema-stays-in-config -->

<!-- omni-outbox-settled: s3-05-openrouter-left-untyped -->

## s3-05-openrouter-left-untyped — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-05-openrouter-left-untyped
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

A few files this slice touched belong to no later step of the plan, so nobody would ever finish converting them. Who should?

## The decision, in plain words

This slice converted the two small ones fully. The one that talks to the language model, and the settings' own tests, stay unconverted and are flagged for the final step.

## The intro, for fun

Three files raised their hands when the plan called out who owns them, and only this slice did.

## The punchline, for fun

It adopted the two quiet ones and left a note on the loud one's door.

## The options, in plain words

A. Leave the three files for the final step's review to assign
B. Give them to the step that converts the tool's other language-model callers
C. Convert them in this slice before it merges

## What I had to decide

kit/lib/config, kit/lib/front-matter and kit/lib/openrouter are in s3's territory and in no later slice's, so the ratchet (s29) would find their @ts-nocheck still there. s3's own done-when asks for schemas, not for its files to be typed.

## What I did meanwhile

Typed kit/lib/config.ts and kit/lib/front-matter.ts (no @ts-nocheck). Left kit/lib/openrouter.ts (45 errors, and its network replies still to be parsed through a schema) and the tests kit/lib/config.test.ts and kit/lib/openrouter.test.ts (they drive kit/bin, typed by s17) with @ts-nocheck.

## What it costs to change later

Cheap: a follow-up slice, or s29's review, types the three files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which slice the plan meant to type kit/lib/openrouter (author)

```

<!-- /omni-outbox-settled: s3-05-openrouter-left-untyped -->

<!-- omni-outbox-settled: s4-01-heading-without-hashes-still-crashes -->

## s4-01-heading-without-hashes-still-crashes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-heading-without-hashes-still-crashes
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

Typing the rules reader showed that a configured invariants heading written without its leading hash signs makes the tool crash instead of saying what is wrong. Should this slice fix it?

## The decision, in plain words

Left as it is: this slice only adds types and must not change what the tool does. The crash is kept, marked, and left for its own fix later.

## The intro, for fun

The compiler pointed at a heading with no hash signs and asked what happens next.

## The punchline, for fun

What happens next is a crash, now with a sticky note on it.

## The options, in plain words

A. A: keep the crash as it is in this typing slice, and fix it in its own pull request later
B. B: have the settings file refuse such a heading, with a message naming the setting
C. C: read such a heading as covering the rest of the rules page, with no crash

## What I had to decide

Whether to change invariantAdrs in kit/lib/laws.ts so a laws.claudeMdHeading with no leading '#' fails with a named error instead of a TypeError, or keep today's behaviour while typing the file.

## What I did meanwhile

invariantAdrs keeps today's behaviour: the heading's '#' run is read with a non-null assertion, on a line marked `// ts-allow:`, so a heading with no '#' that CLAUDE.md does contain still throws the same TypeError as before. Nothing else changed.

## What it costs to change later

One line in kit/lib/laws.ts and a test: refuse such a heading in the config schema (laws.claudeMdHeading must start with '#'), or treat it as level 0 in invariantAdrs. Either is a small, separate fix PR.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any repository sets laws.claudeMdHeading without a leading '#' today is unknown (author)

```

<!-- /omni-outbox-settled: s4-01-heading-without-hashes-still-crashes -->

<!-- omni-outbox-settled: s4-02-core-reads-config-keys-one-by-one -->

## s4-02-core-reads-config-keys-one-by-one — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-core-reads-config-keys-one-by-one
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The core modules need the type of the whole settings file, but the slice that writes the shared types runs at the same time. Where should the core modules take that type from meanwhile?

## The decision, in plain words

They take it from what the settings reader already returns, and read the few settings they use one by one. Once the shared types land, the same code simply gets stricter.

## The intro, for fun

Two slices needed the same settings type on the same afternoon.

## The punchline, for fun

One borrowed it from the reader and promised to give it back.

## The options, in plain words

A. A: borrow the type from the settings reader now, and read the few settings used one by one
B. B: wait for the shared types slice before typing the core modules
C. C: write a separate hand-made settings type in the core modules now

## What I had to decide

Which Config type kit/lib/context.ts exports while s3 (kit/lib/types.ts, kit/lib/schema/) is in flight in the same wave, and how sections typed loosely by config.ts's untyped section() helper are read.

## What I did meanwhile

context.ts exports `Config = ReturnType<typeof loadConfig>` and `Context = ReturnType<typeof createContext>`. Because config.ts is still @ts-nocheck, its `section()` sections (paths, laws, markers…) come out as `{ [x: string]: any }`; createContext passes the four `paths` keys the layout reads one by one, and lawsFor reads `laws.source` and `laws.claudeMdHeading` into typed locals. Functions that need little take narrow structural types (`{ root: string }`, `TrailerSignature`, `LayoutPaths`, `BoardConfig`). No cast was added.

## What it costs to change later

A one-line change in context.ts to `export type { Config } from './types.ts'` (or z.infer of s3's schema) once s3 merges; the key-by-key reads keep working and can be folded back to `config.paths` when the section types are exact.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3 will type config.ts's section() helper so its sections infer exactly is not settled in the plan (author)

```

<!-- /omni-outbox-settled: s4-02-core-reads-config-keys-one-by-one -->

<!-- omni-outbox-settled: s4-03-core-text-reads-stay-unschemaed -->

## s4-03-core-text-reads-stay-unschemaed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-core-text-reads-stay-unschemaed
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The core modules read plain text from version control and folder names from disk, and the board takes pull request lists that another module fetched. Should each of those pass a validation schema here?

## The decision, in plain words

No new schema in this slice: the text is already a plain string handled by the existing parsers, and the pull request list should be checked where it is fetched, which belongs to the slice that types the command line.

## The intro, for fun

Plain text walked up to the schema desk and asked what form to fill in.

## The punchline, for fun

It was told strings fill in their own form, and to come back as JSON.

## The options, in plain words

A. A: plain text stays a typed string, and the pull request list is checked where it is fetched, in the command line slice
B. B: add a schema for the pull request list beside the board now, unused until the command line slice wires it
C. C: wrap every plain text read here in a schema as well

## What I had to decide

Whether the done-when rule 'every value read from a file, a process, the network or the environment passes a Zod schema' asks for a schema on git stdout (check-report.trackedFiles, git.rangeChanges, context.loadContext), on directory listings (layout, laws, fix-verdict), on CLAUDE.md's text (laws), and on the gh pr list payload boardFor receives.

## What I did meanwhile

No Zod import was added in this slice's files. Process output is typed `string` through an `ExecText` runner type, and parsed by the parsers already there (parseNameStatus, slugFromRemote, invariantAdrs). boardFor's payload is typed `BoardPr` with every field optional, as the board already tolerates; the gh JSON is read in kit/bin/commands/board.ts (s17's territory), where its schema belongs.

## What it costs to change later

A schema for the pull request payload in s17 (kit/bin/commands/board.ts) parsing into BoardPr; or a small `z.string()` wrap around each runner call here, one line each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether unstructured text output counts as a value that needs a schema (author)

```

<!-- /omni-outbox-settled: s4-03-core-text-reads-stay-unschemaed -->

<!-- omni-outbox-settled: s4-04-typing-slice-commits-rebuilt-bundle -->

## s4-04-typing-slice-commits-rebuilt-bundle — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-typing-slice-commits-rebuilt-bundle
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

Typing a module changes a few lines of the built tool that other repositories install, a file no typing slice owns. Should each typing slice commit that rebuilt file?

## The decision, in plain words

Yes: this slice commits the rebuilt tool beside its own changes, so the check that it matches the source stays true. When several slices merge, the merger rebuilds it once more instead of resolving its lines by hand.

## The intro, for fun

A tidy-up of the source nudged a few lines in the built tool nobody owns.

## The punchline, for fun

The built tool shrugged and said it would just be rebuilt again anyway.

## The options, in plain words

A. A: each typing slice commits the rebuilt tool, and the wave rebuilds it again when slices collide on it
B. B: typing slices leave the built tool alone, and the wave rebuilds it once after merging them all
C. C: give the built tool to the command line slice, and let the check stay red until then

## What I had to decide

Whether s4 may commit kit/dist/omni.mjs, outside its territory, after typing its modules changed a handful of statements in the bundle (destructuring defaults, `?.`/`??` for noUncheckedIndexedAccess, key-by-key reads of config.paths).

## What I did meanwhile

kit/dist/omni.mjs is rebuilt with `pnpm kit:build` and committed in its own commit on the slice branch; the full suite (kit/test/dist.test.ts included) is green against it. The bundle's behaviour is unchanged: every change is a rewrite TypeScript asked for that computes the same values.

## What it costs to change later

If the wave would rather rebuild the bundle itself after merging every slice of the wave, drop this commit and run `pnpm kit:build` on the feature branch: a generated file, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no owner for kit/dist/omni.mjs after s2, though every typing slice of the kit changes it (author)

```

<!-- /omni-outbox-settled: s4-04-typing-slice-commits-rebuilt-bundle -->

<!-- omni-outbox-settled: s5-01-fallow-skips-generated-database-types -->

## s5-01-fallow-skips-generated-database-types — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-fallow-skips-generated-database-types
prd: 725
slice: s5
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The new generated description of the database repeats one shape per table, so the dead-code and copy-paste checker flags it as duplicated and unused. Should that checker leave the generated file alone?

## The decision, in plain words

The checker now treats the generated file as a starting point and skips it when looking for copy-paste, so it reports nothing on code nobody writes by hand.

## The intro, for fun

A machine wrote a very repetitive file, and another machine complained about the repetition.

## The punchline, for fun

We asked the second machine to look away politely.

## The options, in plain words

A. Skip the generated file: List it as an entry and ignore it for duplication in the checker's config. Built.
B. Grade it like any file: Remove the two lines; the feature's pull request into main fails the checker until a baseline is regenerated to absorb the file.
C. Absorb it in the baseline: Regenerate the checker's baselines on the feature branch so today's findings on the file are inherited, and new ones still count.

## What I had to decide

Whether the copy-paste and dead-code checker should skip the generated database types file, or keep grading it like hand-written code.

## What I did meanwhile

The checker skips the generated file for copy-paste, and counts it as a starting point, so the feature's pull request into main stays green on it.

## What it costs to change later

Undoing it is two lines of the checker's config; nothing else depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The briefing says never add a suppression to turn a check green; skipping a generated file reads as a narrow exception, but a person should confirm it (author)
- The checker's config file sits outside this slice's territory (author)

```

<!-- /omni-outbox-settled: s5-01-fallow-skips-generated-database-types -->

<!-- omni-outbox-settled: s6-01-design-reads-browser-types -->

## s6-01-design-reads-browser-types — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-design-reads-browser-types
prd: 725
slice: s6
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The drawing helpers paint on browser canvases, but the main type check only knows the server's words. How should the check learn what a canvas is?

## The decision, in plain words

The two drawing files now tell the check to load the browser's vocabulary. The whole main check then knows browser words too, which other parts of the code could start to lean on.

## The intro, for fun

The paintbrush walked into a room that had never heard of paint.

## The punchline, for fun

So it brought its own dictionary, and lent it to everyone.

## The options, in plain words

A. Keep the browser reference in the two drawing files, the whole main check sees browser words
B. Give the design package its own check settings with browser words, and leave the main check without them
C. Describe the few canvas pieces the helpers use by hand, so no browser vocabulary is loaded at all

## What I had to decide

draw.ts and logo.ts name canvas types (CanvasRenderingContext2D, OffscreenCanvas, HTMLCanvasElement) that the root tsconfig, lib es2023 with only node types, does not declare.

## What I did meanwhile

Added `/// <reference lib="dom" />` at the top of packages/design/src/draw.ts and logo.ts. That pulls lib.dom into the root program, so every root file type-checks with DOM globals beside @types/node.

## What it costs to change later

A constant: delete the two reference lines and give packages/design its own tsconfig with lib dom (the root then excludes it), or declare small structural canvas types locally. No runtime code changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether DOM globals in the root program will hide a missing import or widen a timer type in a later typing slice; no file outside packages/design is checked yet, as all are still @ts-nocheck.

```

<!-- /omni-outbox-settled: s6-01-design-reads-browser-types -->

<!-- omni-outbox-settled: s8-01-reply-comments-typed-not-parsed -->

## s8-01-reply-comments-typed-not-parsed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-reply-comments-typed-not-parsed
prd: 725
slice: s8
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The reader of pull request replies takes the comments GitHub sends as they come. Should it check every comment against a strict shape before reading it?

## The decision, in plain words

The reader keeps reading comments as it does today, with their shape only described for the compiler, so no reply that counts now is ever dropped.

## The intro, for fun

Every comment from GitHub walks in without showing its papers.

## The punchline, for fun

The doorman got a guest list, not a metal detector.

## The options, in plain words

A. Keep reading comments as today, typed for the compiler but not checked at runtime
B. Check each comment against a lenient shape and skip any that fails, saying which field was wrong
C. Check each comment against a strict shape and stop the run on the first one that fails

## What I had to decide

Whether the GitHub comments readReplies and planReplies read (body, user, author_association, created_at, html_url) must pass a Zod schema, as the plan's done-when asks of every value read from the network.

## What I did meanwhile

kit/lib/outbox/replies.ts describes the comment as a ReplyComment type and narrows it at runtime exactly as before (a comment whose body is not a string is skipped by isCountedReply). No schema parses it, because a strict one would refuse comments the reader tolerates today, which changes output; the arcade also calls planReplies with its own rows.

## What it costs to change later

One schema in kit/lib/outbox (all fields optional, unknown keys kept) parsed at the top of planReplies, plus deciding what a comment that fails it becomes: skipped, or an error naming its field. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a malformed comment from GitHub should be skipped silently, as today, or fail the run with its field named
- (author) Whether the arcade's own GitHub reader should parse the same comments first, so the kit's reader receives parsed rows only

```

<!-- /omni-outbox-settled: s8-01-reply-comments-typed-not-parsed -->

<!-- omni-outbox-settled: s8-02-bridges-to-neighbouring-slices -->

## s8-02-bridges-to-neighbouring-slices — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-bridges-to-neighbouring-slices
prd: 725
slice: s8
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The outbox files typed here lean on files other slices are typing at the same time. Should this slice wait for them, or bridge the gap with marked shortcuts?

## The decision, in plain words

This slice bridges the gap with three marked shortcuts that state the shapes it expects, so it can finish now. Once the neighbouring files are typed, each shortcut becomes a no-op that the final tightening slice can remove.

## The intro, for fun

Two crews are building the same bridge from opposite banks.

## The punchline, for fun

This crew left a rope ladder and a note saying where the bolts go.

## The options, in plain words

A. Keep the marked bridges now and remove them in the final tightening slice
B. Rebase this slice on s7 once it merges and drop the bridges here
C. Move the narrowing reader and the shared outbox types into the kit-wide types file

## What I had to decide

How the settle, replies and check modules read results from outbox.ts and comment.ts, which slice s7 types in the same wave, and how planReplies keeps compiling for the arcade, which passes it loosely typed rows.

## What I did meanwhile

settle.ts exports parseItem, a wrapper over parseOutboxItem that returns { ok: true, item: OutboxItem } or { ok: false, errors } through one cast marked ts-allow; replies.ts casts openItemsForPrd's result to OutboxItem[] and keeps planReplies' wide object parameters, narrowing them once inside with a marked cast. settle.ts also exports the folder-local types the outbox shares (Markers, SettleContext, Judgement, SettledEntry, Verdict).

## What it costs to change later

Three casts to delete once s7 and the arcade slices land, and parseItem either kept as the one narrowing reader or replaced by parseOutboxItem at its four call sites. No output changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The exact return type s7 gives parseOutboxItem and openItemsForPrd was not known while this slice ran in parallel
- (author) Whether the arcade slices will type the rows they pass to planReplies with the kit's own types

```

<!-- /omni-outbox-settled: s8-02-bridges-to-neighbouring-slices -->

<!-- omni-outbox-settled: s9-01-harvest-binds-untyped-units -->

## s9-01-harvest-binds-untyped-units — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s9
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-harvest-binds-untyped-units
prd: 725
slice: s9
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The part that writes decisions back into the knowledge base calls four helpers that nobody has converted yet. Until they are, how should it describe what those helpers give back?

## The decision, in plain words

It writes down, once, the shape each helper already gives back, and relies on it. When a helper is converted later and disagrees, the check that reads the shapes fails right there, so nothing drifts silently.

## The intro, for fun

Four helpers still speak the old language, and the knowledge base wanted a word with them.

## The punchline, for fun

So it wrote down what they usually say, and asked them to sign it later.

## The options, in plain words

A. A: bind each untyped helper once to the shape it returns today, on marked lines, and drop the bindings when the helpers are typed
B. B: leave the harvest pipeline file unconverted until the outbox and delivery slices land, and convert it in a later wave
C. C: type the four helpers' signatures in this slice, outside its own folder

## What I had to decide

kit/lib/knowledge/pipeline.ts calls settleAtMerge (kit/lib/outbox/settle-merge.ts, s8), findOutboxViolations (kit/lib/outbox/check-outbox.ts, s8), planShip and movedPath (kit/lib/delivery/ship.ts, s11) and askModel (kit/lib/openrouter.ts, left untyped by s3). Under @ts-nocheck their inferred types are widened (an ok flag typed boolean, so a result never narrows) or wrong (askModel's parameter loses every key without a default), so typed code cannot call them as they are.

## What I did meanwhile

pipeline.ts binds each of the five functions once, near its imports, to a local type naming the shape it returns today (SettleAtMerge, PlanShip, MovedPath, FindOutboxViolations, AskModel), on lines marked `// ts-allow:`. The model's reply is typed ClassificationReply where askModel returns it, because askModel only returns a reply its `check` (classificationSchema) accepted. Nothing else changed: the bundle differs only by the five rebinding lines.

## What it costs to change later

Five lines and five local types in pipeline.ts: once s8 and s11 type their modules (and the ratchet types openrouter), each cast is deleted and the import used directly; a mismatch then shows as a compile error on that line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the ratchet (s29) or s17 owns typing kit/lib/openrouter.ts, which s3 left untyped, is not planned
- (author) finishHarvest's classified replies come from the app between steps and are typed, not re-parsed; whether the App slice (s20) parses them through classificationSchema is not settled

```

<!-- /omni-outbox-settled: s9-01-harvest-binds-untyped-units -->

<!-- omni-outbox-settled: s10-01-plan-repo-without-slug-still-crashes -->

## s10-01-plan-repo-without-slug-still-crashes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s10
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-plan-repo-without-slug-still-crashes
prd: 725
slice: s10
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Grading the plan of a planning repository that never wrote down its own name stops with a crash instead of a clear message. Should this slice fix that?

## The decision, in plain words

Left as it is: this slice only adds types and must not change what the tool does. The crash is kept, marked, and left for its own fix later.

## The intro, for fun

A planning repository forgot to write its own name on the door.

## The punchline, for fun

The grader still faints at the door, but now there is a note pinned to it.

## The options, in plain words

A. Keep the crash for now, marked, and fix it in its own pull request
B. Have the plan grader report a missing repository name as a plain violation
C. Have the settings reader refuse a planning repository that does not name itself

## What I had to decide

kit/lib/inbox/plan-grade.ts passes config.repo.slug to the plan-repository checks, which read it as text. The config allows repo.slug to be null, and a plan section with a null slug makes shortName(null) throw a TypeError. Typing it means either keeping that throw or changing the output.

## What I did meanwhile

Kept the throw: the line reads config.repo.slug! with a ts-allow comment naming this item. No output changes.

## What it costs to change later

Small: one later pull request adds a violation such as 'repo.slug: a plan repository names its own slug' in gradePlan, or a config refinement requiring repo.slug when plan is set, plus a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the config should refuse a plan section without repo.slug, or the grader should report it as a violation (author)

```

<!-- /omni-outbox-settled: s10-01-plan-repo-without-slug-still-crashes -->

<!-- omni-outbox-settled: s10-02-malformed-github-answer-reads-unreachable -->

## s10-02-malformed-github-answer-reads-unreachable — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s10
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-02-malformed-github-answer-reads-unreachable
prd: 725
slice: s10
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When GitHub answers about a target repository in a shape the tool does not expect, what should the targets report say?

## The decision, in plain words

The answer is now checked, and one missing the expected parts shows that repository as unreachable, naming the missing part. Well-formed answers read exactly as before.

## The intro, for fun

GitHub usually answers in full sentences, but the tool now checks the grammar.

## The punchline, for fun

A garbled reply gets a polite 'could not reach you' instead of a shrug three steps later.

## The options, in plain words

A. Show that repository as unreachable, naming the missing part, and carry on with the others
B. Stop the whole command with an error naming the missing part
C. Do not check GitHub's answers in this slice at all

## What I had to decide

The spec asks every value read from the network to pass a schema, failing with an error naming its field. kit/lib/plan-repo/targets.ts read gh api JSON (the repository, a contents listing, a compare) as it came. A schema refusal has to go somewhere: throw out of readTarget, or become a row.

## What I did meanwhile

Added kit/lib/plan-repo/gh-schema.ts: loose schemas naming only the fields the readers use (default_branch; type, name, path; ahead_by, files[].filename, previous_filename) plus the two YAML reads (paths.playbook, a form's state). A refused gh answer throws Unreachable naming the field, so omni targets and omni plan moved show that target as unreachable. A JSON syntax error still throws as before. A non-array contents answer still reads as no folder.

## What it costs to change later

Cheap: answerOf in targets.ts can throw the ZodError instead, one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a malformed GitHub answer should stop the command or stay one row among the others (author)

```

<!-- /omni-outbox-settled: s10-02-malformed-github-answer-reads-unreachable -->

<!-- omni-outbox-settled: s10-03-playbook-tests-type-the-form-fixture-locally -->

## s10-03-playbook-tests-type-the-form-fixture-locally — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s10
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-03-playbook-tests-type-the-form-fixture-locally
prd: 725
slice: s10
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

A shared test helper this slice relies on is typed by a later slice. How should this slice's tests use it meanwhile?

## The decision, in plain words

Each of this slice's test files that builds a form gives that helper its expected shape locally, in a few lines, until the later slice types the helper itself.

## The intro, for fun

The test helper still speaks untyped, and this slice could not wait for its lessons.

## The punchline, for fun

So five test files carry a small phrasebook until the helper graduates.

## The options, in plain words

A. Give the helper its shape locally in each test file until the later slice types it
B. Type the shared helper in this slice, outside its own ground
C. Put one typed wrapper of the helper inside this slice's folders and import it from each test

## What I had to decide

kit/test/fixture.ts belongs to s17 and still opens with @ts-nocheck, so formText's slots default is inferred as never[]: every call passing slots fails to compile. The territory forbids editing the fixture.

## What I did meanwhile

forms, check-playbook, releasing, resolve and review tests import formText as fixtureFormText and cast it to a local FormTextOptions signature (tests may cast fixtures freely). The same tests call main through an 'io as never' cast, since kit/bin/omni.ts is untyped until s17.

## What it costs to change later

Cheap: once s17 types formText and main, delete the five aliases and the casts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s17 will type formText with the same option shape (author)

```

<!-- /omni-outbox-settled: s10-03-playbook-tests-type-the-form-fixture-locally -->

<!-- omni-outbox-settled: s13-01-init-reads-malformed-json-as-missing -->

## s13-01-init-reads-malformed-json-as-missing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s13
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s13-01-init-reads-malformed-json-as-missing
prd: 725
slice: s13
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When the setup command reads a project file or a tool's answer that has the wrong shape, should it treat it as missing, or stop as it sometimes did before?

## The decision, in plain words

A file or an answer of the wrong shape is now treated exactly like a missing one, so setup carries on with its usual fallback instead of crashing in one rare case.

## The intro, for fun

The setup command opened a box labelled package and found only the word null inside.

## The punchline, for fun

It now shrugs, writes no scripts down, and keeps unpacking.

## The options, in plain words

A. Treat a malformed file or answer as missing, the same fallback as an absent one (built)
B. Bring back the old crash for a project file holding nothing at all, and keep the rest as built
C. Stop init with an error naming the field whenever an outside value has the wrong shape

## What I had to decide

Whether init should keep treating a malformed package.json, composer.json or gh/claude JSON answer as missing (what the slice built), or restore the old crash for the one case that crashed.

## What I did meanwhile

kit/lib/init/schema.ts parses every outside read of init through Zod; a value the schema refuses falls back exactly as an absent file or a failed command does. The one output that changed: a package.json or composer.json whose whole content is JSON `null` used to throw a TypeError out of detectCommands (`null.scripts`); it now reads as no scripts, so every command is null. A gh or claude answer whose fields have the wrong type (never seen from the real tools) now takes the same fallback as gh being unavailable, where before the wrong-typed value was used as is.

## What it costs to change later

A constant: the fallback lives in readScripts in kit/lib/init/detect.ts and in each safeParse/parse call inside an existing try. Restoring the crash is one throw when the parsed file is null.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a bug the types reveal is recorded, not fixed; it does not say whether init's never-throw contract should cover a package.json holding only null, which no real repository is likely to have.

```

<!-- /omni-outbox-settled: s13-01-init-reads-malformed-json-as-missing -->

<!-- omni-outbox-settled: s16-01-hand-checks-stand-in-for-schemas -->

## s16-01-hand-checks-stand-in-for-schemas — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s16
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s16-01-hand-checks-stand-in-for-schemas
prd: 725
slice: s16
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Four readers in this part already check what they read by hand, and each refusal already names the field that is wrong. Should they move to the shared validation library now, as the rest of the work asks?

## The decision, in plain words

Not in this slice: they keep their own checks, which already refuse bad input with a message naming the field, so nobody sees a different message. The pull request answer used by the review helper is left to be checked where it is fetched, as an earlier decision said.

## The intro, for fun

Four careful readers were asked to swap their own checklists for the house one.

## The punchline, for fun

They pointed out their lists already say which box is wrong, and kept their pens.

## The options, in plain words

A. A: keep the hand-written checks, now typed, and check the review answer where it is fetched, in the command line slice
B. B: move the proof run and persona files to the shared library now, rewording nothing people see
C. C: move every reader here to the shared library, and accept new wording in its refusals

## What I had to decide

Whether the done-when rule 'every value read from a file, a process, the network or the environment passes a Zod schema' requires replacing the hand-written validation in kit/lib/proof/run.ts (run.json), kit/lib/voice/voice.ts (voice.json), kit/lib/proof/push.ts (the Omni page's replies) and kit/lib/proof/session.ts (the JWT claims), and adding a schema for the GraphQL answer kit/lib/care/state.ts parses.

## What I did meanwhile

No Zod schema added. run.ts, voice.ts and push.ts read their input as `unknown` and narrow it through the checks already there, whose refusals name the field (`run.json: commit is ...`, `round spec: personas[0].score must be ...`). session.ts reads the JWT payload with one marked cast (`// ts-allow:`), checked as before: `iss` through `new URL`, `exp` by comparison. care/state.ts types the GraphQL answer as `CareResponse` with every field optional; the gh JSON is parsed in kit/bin/commands/care.ts (s17's territory), as item s4-03 settled for the board.

## What it costs to change later

A folder-local schema file per reader (kit/lib/proof/schema.ts, kit/lib/voice/schema.ts) with an error map that rebuilds today's refusal wording, plus a `CareResponse` schema in s17 where the gh answer is read. No stored data or interface changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether a hand-written check that names the field counts as the schema the done-when asks for (author)
- session.ts's JWT claims are not fully checked today (email, sub and role are copied as given); a schema would refuse a token the browser now accepts (author)

```

<!-- /omni-outbox-settled: s16-01-hand-checks-stand-in-for-schemas -->

<!-- omni-outbox-settled: s7-01-pr-comment-result-checked -->

## s7-01-pr-comment-result-checked — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s7
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-pr-comment-result-checked
prd: 725
slice: s7
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The note sent to the team chat reads a small file left by the step before it. Should a file whose values have the wrong kind be ignored, or passed along as it is?

## The decision, in plain words

A file whose values have the wrong kind is now ignored, so the note links to the issue instead, exactly as when the file is missing.

## The intro, for fun

A tiny file walks into the chat step carrying a number that is secretly a word.

## The punchline, for fun

It now gets politely turned away at the door, like a missing file would be.

## The options, in plain words

A. Check the file's values and ignore a file whose values have the wrong kind, like a missing one
B. Pass the file along as it is, whatever its values hold, as before
C. Refuse the run with an error naming the wrong value

## What I had to decide

readPrCommentResult (kit/lib/outbox/comment.ts) read the --result JSON file and returned it whenever it was any object, arrays included, trusting htmlUrl and newAdoptedCount as written. The plan's done-when asks every value read from a file to pass a Zod schema first.

## What I did meanwhile

Added PrCommentResultSchema in comment.ts (htmlUrl a string or null or absent, newAdoptedCount a number or absent, any other key kept as written); a file that fails it reads as null, the same answer an unreadable or missing file already gave. The only writer of that file, omni comment --pr, always writes the right kinds, so its own runs read exactly as before.

## What it costs to change later

A constant: drop the schema and return the parsed object again, one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone hands-writes that result file with other kinds of values (author)
- Whether a wrong-kind file should fail loudly instead of falling back quietly (author)

```

<!-- /omni-outbox-settled: s7-01-pr-comment-result-checked -->

<!-- omni-outbox-settled: s7-02-relay-without-a-folder-names-it -->

## s7-02-relay-without-a-folder-names-it — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s7
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-relay-without-a-folder-names-it
prd: 725
slice: s7
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Moving a target's decisions into a feature that has no folder yet used to crash with an unclear error. Should it now stop with a message naming the feature instead?

## The decision, in plain words

It now stops with a message naming the feature. The command that moves the decisions already refuses this case first, so nobody sees the new message in practice.

## The intro, for fun

A box of decisions arrives at an address that does not exist yet.

## The punchline, for fun

The courier now says which address was missing, instead of just dropping the box.

## The options, in plain words

A. Stop with a message naming the feature that has no folder
B. Keep the unclear crash it had before
C. Create the missing folder and carry on

## What I had to decide

relayFolder (kit/lib/outbox/relay.ts) called join(ctx.root, outboxDir) with outboxDir null when the PRD had no inbox or shipped folder, which throws Node's own ERR_INVALID_ARG_TYPE. The types refuse a null there.

## What I did meanwhile

relayFolder now throws Error('PRD <n> has no inbox or shipped folder') when ctx.layout.outboxDir(prd) is null. omni item relay checks the same condition and refuses with its own usage error before ever calling relayFolder, so no output of the command changes.

## What it costs to change later

A constant: one line in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any caller other than omni item relay calls relayFolder (author)

```

<!-- /omni-outbox-settled: s7-02-relay-without-a-folder-names-it -->

<!-- omni-outbox-settled: s7-03-arcade-reads-the-kit-markers-type -->

## s7-03-arcade-reads-the-kit-markers-type — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s7
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-arcade-reads-the-kit-markers-type
prd: 725
slice: s7
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Once the outbox comment code said exactly which markers it takes, one page of the web app stopped checking, because it described those markers as anything at all. Should this slice touch that page, which belongs to a later slice?

## The decision, in plain words

This slice changed that one line on the page to name the markers the tool really takes. Nothing the page shows changes.

## The intro, for fun

One page described its luggage as simply some kind of bag.

## The punchline, for fun

The airline now wants to know which bag, so the label got one more word.

## The options, in plain words

A. Change that one line here, so the whole repository keeps checking
B. Loosen the outbox comment code to accept any markers, and leave the page to its later slice
C. Leave the page failing its check until its later slice clears it

## What I had to decide

apps/galaxy/src/dossier/github/replies.ts declared `type Markers = object` and passed it to findPrMarkerComment and parseNumbersMarker, which s7 now types with the markers makeMarkers builds; tsc -p apps/galaxy failed on both calls. That folder is s26's territory (wave 5), outside s7's.

## What I did meanwhile

Changed that one alias to `Parameters<typeof findPrMarkerComment>[1]`, the kit's own markers type; its one caller (reader.ts) already passes config.markers, and pnpm typecheck passes with no other change. No runtime code changed.

## What it costs to change later

A constant: one type alias in one file; s26 may rewrite it when it clears the folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s26 would rather import the kit's markers type by name (author)

```

<!-- /omni-outbox-settled: s7-03-arcade-reads-the-kit-markers-type -->

<!-- omni-outbox-settled: s11-01-status-and-release-text-stay-unschemaed -->

## s11-01-status-and-release-text-stay-unschemaed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s11
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-01-status-and-release-text-stay-unschemaed
prd: 725
slice: s11
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The status overview reads plain text from version control, and the release note check reads a short header written by hand. Should each of those pass a validation schema here?

## The decision, in plain words

No new schema in this part: the text stays plain text handled by the readers already there, as the core modules already decided, and the release note keeps its own reader so its messages stay word for word the same.

## The intro, for fun

The release note header asked to be checked by the new schema desk like everyone else.

## The punchline, for fun

It was told it already had a personal reader who knows every one of its lines by heart.

## The options, in plain words

A. Plain text stays typed text and the release note keeps its own reader, as built
B. Add a schema for the release note header now, with its messages mapped to today's words
C. Wrap every text read in this part in a schema as well

## What I had to decide

Whether the done-when rule that every value read from a file, a process, the network or the environment passes a Zod schema asks for a schema on the git output kit/lib/status/facts.ts reads (rev-parse, ls-tree, log, for-each-ref, diff), on the plan text kit/lib/delivery/prd.ts hands to parsePlanSlices, on the files kit/lib/delivery/ship.ts rewrites, and on a release note's front matter, which kit/lib/releases/note.ts reads line by line.

## What I did meanwhile

No Zod import was added in this slice's files, following the adopted s4-03 decision for the core modules. Process output is typed string through ExecText and parsed by the readers already there. The release note keeps its hand-written line reader: it reads values as written rather than as YAML, and its refusals (a field it never carries named, a field given twice, prd not a number) are the exact messages omni check releases and omni ship print, which a Zod schema would reword.

## What it costs to change later

A ReleaseNoteFrontMatterSchema beside note.ts parsing the fields readFields returns, with its messages mapped to today's wording; and a z.string() wrap around each git call in facts.ts, one line each. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether unstructured text output, or a front matter the kit deliberately reads without YAML, counts as a value that needs a schema

```

<!-- /omni-outbox-settled: s11-01-status-and-release-text-stay-unschemaed -->

<!-- omni-outbox-settled: s12-01-ask-replies-handed-on-unparsed -->

## s12-01-ask-replies-handed-on-unparsed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s12
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-01-ask-replies-handed-on-unparsed
prd: 725
slice: s12
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The tool that talks to the Omni page gets answers back from the server. Should it check every answer's shape itself, or hand each one on to the command that asked?

## The decision, in plain words

It hands each answer on as it came, and checks only the few parts it reads itself: the renewed sign-in and the server's error text. Each command checks the rest.

## The intro, for fun

The postman was asked to read every letter before delivering it.

## The punchline, for fun

He reads the address and the stamp, and leaves the rest to whoever opens it.

## The options, in plain words

A. Hand each reply on as it came, and check only the sign-in and the error text inside the client
B. Check every reply's shape inside the client, and fail a call whose answer is not of the shape
C. Check every reply's shape inside the client, and drop the fields that are not of the shape instead of failing

## What I had to decide

Whether kit/lib/ask/client.ts should parse every reply of the contract through a schema, or hand replies on as `unknown` for the calling command to parse.

## What I did meanwhile

Every client method now returns `Promise<unknown>`: the client reads only the renewed tokens (through TokenReplySchema) and the `{error}` text itself, both in kit/lib/ask/schema.ts. The hooks in kit/lib/ask/hook.ts read the fields they need from a reply (`id`, `roundId`, `status`, `answers`, `attachments`) field by field, as they did. The commands under kit/bin that read replies are s17's to type; they will need a schema for each reply they read.

## What it costs to change later

A constant per call: add a schema per reply in kit/lib/ask/schema.ts and parse it in the method; the callers' code only loses its own checks. No stored shape and no output change today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reply that misses a field should become an error (it passes through today, and a parsing client would refuse it), which would change what a command prints against an older server

```

<!-- /omni-outbox-settled: s12-01-ask-replies-handed-on-unparsed -->

<!-- omni-outbox-settled: s12-02-ask-local-reads-stay-silent -->

## s12-02-ask-local-reads-stay-silent — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s12
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-02-ask-local-reads-stay-silent
prd: 725
slice: s12
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The plan asks that a file the tool cannot read fails with a message naming what is wrong, but question mode always read its own small files and the sign-in quietly, a broken one counting as missing. Which wins?

## The decision, in plain words

They are still read quietly: a broken file counts as missing and nothing is printed, so a question is never blocked. The check behind it now uses a proper shape description.

## The intro, for fun

The plan wanted every smudged note read aloud with its typo.

## The punchline, for fun

Question mode shrugs, bins the note, and lets the question through.

## The options, in plain words

A. Keep the reads quiet: a value not of the shape reads as absent, through a schema
B. Fail each read with an error naming the field, and let the hooks catch and swallow it
C. Keep the reads quiet but write the field's error to a local log a person can read

## What I had to decide

Whether the reads of ask mode's local state, the sign-in store, the dossier drafts file, a hook's input and a transcript should fail with an error naming the field (the plan's done-when), or stay lenient as they were.

## What I did meanwhile

Each read goes through a Zod schema with safeParse (ModeFileSchema, TerminalFileSchema, RoundFileSchema, HeartbeatWindowSchema, TokensSchema, TokenReplySchema in kit/lib/ask/schema.ts; DossierEntrySchema in kit/lib/dossier/local.ts), and a value that fails reads as absent, exactly as before. Transcript lines and hook inputs, which are any JSON, are read field by field with the `field` helper rather than one schema. No output changed.

## What it costs to change later

A constant: where an error is wanted, swap a safeParse for parse with the kit's messages; the schemas are already there. Each such swap changes what a hook prints, which the spec rules out for this PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan's rule that an invalid value fails naming its field was meant to cover reads that were designed never to fail (the hooks must never block a question)

```

<!-- /omni-outbox-settled: s12-02-ask-local-reads-stay-silent -->

<!-- omni-outbox-settled: s14-01-malformed-answers-now-fail-by-name -->

## s14-01-malformed-answers-now-fail-by-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s14
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s14-01-malformed-answers-now-fail-by-name
prd: 725
slice: s14
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When GitHub or the database answers the credits report or the personas import in a shape it should never have, should the tool stop and say which part was wrong, or carry on as it used to?

## The decision, in plain words

It stops and names the part that was wrong. A well-formed answer, which is every answer seen so far, gives exactly the same result as before.

## The intro, for fun

GitHub once answered with a pull request that had no number. Nobody believes it either.

## The punchline, for fun

Now the tool says so out loud, instead of tripping three steps later.

## The options, in plain words

A. A malformed answer stops the run with an error naming the field; well-formed answers behave exactly as before
B. Keep passing malformed answers through as before, and parse only for the types
C. Stop on malformed answers, but turn the error into the command's usual one-line refusal

## What I had to decide

PRD 725 asks every value read from a process or the network to pass a schema, failing with an error naming its field. In omni credits the rows of gh search and gh pr view were read field by field with fallbacks; a row with no number or repository was passed through and could crash later in the classifier. In scripts/personas-import.ts the Supabase rows were trusted as they came, and a refusal body that was not an object would have thrown a TypeError while reading its fields.

## What I did meanwhile

kit/lib/credits/schema.ts parses each gh row before use: a row's number and repository (a commit's sha and repository) are required, every other field may be missing and keeps its old fallback. scripts/personas-import.ts parses the workspace, product and persona rows Supabase answers, and reads a refusal's code, message and hint through a loose schema, so a body that is not an object reads as empty instead of throwing. Each failure names its path, e.g. 'gh search prs printed an unexpected shape: 0.labels.0.name: Required'.

## What it costs to change later

Cheap: loosen a field in the folder's schema file to nullish, or drop the parse; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether gh ever prints a search row without its repository; its JSON output always has so far (author)
- Whether a refusal from PostgREST ever carries a body that is not an object (author)

```

<!-- /omni-outbox-settled: s14-01-malformed-answers-now-fail-by-name -->

<!-- omni-outbox-settled: s14-02-hooks-folder-unseen-by-typecheck -->

## s14-02-hooks-folder-unseen-by-typecheck — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s14
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s14-02-hooks-folder-unseen-by-typecheck
prd: 725
slice: s14
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The test beside the assistant's commit guard is now typed, but the repository's type check never looks inside that hidden folder. Should the check be widened to see it?

## The decision, in plain words

The test is typed and was checked by hand with the shared settings. Widening the repository's check is left to the last slice, which owns that setting.

## The intro, for fun

The type checker skips hidden folders, the way a tidy guest skips the closet.

## The punchline, for fun

The guard's own test was hiding in there, typed and spotless, with nobody to admire it.

## The options, in plain words

A. Leave the root include as it is for now; s29 adds the hooks folder when it tightens the configs
B. Add the hooks folder to the root include now, outside this slice's ground
C. Leave the hooks folder out of the type check for good: it holds one test

## What I had to decide

The root tsconfig.json includes **/*.ts, but TypeScript's wildcards do not enter folders whose name starts with a dot, so .claude/hooks/fallow-gate.test.ts is not checked by pnpm typecheck. tsconfig.json is s29's territory, not s14's.

## What I did meanwhile

Removed the file's nocheck marker, typed its helpers, and checked it with a scratch config that extends tsconfig.base.json and includes .claude/hooks/*.ts: no error. pnpm test still runs it.

## What it costs to change later

Cheap: add ".claude/hooks/**/*.ts" to the root include in s29, or leave it unchecked.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s29's guard test, which reads files itself, also covers dot folders (author)

```

<!-- /omni-outbox-settled: s14-02-hooks-folder-unseen-by-typecheck -->

<!-- omni-outbox-settled: s17-01-cli-gh-replies-parsed-by-name -->

## s17-01-cli-gh-replies-parsed-by-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s17
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s17-01-cli-gh-replies-parsed-by-name
prd: 725
slice: s17
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The command line reads what GitHub's tool prints. Should a reply of the wrong shape now stop with a message naming the wrong field, rather than going on with a blank value?

## The decision, in plain words

Every GitHub reply the command line reads now goes through a check first. A well-formed reply works exactly as before; a malformed one stops at once and names the field that is wrong.

## The intro, for fun

GitHub's replies used to walk straight in; now there is a doorman with a clipboard.

## The punchline, for fun

Regulars get waved through; only the oddly dressed get asked their name.

## The options, in plain words

A. A: parse every gh reply the CLI reads through a schema, failing by field name on a malformed one
B. B: keep the schemas but fall back to the old reading when a reply does not parse
C. C: leave the gh reads unparsed, as typed values only

## What I had to decide

Whether the CLI's reads of `gh` JSON (issue comments, a pull request, `gh pr list`, `gh pr view --json commits`, the GraphQL answers of `omni care`) are parsed through Zod schemas, which turns a malformed reply from a later undefined into an immediate error naming the field.

## What I did meanwhile

kit/bin/schema.ts holds looseObject schemas for each of those replies; kit/bin/github.ts, commands/board.ts and commands/care.ts parse through them. The ask server's replies (business, decide, dossier, ask) keep the hand checks they had, read field by field with the ask module's own field() helper, as s16-01 settled for hand checks. The release script and the build parse package.json through a small schema of their own.

## What it costs to change later

Dropping a schema is one line per call site; the schemas keep every field GitHub sends, so no well-formed reply changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec forbids output changes; a reply GitHub never sends malformed now fails differently than before, and no test can show which old failure a real malformed reply produced

```

<!-- /omni-outbox-settled: s17-01-cli-gh-replies-parsed-by-name -->

<!-- omni-outbox-settled: s17-02-cli-bridges-to-neighbour-types -->

## s17-02-cli-bridges-to-neighbour-types — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s17
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s17-02-cli-bridges-to-neighbour-types
prd: 725
slice: s17
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

A few library parts the command line calls are typed a little narrower than what really reaches them. Should the command line bridge those gaps with marked shortcuts for now?

## The decision, in plain words

The command line bridges each gap with a shortcut marked on its own line and its reason, and nothing it does changes. Each shortcut becomes useless once the part it calls is typed or widened, and the final tightening can remove it.

## The intro, for fun

The new road reached the old bridge, and the old bridge is one lane narrower.

## The punchline, for fun

A cone and a sign do the job until the bridge crew arrives.

## The options, in plain words

A. A: keep the marked bridges now; the final tightening slice removes them
B. B: widen the neighbouring library types in their own follow-up pull request before the ratchet
C. C: have the command line refuse the values the library types leave out, such as a missing feature branch

## What I had to decide

How the typed CLI calls library functions whose types are narrower than the values they are handed today. The lib/update and lib/statusline bridges this slice first needed were dropped once s18 merged.

## What I did meanwhile

Marked casts (// ts-allow): commands/rework.ts passes a null feature branch to planRework, typed string; commands/proof.ts hands the ask client to pushProof, whose upload takes Uint8Array where the client's takes BodyInit; commands/board.ts reads plan slices whose wave may be null as the board's number; commands/plan.ts keeps the slug-less plan repository crash of s10-01; commands/replies.ts reads the posted comment readReplies types unknown.

## What it costs to change later

Each bridge is one line to delete once its neighbour is widened (policy/rework featureBranch, proof/push upload, board wave, replies posted).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether planRework should take a null feature branch in its type, or the CLI should refuse one, is a behaviour question this slice may not settle

```

<!-- /omni-outbox-settled: s17-02-cli-bridges-to-neighbour-types -->

<!-- omni-outbox-settled: s17-03-cli-tests-loosely-typed-fixtures -->

## s17-03-cli-tests-loosely-typed-fixtures — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s17
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s17-03-cli-tests-loosely-typed-fixtures
prd: 725
slice: s17
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The command line's tests are now type-checked, but some test helpers still say 'anything goes' for a fixture value. Is that fine in tests, while the real code may not?

## The decision, in plain words

Tests keep a few 'anything goes' types for fixture values, as the plan lets tests cast fixtures freely. The real code never does without a marked reason.

## The intro, for fun

The test kitchen got a health inspector, but the tasting spoons are still allowed.

## The punchline, for fun

The menu is strict; the scraps bowl is not.

## The options, in plain words

A. A: tests may use any and as on fixtures; the guard checks source files only
B. B: tests follow the source rule too, every any and as marked with ts-allow
C. C: tests may cast with as but not annotate with any

## What I had to decide

How strictly the CLI's tests are typed: about forty test lines annotate a fixture parameter or a recorded call list as any, cast a fixture with as, or assert a value with !, with no ts-allow comment, while kit/test's helper files mark theirs.

## What I did meanwhile

Test files type their fakes through shared helpers in kit/test/fixture.ts (FakeExec, realExec, FetchInit, Repo, Files, Io) and kit/test/fake-ask-server.ts (FakeAskServer, Json); what inference could not settle in a test stays any or is cast. The helper files outside *.test.ts (fixture.ts, flat-layout.ts, fake-ask-server.ts) mark every any and as with ts-allow.

## What it costs to change later

If the ratchet's guard holds tests to the source rule, about forty test lines need a real type or a ts-allow comment.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says tests may cast fixtures freely but does not say whether the ratchet's guard exempts test files from the any rule

```

<!-- /omni-outbox-settled: s17-03-cli-tests-loosely-typed-fixtures -->

<!-- omni-outbox-settled: s18-01-lock-time-read-as-text-only -->

## s18-01-lock-time-read-as-text-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s18
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s18-01-lock-time-read-as-text-only
prd: 725
slice: s18
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The status line keeps a small lock file while it refreshes the board in the background. When that file's time is written in an odd form, should it still be read, or count as unreadable?

## The decision, in plain words

Only a time written as text is read now; any other form counts as unreadable, so the file's own date on disk is used instead, as for a missing time. The tool only ever writes text, so nobody sees a difference in practice.

## The intro, for fun

A lock file with a strange clock walks into the status line.

## The punchline, for fun

It is told to use the date on its own envelope instead.

## The options, in plain words

A. A. Read only a time written as text; anything else falls back to the file's own date (built).
B. B. Keep reading any value as a time, as the untyped code did.

## What I had to decide

Whether a lock file whose time is not text should still have that time read, as the old code did by accident, or count as having no readable time.

## What I did meanwhile

The lock file is now read through a shape description: a time that is not text is dropped, and the file's own modification time stands in, exactly as for a lock with no time at all. Every lock the tool writes holds its time as text, so every real lock reads as before.

## What it costs to change later

A constant: widening the time back to any value is one line in the status line's shape description.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No lock with a non-text time has ever been seen; the old reading of one (a number taken as a year) was an accident of the language, not a rule anyone wrote.

```

<!-- /omni-outbox-settled: s18-01-lock-time-read-as-text-only -->

<!-- omni-outbox-settled: s19-01-app-refuses-malformed-github-shapes-whole -->

## s19-01-app-refuses-malformed-github-shapes-whole — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s19
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s19-01-app-refuses-malformed-github-shapes-whole
prd: 725
slice: s19
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When GitHub sends the App something in a shape it never sends, should the App stop and say which part was wrong, or carry on part by part as it used to?

## The decision, in plain words

It stops: an answer from GitHub or an event missing a part fails naming that part, and a delivery of the wrong shape starts nothing. Every well-formed delivery and answer gives exactly the same result as before.

## The intro, for fun

GitHub once sent a pull request whose number was a word. Nobody believes it either.

## The punchline, for fun

Now the App says so at the door, instead of tripping three rooms later.

## The options, in plain words

A. A. A malformed answer or event fails naming its field; a malformed delivery starts nothing; well-formed ones behave as before
B. B. Parse only for the types, and let malformed values pass through as before
C. C. Fail on malformed answers, but keep reading malformed deliveries field by field

## What I had to decide

PRD 725 asks every value read from the network to pass a schema and fail naming its field, and asks for no output change. The App read webhook deliveries, GitHub's REST answers and Inngest event data field by field with fallbacks: a field of an unexpected type passed through until something downstream crashed or quietly used it.

## What I did meanwhile

src/outbox-check/github-schema.ts holds one schema per GitHub answer the App reads (pull request, issue, comments, compare, check runs, trees, blobs, refs, commits, pulls); each names only the fields read, with the fallbacks as before (nullish where the code had `??`). src/inngest-client.ts holds the event data schemas, which every function parses `event.data` through. The webhook (src/webhook/webhook.ts) and the stage events (src/stage-forward/stage-forward.ts) parse a delivery with safeParse: a delivery of another shape becomes no event and no stage, as a delivery missing those fields already did. All 635 tests pass unchanged; src/outbox-check/github-schema.test.ts adds five that show a refusal naming its field.

## What it costs to change later

Cheap: loosen a field to nullish or unknown in the schema file, or drop a parse; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether GitHub ever sends a delivery whose repository has no `name`, which the webhook schema now requires; every recorded delivery has one
- (author) Whether a malformed event already sitting in Inngest's queue would now fail its run by name, where it used to fail later

```

<!-- /omni-outbox-settled: s19-01-app-refuses-malformed-github-shapes-whole -->

<!-- omni-outbox-settled: s19-02-app-lists-its-own-schema-library -->

## s19-02-app-lists-its-own-schema-library — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s19
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s19-02-app-lists-its-own-schema-library
prd: 725
slice: s19
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The GitHub App now checks what GitHub sends it with the same checking library the rest of the repository uses. Should the App name that library as its own dependency, which touches the shared list of installed versions?

## The decision, in plain words

The App names it, at the exact version already installed for the rest of the repository, so nothing new is downloaded and nothing else changes version.

## The intro, for fun

The App borrowed a library from its neighbours and never said thank you.

## The punchline, for fun

Now it is on the App's own shopping list, same brand, same price.

## The options, in plain words

A. A. The App names the library itself, at the version already installed; nothing else changes
B. B. Leave the App's list alone and keep borrowing the library from the repository, with the audit warning left standing
C. C. Check the App's data only through the kit's own checks, so the App never uses the library directly

## What I had to decide

PRD 725 asks every value the App reads from GitHub, Inngest or a webhook delivery to pass a Zod schema. apps/omni-app imported zod nowhere before this slice, and its package.json did not list it: the import resolved only because the root package lists zod and pnpm links it there. fallow's audit reports that as an unlisted dependency of apps/omni-app. package.json of the App and pnpm-lock.yaml are outside s19's territory.

## What I did meanwhile

apps/omni-app/package.json lists "zod": "^4.6.5", and pnpm-lock.yaml gains the three lines of that importer entry only, resolved to the zod 4.6.5 already locked for the root and the arcade. `pnpm install --frozen-lockfile` (pnpm 9, as CI runs it) accepts the lockfile, and no other version moves. A plain `pnpm install` was tried first and refused: it re-resolved inngest's TypeScript peer to 7.0.2.

## What it costs to change later

Cheap: drop the line from the App's package.json and the three lockfile lines, and leave the import resolving through the root as before.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s20, which also opens schemas in apps/omni-app, adds the same line, so the wave merge sees it twice
- (author) Whether Vercel's build of the App installs with --frozen-lockfile, which would refuse a lockfile edited by hand if it were wrong

```

<!-- /omni-outbox-settled: s19-02-app-lists-its-own-schema-library -->

<!-- omni-outbox-settled: s20-01-malformed-harvest-event-is-not-retried -->

## s20-01-malformed-harvest-event-is-not-retried — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s20
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s20-01-malformed-harvest-event-is-not-retried
prd: 725
slice: s20
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When the request to harvest knowledge from a merged change arrives incomplete, should the app try it again a few times, or give up at once and say which part was missing?

## The decision, in plain words

It gives up at once and leaves its usual failure note on the merged change, naming the missing part. Trying again could not help, since the same incomplete request would come back each time.

## The intro, for fun

A letter with no address on it will not find its way on the fourth try either.

## The punchline, for fun

So the app stops at the first try and says which line was left blank.

## The options, in plain words

A. Fail at once, naming the missing field (built).
B. Retry three times like any other failure, then fail with the same message.

## What I had to decide

Whether a harvest request missing a field is retried three times before failing, or fails at once.

## What I did meanwhile

A malformed request fails at once with a message naming its missing field; the failure comment is posted as before.

## What it costs to change later

Changing it back is one line: throw a plain error instead of a non-retriable one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No harvest request has ever been seen arriving incomplete; the webhook always sends every field.

```

<!-- /omni-outbox-settled: s20-01-malformed-harvest-event-is-not-retried -->

<!-- omni-outbox-settled: s21-01-retro-reads-check-github-answers -->

## s21-01-retro-reads-check-github-answers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s21
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s21-01-retro-reads-check-github-answers
prd: 725
slice: s21
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When GitHub answers one of the retro's questions in a shape it should never have, should the retro stop and say which part was wrong, or carry on as it used to?

## The decision, in plain words

It stops that read and names the part that was wrong, and the read is tried again later as any failed read is. Every answer GitHub has given so far reads exactly as before.

## The intro, for fun

The retro asks GitHub about every check that ran, and GitHub has always answered politely.

## The punchline, for fun

If it ever mumbles, the retro now asks it to repeat itself, by name.

## The options, in plain words

A. A. A malformed answer fails the read with an error naming the field, and the step is retried; well-formed answers read exactly as before
B. B. Treat a malformed answer like an unreadable one: the section says it could not be read
C. C. Keep passing malformed answers through as before, and describe their shape only for the compiler

## What I had to decide

PRD 725 asks every value read from the network to pass a schema and fail with an error naming its field. The retro's kinds of finding (apps/omni-app/src/retro/kinds/) read workflow runs, jobs, issues, pull requests, changed files, commits, comments, reviews, issue events and the review-threads GraphQL answer field by field, most with fallbacks, and passed anything else through: a job with no name would have been counted as a check called undefined.

## What I did meanwhile

apps/omni-app/src/retro/kinds/schema.ts holds one loose schema per answer, naming only the fields the kinds read. A field the kinds read with a fallback is nullish there, so it reads as before; the fields they cannot do without (a run's or a job's id, a job's name, an issue's number, link and opening time, a closed pull request's number and link, a file's name, a commit's sha, an issue event's kind and time) are required. A malformed answer throws a Zod error naming its path inside the gather step, which Inngest retries like any other failed read; the 403, 404 and 410 handling is unchanged.

## What it costs to change later

Cheap: make a field nullish in the folder's schema file, or drop one parse; no stored shape changes, and the records each kind keeps are the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether GitHub ever sends a job without its name, or an issue without its link; its REST answers always carry them so far (author)
- Whether a step that now fails on a malformed answer should rather leave that section out of the retro, as an unreadable answer does (author)

```

<!-- /omni-outbox-settled: s21-01-retro-reads-check-github-answers -->

<!-- omni-outbox-settled: s21-02-retro-kind-tests-bridge-untyped-helpers -->

## s21-02-retro-kind-tests-bridge-untyped-helpers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s21
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s21-02-retro-kind-tests-bridge-untyped-helpers
prd: 725
slice: s21
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The retro's tests lean on shared test helpers that another part of this work types later. Should these tests wait for them, or bridge the gap now?

## The decision, in plain words

They bridge the gap now, through one small helper file that states what the tests hand in. Once the shared helpers are typed, the bridge can be removed by the final tightening step.

## The intro, for fun

The tests needed a fake GitHub, and the fake GitHub has not been to type school yet.

## The punchline, for fun

So the tests brought a translator, and promised to send it home later.

## The options, in plain words

A. A. One test-support file bridges the untyped helpers with marked casts, removable once they are typed
B. B. Cast at every call site in each test file instead
C. C. Leave the tests for the slice that types the shared helpers

## What I had to decide

The kinds' tests call the stubbed GitHub (apps/omni-app/test/github-replay.ts), the widget scenario (apps/omni-app/test/retro-scenario.ts) and the retro function (apps/omni-app/src/retro/retro.ts). Those belong to s19 and s22, still untyped in this wave, so their inferred option types accept only empty lists and maps; and the tests hand the kinds partial scopes and contexts.

## What I did meanwhile

apps/omni-app/src/retro/kinds/test-handles.ts gives the tests typed handles on each kind (gather, detect and section, taking any object and reading facts back as present) and three pass-throughs, replay, scenario and retroFunction, each a marked cast onto the untyped helper. The kinds themselves keep their strict types; no test assertion changed.

## What it costs to change later

Cheap: once s19 and s22 land, replace each pass-through with a direct import, or keep the handles; test support only, no output changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which shapes s19 gives the stubbed GitHub's options, so whether the pass-throughs become no-ops or need a tweak (author)

```

<!-- /omni-outbox-settled: s21-02-retro-kind-tests-bridge-untyped-helpers -->

<!-- omni-outbox-settled: s22-01-model-reply-keeps-its-own-check -->

## s22-01-model-reply-keeps-its-own-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s22
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s22-01-model-reply-keeps-its-own-check
prd: 725
slice: s22
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The retro already checks the model's answer field by field, and sends its sentences back to the model when the answer is wrong. Should that check become a schema, like every other answer read from outside?

## The decision, in plain words

The retro keeps its own check of the model's answer, now typed, because its sentences are what the model reads when it is asked to fix its answer. Turning it into a schema would change those sentences.

## The intro, for fun

The retro already marks the model's homework, line by line, in its own handwriting.

## The punchline, for fun

Swapping in a stamp would be tidier, but the model has learned to read the handwriting.

## The options, in plain words

A. Keep the retro's own check of the model's answer, typed, so the model is told the same thing as before
B. Replace it with a schema now, and accept that the model is told what is wrong in other words
C. Wrap the schema so it writes the same sentences as the check does today

## What I had to decide

PRD 725's done-when asks every value read from the network to pass a Zod schema, and forbids any output change. narrate.ts's checkReply is the model reply's validator: its error sentences go back to OpenRouter in the repair request (askModel), so a Zod schema would change the repair prompt the model is sent.

## What I did meanwhile

Kept checkReply hand-written, typed it (unknown in, ModelReply out), and said why in its doc comment. Every GitHub answer, the retro event and a retro.json read back from a branch go through Zod schemas in apps/omni-app/src/retro/github.schema.ts.

## What it costs to change later

Cheap: askModel already accepts a Zod schema as its check, so a later slice can swap checkReply for one and accept the new repair sentences.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the repair prompt's exact sentences matter to anyone beyond the tests that pin them (author)

```

<!-- /omni-outbox-settled: s22-01-model-reply-keeps-its-own-check -->

<!-- omni-outbox-settled: s22-02-retro-shapes-beside-untyped-neighbours -->

## s22-02-retro-shapes-beside-untyped-neighbours — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s22
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s22-02-retro-shapes-beside-untyped-neighbours
prd: 725
slice: s22
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The retro's main steps were typed while the parts they lean on were still being typed by other slices at the same time. Where should the shapes they share live?

## The decision, in plain words

The retro's steps describe the shapes they need in a file of their own beside them, written loosely enough that the other slices' shapes still fit. Where a helper was not typed yet, the retro names the shape that helper documents.

## The intro, for fun

Two crews built the two halves of a bridge at the same time, each from its own drawing.

## The punchline, for fun

The drawings agree on where the bridge meets; the bolts get compared once both halves are up.

## The options, in plain words

A. Keep the retro's own shapes beside it, loose enough to fit, and fold them into the neighbours' types after the wave
B. Wait for the kinds and the app's helpers to be typed first, and type the retro's steps after them
C. Move the shared shapes into one app-wide types file now, outside this slice's ground

## What I had to decide

s21 types apps/omni-app/src/retro/kinds/ and s19 types git-write, snapshot, outbox-check and the test helpers in the same wave; s22's territory holds neither. The kinds' registry exported its Kind type only as JSDoc, which a .ts file ignores, and git-write's addCommit and the kit's askModel still open with @ts-nocheck, so their parameters read as their defaults (files: never[]).

## What I did meanwhile

Wrote apps/omni-app/src/retro/retro.types.ts (Octokit, Kind with method signatures so a narrower kind still fits, the fact sheet, the prose, the run records). retro.ts filters kinds by run itself (kindsIn) rather than through kindsFor, whose parameter is typed by the registry's default. publish.ts and narrate.ts call addCommit and askModel through a typed view of what their doc comments say, each cast marked ts-allow. Tests reach the untyped scenario helpers through local loose wrappers.

## What it costs to change later

Cheap: once s19 and s21 merge, the wave check can point retro.types.ts at their exported types, drop kindsIn for kindsFor, and remove the two typed views; no output depends on any of it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which exported names s19 and s21 chose for the Octokit seam and the kind type (author)

```

<!-- /omni-outbox-settled: s22-02-retro-shapes-beside-untyped-neighbours -->

<!-- omni-outbox-settled: s22-03-app-imports-zod-through-the-root -->

## s22-03-app-imports-zod-through-the-root — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s22
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s22-03-app-imports-zod-through-the-root
prd: 725
slice: s22
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The app's retro now checks GitHub's answers with the tool's checking library, which the app's own list of dependencies does not name. Should that list name it?

## The decision, in plain words

The retro uses the library the tool already brings with it, found the same way the tool's own files the app runs find it, and the app's list of dependencies is left as it was, since changing it is outside this slice.

## The intro, for fun

The app borrowed the tool's tape measure without writing it on its own packing list.

## The punchline, for fun

It is in the same truck, so nothing is lost, yet a careful packer would add the line.

## The options, in plain words

A. Use the library through the root package, as the tool's own files the app runs already do
B. Add the library to the app's own list of dependencies in a later change
C. Re-export the library from the tool, and have the app import it from there

## What I had to decide

apps/omni-app/src/retro/github.schema.ts and retro.ts import 'zod'. apps/omni-app/package.json lists no zod; it resolves from the root package (vertuo-omni-plan), whose kit files the app already imports and which import zod themselves. The package.json is outside s22's territory.

## What I did meanwhile

Imported 'zod' directly, as the kit files the app runs do; the app's tests, typecheck and imports resolve it from the workspace root (Zod 4).

## What it costs to change later

Cheap: add zod ^4 to apps/omni-app/package.json and the lockfile in one later change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the App's Vercel build installs only the app's own dependencies, in which case the kit's zod imports would already fail today (author)

```

<!-- /omni-outbox-settled: s22-03-app-imports-zod-through-the-root -->

<!-- omni-outbox-settled: s23-01-galaxy-contract-kept-beside-typed-sources -->

## s23-01-galaxy-contract-kept-beside-typed-sources — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s23
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s23-01-galaxy-contract-kept-beside-typed-sources
prd: 725
slice: s23
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

Should the arcade keep reading the galaxy package through its hand-written description, or read the typed code itself now that the code carries its own types?

## The decision, in plain words

The hand-written description stays as what the arcade reads, but its shapes now live in one shared place the code also uses, and a check fails the build when the code and the description drift apart.

## The intro, for fun

Two maps of the same galaxy, and somebody has to decide which one the pilots fly by.

## The punchline, for fun

For now the old map stays on the wall, stapled to the new one so they cannot disagree.

## The options, in plain words

A. Keep the hand-written description as what the arcade reads, its shapes shared with the code and a check that fails when they drift (built).
B. Let the arcade read the typed code directly and drop the description, as the design package already does; the arcade then checks the game's code too.
C. Keep the description but have it copy every signature from the code automatically, dropping the drift check.

## What I had to decide

Whether packages/galaxy keeps index.d.ts as the arcade's contract (types re-exported from types.ts, held to the sources by contract.test.ts), or points its package types at index.ts as packages/design does, which pulls the game's typed sources into the arcade's type check.

## What I did meanwhile

index.d.ts re-exports every shape from the new types.ts and declares the functions; contract.test.ts makes tsc check each source export against its declaration. LedgerEvent keeps type: string for the arcade, so buildGalaxy hands its rows to the game's score() through one marked cast.

## What it costs to change later

A constant: change the package.json types entry to ./src/index.ts and delete index.d.ts and contract.test.ts; no data or behaviour moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not tried: whether the arcade's tsc stays green when it compiles game/ under its own looser config; option B needs that run.
- (author) The declared XP functions take LedgerEvent while the game's take GameEvent; the contract check accepts them because declared functions compare bivariantly, so that one seam is not held strictly.

```

<!-- /omni-outbox-settled: s23-01-galaxy-contract-kept-beside-typed-sources -->

<!-- omni-outbox-settled: s23-02-demo-regions-carry-no-feature-pr -->

## s23-02-demo-regions-carry-no-feature-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s23
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s23-02-demo-regions-carry-no-feature-pr
prd: 725
slice: s23
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The demo world's raw snapshot now says outright that each repository has no feature pull request of its own, where it used to leave that unsaid. Is that acceptable?

## The decision, in plain words

Yes for now: the game already reads a missing value and an empty one the same way, so the demo's events, galaxy and points are identical before and after.

## The intro, for fun

The demo planets filled in a blank on their paperwork that nobody ever read.

## The punchline, for fun

Same planets, same points, one extra 'none' in the margin.

## The options, in plain words

A. The demo says each repository has no feature pull request of its own, as the game's shape asks (built).
B. Let the game's shape leave that value out, and leave the demo as it was.

## What I had to decide

Whether demoSnapshot's regions may carry featurePr: null, which the game's Snapshot type requires, or whether the game's Region type should make featurePr optional instead.

## What I did meanwhile

demoSnapshot writes featurePr: null on every region. Nothing outside the package reads demoSnapshot; demoEvents, buildGalaxy and borrowedXp were compared as JSON at three dates and are identical.

## What it costs to change later

A constant: drop the field from the demo and make Region.featurePr optional in game/types.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) demoSnapshot's JSON grows by the added field, about 300 bytes; no caller reads it today.

```

<!-- /omni-outbox-settled: s23-02-demo-regions-carry-no-feature-pr -->

<!-- omni-outbox-settled: s24-01-arcade-malformed-reads-fall-back -->

## s24-01-arcade-malformed-reads-fall-back — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s24
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s24-01-arcade-malformed-reads-fall-back
prd: 725
slice: s24
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

Three things the game screens read from outside are now checked before use: the team members list, a saved team, and the demo player kept in the browser. When one comes back in the wrong shape, what should happen?

## The decision, in plain words

Each falls back the way that screen already falls back when the read fails: the people list shows plain photos, the team form says it could not save, and the demo starts a fresh guest. A correct read behaves exactly as before.

## The intro, for fun

The game used to trust every parcel at the door, even the ones that rattled.

## The punchline, for fun

Now a rattling parcel gets the same polite shrug as a missing one.

## The options, in plain words

A. A: a read of the wrong shape falls back like a failed read, each screen as it already does
B. B: a read of the wrong shape stops the screen with an error naming the field
C. C: fall back, and also report the wrong shape to the error tracker

## What I had to decide

Whether a read of the wrong shape should fall back like a failed read, or stop the screen with an error.

## What I did meanwhile

apps/galaxy/src/people/load.ts parses workspace_roster and teams rows (RosterRowSchema, FleetLookRowSchema); a bad row logs 'people: ... could not be read' with the field, and the directory falls back. apps/galaxy/src/fleets/store.ts parses the row each fleet function answers; a bad one is the refusal COULD_NOT_SAVE. apps/galaxy/src/arcade/account-demo.ts parses the guest kept in localStorage with loose objects (unknown fields kept); a bad one is a fresh guest. A test covers each bad case.

## What it costs to change later

A constant per screen: throw instead of returning the fallback in three catch paths.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The generated database types say workspace_roster returns no nulls, yet a member with no name, login, avatar or fleet returns null; the schema keeps them nullable, as the code always read them (author)
- (author) A demo guest saved by an older build with a field missing now restarts as a fresh guest; no such older shape is known (author)

```

<!-- /omni-outbox-settled: s24-01-arcade-malformed-reads-fall-back -->

<!-- omni-outbox-settled: s24-02-arcade-style-variables-helper -->

## s24-02-arcade-style-variables-helper — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s24
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s24-02-arcade-style-variables-helper
prd: 725
slice: s24
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The game screens colour many elements through style variables, which the typing rules only accept with a forced conversion on each line. Should each line carry its own marked conversion, or should one small shared helper do it once?

## The decision, in plain words

One small helper in the game's folder does the conversion once, and every screen in this slice uses it. The pages draw exactly the same.

## The intro, for fun

Eighteen screens each had to sign the same permission slip to wear a colour.

## The punchline, for fun

Now one slip sits at the front desk and everyone points at it.

## The options, in plain words

A. A: one helper in the game's folder, used by this slice's screens
B. B: a marked conversion on every line that sets a style variable
C. C: teach the typing rules about style variables once for the whole web app

## What I had to decide

How to type React styles that set CSS custom properties without a marked cast on every element.

## What I did meanwhile

Added apps/galaxy/src/arcade/css-vars.ts (cssVars, one `// ts-allow:` cast). It replaced 18 `['--x' as string]` keys in arcade/scenes and the `as CSSProperties` casts in fleets/FleetCard.tsx, people/FleetChip.tsx, design/DesignScreen.tsx and arcade/ArcadeApp.tsx. The non-null assertions the index checks needed are left unmarked, as builder.ts already had them: the guard names only `any` and `as`.

## What it costs to change later

Cheap: inline the casts back with a `// ts-allow:` each, or move the helper somewhere shared when the other arcade folders want it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) business/BusinessView.tsx and home/spreads/Game.tsx, in sibling slices, keep the same casts; whether s29 folds them onto this helper is not planned (author)
- (author) Whether the ratchet will also count non-null assertions is not written down (author)

```

<!-- /omni-outbox-settled: s24-02-arcade-style-variables-helper -->

<!-- omni-outbox-settled: s25-01-arcade-casts-and-reads-left-as-they-were -->

## s25-01-arcade-casts-and-reads-left-as-they-were — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s25
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s25-01-arcade-casts-and-reads-left-as-they-were
prd: 725
slice: s25
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

In this part of the web app, should every shortcut the code takes with its types carry a written reason, and should every value it reads from outside be checked against a rule, as the rest of the repository now does?

## The decision, in plain words

Not in this step: the web app was changed only where the stricter list checks and the typed database needed it, as the design says. The shortcuts and the outside reads stay as they were, for the final tightening step to settle.

## The intro, for fun

Three hundred type shortcuts sat in a row, each waiting to explain itself.

## The punchline, for fun

They were told the explaining starts in the last chapter.

## The options, in plain words

A. A: leave the arcade's existing casts and outside reads as they were; the ratchet slice decides whether its guard covers the web app
B. B: mark every existing cast in these folders with a written reason now, a comments-only change
C. C: mark every cast and add schemas at every outside read in these folders now

## What I had to decide

Whether the arcade slices must mark every source `as`/`any` with `// ts-allow: <reason>` and parse every outside read through a Zod schema, when the spec's Out list says the arcade's code changes only for its index checks and the Database type.

## What I did meanwhile

apps/galaxy/src/{ask,dashboard,profile,signup,proxy,working} and apps/galaxy/proxy.ts pass `tsc -p apps/galaxy --noUncheckedIndexedAccess` and `--erasableSyntaxOnly` with no error; the Supabase clients the territory opens are created with `<Database>`. About 300 existing source casts are left unmarked, and outside reads (env, JSON bodies, OpenRouter, GitHub) keep their existing hand checks with no new Zod schema. The few new casts this slice wrote (a YYYY-MM-DD split read as three numbers) carry `// ts-allow:`.

## What it costs to change later

Comments only for the casts (one `// ts-allow: <reason>` per line, about 300 lines across the six folders), or a scope line in the s29 guard that leaves apps/galaxy out; Zod schemas at the arcade's outside reads would be a separate behaviour-neutral pass per folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the s29 guard is meant to scan apps/galaxy is not written: the plan's done-when asks every typing slice to mark casts, while the spec's Out list keeps the arcade's code unchanged beyond index checks and Database
- (author) The sibling arcade slices (s24, s26 to s28) may have answered this differently in the same wave

```

<!-- /omni-outbox-settled: s25-01-arcade-casts-and-reads-left-as-they-were -->

<!-- omni-outbox-settled: s26-01-arcade-iii-reads-keep-hand-checks -->

## s26-01-arcade-iii-reads-keep-hand-checks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s26
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s26-01-arcade-iii-reads-keep-hand-checks
prd: 725
slice: s26
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The dossier pages, the home page and the waiting badges read data from the browser's storage, from our own web routes and from GitHub. Should those reads be rewritten to go through a formal schema now, or may they keep the checks they already make by hand?

## The decision, in plain words

They keep the checks they already make by hand, so nothing the pages show can change. Each spot where the code trusts the shape it was given now says why, in a short note on that line.

## The intro, for fun

Some doors already had a bouncer checking names by hand.

## The punchline, for fun

We gave each bouncer a name badge instead of hiring a new one.

## The options, in plain words

A. Keep the hand-written checks, and mark each cast with its reason: no output change.
B. Replace each hand-written check with a folder-local Zod schema, at the risk of small changes in what a malformed value does.
C. Leave it to a follow-up pull request after the ratchet: the same as A now, with a ticket for B.

## What I had to decide

Whether this slice should have replaced the existing hand-written checks on outside reads with schemas.

## What I did meanwhile

Every cast in the slice's source files carries a ts-allow reason, the hand-written checks stay as they were, and the index checks and the Database-typed clients are in place.

## What it costs to change later

Replacing a hand-written check with a schema later is a local change in one file per read, with its existing tests as the guard.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not list every outside read in the territory one by one; the ones seen are the browser-storage reads in waiting/alerts, waiting/documents and dossier/page/outbox-picks, the route answers read in dossier/page/OutboxSend, waiting/outbox and waiting/business, and GitHub's answers in dossier/github/reader.
- (author) The plan's done-when asks for a schema on every outside read; this slice meets it only where a schema already existed (dossier/page/voice).

```

<!-- /omni-outbox-settled: s26-01-arcade-iii-reads-keep-hand-checks -->

<!-- omni-outbox-settled: s27-01-arcade-iv-casts-left-unmarked -->

## s27-01-arcade-iv-casts-left-unmarked — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s27
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s27-01-arcade-iv-casts-left-unmarked
prd: 725
slice: s27
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

Should this part of the game site have every loose type shortcut labelled and every outside read checked now, or only what the stricter list checks and the database types need?

## The decision, in plain words

Only what the stricter list checks and the database types need was changed, as the spec's out-of-scope list asks. About 130 older type shortcuts stay unlabelled for the final clean-up step to decide.

## The intro, for fun

The plan said tidy the whole room; the spec said only touch the shelf.

## The punchline, for fun

So the shelf is spotless and the rest of the room waits for its turn.

## The options, in plain words

A. Leave the arcade's existing casts and reads as they are; s29 decides (what I built)
B. Mark every arcade cast with ts-allow in a follow-up before s29
C. Mark the casts and add Zod schemas at every outside read in the arcade

## What I had to decide

Whether the arcade's existing casts get a ts-allow mark (and its outside reads a Zod schema) in these slices, in the ratchet slice, or never.

## What I did meanwhile

apps/galaxy business, business-api, jev, proof, engineering and repositories now type-check with noUncheckedIndexedAccess (non-null assertions only, no output change) and the two pages that open a browser Supabase client pass Database to it; the four cast lines touched there carry a ts-allow mark. The other ~130 as/any lines in this territory's source, and its Supabase and fetch reads, are untouched.

## What it costs to change later

Cheap either way: adding a ts-allow comment to each line, or a schema at each read, changes no output and can be done by s29 or a follow-up in one pass.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s29's guard will scan apps/galaxy, where these unmarked casts would then fail it
- (author) Whether the plan's per-slice 'casts marked' and 'outside reads parsed' rules were meant to bind the arcade slices, given the spec's out-of-scope line

```

<!-- /omni-outbox-settled: s27-01-arcade-iv-casts-left-unmarked -->

<!-- omni-outbox-settled: s28-01-player-first-save-typing -->

## s28-01-player-first-save-typing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s28
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s28-01-player-first-save-typing
prd: 725
slice: s28
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When someone joins a fleet for the first time, the arcade may send their row without a name or a hero, and the database refuses a row missing either. Should the first save be made to always carry both?

## The decision, in plain words

The save that creates or changes a player stays as it was, untyped against the database, so nothing it does changes. Every other read and write in this slice is now checked against the database's own description.

## The intro, for fun

The types noticed a new player might arrive with no name and no face.

## The punchline, for fun

The database already turns such strangers away at the door; the question is who tells them first.

## The options, in plain words

A. Leave the save untyped against the database, and the database's refusal stands: what was built, with no behaviour change in this slice.
B. Type the first save so it must carry a name and a hero: a later change to the save and the fleet screens that call it, after which the compiler refuses a first save missing either.

## What I had to decide

Whether the first save of a player must carry a name and a hero, checked before it reaches the database.

## What I did meanwhile

The save works as before: a first save without a name or a hero is refused by the database and the screen shows that refusal.

## What it costs to change later

A constant: typing the save against the database later is a change to one function and its callers' patch type.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any screen ever creates a player without both a name and a hero was not traced through the arcade's fleet screens, which other slices own (author).

```

<!-- /omni-outbox-settled: s28-01-player-first-save-typing -->
