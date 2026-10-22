---
id: s3-02-what-stays-global
prd: 2346
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

Should a rule tagged only with layers that no file of the repository belongs to be shown for every change or for none? And should a past decision record with no area and no layer be listed for every change, or left out?

## The decision, in plain words

A rule no file can ever reach is shown for every change, so no rule goes unseen. A decision record with no tag is left out, as before, and a tagged one shows only when its tag meets a changed file.

## The intro, for fun

Some rules wear a badge for a club with no members yet.

## The punchline, for fun

Until the club opens, they stand in the main hall where everyone sees them.

## The options, in plain words

A. An entry whose layers nothing maps is global; an untagged decision record is never listed (built).
B. Any layer tag narrows an entry, mapped or not, so one tagged with an unmapped layer is hidden; untagged records still left out.
C. As built, and every untagged decision record listed under Global too.

## What I had to decide

Whether an entry whose only tags are layers the repository maps no path to is global or hidden, and whether an untagged decision record is listed under Global or not at all.

## What I did meanwhile

An entry is global when nothing on the map can narrow it: no Governs: line, a domain no area maps, and no layer the repository maps. A decision record is listed only under Applies here, when its Domain or Layers meet a changed file; a tagged one that does not is counted as hidden, and an untagged one is neither listed nor counted.

## What it costs to change later

One condition each in the lookup, and the tests that pin them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec defines global as naming no layer, and reachable as a layer the repository maps; it says nothing of decision records with no tag, which number in the hundreds here.
