---
id: s3-06-manifest-test-outside-territory
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

This slice changed one test outside the files it was given, the one that lists which GitHub events the app reacts to; is that acceptable?

## The decision, in plain words

Yes: that test lists every event the app reacts to, and reacting to reviews is what this slice adds, so the list gained one line.

## The intro, for fun

A guest list had to grow by one name.

## The punchline, for fun

The new guest was invited by the spec.

## The options, in plain words

A. Keep the one-line change to the manifest test (built).
B. Move the expectation into the webhook's own tests and leave the manifest test as it was.

## What I had to decide

Whether to edit apps/omni-app/test/app-yml.test.ts, outside s3's territory, whose HANDLED expectation must name pull_request_review once the webhook handles it.

## What I did meanwhile

The test's HANDLED expectation gained pull_request_review: ['submitted', 'dismissed'], its title says so; nothing else in it changed. The manifest (app.yml) already subscribes to pull_request_review, so no permission or event was added; its header comment, which lists the actions the app acts on, was left as it is.

## What it costs to change later

Nothing to undo: the line follows the webhook's table.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s3 names apps/omni-app/test/fixtures/ but not this test, which the spec's re-run on reviews cannot avoid.
