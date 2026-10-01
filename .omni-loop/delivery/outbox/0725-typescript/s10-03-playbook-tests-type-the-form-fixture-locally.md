---
id: s10-03-playbook-tests-type-the-form-fixture-locally
prd: 725
slice: s10
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

A shared test helper this slice relies on is typed by a later slice. How should this slice's tests use it meanwhile?

## The decision, in plain words

Each of this slice's test files that builds a form gives that helper its expected shape locally, in a few lines, until the later slice types the helper itself.

## The intro, for fun

The test helper still speaks untyped, and this slice could not wait for its lessons.

## The punchline, for fun

So five test files carry a small phrasebook until the helper graduates.

## The options, in plain words

A. Give the helper its shape locally in each test file until the later slice types it
B. Type the shared helper in this slice, outside its own ground
C. Put one typed wrapper of the helper inside this slice's folders and import it from each test

## What I had to decide

kit/test/fixture.ts belongs to s17 and still opens with @ts-nocheck, so formText's slots default is inferred as never[]: every call passing slots fails to compile. The territory forbids editing the fixture.

## What I did meanwhile

forms, check-playbook, releasing, resolve and review tests import formText as fixtureFormText and cast it to a local FormTextOptions signature (tests may cast fixtures freely). The same tests call main through an 'io as never' cast, since kit/bin/omni.ts is untyped until s17.

## What it costs to change later

Cheap: once s17 types formText and main, delete the five aliases and the casts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s17 will type formText with the same option shape (author)
