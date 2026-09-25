---
id: s5-02-test-stub-ships-with-app
prd: 28
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Where should the pretend GitHub used by the app's tests live?

## The decision, in plain words

Beside the code it tests, in the app's own folder, since the slice may only touch that folder. It is never loaded by the running app.

## The options, in plain words

A. Keep it beside the tests in the app's source folder, as built.
B. Move it under the app's test folder with the fixtures.

## What I had to decide

Where the stubbed GitHub used by the outbox-check and end-to-end tests lives.

## What I did meanwhile

It is apps/omni-app/src/outbox-check/fake-github.mjs, imported only by tests; the test fixtures folder belongs to another slice's territory. The Inngest route uses the SDK's web-standard adapter on Vercel's Node runtime, and vercel.json only raises the functions' time limit to 60s.

## What it costs to change later

Moving one file and two imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the repository prefers test support under test/ once territories no longer apply.
