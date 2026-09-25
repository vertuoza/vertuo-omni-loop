# Settled outbox items — PRD 45

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s4-01-init-lays-down-the-forms -->

## s4-01-init-lays-down-the-forms — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-init-lays-down-the-forms
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Should the one-line install also create the empty knowledge forms, and end by telling people how to fill them?

## The decision, in plain words

Yes. Installing now creates the empty forms, and its last message points to the skill that fills them.

## The options, in plain words

A. The install writes the blank forms after the config and the bin, and its closing steps name the terraform skill.
B. The install stays as shipped. Its closing steps only tell the person to run the forms command, then the terraform skill.
C. The install stays as shipped, and the terraform skill writes the blank forms itself when it runs.

## What I had to decide

PRD 39's `omni init` merged after this spec was first written. The spec had left the installer out of scope, with `omni kb init` as a separate command. Now that `omni init` ships, a repository can be installed without any forms, so the spec has to say whether the install lays them down. This is spec decision 13, added while re-planning and never put to the PRD author.

## What I did meanwhile

The spec (decision 13) and the plan (s4) have `omni init` run the forms writer after the config and the bin, and add a closing step naming `/omni:terraform`. Nothing is built yet: s4 is in wave 4.

## What it costs to change later

Before s4 merges: drop s4's forms step and the closing line from the plan, a few minutes. After it merges: revert s4's commit. Repositories installed in between keep their blank forms, which are harmless.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether `omni init` should stay as small as PRD 39 shipped it: config, bin and labels (author).

```

<!-- /omni-outbox-settled: s4-01-init-lays-down-the-forms -->

<!-- omni-outbox-settled: s4-02-laws-source-from-register-entries -->

## s4-02-laws-source-from-register-entries — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-laws-source-from-register-entries
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Once every install creates the knowledge folder, how should the install decide whether a repository has product rules that bind the agents?

## The decision, in plain words

It looks for at least one written principle, rule or invariant, instead of only checking that the folder exists.

## The options, in plain words

A. The install reads laws from the registers only when they hold at least one principle, rule or invariant.
B. Keep PRD 39's rule, where the folder existing means laws. A reinstall then reads laws from empty registers, which changes nothing until an entry is written.
C. The install stops guessing and always writes none; a person switches it on by hand.

## What I had to decide

PRD 39's `detectLawsSource` returns `knowledge` whenever `.omni-loop/knowledge` exists. A first install detects it before any form is written, so it still reads `none`. But decision 13 makes every install create that folder, so any later `omni init --force` would switch `laws.source` to `knowledge`, even in a repository whose registers are empty. This is spec decision 14, added while re-planning and never put to the PRD author.

## What I did meanwhile

The spec (decision 14) and the plan (s4, in `kit/lib/init/detect.mjs`) change the detection to registers that hold at least one entry. PRD 39's tests change only where they assert `laws.source` on a bare knowledge folder. Nothing is built yet: s4 is in wave 4.

## What it costs to change later

One function and its tests. If B or C is chosen, s4 drops the change, and nothing else in the plan depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a repository with an empty register folder ever means to adopt laws soon, and so should read as having them (author).

```

<!-- /omni-outbox-settled: s4-02-laws-source-from-register-entries -->

<!-- omni-outbox-settled: s1-01-kit-default-names-an-unset-setting -->

## s1-01-kit-default-names-an-unset-setting — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-kit-default-names-an-unset-setting
prd: 45
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a shared default page names a repository setting that is empty or holds a list, what should the page show?

## The decision, in plain words

It shows the placeholder exactly as written and reports it, the same as a setting that does not exist, so a reader never sees a guessed value.

## The options, in plain words

A. A setting that is empty, or holds more than one value, stays as a visible placeholder and is reported, like an unknown one.
B. An empty setting prints as not set, and a list prints its values separated by commas.
C. An empty setting or a list prints nothing, and is reported.

## What I had to decide

The spec says a kit default may name a config value as `{config:<key>}`, filled from the repository's config, and that an unknown key is left visible and reported. It does not say what to print when the key exists but holds `null` (the default for `commands.test` and `commands.preflight`, so in most freshly installed repositories), a list (`commands.checks`, `paths.context`) or a whole section. The templates (s2) are written against this rule, and `omni kb show` (s3) prints its result.

## What I did meanwhile

`fillConfig` in `kit/lib/playbook/resolve.mjs` fills a string, a number or a boolean. A key that names nothing, a key set to `null`, and a key holding a list or a section are all left in the text as written, and each is reported as a problem line (`names no config key`, `is not set in the config`, `holds no single value`). Tests: the `fillConfig` cases in `kit/lib/playbook/resolve.test.mjs`.

