---
id: s2-03-mockup-version-address
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The before-and-after mockup is shown from an address of its own that names a version. Should it name the version by the number people read, v1 or v2, or by a hidden identifier that never changes?

## The decision, in plain words

By the number people read, counted per artifact from the oldest, which matches the version picker and reads well in a shared link. When a draft is joined to a PRD the repository reading had already found, both sets of versions are counted together by date, so a number may then point elsewhere.

## The intro, for fun

Every mockup got a house number, counted from the oldest house on the street.

## The punchline, for fun

If two streets ever merge, the numbers may shuffle, so the page says which street it counted.

## The options, in plain words

A. The version's number, counted per artifact from the oldest
B. The version's stored identifier, which never changes
C. The number in the address, with the identifier added as a check

## What I had to decide

Name a before/after version in its address by its number, or by its stored identifier.

## What I did meanwhile

The sandboxed route takes the version's number among the versions of its kind, oldest first: the same number the picker shows and the version rule returns when it adds one.

## What it costs to change later

How the page builds and reads one address; nothing stored changes, but links already shared to one version would stop working.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a link to one version must keep pointing at the same content after a draft is merged into a dossier the fallback created is not written in the spec.
