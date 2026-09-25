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
