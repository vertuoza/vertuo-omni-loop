---
id: s2-01-s2-dom-test-dev-dependencies
prd: 3129
slice: s2
rank: medium
bears-on: none
raised: 2026-11-21
wave: 2
---

## The question, in plain words

To prove that picking an option in the Ask page's dropdowns still saves it, the tests need the same browser-test tools the shared dropdown's own tests use. Is it fine that the app now lists them as development tools?

## The decision, in plain words

The app's package list and the lockfile gained four test-only tools already used by another package, so the Ask page's pick tests can run in a simulated browser.

## The intro, for fun

Even a dropdown deserves a proper test drive before it leaves the garage.

## The punchline, for fun

Four test-only tools moved in, and none of them ships to anyone.

## The options, in plain words

A. A. Keep the four test-only tools as development dependencies of the app and test the picks in a simulated browser (as built).
B. B. Drop the browser test and check only the rendered markup, leaving the saving of a pick unproven.

## What I had to decide

Option A keeps one new test file in the Ask page. Option B drops the DOM test and keeps only static markup tests, which cannot prove a pick saves.

## What I did meanwhile

The tools are listed as development-only dependencies of the app, so nothing changes for people using it.

## What it costs to change later

Removing them later costs one edit of the package list and the lockfile.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the app should own these test tools or the tests live in the shared UI package (author).
