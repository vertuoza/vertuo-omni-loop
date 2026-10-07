---
id: s4-02-loop-push-outside-territory
prd: 1139
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

Sending the loop's state needed one new call in the shared sign-in client, and proving the kit and the app agree needed a test on the app's side. Both sit outside this slice's ground: should they stay?

## The decision, in plain words

Kept both small: one added call in the shared client, which reuses its time limit and sign-in refresh, and one new test beside the app's loop code that sends the kit's own messages through the app's door. Nothing existing changed.

## The intro, for fun

The loop needed a phone line, and the only phone was in the hallway.

## The punchline, for fun

We added one number to the shared phone book rather than build a second phone.

## The options, in plain words

A. A. One method in the shared client and one contract test on the app's side (built).
B. B. A second sign-in client just for the loop, and a hand-written copy of the app's rules in the kit's tests.
C. C. Widen this slice's ground in the plan to cover both, after the fact.

## What I had to decide

Whether `omni loop push` may add `pushLoop` to `kit/lib/ask/client.ts` (outside s4's territory) instead of a second HTTP client, and whether the contract test may live at `apps/galaxy/src/loop/kit-push.test.ts` (s2's folder): the boundaries let the app import `kit/lib`, never the reverse, so the test that holds both halves together can only live on the app's side.

## What I did meanwhile

Added the one method `pushLoop(body)` to the ask client (POST /api/loops, same 5-second limit and one 401 refresh as `omni dossier`), and the new test file `apps/galaxy/src/loop/kit-push.test.ts`, which builds every event's body with `kit/lib/loop/body.ts` from a plan written and read through `kit/lib/next/store.ts`, sends it through `loopPush()` on the fake store, and checks each is taken and the stored plan equals the file's. No existing line of either area changed behaviour.

## What it costs to change later

Low: moving the method into `kit/lib/loop/` means duplicating the token refresh; moving the test means a fixture of the contract instead of the real route. Either is a file move, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec, the plan and the API settle the rest.
