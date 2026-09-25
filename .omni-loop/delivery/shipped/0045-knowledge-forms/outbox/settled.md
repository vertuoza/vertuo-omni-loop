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

<!-- omni-outbox-settled: s4-03-install-lists-each-form-it-wrote -->

## s4-03-install-lists-each-form-it-wrote — adopted

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
id: s4-03-install-lists-each-form-it-wrote
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the install lays down the empty knowledge forms, how should its closing message show them, and where should the new step that fills them go?

## The decision, in plain words

The message gives each form the install wrote its own line, says nothing about forms that were already there, and makes filling the forms the last step of its list.

## The options, in plain words

A. Each form written gets its own line, forms already there are not listed, and filling the forms is the last step.
B. One line sums up the forms folder, with how many were written and how many were already there, and filling the forms is the last step.
C. Each form gets its own line, written or already there, like the settings file, and filling the forms comes right after installing the plugin.

## What I had to decide

The spec says `omni init` "lists the files it wrote among the files it reports" and that its closing steps "gain one: fill the forms with `/omni:terraform`". It does not say whether a form already there is listed (the config and the bin print `kept … (pass --force to overwrite)`, but `--force` never overwrites a form), nor where the new step sits among PRD 39's numbered steps. The plan asks that PRD 39's tests be amended only where they assert `laws.source` on a knowledge folder, yet its footprint test (AC 7) and its closing-steps tests (AC 8) compare the whole file list and the whole output, so they cannot pass unchanged once the forms are written: they are amended to list the forms and the new step.

## What I did meanwhile

`closingSteps` in `kit/lib/init/steps.mjs` takes `forms: { dir, wrote, outside }` and prints, after the config and the bin, one `  wrote   <path>` line per file the forms writer wrote and none for a file it found. The step `Fill the forms in <front door>/ with what the repository can prove, in Claude Code:` then `/omni:terraform` is pushed last, after the optional branch-protection step, so the labels step keeps its number 3. In `kit/bin/init.test.mjs`, `FIRST_RUN` lists the seventeen files and the new step, the footprint test lists the seventeen files, and the second-run test skips them; the new test "a repository installed before the forms: keeps the config and the bin, writes the forms and lists each one" covers a repository installed before this PRD.

## What it costs to change later

A constant, before or after merge: the listing and the step's place are a few lines of `closingSteps` and the `FIRST_RUN` lines of its test. Nothing is stored; the message is only printed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person reading the install's output wants one line per form, seventeen on a first run, or one line for the whole folder: the spec names each file only for `omni kb init`, which prints what it wrote.
- (author) Whether PRD 39's footprint and closing-steps tests may be amended to list the forms, beyond the `laws.source` amendment the plan names: without it they cannot pass once the forms are written.

```

<!-- /omni-outbox-settled: s4-03-install-lists-each-form-it-wrote -->

<!-- omni-outbox-settled: s4-04-install-writes-no-form-outside-its-folder -->

## s4-04-install-writes-no-form-outside-its-folder — adopted

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
id: s4-04-install-writes-no-form-outside-its-folder
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The install may only write inside its own folder. What should it do when a settings file it keeps puts the knowledge forms somewhere else in the repository?

## The decision, in plain words

It writes no form there, says so in its closing message, and leaves them to the skill that fills the forms, which creates them where the settings say.

## The options, in plain words

A. The install writes no form outside its folder, says so, and points to the step that fills the forms.
B. The install writes the forms where the settings say, even outside its own folder.
C. The install refuses to run until the settings put the forms inside its folder.

## What I had to decide

The spec says `omni init` runs the same writer as `omni kb init`, and that "everything it writes stays under `.omni-loop/`, as PRD 39 requires". A config `omni init` writes never sets `paths.playbook`, so its forms land in `.omni-loop/knowledge/`. But a config it keeps (no `--force`) may set `paths.playbook` elsewhere, say `docs/playbook`, and the writer would then write the front door's page, the forms and the decisions form under that folder's parent. The spec does not say which of the two rules wins.

## What I did meanwhile

`init` in `kit/bin/commands/init.mjs` calls `writeForms` only when the front door (`ctx.layout.frontDoor`, the playbook folder's parent), normalized, is `.omni-loop` or lies under it. Otherwise it writes none, and `closingSteps` prints `  forms   not written: <front door>/ is outside .omni-loop/ — see step <n> below`, naming the `/omni:terraform` step, whose step 0 runs `omni kb init`. Test: "writes no form outside .omni-loop/: a kept config whose playbook lies elsewhere leaves them to /omni:terraform" in `kit/bin/init.test.mjs`.

## What it costs to change later

A constant, before or after merge: one condition in `kit/bin/commands/init.mjs`, one line in `kit/lib/init/steps.mjs` and one test. No repository holds a form this rule kept out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any repository keeps its playbook outside `.omni-loop/`: the default keeps it inside, and the spec gives no example of one that does not.

```

