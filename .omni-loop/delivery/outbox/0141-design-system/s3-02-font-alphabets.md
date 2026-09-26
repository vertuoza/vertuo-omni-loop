---
id: s3-02-font-alphabets
prd: 141
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

Google used to send every alphabet a font has. Which alphabets should we now ship ourselves?

## The decision, in plain words

Western European and Central European letters only. Greek, Cyrillic and Vietnamese text, which two of the fonts used to cover, now shows in the reader's system font.

## The intro, for fun

Our fonts moved in, but only packed the Latin suitcases.

## The punchline, for fun

The Greek and Cyrillic luggage can follow if anyone writes home in it.

## The options, in plain words

A. Latin and latin-ext for every face, the option built.
B. Every subset each face has, as Google served them.
C. Latin only, the smallest set.

## What I had to decide

Which character subsets the package ships for each face.

## What I did meanwhile

The latin and latin-ext subsets of every face; Press Start 2P and JetBrains Mono also had cyrillic, greek and vietnamese subsets on Google, now left out.

## What it costs to change later

One line in the fonts module and the extra files, about 20 KB each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether any question or knowledge entry today is written in Greek, Cyrillic or Vietnamese (author)
