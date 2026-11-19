---
id: s2-03-bug-fix-and-release-shape
prd: 3088
slice: s2
rank: medium
bears-on: none
raised: 2026-11-19
wave: 1
---

## The question, in plain words

The spec names a bug's fix pull request and the release that holds it, but not how each is stored, nor whether a bug may read fixed without its release.

## The decision, in plain words

A bug keeps its fix pull request as a number on the Omni Loop repository and its release as a plain version number with no leading v. A bug reads fixed only once its release is known.

## The intro, for fun

A version has many spellings, and only one of them is easy to compare.

## The punchline, for fun

So the database keeps the plain one and asks for it before saying fixed.

## The options, in plain words

A. A. A pull request number and a plain version, fixed needing its version (built).
B. B. The pull request's whole link, as a mission's repairs keep it.

## What I had to decide

Keep a number and a plain version, fixed needing its version (A), or keep the pull request's whole link as a mission's repairs do (B).

## What I did meanwhile

The App writes the pull request's number and the version without its v; the room adds the v back when it shows it.

## What it costs to change later

Changing the shape later is one migration and the App's two writers; no bug has a fix yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A mission's repairs keep their fix as a whole link; the bug reports keep their issue as a number on their repository, which this follows.
