---
id: s7-01-report-read-from-acceptance-run-text
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The App reads the proof of each success criterion from the acceptance check the build writes on the latest commit, but the spec does not say where in that check the proof sits. Where should the App look?

## The decision, in plain words

It reads the proof from the check's detailed text, then its summary, written alone or in a block marked as JSON. With no proof there, the third check reads not finished or not judged, never passed.

## The intro, for fun

Two teams built a letterbox and a postman on the same day, without meeting.

## The punchline, for fun

We agreed the letters go through the slot, not the chimney.

## The options, in plain words

A. A. Read the proof from the check's detailed text, then its summary, alone or in a JSON block: what was built.
B. B. Read it only from the detailed text, as plain JSON, and treat anything else as unreadable.
C. C. Read it from a file the build keeps beside its run, not from the check itself.

## What I had to decide

The `acceptance` check run is written by s5 (CI) and by s8 (the runner fallback), in the same wave or a later one, so its shape was not settled when s7 was built. `apps/omni-app/src/ready-check/facts.ts` (`reportText`) reads `output.text` first, then `output.summary`, and takes the whole text when it starts with `{`, else the first fenced json block. The parse is the kit's `parseAcceptanceReport`, so a malformed report is `not judged · <why>`. s5 and s8 should write the report as the run's `output.text`, JSON alone, so `omni ready` (s3) and the App read it the same way.

## What I did meanwhile

Built the reader as above, with the AC-8 test writing the report as `output.text`. Nothing else in the App reads the run.

## What it costs to change later

One small function in one file, and its test: a constant's worth of change if s5 writes it elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether s5 writes the report in `output.text`, in an artifact, or in the summary; s3's reader must agree with it too