## What it costs to change later

A constant: widening `configValue` in `kit/lib/playbook/resolve.mjs` (for example, joining a list with commas) is a few lines and a test, before or after merge; no stored data or repository file depends on it. A template that already names a list key would start printing it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any kit default will need a list setting, such as the extra checks, printed inline: the templates are not written yet (s2).

```

<!-- /omni-outbox-settled: s1-01-kit-default-names-an-unset-setting -->

<!-- omni-outbox-settled: s1-02-section-with-text-and-open-questions -->

## s1-02-section-with-text-and-open-questions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-section-with-text-and-open-questions
prd: 45
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a section of a form holds written guidance and also an open question for a person, which one should an agent read?

## The decision, in plain words

The agent reads the written guidance, with the open question kept in place and still counted, so nothing the repository wrote is hidden behind the shared default.

## The options, in plain words

A. The written guidance shows, with the open question in place, and the question is still listed for a person.
B. The section counts as unanswered: the shared default shows, then the question, and the written guidance is hidden.
C. The check refuses a section that mixes the two, so a person must split them.

## What I had to decide

The spec's resolution table has one row for a filled section and one for a section holding `TODO(human)` lines (the kit default, then each question, labelled `[hole]`), and its example hole holds nothing else. It does not say what a section holding both repository text and a `TODO(human)` line is. The parser's reading decides what `omni kb show` (s3) prints and what `omni kb status` counts as an open question. Separately, the spec does not say whether an HTML comment in a body is content; the parser treats it as not content, since it renders as nothing.

## What I did meanwhile

`parseForm` in `kit/lib/playbook/forms.mjs` reads a body as `holes` only when every non-blank line is a `TODO(human):` line; a body with any other text is `text`, its `questions` still listing each `TODO(human)` line, and `resolveForm` labels it `[repo]` with the text as written. HTML comments are stripped before a body is read, so a comment-only body is `empty`. Tests: "reads text beside an open question as text, and still lists the question" and "reads a missing body, blank lines and comments alone as empty" in `kit/lib/playbook/forms.test.mjs`.

## What it costs to change later

A constant: which kind `readBody` returns for a mixed body is one condition and a test, before or after merge; no stored data depends on it. Forms already in a repository are read the new way at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether terraform (s5) will ever write a section that mixes the two: the spec's own examples keep them apart.

```

<!-- /omni-outbox-settled: s1-02-section-with-text-and-open-questions -->

<!-- omni-outbox-settled: s2-01-front-door-page-filled-from-settings -->

## s2-01-front-door-page-filled-from-settings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-front-door-page-filled-from-settings
prd: 45
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The page at the entrance of the knowledge folder must say where each kind of knowledge lives, even when some of it is kept elsewhere. Should the kit ship one such page, or one for each case?

## The decision, in plain words

One page, whose three locations are filled in from the repository's own settings when the page is written, so it names the right folders in every case.

## The options, in plain words

A. One plain page, whose locations are filled in from the repository's settings when it is written.
B. Two pages, one for knowledge kept in this folder and one pointing elsewhere; the install picks one.
C. The entrance page is a form like the others, with sections a repository can override, read the same way.

## What I had to decide

The spec says `omni kb init` writes the front door's `README.md` when it is missing, "pointing at `paths.knowledge` when the registers live elsewhere", and the plan gives s2 "the front door README template" under `kit/templates/`. Neither says whether that template is a form (front matter and slots, resolved per section) or a plain page, where it sits under `kit/templates/`, or how one text points elsewhere.

## What I did meanwhile

`kit/templates/README.md` is plain Markdown: a provenance line, a title, an opener, and no front matter or slots. It names the three places as `{config:paths.knowledge}`, `{config:paths.adr}` and `{config:paths.playbook}`, each a single string in every config, so the same text is right whether the registers live in the front door or elsewhere. Its path mirrors the front door: `kit/templates/` is the front door, `kit/templates/playbook/` the playbook. `frontDoorTemplate()` in `kit/lib/playbook/templates.mjs` returns it unfilled; s3's writer is expected to fill it with `fillConfig` (from `kit/lib/playbook/resolve.mjs`) when it writes the file. Test: "the front door’s README names the playbook, the knowledge registers and the decision records by config" in `kit/lib/playbook/templates.test.mjs`.

## What it costs to change later

