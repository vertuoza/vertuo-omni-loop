---
id: s1-03-ci-form-names-new-jobs
prd: 2305
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The team's written guide to the automatic checks still says the security check runs only once a day, and that the push hook only typechecks and lints. Who updates it to name the two new jobs and the hook's new first step?

## The decision, in plain words

This slice left the guide as it is, because the guide sits outside the files it may change. It suggests the slice that cleans the loop's knowledge folder adds the lines, or a person does.

## The intro, for fun

The guards are on duty; the duty roster has not heard yet.

## The punchline, for fun

Nobody reads a roster that is one shift behind.

## The options, in plain words

A. A. Leave the guide to the slice that owns the knowledge folder, or to a person (built).
B. B. Update the guide now, outside this slice's files.

## What I had to decide

Keep A unless the guide should change in this PRD's first wave; then B, a short docs change outside this slice, by a person or the history slice.

## What I did meanwhile

The guide's workflows table says the security workflow runs on a schedule or by hand, and its hooks paragraph names only the typecheck and lint of what changed.

## What it costs to change later

Three lines in the CI form of the playbook, whenever they land.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The CI form's workflows table needs a row for the security workflow's open-source and gitleaks jobs on every pull request (author).
- Its hooks paragraph needs the open-source guard as the pre-push hook's first step (author).
