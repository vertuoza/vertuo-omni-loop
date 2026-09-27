---
id: s1-03-unknown-draft-refusals
prd: 216
slice: s1
rank: high
bears-on: ADR-0029
raised: 2026-09-27
wave: 1
---

## The question, in plain words

A push may name a draft that is gone, belongs to another repository, or is already another PRD. The spec lists the refusal codes but not which case gets which, so what should happen?

## The decision, in plain words

A draft that is gone, or that the caller cannot read, is refused as not found, and the command then forgets it and pushes again by the PRD's number. A draft of another repository, or already another PRD, is refused as a bad request.

## The intro, for fun

A push knocked on a draft's door and found the house had been sold.

## The punchline, for fun

It now tries the street address instead of waiting on the porch.

## The options, in plain words

A. Refuse a missing draft as not found, and have the command retry by the PRD's number and forget the draft
B. Have the server fall back to the PRD's own dossier by itself when the draft is missing
C. Refuse it, and have the command report the refusal without retrying

## What I had to decide

Refuse a missing draft and let the command recover, or have the server fall back quietly to the PRD's own dossier.

## What I did meanwhile

The server answers not found for a missing draft and bad request for a mismatched one. The command retries once without the draft, and forgets the draft only when that retry lands.

## What it costs to change later

A constant in the server and one branch in the command; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person would rather see the refusal than the quiet retry is unknown (author).