<!-- /omni-outbox-settled: s4-04-install-writes-no-form-outside-its-folder -->

<!-- omni-outbox-settled: s5-01-terraform-config-proposal-is-its-own-commit -->

## s5-01-terraform-config-proposal-is-its-own-commit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-terraform-config-proposal-is-its-own-commit
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the setup skill learns better values for the repository's settings, how should it put them to the person who reviews its work?

## The decision, in plain words

It changes the settings file in the same review request, as a separate change the reviewer can accept or drop on its own, and lists each new value with the file that shows it.

## The options, in plain words

A. The settings change is its own step inside the one review request, which lists each value and the file that shows it.
B. The settings stay untouched, and the review request only lists the suggested values for a person to copy in by hand.
C. The settings change is folded into the same step as the knowledge pages.

## What I had to decide

The spec's step 6 says `/omni:terraform` proposes config "as a diff", and step 7 says it opens "one docs-only pull request". It does not say whether that diff is committed on `branches.terraform` or only shown in the body, nor whether `.omni-loop/config.yml` counts as docs. The before/after page shows `config.yml` gaining "values terraform learned", and s7's done-when says "the config proposals applied". It also does not say whether an empty `commands.checks` list counts as unset, for "a command that is `null`".

## What I did meanwhile

Step 5 of `kit/plugin/skills/terraform/SKILL.md` edits `.omni-loop/config.yml`, runs `omni config` and `omni check all`, and commits the change alone as `chore(config): …`. Step 6's docs-only check allows only files under the front door and the config file, and the body's `## Config` lists each key, old to new, with its evidence. A key that turns `omni check all` red is left out and named. An empty `commands.checks` counts as unset.

## What it costs to change later

A constant: a few lines of skill prose, before or after merge. No stored data depends on it; a terraform pull request already opened keeps its shape until the next run rewrites it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the docs-only pull request was meant to carry the settings file, or Markdown pages alone: the before/after page shows the settings gaining values, but not through which change.

```

<!-- /omni-outbox-settled: s5-01-terraform-config-proposal-is-its-own-commit -->

<!-- omni-outbox-settled: s5-02-terraform-continues-its-open-pull-request -->

## s5-02-terraform-continues-its-open-pull-request — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-terraform-continues-its-open-pull-request
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the setup skill runs again while its earlier review request is still open, or after that one was merged or closed, where should its new work go?

## The decision, in plain words

An open request is continued, so there is only ever one; once the earlier one was merged or closed, the skill starts again from the main line under the same name.

## The options, in plain words

A. Continue the open request; after a merge or a close, start afresh from the main line, replacing what the earlier run left under that name.
B. Open a new request under a new, dated name on every run.
C. Stop and ask a person whenever an earlier run's work still exists under that name.

## What I had to decide

`branches.terraform` is one fixed name (default `docs/omni-terraform`, no placeholder), and `/omni:terraform --refresh` runs again later on the same repository. The spec says terraform opens one pull request on that branch, and does not say what happens when the branch, or its pull request, already exists.

## What I did meanwhile

Step 0 of `kit/plugin/skills/terraform/SKILL.md` runs `gh pr list --head <terraform branch> --base <repo.defaultBranch> --state open`. One open: `git worktree add -B <terraform branch> <worktrees>/terraform <remote>/<terraform branch>`, and step 6 rewrites that pull request's body. None open: the same command from `<remote>/<repo.defaultBranch>`, and step 6 pushes with `--force-with-lease`; a branch whose pull request is open is never forced.

## What it costs to change later

A constant: a few lines of skill prose, before or after merge. A forced push over a merged branch loses nothing, and a closed pull request's commits stay readable on GitHub.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person ever keeps unmerged work on that branch after closing its pull request, which starting afresh would replace.

```

