---
id: s6-03-acting-for-allows-letter-marks
prd: 2425
slice: s6
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

The name a key says it acts for takes letters of any alphabet. Should it also take the small marks that many names are made of, such as an accent typed as a separate mark?

## The decision, in plain words

Yes: marks are allowed beside letters, and digits of any alphabet too, while other symbols, new lines and emoji are still refused.

## The intro, for fun

Some names are a letter and a little mark on top.

## The punchline, for fun

Let the marks in, and keep the symbols out.

## The options, in plain words

A. A. Letters with their combining marks, decimal digits of any alphabet, spaces and the five symbols are allowed.
B. B. Only letters, digits, spaces and the five symbols as written, so a name typed with a separate mark is refused.

## What I had to decide

The spec's set is letters of any alphabet, digits, spaces and `. _ ' @ - ·`. A name typed in many alphabets, and accents typed as separate marks, is a letter followed by a combining mark, and a check on letters alone would refuse it as not a letter. The contract allows Unicode letters (L), combining marks (M) and decimal digits (Nd) with the spaces and the five symbols; the value is stored exactly as given.

## What I did meanwhile

Built the check on those three categories and proved it on names in Latin, Cyrillic, Han and Devanagari, an accent typed as a separate mark, digits of another alphabet, an address and a name with padding spaces, and on the refusals: a tag, an emoji, a new line, a number and 81 characters.

## What it costs to change later

Changing it later means changing one pattern in the contract; the values already stored stay as they were given.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a key's owner would rather see only a short list of known names than free text.
