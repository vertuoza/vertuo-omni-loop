---
id: s3-03-docs-item-outside-territory
prd: 346
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Adding Docs to the top bar turned two button-counting page tests red, and the docs build writes a generated folder git would pick up, all in files this slice was not given. Was touching them the right call?

## The decision, in plain words

We updated the two tests so they expect Docs after Release notes, added the docs page to the list of headers the shared test checks, and told git to ignore the generated folder. Nothing else in those files changed.

## The intro, for fun

One new button in the top bar, and two tests that count buttons noticed straight away.

## The punchline, for fun

We taught them to count to Docs, and asked git to look away from the build's scraps.

## The options, in plain words

A. Update them in this slice: what was built, the two tests expect Docs and the ignore list names the generated folder.
B. Widen the plan's territory instead: list those three files in the slice's row, so the same change sits inside bounds.
C. Leave the ignore list alone: generate the docs folder somewhere git already ignores, and keep only the test changes.

## What I had to decide

Whether a slice may update neighbouring tests its own change turns red, and the app's ignore list, when the plan did not name those files.

## What I did meanwhile

The header test, the knowledge map test and the app's ignore list carry the change; the whole suite is green apart from the release-date test that fails on this machine's git on main too.

## What it costs to change later

Cheap: a few lines in two tests and one line in an ignore list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks that every bar show Docs and that the header test be updated, which settles the new lines; only the territory was unsaid (author)