<!-- /omni-outbox-settled: s5-02-terraform-continues-its-open-pull-request -->

<!-- omni-outbox-settled: s5-03-terraform-treats-an-unmarked-section-as-a-persons -->

## s5-03-terraform-treats-an-unmarked-section-as-a-persons — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-terraform-treats-an-unmarked-section-as-a-persons
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The setup skill must never overwrite what a person wrote on a knowledge page. How does it tell a person's section from its own when the person did not label it?

## The decision, in plain words

It rewrites only sections that are empty, hold nothing but open questions, or that it labelled as its own; any other written section counts as a person's and is left alone.

## The options, in plain words

A. Only an empty section, one holding only questions, or one the skill labelled as its own is rewritten; every other section is a person's.
B. Only a section a person labelled as theirs is protected; unlabelled text is the skill's to rewrite.
C. The skill never rewrites a section holding any text, even its own; a refresh only fills empty sections and questions.

## What I had to decide

The spec says terraform "never rewrites a `by: human` section", and that `--refresh` redoes stale or blank forms. `omni kb init` writes markers with no `by:`, a person answering a `TODO(human)` line may not add `by: human`, and the spec's own example hole carries no `by:`. It does not say who owns a section holding text with no `by:`, nor whether a hole terraform writes is marked `by: terraform`.

## What I did meanwhile

The "Whose section it is" section of `kit/plugin/skills/terraform/SKILL.md`: terraform writes a section only when it is empty, holds nothing but `TODO(human)` lines, or its marker says `by: terraform`; text or a `See:` line with no `by:` is a person's. A hole's marker keeps no `by:`, and the pull request body tells a person to add ` · by: human` when answering one. A form holding a person's section is never turned into a pointer.

## What it costs to change later

A constant: the rule is prose in one skill. Narrowing it to option B is one sentence, but any section a person already wrote without a label would then be rewritten by the next refresh.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people will reliably label the sections they answer, which option B relies on.

```

<!-- /omni-outbox-settled: s5-03-terraform-treats-an-unmarked-section-as-a-persons -->

<!-- omni-outbox-settled: s5-04-terraform-never-runs-a-command-that-publishes -->

## s5-04-terraform-never-runs-a-command-that-publishes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-terraform-never-runs-a-command-that-publishes
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The setup skill writes a command down only after running it successfully. What about commands that publish, deploy or change shared data, which must not be run just to check them?

## The decision, in plain words

It never runs them, so it never writes them down as checked; the page points at the file where they are defined, or asks a person.

## The options, in plain words

A. Never run a command that deploys, publishes, releases or changes shared data; point at where it is defined, or ask a person.
B. Write such commands down as the repository shows them, marked as not checked.
C. Run them in a rehearsal mode when the tool offers one, and write them down when that succeeds.

## What I had to decide

Decision 6 and step 4 of the spec say every command is run once, green, before it is written, and its slot carries `verified: <date>`. The releasing form's `how` and `rollback` slots, and some CI steps, name commands that deploy, publish or migrate: running them to verify them would publish. The spec does not say which commands terraform may run.

## What I did meanwhile

Step 3 of `kit/plugin/skills/terraform/SKILL.md` runs only commands that check or build (install, build, test, lint, typecheck, the preflight). A deploy, publish, release, shared-database migration or shared-environment write is never run and never written as verified: its section is a `See:` line to the file that defines it, or a `TODO(human)` question. A command that changes tracked files is undone with `git restore` before the next step.

## What it costs to change later

A constant: a few lines of skill prose, before or after merge. Forms written meanwhile hold pointers to where those commands live, which stay true under any later rule.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any repository's release or deploy command is safe to run from a checkout, which would let terraform verify it.

```

<!-- /omni-outbox-settled: s5-04-terraform-never-runs-a-command-that-publishes -->

<!-- omni-outbox-settled: s5-05-terraform-marks-a-form-holding-only-questions-filled -->

## s5-05-terraform-marks-a-form-holding-only-questions-filled — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-05-terraform-marks-a-form-holding-only-questions-filled
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the setup skill could only ask questions on a knowledge page, should that page count as filled in, or as still empty?

