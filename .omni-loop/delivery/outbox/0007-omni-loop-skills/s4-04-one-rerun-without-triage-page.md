---
id: s4-04-one-rerun-without-triage-page
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Without a written list of known flaky failures, when may the agent simply re-run a failed check instead of changing code?

## The decision, in plain words

Once per pull request, when the failure is plainly not the branch's doing, such as a runner, network or timeout failure in code the branch did not touch. That re-run still counts as one attempt.

## The options, in plain words

A. One re-run per PR when the failure is plainly unrelated, the option built.
B. No re-runs at all; every red check is fixed in code.
C. Add a config key naming a triage page, and allow a re-run only on a signature it lists.

## What I had to decide

The re-run rule of `/omni:pr`, since upstream's rule depended on its CI-triage page, which does not exist here.

## What I did meanwhile

On red: read `gh run view --log-failed`, compare against the branch's changed files since its merge base, allow one `gh run rerun --failed` per PR when unrelated, counted toward `limits.attempts`.

## What it costs to change later

One list in `kit/plugin/skills/pr/SKILL.md`; a config key if a triage page is wanted later.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether repositories adopting the kit will want a configured triage page, the way upstream had one.
