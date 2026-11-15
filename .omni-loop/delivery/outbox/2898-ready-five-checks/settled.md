# Settled outbox items — PRD 2898

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-ready-label-made-by-a-person -->

## s1-01-ready-label-made-by-a-person — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-ready-label-made-by-a-person
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The new label that starts the full checks on a draft has to exist before a skill can put it on a pull request. Should the install create it with the other loop labels, or a person once per repository?

## The decision, in plain words

A person creates it, as for the label a runner puts on a dead claim. The setting may rename it and the kit reads the usual name when it is left out, so turning the gate on is one label to make by hand.

## The intro, for fun

A label nobody created is a sticker with no glue.

## The punchline, for fun

For now, a person brings the glue.

## The options, in plain words

A. A person creates the label once; the kit reads its usual name: what was built.
B. Create it at install with the other loop labels, with the yes of the locked install law's owner.

## What I had to decide

`labels.readyCheck` is new. Created at install, it needs a style in `kit/lib/init/labels.ts` and new names in `kit/bin/init.test.ts` and `kit/bin/update.test.ts`: none of them is in s1's territory, and `kit/bin/init.test.ts` proves the locked N-PRODUCT-13, whose file stays its owner's. PRD 2175 met the same choice for `labels.released` and made the key optional. Optional, `omni config labels` does not print it when it is not set, which s1's done-when listed.

## What I did meanwhile

`labels.readyCheck` is optional; `readyCheckLabel()` reads `DEFAULT_READY_CHECK_LABEL` (`omni:ready-check`) when it is left out. `omni init` does not create it. s4, which adds the label, may create it when it is missing, or name it as a human step.

## What it costs to change later

Creating it at install is a style line, the label in two install test lists (one of them a locked law's proof, so its owner's yes) and the key defaulted.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s4 should create the label itself when it is missing, rather than name it as a human step

```

<!-- /omni-outbox-settled: s1-01-ready-label-made-by-a-person -->

<!-- omni-outbox-settled: s1-02-excuses-flag-tests-own-file -->

## s1-02-excuses-flag-tests-own-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-excuses-flag-tests-own-file
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
excuses: [kit/bin/item-excuses.test.ts]
---

## The question, in plain words

The tests of the new way to name the exact files a question excuses needed a home. The existing test file of that command proves a locked rule, so may they live in a new file beside it?

## The decision, in plain words

Yes. They sit in a new test file of their own next to the command's tests, and the file that proves the locked rule is left exactly as it was.

## The intro, for fun

Two roommates, one sacred shelf.

## The punchline, for fun

The new tests got their own shelf.

## The options, in plain words

A. Keep the new tests in a file of their own beside the command's tests: what was built.
B. Fold them into the file that proves the locked rule, with its owner's yes.

## What I had to decide

`omni item new --excuses <path>` is tested through `main()`, as every command is. `kit/bin/item.test.ts` is in s1's territory, but it proves N-PRODUCT-3, and the testing form keeps a law's proof file its owner's: tests of other behaviour go in a file of their own. The plan names no other test file for the command.

## What I did meanwhile

Wrote `kit/bin/item-excuses.test.ts` beside it, outside s1's territory; this item names it in its excuses field. `kit/bin/item.test.ts` is untouched.

## What it costs to change later

Moving the tests is a file rename, or folding them into the proof file once its owner agrees.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner of the locked rule would rather keep every test of the command in one file

```

<!-- /omni-outbox-settled: s1-02-excuses-flag-tests-own-file -->

<!-- omni-outbox-settled: s1-03-full-jobs-default-none -->

## s1-03-full-jobs-default-none — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-full-jobs-default-none
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The check that the full tests and lint ran needs the names of the jobs that run everything. What should it do in a repository that names none, and how does it recognise a job split into parallel parts?

## The decision, in plain words

A repository that names no job gets that check marked as not judged, with the reason, so it can never pass by accident. A job split into parts counts only when every part succeeded, and a job with another name never counts, even one with a similar name.

## The intro, for fun

Asked to check the full tests, the checker first asks which ones.

## The punchline, for fun

No answer, no pass.

## The options, in plain words

A. No job by default, so the check is not judged until a repository names its own: what was built.
B. Default to test and lint, the names this repository uses.
C. Also count a run whose name ends with the job's name, for jobs run through a shared workflow.

## What I had to decide

`ready.full` has no default the kit can know: job names are each repository's. With `[]` as the default, check 2 reads `not judged · ready.full names no CI job` (BL-GATE-1). A job's run is a check run named exactly the job (`test`) or a leg of its matrix (`test (1)`); `quick` and `test shard 1/3` are other jobs. This repository sets `ready.full: [test, lint]` in s10.

## What I did meanwhile

`ready.full` defaults to `[]`; check 2 matches a run by the job's exact name or by `<job> (`, and every leg must succeed.

## What it costs to change later

A default and one matching line in `kit/lib/ready/checks.ts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a repository runs its full suite under a job name that a reusable workflow prefixes, as caller / job, which this matching does not read

```

<!-- /omni-outbox-settled: s1-03-full-jobs-default-none -->

<!-- omni-outbox-settled: s1-04-loosening-reads-per-file -->

## s1-04-loosening-reads-per-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-loosening-reads-per-file
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The check that no test was loosened has to decide how closely it reads a change. Should it count tests and assertions file by file, treat a new timeout as a raised one, and read the quality floors and baselines where this repository keeps them?

## The decision, in plain words

It counts file by file, so a test moved to another file reads as removed and a new timeout reads as raised, both leaning toward asking a person rather than letting something slip. It reads the floors and baselines where the spec names them, with no new setting for now.

## The intro, for fun

A detector that squints at one file at a time sees every crumb.

## The punchline, for fun

Some crumbs are just a test that moved house.

## The options, in plain words

A. Count file by file and read the floors and baselines where the spec names them: what was built.
B. Compare test counts across all changed files, so a moved test is no finding.
C. Make the floors and baselines a setting each repository fills in.

## What I had to decide

The spec lists the weakenings but not how they are measured. The detector (`kit/lib/ready/loosening.ts`) counts declarations, `expect(` calls, skip markers, suppressions and timeouts in each file at both ends, so a renamed test and a stronger assertion are clean, but a test moved between files fails check 4 until an item excuses it. A timeout key or a trailing test timeout new in a file counts as raised. The floor and baseline ground is `READY_LOOSENING_GROUND` in `kit/lib/config.ts` (`mutation/floor.json`, `fallow/`, `layering/`), the one file allowed to carry repository literals, not a config key: the spec names no setting for it.

## What I did meanwhile

Built the per-file detector, and the ground as a constant the rule reads unless its facts pass another.

## What it costs to change later

Comparing across files is a change inside the detector; a `ready.floors` and `ready.baselines` setting is one schema key each, the constant becoming their default.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often a pull request moves tests between files, which would make the per-file count ask more than it should

```

<!-- /omni-outbox-settled: s1-04-loosening-reads-per-file -->
