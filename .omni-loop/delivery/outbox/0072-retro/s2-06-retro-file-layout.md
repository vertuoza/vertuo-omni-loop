---
id: s2-06-retro-file-layout
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The spec sketches the retro page and says its data file keeps every run, but leaves open where each kind of problem is shown and how the data file is laid out. What layout should they have?

## The decision, in plain words

The page lists every problem once, worst first, then gives each kind its own section that refers back to its problems, then the rules used. The data file keeps one record per run, holding the counted facts, whether the model wrote anything, and the issue links, so every number on the page can be found in it.

## The intro, for fun

A retro page has to be read by people in a hurry and checked by people with a calculator.

## The punchline, for fun

So the page tells the story once, and the data file keeps the receipts for every number.

## The options, in plain words

A. Problems once, worst first, then a section per kind referring back, and one data record per run, the option built.
B. Each kind's problems written out in full inside its own section, with no single ranked list.
C. The same page, with a data file holding only the latest run.

## What I had to decide

The layout of `retro.md` and the shape of `retro.json`. The spec's sketch has Findings, Proposed lessons, Timeline, Decisions, Rules and After merge; the plan asks `render` to place "each kind's findings under the section that kind names", so no later slice edits it. The spec says only that `retro.json` "holds the fact sheet of every run", yet a later reader may compare it across PRDs.

## What I did meanwhile

`retro.md`: front matter, summary or "Facts only: <reason>", Findings (F1… ranked by `rules`, each with what happened, why it matters, lesson, evidence and its issue link), Proposed lessons, one section per kind in the registry's order (Timeline, Decisions, Checks, Churn; each kind's own lines, then "Findings: F2 · <title> · #issue"), Rules, then After merge. A kind with nothing to say has no section. `retro.json` is `{ prd, runs: [record] }`, a record being the fact sheet (`run`, `rules`, `prd`, `featurePr`, `kinds` by id, `findings`) plus `narration` (`model`, `reason`, `dropped`) and `issues` (finding id to number, url and state); a replay replaces the record of the same feature PR and run. Golden files pin both.

## What it costs to change later

Before any retro is merged into a repository, a change is `render` and its golden files. After, the retro files already merged keep the old layout, and anything reading `retro.json` across PRDs reads both shapes, told apart by each record's rules version.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the two sections the sketch does not name, Checks and Churn, are wanted as sections or only as findings.
- (author) A PRD with a second feature pull request: its record is kept in the data file, but the page shows only the latest feature pull request's runs, not one section per feature pull request as the spec asks.
