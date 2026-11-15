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
