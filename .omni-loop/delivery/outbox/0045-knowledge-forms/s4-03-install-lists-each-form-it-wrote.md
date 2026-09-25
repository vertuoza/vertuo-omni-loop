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