## The decision, in plain words

It counts as filled in and dated, so a later refresh does not ask the same questions again; only a page the skill left wholly empty stays marked empty.

## The options, in plain words

A. A page holding any written text, pointer or question is marked filled and dated; a page left wholly empty stays marked empty.
B. A page holding only questions stays marked empty, so every refresh looks at it again.
C. Every page the skill looked at is marked filled and dated, even one it left wholly empty.

## What I had to decide

A form's front matter has `state: blank | filled | pointer` and `terraformed: <date> | null`, and `--refresh` redoes "the forms `omni kb status` reports stale or blank". The spec does not say which state a form holding only `TODO(human)` lines carries, nor one terraform surveyed and left empty because the kit default is already right.

## What I did meanwhile

Step 3 of `kit/plugin/skills/terraform/SKILL.md`: a form whose sections hold any text, `See:` line or question is `state: filled` with `terraformed: <today>`; a form left wholly empty stays `state: blank`, `evidence: []`, `terraformed: null`, so `--refresh` surveys it again.

## What it costs to change later

A constant: one sentence of skill prose. Forms written meanwhile keep the state they were given until a person or a refresh changes it; only the refresh choice and the map read it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person wants a refresh to ask again the questions nobody has answered yet, which option B would do.

```

<!-- /omni-outbox-settled: s5-05-terraform-marks-a-form-holding-only-questions-filled -->

<!-- omni-outbox-settled: s6-01-reruns-follow-the-ci-form -->

## s6-01-reruns-follow-the-ci-form — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-reruns-follow-the-ci-form
prd: 45
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When a check fails for a reason that looks unrelated to the change, may the agents simply run it again, or must the failure be one the repository has written down as known?

## The decision, in plain words

Only a failure the repository's page about its checks lists as known, in ground the change did not touch, is run again, and only once. With nothing listed, every failure is the change's to fix.

## The options, in plain words

A. Re-runs follow the repository's page about its checks: only a failure listed there as known is run again, once, and a failed slice whose failure is one gets that one re-run too.
B. The page adds to the old rule: a failure plainly outside the change, such as a broken machine or network, still gets one re-run when the page lists nothing.
C. The page only informs: pull requests keep the old rule, and a failed slice is never run again.

## What I had to decide

The spec's wiring table gives `/omni:pr` (watch to green) and `/omni:wave` (a red slice) the `ci` form: "which checks exist and gate, the known reds, when a re-run is allowed". Before this PRD, `/omni:pr` allowed one re-run per PR for any failure plainly not the branch's (a runner, network or timeout failure), because no CI-triage page existed (PRD 7's item s4-04, recorded in `kit/porting/plugin--pr.md`). The `ci` form's kit default (s2, its `rerun` slot) allows a re-run only for a listed known red the branch does not touch, so a repository that lists none gets no re-run. `/omni:wave` never re-ran a red slice. The spec does not say whether the form replaces the old allowance or adds to it, nor what the wave does with a red slice whose failure is a known red.

## What I did meanwhile

`/omni:pr`'s triage (On red, steps 2 and 3) treats a failure matching a known red in the `ci` form, where the branch changes nothing that red names, as not the branch's, and re-runs only when the form's When to re-run section allows it: one per PR, counted as an attempt. The runner, network or timeout allowance is gone. `/omni:wave` (§4, A red slice) reads `omni kb show ci` once; a `red` slice whose failing step matches such a known red goes through steps 1 to 5 like a `done` slice, the preflight run by `/omni:pr`'s sub-PR lifecycle being its one re-run.

## What it costs to change later

Prose only, before or after merge: one step in `kit/plugin/skills/pr/SKILL.md` and one paragraph in `kit/plugin/skills/wave/SKILL.md`, no code and no stored data. Restoring the old allowance as a fallback is one sentence in `/omni:pr`'s step 3.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a repository that lists no known red should still get one re-run for a runner or network failure: the kit default says no, as upstream did; PRD 7's port said yes only because no page existed.
- (author) Whether the wave should re-run a red slice at all, or only name the known red in the stuck comment.

```

<!-- /omni-outbox-settled: s6-01-reruns-follow-the-ci-form -->

<!-- omni-outbox-settled: s6-02-a-form-never-overrides-a-skill-rule -->