A constant before s3 writes the file: the template's text, its path in `templates.mjs` and one test. After s3 merges, a repository that already holds its front door page keeps it, since `omni kb init` never changes an existing file; only new installs see a change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page should read differently when the registers live outside the front door, beyond naming that folder: the spec gives no wording for that case.

```

<!-- /omni-outbox-settled: s2-01-front-door-page-filled-from-settings -->

<!-- omni-outbox-settled: s2-02-bundle-hands-out-the-kit-defaults -->

## s2-02-bundle-hands-out-the-kit-defaults — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-bundle-hands-out-the-kit-defaults
prd: 45
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The shared default pages must travel inside the one file every repository installs. How should that file carry them, and how can anyone check that its copy matches the kit's?

## The decision, in plain words

The installed file carries every default page and hands them out on request, so a test can prove the installed copy says exactly what the kit's own pages say.

## The options, in plain words

A. The installed file carries every default page and hands them out on request, and a test compares them with the kit's own pages.
B. The installed file carries the pages but shows them only through the knowledge commands of the next slice; until then nothing checks the installed copy.
C. The pages ship as separate files beside the installed file, which reads them from there.

## What I had to decide

The spec says kit defaults "travel inside the bundled `omni.mjs`", and s2's "done when" asks that "from source and from the committed bundle, the same loader returns the same template text". But no command reads a template until s3's `omni kb`, so esbuild would leave the loader out of a bundle built from `kit/bin/omni.mjs`, which is not s2's territory. The plan asks that `kit/build.mjs` keep PRD 39's bundle marker and pinned working directory; it does not say whether the bundle may export more than `main`.

## What I did meanwhile

`kit/build.mjs` now builds from a one-line virtual entry (esbuild `stdin`) that keeps the hashbang, re-exports `kit/bin/omni.mjs`, and exports `formTemplate` and `frontDoorTemplate` from `kit/lib/playbook/templates.mjs` beside `main`. It defines `__OMNI_TEMPLATES__` as the JSON of `readTemplates()`, the loader's own reader, as a string parsed once (an object define would add an initialiser to every bundled module). `__OMNI_BUNDLE__` and `absWorkingDir` are unchanged. Test: "from source and from kit/dist/omni.mjs alone, the same loader returns the same text" in `kit/lib/playbook/templates.test.mjs`, which copies the committed bundle alone into a temporary folder and imports it with plain Node.

## What it costs to change later

A constant: dropping the two exports is one line of `kit/build.mjs` and a rebuild, once s3's `omni kb show` can prove the same thing through a command; that test would then move to it. Nothing stored depends on the exports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the committed bundle's exports are meant to stay `main` alone: PRD 39's tests assert its hashbang, its usage line and that it equals a fresh build, and nothing about its exports.

```

<!-- /omni-outbox-settled: s2-02-bundle-hands-out-the-kit-defaults -->

<!-- omni-outbox-settled: s3-01-pointer-form-holds-no-sections -->

## s3-01-pointer-form-holds-no-sections — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-pointer-form-holds-no-sections
prd: 45
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When the setup writes a knowledge page that only points to a page kept elsewhere, should it still carry the empty sections of a full page?

## The decision, in plain words

No. A page that points elsewhere carries only its title and its opening line, and the check asks it for no section, because the page it points to answers the whole question.

## The options, in plain words

A. A pointing page carries its title and opening line only, and the check asks it for no section.
B. A pointing page carries every section heading, empty, like a blank page, and the check still asks for every required one.
C. A pointing page carries every section heading, empty, and the check asks for none of them.

## What I had to decide

The spec says `omni kb init` writes every missing form with "the front matter with `state: blank`, the title, the opener, every slot heading and marker, empty bodies", and writes the decisions form "as a pointer" when `paths.adr` is outside the front door's `adr/` (the glossary form when `paths.glossary` is set). It does not say whether a pointer form keeps the slot headings. `omni check kb` fails on "a required slot whose marker is missing" without saying whether that holds for a pointer form, whose target resolves the whole form (s1's `resolveForm` ignores its slots). The before/after page's one pointer example, the decisions form in the vertuo-ai-domain column, has no slot.

## What I did meanwhile

`blankForm` in `kit/lib/playbook/write-forms.mjs` writes a pointer form as its front matter (`state: pointer`, `points-to: <path>`), its title and its opener, with no slot. `gradeForm` in `kit/lib/playbook/check-playbook.mjs` asks a pointer form for no required slot and warns on no blank one, but still fails on an unknown slot id or a dead `See:` line, and still lists its `TODO(human)` lines. Tests: "writes decisions as a pointer when paths.adr is outside the front door’s adr/, and glossary when paths.glossary is set" and "asks no section of a pointer form, and lets a folder pointer without an index through" in `kit/bin/kb.test.mjs`; "lists the questions of a pointer form, and asks it for no section" in `kit/lib/playbook/check-playbook.test.mjs`.

