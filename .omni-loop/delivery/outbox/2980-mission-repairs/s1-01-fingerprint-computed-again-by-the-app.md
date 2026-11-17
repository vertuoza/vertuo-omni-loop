---
id: s1-01-fingerprint-computed-again-by-the-app
prd: 2980
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

When a repair names the cause of a failure, should the Omni App trust the cause's label the runner wrote, or work it out again itself?

## The decision, in plain words

The Omni App works the label out again from the cause's own words every time, so one cause always gets one label and a runner can never dodge the limit of three repairs by writing a new one.

## The intro, for fun

Every failure gets a name tag, and the question is who is allowed to write it.

## The punchline, for fun

The runner fills in the tag, and the App checks the handwriting.

## The options, in plain words

A. The App computes the fingerprint again from the retro and keeps its own, a sha256 in 64 hex characters (built).
B. The App keeps the fingerprint the runner wrote, as long as it is 64 hex characters.
C. The App refuses a record whose fingerprint differs from its own computation, which then reads as unreadable and spends one repair.

## What I had to decide

Whether the record line's fingerprint is taken as the runner wrote it, or computed again from the retro's class, place and signature when the App reads it, and the fingerprint's shape.

## What I did meanwhile

A fingerprint is a sha256 in lowercase hex, 64 characters. repairLine() requires the runner's fingerprint to be of that shape and to agree with its retro's, then replaces it with fingerprint(retro), in the record, the retro and the report alike, so the cap counts what the App computed.

## What it costs to change later

A constant: drop the recomputation in repairLine() and the record keeps the runner's value. The 64-character shape is what s2's mission_repairs and omni_bug_reports columns must hold; changing it later is a column check, not a data migration, while the tables are empty.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the retro holds the fingerprint but not how a runner computes it: no omni command in any slice's territory prints one, so s3's skill must write some 64-hex value, which the App then replaces.
- (author) The fingerprint's length is not in the spec; s2 builds the column in the same wave and was not yet started when this was chosen.