## s6-02-a-form-never-overrides-a-skill-rule — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-a-form-never-overrides-a-skill-rule
prd: 45
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When a repository's own page about how to work asks for something a delivery skill forbids, such as an agent merging its own pull request, which one does the agent follow?

## The decision, in plain words

The skill's rules win. A page adds steps and detail to what the agent does, but never loosens what the skill forbids.

## The options, in plain words

A. The skill's rules win; a repository's page only adds to them.
B. The repository's page wins wherever it speaks, since it knows the repository best.
C. Say nothing, and let the agent weigh the two case by case.

## What I had to decide

The spec wires each skill to read its forms through `omni kb show`, and decision 2 ranks the layers inside one form (pointer, then repository section, then kit default). It does not say how a form's text ranks against the skill that reads it: for example a filled `briefing` or `pull-requests` section saying to merge once green, while `/omni:pr` never merges a PR into `repo.defaultBranch`.

## What I did meanwhile

Step 0 of each of the seven skills, after printing the briefing, says: "A form adds to the steps below; it never overrides this skill's rules." The same paragraph says a `[hole]` is a question for a person, never a reason to stop (spec decision 7).

## What it costs to change later

Prose only, before or after merge: one sentence in the step 0 of seven `SKILL.md` files. No code and no stored data depend on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a repository should ever tighten or loosen a skill's rule through its playbook, for example its number of repair attempts: today that is what the config is for.

```

<!-- /omni-outbox-settled: s6-02-a-form-never-overrides-a-skill-rule -->

<!-- omni-outbox-settled: s6-03-a-lesson-for-a-page-kept-elsewhere -->

## s6-03-a-lesson-for-a-page-kept-elsewhere — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-a-lesson-for-a-page-kept-elsewhere
prd: 45
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When a person's answer teaches a lesson about how to work in the repository, and the page it belongs to is kept elsewhere in the repository rather than in the loop's own folder, where is the lesson written?

## The decision, in plain words

In the page kept elsewhere, so that page stays the one source. When only one part of the loop's page points there, the record of the answer still names that part; when the whole page points there, the record says in words where the lesson went.

## The options, in plain words

A. Write it in the page kept elsewhere; the record names the part of the loop's page when there is one, and otherwise says where the lesson went.
B. Write it into the loop's own page anyway, beside the pointer, so the record can always name it; agents reading the page would not see it while the pointer stands.
C. Keep it in the record of the answer only, and let a person copy it where it belongs.

## What I had to decide

Spec decision 10: a process lesson lands in a playbook section, `by: human`, and the settled entry records `Became: playbook/<form>#<slot>`, which `omni check outbox` resolves only when the form's own file holds that slot and it is not blank (s1's `resolvePlaybookId`). Decision 4 keeps pointers, not copies. A form with `state: pointer` holds no slot (s3-01) and `omni kb show` prints its target, not its slots; a section holding a `See:` line prints the page it names. The spec does not say where a lesson goes when the form, or the section, points elsewhere.

## What I did meanwhile

`/omni:yolo-fix` §3 (write-back): a section that `omni kb show <form>` prints from another page takes the lesson in that page, and the entry still records `Became: playbook/<form>#<slot>`, since the `See:` line keeps the slot non-blank. A form that points elsewhere as a whole takes the lesson in its target, and the entry records `Stays here:` with a reason naming where it went: there is no slot to name, and a `Became:` would fail `omni check outbox`.

## What it costs to change later

Prose only, before or after merge: two sentences in `kit/plugin/skills/yolo-fix/SKILL.md`. A ledger that already holds such a `Stays here:` line keeps it, since the ledger only grows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the kit should later accept a `Became:` naming a page outside the playbook, so a lesson written into a pointed page is traced like any other.

