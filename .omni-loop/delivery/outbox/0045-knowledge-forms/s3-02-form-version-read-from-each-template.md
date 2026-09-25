---
id: s3-02-form-version-read-from-each-template
prd: 45
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The check refuses a knowledge page written for a newer kit than the one installed. What does the installed kit compare it against?

## The decision, in plain words

Each kind of page carries its own version in the kit's copy of it, and a page is refused only when it is newer than the kit's copy of that same page.

## The options, in plain words

A. Each page's version is compared with the kit's own copy of that page.
B. One version number for all the kit's pages, kept in the kit's code.
C. No version check until a second version of any page exists.

## What I had to decide

The spec says `omni check kb` fails on "a `form-version` newer than the kit's", and the before/after page says `form-version` "lets the kit add a slot later without breaking older forms". The kit has no form-version constant: each template in `kit/templates/playbook/` carries `form-version: 1`, and s1's parser reads it.

## What I did meanwhile

`gradeForm` in `kit/lib/playbook/check-playbook.mjs` compares a form's `form-version` with the `form-version` of the kit's template for the form its file is for, parsed with s1's parser, so there is no second number to keep in step. The same comparison refuses front matter naming another form than its file's. `blankForm` in `kit/lib/playbook/write-forms.mjs` writes the template's version. Tests: "fails on a form-version newer than the kit’s" and "fails on front matter naming another form" in `kit/bin/kb.test.mjs`.

## What it costs to change later

A constant, before or after merge: one kit-wide number is a constant and one comparison in `gradeForm`. Nothing stored changes, since every template and every written form says 1 today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later kit will raise one form's version without the others: the spec does not say how versions move.