## What it costs to change later

A constant before s5 and s7 write pointer forms: one branch in `blankForm` and one condition in `gradeForm`, with their tests. After s7 merges, a pointer form this repository already holds keeps its shape, since `omni kb init` never changes a file that exists; choosing B then turns such a form red until its headings are added by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether /omni:terraform (s5) will ever turn a pointer form back into a filled one in place: if it does, it writes the section headings itself.
- (author) Whether a person reading a pointer form on GitHub needs a line of prose naming the target, beyond the front matter GitHub already shows.

```

<!-- /omni-outbox-settled: s3-01-pointer-form-holds-no-sections -->

<!-- omni-outbox-settled: s3-02-form-version-read-from-each-template -->

## s3-02-form-version-read-from-each-template — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-form-version-read-from-each-template
prd: 45
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The check refuses a knowledge page written for a newer kit than the one installed. What does the installed kit compare it against?

## The decision, in plain words

Each kind of page carries its own version in the kit's copy of it, and a page is refused only when it is newer than the kit's copy of that same page.

## The options, in plain words

A. Each page's version is compared with the kit's own copy of that page.
B. One version number for all the kit's pages, kept in the kit's code.
C. No version check until a second version of any page exists.

## What I had to decide

The spec says `omni check kb` fails on "a `form-version` newer than the kit's", and the before/after page says `form-version` "lets the kit add a slot later without breaking older forms". The kit has no form-version constant: each template in `kit/templates/playbook/` carries `form-version: 1`, and s1's parser reads it.

## What I did meanwhile

`gradeForm` in `kit/lib/playbook/check-playbook.mjs` compares a form's `form-version` with the `form-version` of the kit's template for the form its file is for, parsed with s1's parser, so there is no second number to keep in step. The same comparison refuses front matter naming another form than its file's. `blankForm` in `kit/lib/playbook/write-forms.mjs` writes the template's version. Tests: "fails on a form-version newer than the kit’s" and "fails on front matter naming another form" in `kit/bin/kb.test.mjs`.

## What it costs to change later

A constant, before or after merge: one kit-wide number is a constant and one comparison in `gradeForm`. Nothing stored changes, since every template and every written form says 1 today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later kit will raise one form's version without the others: the spec does not say how versions move.

```

<!-- /omni-outbox-settled: s3-02-form-version-read-from-each-template -->

<!-- omni-outbox-settled: s3-03-a-form-source-is-its-strongest-layer -->

## s3-03-a-form-source-is-its-strongest-layer — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-a-form-source-is-its-strongest-layer
prd: 45
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The map of the knowledge pages says, for each page, where it is read from: the repository, a pointer, or the kit's default. What does it say for a page whose sections come from different places?

## The decision, in plain words

It names the strongest place any section comes from: the repository when one section holds the repository's own words, a pointer when every answered section points elsewhere, and the kit's default when nothing is answered yet. The map also lists where each section comes from.

## The options, in plain words

A. One word per page, the strongest place any section comes from, and the place of every section beside it.
B. One word per page from its own stated state alone: filled means the repository, blank or missing means the kit's default.
C. No word per page: only the place of each section.

## What I had to decide

The spec says `omni kb status` prints "each form, its state, its open questions, its stale evidence and its source (repository, pointer or kit default)". A form resolves per slot, and one form can hold repository text, a `See:` line and blank slots at once, so a form's source is not a single fact; the spec does not say how to name it.

## What I did meanwhile

`formSource` in `kit/lib/playbook/status.mjs` returns `pointer` for a pointer form or one whose every answered section is a `See:` line, `repo` when at least one section holds repository text, and `kit` otherwise (a missing, invalid or blank form, or one holding only `TODO(human)` lines). Each form also lists `sections: [{ slot, source }]`. Test: "--json lists each form with its state, source, open questions and stale evidence" in `kit/bin/kb.test.mjs`.

## What it costs to change later

A constant, before or after merge: the rule is one function of `resolveForm`'s sections, and nothing stores it. /omni:terraform --refresh (s5) reads `state` and `stale`, not `source`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person reading the map wants a page with holes named apart from a page nobody has touched: today both read as the kit's default, and the open questions are listed below the map.

```

<!-- /omni-outbox-settled: s3-03-a-form-source-is-its-strongest-layer -->
