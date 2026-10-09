---
id: s3-01-law-judge-own-secret
prd: 1342
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Should the new law judge have its own secret, even if that means touching a few files outside this slice's ground?

## The decision, in plain words

We gave it its own secret, as the spec asks, and added it everywhere the web app lists its secrets, plus two tests that count the Jev decisions.

## The intro, for fun

Every judge wants its own key to the courthouse.

## The punchline, for fun

We cut a new key and updated the key cabinet's inventory too.

## The options, in plain words

A. Its own secret, added to the app's settings list, its example file and its read-me list, the option built.
B. Share the constituent judge's secret, so nothing outside the slice changes, at the price of one secret opening two judges.

## What I had to decide

Whether the law judge signs with its own secret or shares the constituent judge's, and whether the slice may edit the app's settings list to add it.

## What I did meanwhile

A new optional secret; left empty, every law judge call is refused and the classifier's own answer stands, so nothing breaks before it is set.

## What it costs to change later

Removing the variable from four files and pointing the law judge at the other secret.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the slice plan meant the app's settings list to be part of this slice (author)
