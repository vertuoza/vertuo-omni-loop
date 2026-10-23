---
id: s1-03-templates-folder-test
prd: 2417
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

May this slice change an existing test outside its own area, the one that lists every file the kit ships as a default?

## The decision, in plain words

Yes, by one line: that test now also lists the four shared rules pages the kit ships, so it keeps refusing any other file.

## The intro, for fun

A guest list that says nobody else is coming meets four new guests at the door.

## The punchline, for fun

We added four names to the list instead of tearing it up.

## The options, in plain words

A. A. The test lists the curated pages beside the forms' templates: the option built.
B. B. The test leaves the omni-settings folder out of its list, and only the curated pages' own test names what it holds.
C. C. The curated pages move out of the templates folder into a folder the bundle carries on its own.

## What I had to decide

Whether `kit/lib/playbook/templates.test.ts`, outside the slice's territory, may list the curated pages: its test that the templates folder holds one template per form and the front door, and nothing else, now adds `omni-settings/playbook/<form>.md` for each of `CURATED_FORMS`. Without it the plan's own territory, `kit/templates/omni-settings/`, cannot hold a file and keep that test green.

## What I did meanwhile

The test still refuses any file it does not name; `kit/lib/omni-settings/curated.test.ts` also checks that the curated folder holds exactly those four pages.

## What it costs to change later

One line of one test; reverting it means moving the curated pages out of the kit's templates folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the territory but not this test, which any file added under the templates folder trips.
