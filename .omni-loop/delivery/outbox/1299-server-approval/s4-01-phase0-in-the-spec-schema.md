---
id: s4-01-phase0-in-the-spec-schema
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

A spec may now say it was born on the server, but the rule that lists what a spec may say lives in a file this slice was not given. Should it change that file?

## The decision, in plain words

Yes: the shared list of what a spec may say now accepts the one new value, server, and still refuses every other value by name.

## The intro, for fun

The plan handed us the keys to the wrong door, right next to the right one.

## The punchline, for fun

We used the right one and left a note on the fridge.

## The options, in plain words

A. A. Add an optional phase0 (server only) to the spec schema, as built
B. B. Strip phase0 inside the inbox guard alone and keep the schema as it was, so every other reader of the inbox would refuse a server-born spec
C. C. Leave phase0 refused and amend the plan first

## What I had to decide

Whether the slice may add the optional phase0 field to the shared spec schema, outside the territory the plan named.

## What I did meanwhile

The schema accepts phase0: server and refuses any other value; the inbox guard and every reader of the inbox read it as before.

## What it costs to change later

Undoing it is removing one optional field from the schema; nothing stored depends on it until a server-born PRD exists.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan named kit/lib/front-matter.ts, which only splits key: value lines; the strict schema that refuses unknown fields is kit/lib/schema/front-matter.ts. I read the plan's entry as a slip for that file.