```

<!-- /omni-outbox-settled: s6-03-a-lesson-for-a-page-kept-elsewhere -->

<!-- omni-outbox-settled: s7-01-context-files-left-empty -->

## s7-01-context-files-left-empty — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-context-files-left-empty
prd: 45
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

This repository has no top-level instructions file for coding agents, so the setting that lists such files named one that does not exist. Should it list the arcade's own instructions file instead, or nothing?

## The decision, in plain words

It lists nothing. The arcade's instructions file is a note about the arcade's web framework, so every other change would read a note that does not concern it.

## The options, in plain words

A. The list is empty: nothing at the top of the repository, and the arcade's note stays with the arcade.
B. The list names the arcade's instructions file, so every change reads it before building.
C. The list names the repository's front page instead, so every change reads that first.

## What I had to decide

Spec step 6 has `/omni:terraform` propose `paths.context`, and the skill's step 5 table proposes it when "its list names a missing file, or misses a `CLAUDE.md` or `AGENTS.md` the tree holds: the files that exist, `[]` when none". The before/after page's column for this repository says `paths.context: []`, "because CLAUDE.md does not exist". But the tree holds `apps/galaxy/AGENTS.md` (the Next.js agent note `next dev` writes) and `apps/galaxy/CLAUDE.md` (a one-line `@AGENTS.md`), both about the arcade alone. Neither the spec nor the skill says whether a nested file counts.

## What I did meanwhile

`.omni-loop/config.yml` sets `paths.context: []`, with a comment saying why, in its own commit (`chore(config): paths.context names no missing file (s7)`). `omni config` prints it and `omni check all` stays green. `/omni:do-work`, `/omni:plan` and `/omni:brainstorm` read no context file here; the session-start hook in `.claude/settings.json` prints the briefing instead.

## What it costs to change later

A constant: one line of config. Listing `apps/galaxy/AGENTS.md` later is one entry in the list; besides the skills, only the phase-0 policy reads the list, to count its files as documents.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the skill's rule means a `CLAUDE.md` or `AGENTS.md` anywhere in the tree, or only at its root.
- (author) Whether a slice that changes the arcade needs the Next.js note before it builds; Claude Code reads a folder's own `CLAUDE.md` when it works in that folder, but the skills read only `paths.context`.

```

<!-- /omni-outbox-settled: s7-01-context-files-left-empty -->

<!-- omni-outbox-settled: s7-02-section-pointer-prints-whole-page -->

## s7-02-section-pointer-prints-whole-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-section-pointer-prints-whole-page
prd: 45
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

A section of a knowledge page can send the reader to one heading of another page, but the tool that prints the page shows all of that other page, not the heading. Should this repository's pages still send sections to long pages that way?

## The decision, in plain words

Yes, where the plan's page shows it. But the setup page, which every build reads first, sends its section on running things locally to the short front page rather than the long arcade page, to keep what every build reads small.

## The options, in plain words

A. Point anyway, as the plan's page does, but keep the page read before every build pointed at the short front page.
B. Point every section at its exact heading, however long the page that gets printed.
C. Write a short sentence naming the page instead of a pointer, so nothing extra is printed.
D. Change the tool first so that a pointer prints only the heading's section, then point everywhere.

## What I had to decide

The spec's grammar for a section pointer is `See: <path>[#anchor]`, and its resolution table says `omni kb show` prints "the page it names". `resolveSlot` in `kit/lib/playbook/resolve.mjs` reads the whole target and keeps the anchor only in the label, so a pointer to one heading prints every line of the page. `/omni:terraform` step 2 says a page that answers one section is pointed at, never copied, and the before/after page makes `releasing#how` a pointer to `apps/galaxy/README.md#deploy-to-production`, a page of about 250 lines. The spec's Risks name "too much text in a skill's context". Nothing says which wins when a pointer's page is long.

## What I did meanwhile

`releasing#how` is `See: apps/galaxy/README.md#deploy-to-production`, as the page shows, so `omni kb show releasing` (read by `/omni:brainstorm` and `/omni:plan`) prints the whole arcade README. `setup#run`, read by `/omni:do-work` before every slice, is `See: README.md#open-the-galaxy`, the root README of about 100 lines, rather than `apps/galaxy/README.md#run-it-locally`. No kit code changed: `kit/` is outside this slice's territory.

## What it costs to change later

A constant for the forms: each pointer is one line. Printing only the anchored section is a change to the kit's resolver and its tests; every `See:` line then prints less without being rewritten, and `setup#run` can point at the arcade's own section.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec meant a section pointer to print only the section its anchor names; the resolution table says only "the page it names".
- (author) How much text a skill's context can take before a long pointed page costs more than it gives.

```

<!-- /omni-outbox-settled: s7-02-section-pointer-prints-whole-page -->
