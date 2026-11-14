---
id: s5-04-room-dispatch-words-long
prd: 2871
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The approved drawing of the Operation room shows each sent job in seven words or fewer, while the room today also says which runners took it. Should the mission drop where a job went, to fit the drawing?

## The decision, in plain words

The mission keeps saying where each job went, as it did before this PRD, so its sent rows run to about eleven words. The wait on a person keeps the spec's own words too.

## The intro, for fun

The drawing gave each row a tiny coat; the old row kept its long scarf.

## The punchline, for fun

It still fits through the door, just with a little more fabric.

## The options, in plain words

A. A. Keep where each job went in its row (built).
B. B. Drop where it went, as the drawing shows, and leave it to the job's own page.

## What I had to decide

Keep where each job went in its row (A), or drop it to match the drawing, leaving it to the job's own page (B).

## What I did meanwhile

Dispatch rows read `Sent /omni:yolo 2817 --for-review to the night-shift fleet's runners (run 1).` and `Sent /omni:review 2817 to … (run 1, round 1).`; the word pass flags each as explains-at-rest (11 or 12 words). The wait row reads `Waits on a person: PRD 2817: decide the Reviewer's findings on PR #2817` (13 words), its prefix PRD 2842's and the rest the spec's. The Engineer's and the Reviewer's new rows match the drawing: `Shipped; waits for review.`, `Changes asked: 2 findings, round 1/2.`, `Fixed 2 findings; shipped again.`, `Passed, round 2 of 2: marked ready.`

## What it costs to change later

A change of one sentence and the tests that read it; the rows already written keep their words.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the drawing dropped where a job went on purpose, or only to fit the frame.
- (author) The wait row's words are the spec's, after PRD 2842's `Waits on a person:` prefix; shortening them is the Operation room's call as much as this slice's.
