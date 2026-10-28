---
id: s1-01-public-api-fake-runs-as-omni-app
prd: 2573
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

Once every job needs the Omni App's token, the test double of the public interface for API keys would fail every job it claims and its tests would hang. Should this slice fix that test file, though it lies outside the files it was given?

## The decision, in plain words

I changed one line of that test double so it hands the runner service the same pretend GitHub the runner tests use. No product code outside the slice changed.

## The intro, for fun

A test double kept running jobs the old way.

## The punchline, for fun

It now pretends to be the Omni App too, like everyone else.

## The options, in plain words

A. A. Keep the one-line change in the public interface's test double, which reuses the runner tests' pretend GitHub.
B. B. Give the public interface's test double a pretend GitHub of its own, in its own folder.
C. C. Move the change to a slice of its own whose territory holds the public-api fixtures.

## What I had to decide

Whether the public interface's test double may take the runner tests' pretend GitHub, a change outside the slice's territory.
Decided by: Jev (hardToRevert 0.70) · agent said false

## What I did meanwhile

apps/galaxy/src/public-api/fixtures/public-api.fake.ts passes stubGithub().deps to runnersService, so its claims are answered with the Omni App's grant; the 971 tests of public-api and rewind are green.

## What it costs to change later

A constant: one argument of one test fake. Undoing it means giving that fake its own GitHub stub instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the public-api fixture to stay untouched, or simply did not foresee it.
