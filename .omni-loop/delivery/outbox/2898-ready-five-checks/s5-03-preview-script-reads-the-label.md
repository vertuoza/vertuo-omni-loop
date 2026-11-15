---
id: s5-03-preview-script-reads-the-label
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
excuses: [scripts/preview-debounce.sh]
---

## The question, in plain words

The preview of a pull request is built by a small script that refuses every draft, and the plan let this slice change the workflow that calls it but not the script. May the script let a draft through when it carries the label that asks for the full checks?

## The decision, in plain words

Yes. The script now reads the pull request's labels and builds the preview of a draft that carries that label, and still refuses every other draft.

## The intro, for fun

The doorman let only finished guests in.

## The punchline, for fun

Now a guest with the right badge gets in early.

## The options, in plain words

A. Let the script build a labelled draft's preview: what was built.
B. Leave the script as it was and build the labelled draft's preview from a second script of this slice.

## What I had to decide

s5's done-when asks that a draft labelled `omni:ready-check` runs the preview. `.github/workflows/preview-debounce.yml` is in the territory, but `scripts/preview-debounce.sh` stops on any draft (`stop "a draft"`), before the wait and again after it, and is not. A second script would copy its wait, its project choice and its Vercel call.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

`scripts/preview-debounce.sh` reads the labels with the pull request (`read_pr` prints them fifth) and lets a draft through when they hold `PREVIEW_READY_LABEL`, default `omni:ready-check`, at both reads. Its tests in `scripts/preview-debounce.test.ts` cover a labelled draft, a draft labelled otherwise and a label removed while it waited.

## What it costs to change later

A few lines in `scripts/preview-debounce.sh` and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person would rather keep the preview script for ready pull requests only and give labelled drafts their own
