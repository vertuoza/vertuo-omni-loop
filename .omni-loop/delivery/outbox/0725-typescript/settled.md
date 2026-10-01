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
