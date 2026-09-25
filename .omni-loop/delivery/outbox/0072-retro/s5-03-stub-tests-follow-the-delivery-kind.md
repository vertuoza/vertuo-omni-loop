---
id: s5-03-stub-tests-follow-the-delivery-kind
prd: 72
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Two checks written with the retro's skeleton expected this part of the retro to find nothing, and the saved example retro had no section for it. Now that it finds things, should those two checks change with it?

## The decision, in plain words

The check that every unbuilt part finds nothing now skips this part, and the saved example retro was rebuilt with its new section. The recorded example itself is untouched.

## The intro, for fun

The scaffolding said the room was empty, so of course it objected when the furniture arrived.

## The punchline, for fun

It has been told about the sofa, and still expects the other rooms to be bare.

## The options, in plain words

A. Change both checks with this slice and rebuild the golden file, the option built.
B. Leave both to be changed once the whole wave has merged, with this slice's checks red until then.

## What I had to decide

Whether this slice may change two files outside its territory, both s2's: the registry test in `apps/omni-app/src/retro/detect.test.mjs` asserts that every kind but the timeline gathers `null` and finds nothing, and `apps/omni-app/test/fixtures/prd-50/retro.golden.md` pins the PRD 50 retro without a Decisions section. The plan says no wave-3 slice edits the registry, the function or `render`, and that s5 reads the PRD 50 recording without writing to it; it says nothing of these two, and `pnpm test` is red without them.

## What I did meanwhile

`detect.test.mjs` leaves `delivery` out of the stub check, as it already left the timeline out. `retro.golden.md` was rebuilt with `UPDATE_GOLDEN=1`, which adds only the Decisions section; `recording.json` is unchanged. The wave's checks and churn slices will likely change the same two files: merging them is a conflict resolved by rebuilding the golden file once all are in.

## What it costs to change later

One line of a test and one golden file, rebuilt by `UPDATE_GOLDEN=1 pnpm test` once the wave has merged.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the golden file beside the PRD 50 recording counts as part of the recording that this slice must not write to.
