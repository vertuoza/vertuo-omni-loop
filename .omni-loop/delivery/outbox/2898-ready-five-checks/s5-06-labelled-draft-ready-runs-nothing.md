---
id: s5-06-labelled-draft-ready-runs-nothing
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Once a draft carries the label, its full checks and preview run on its latest change. When that draft is then marked ready, should they all run again on the same change?

## The decision, in plain words

No: marking a labelled draft ready runs nothing more, since its latest change was already checked in full, and any later change runs everything again. Adding any other label never runs or stops anything.

## The intro, for fun

The exam was taken on Friday.

## The punchline, for fun

Monday's diploma does not mean sitting it again.

## The options, in plain words

A. Run nothing more when a labelled draft is marked ready: what was built.
B. Run the full checks and the preview again when it is marked ready, as for any pull request.

## What I had to decide

The spec says the label starts the full checks, the e2e job and the preview on the draft's latest commit, again on each push, that only gated PRs pay for it, and that ready still comes last; it does not say what marking the draft ready does. The gate marks it ready only after five passes on that very commit. The `checks` workflow now hears `labeled`, so every other label would also start a run, and in a shared group a run that does nothing cancels the one that grades (issue 1167).

Decided by: Jev (hardToRevert 0.52) · agent said false

## What I did meanwhile

In `.github/workflows/checks.yml` and `.github/workflows/preview-debounce.yml`, `ready_for_review` on a labelled pull request, `labeled` with another label, and `labeled` on a pull request already ready run no job and sit alone in a concurrency group named by the run id; the graded runs share the `ready` group. The tests evaluate the expressions event by event.

## What it costs to change later

One clause in each workflow's gate and group, written twice per file, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person reading a ready pull request expects its checks to show as run on being marked ready
