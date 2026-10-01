---
id: s9-01-harvest-binds-untyped-units
prd: 725
slice: s9
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The part that writes decisions back into the knowledge base calls four helpers that nobody has converted yet. Until they are, how should it describe what those helpers give back?

## The decision, in plain words

It writes down, once, the shape each helper already gives back, and relies on it. When a helper is converted later and disagrees, the check that reads the shapes fails right there, so nothing drifts silently.

## The intro, for fun

Four helpers still speak the old language, and the knowledge base wanted a word with them.

## The punchline, for fun

So it wrote down what they usually say, and asked them to sign it later.

## The options, in plain words

A. A: bind each untyped helper once to the shape it returns today, on marked lines, and drop the bindings when the helpers are typed
B. B: leave the harvest pipeline file unconverted until the outbox and delivery slices land, and convert it in a later wave
C. C: type the four helpers' signatures in this slice, outside its own folder

## What I had to decide

kit/lib/knowledge/pipeline.ts calls settleAtMerge (kit/lib/outbox/settle-merge.ts, s8), findOutboxViolations (kit/lib/outbox/check-outbox.ts, s8), planShip and movedPath (kit/lib/delivery/ship.ts, s11) and askModel (kit/lib/openrouter.ts, left untyped by s3). Under @ts-nocheck their inferred types are widened (an ok flag typed boolean, so a result never narrows) or wrong (askModel's parameter loses every key without a default), so typed code cannot call them as they are.

## What I did meanwhile

pipeline.ts binds each of the five functions once, near its imports, to a local type naming the shape it returns today (SettleAtMerge, PlanShip, MovedPath, FindOutboxViolations, AskModel), on lines marked `// ts-allow:`. The model's reply is typed ClassificationReply where askModel returns it, because askModel only returns a reply its `check` (classificationSchema) accepted. Nothing else changed: the bundle differs only by the five rebinding lines.

## What it costs to change later

Five lines and five local types in pipeline.ts: once s8 and s11 type their modules (and the ratchet types openrouter), each cast is deleted and the import used directly; a mismatch then shows as a compile error on that line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the ratchet (s29) or s17 owns typing kit/lib/openrouter.ts, which s3 left untyped, is not planned
- (author) finishHarvest's classified replies come from the app between steps and are typed, not re-parsed; whether the App slice (s20) parses them through classificationSchema is not settled
