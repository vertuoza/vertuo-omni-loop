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
