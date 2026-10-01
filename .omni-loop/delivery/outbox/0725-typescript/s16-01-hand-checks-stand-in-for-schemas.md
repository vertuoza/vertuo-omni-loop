---
id: s16-01-hand-checks-stand-in-for-schemas
prd: 725
slice: s16
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Four readers in this part already check what they read by hand, and each refusal already names the field that is wrong. Should they move to the shared validation library now, as the rest of the work asks?

## The decision, in plain words

Not in this slice: they keep their own checks, which already refuse bad input with a message naming the field, so nobody sees a different message. The pull request answer used by the review helper is left to be checked where it is fetched, as an earlier decision said.

## The intro, for fun

Four careful readers were asked to swap their own checklists for the house one.

## The punchline, for fun

They pointed out their lists already say which box is wrong, and kept their pens.

## The options, in plain words

A. A: keep the hand-written checks, now typed, and check the review answer where it is fetched, in the command line slice
B. B: move the proof run and persona files to the shared library now, rewording nothing people see
C. C: move every reader here to the shared library, and accept new wording in its refusals

## What I had to decide

Whether the done-when rule 'every value read from a file, a process, the network or the environment passes a Zod schema' requires replacing the hand-written validation in kit/lib/proof/run.ts (run.json), kit/lib/voice/voice.ts (voice.json), kit/lib/proof/push.ts (the Omni page's replies) and kit/lib/proof/session.ts (the JWT claims), and adding a schema for the GraphQL answer kit/lib/care/state.ts parses.

## What I did meanwhile

No Zod schema added. run.ts, voice.ts and push.ts read their input as `unknown` and narrow it through the checks already there, whose refusals name the field (`run.json: commit is ...`, `round spec: personas[0].score must be ...`). session.ts reads the JWT payload with one marked cast (`// ts-allow:`), checked as before: `iss` through `new URL`, `exp` by comparison. care/state.ts types the GraphQL answer as `CareResponse` with every field optional; the gh JSON is parsed in kit/bin/commands/care.ts (s17's territory), as item s4-03 settled for the board.

## What it costs to change later

A folder-local schema file per reader (kit/lib/proof/schema.ts, kit/lib/voice/schema.ts) with an error map that rebuilds today's refusal wording, plus a `CareResponse` schema in s17 where the gh answer is read. No stored data or interface changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether a hand-written check that names the field counts as the schema the done-when asks for (author)
- session.ts's JWT claims are not fully checked today (email, sub and role are copied as given); a schema would refuse a token the browser now accepts (author)
