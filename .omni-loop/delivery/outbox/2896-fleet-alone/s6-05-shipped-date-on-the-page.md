---
id: s6-05-shipped-date-on-the-page
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The Omni page dates a PRD's shipped stage by its feature pull request's merge, which for a mission's PRD is its join to the mission branch, before it landed. Should this slice change how the page dates it?

## The decision, in plain words

No: the code that dates the stages lies outside this slice's ground. The mission itself reads each PRD as shipped only from its landing, and the page shows shipped only once the PRD is on the main branch, but dated at its join.

## The intro, for fun

The parcel arrived on Tuesday, and the receipt says Monday, the day it left the warehouse.

## The punchline, for fun

Right parcel, right door, the wrong day on the stamp.

## The options, in plain words

A. Leave the page's date as it is, outside this slice (built).
B. Change the stage sync now, outside this slice's ground, to date shipped by the landing.

## What I had to decide

Leave the page's shipped date at the join until a slice whose ground holds the stage sync dates it by the landing, or change it now outside this slice's ground.

## What I did meanwhile

The mission records each landed PRD as merged at the moment it read the landing; the page's stage sync still dates shipped by the feature pull request's merge.

## What it costs to change later

Dating it by the landing later costs reading the mission pull request's merge time in the stage sync, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No slice of the plan holds the stage sync of the Omni page in its ground.
