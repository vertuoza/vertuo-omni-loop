---
id: s3-04-config-schema-stays-in-config
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The plan asks for the settings' shape to sit with the other shared shapes, but a check allows the default addresses in one file only. Where should it live?

## The decision, in plain words

The settings' shape stays where it was, and the shared shapes folder points to it. Nothing about the settings changed.

## The intro, for fun

The settings were packed and ready to move to the new shared folder.

## The punchline, for fun

Then the guard at the door said their name was only on one list.

## The options, in plain words

A. The settings' shape stays where it was, and the shared folder points to it
B. Move the settings' shape into the shared folder, and move the check's exception with it

## What I had to decide

Moving ConfigSchema to kit/lib/schema/config.ts fails kit/test/no-literals.test.ts: the config's defaults (branch shapes, labels, signature.home) are the repository literals it exempts in lib/config.ts only, as ADR-0047 records. The test is outside s3's territory.

## What I did meanwhile

ConfigSchema stays defined in kit/lib/config.ts, which is now typed (no @ts-nocheck); kit/lib/schema/config.ts re-exports it, and Config in kit/lib/types.ts is z.infer of it. Its sections now default through prefault, because a Zod 4 default no longer parses the value it fills in.

## What it costs to change later

Cheap: move the block and add lib/schema/config.ts to the test's exemptions, in a slice owning kit/test/.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s29's review wants the definition itself under kit/lib/schema/ (author)
