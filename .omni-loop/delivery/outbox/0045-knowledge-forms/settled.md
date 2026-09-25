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
