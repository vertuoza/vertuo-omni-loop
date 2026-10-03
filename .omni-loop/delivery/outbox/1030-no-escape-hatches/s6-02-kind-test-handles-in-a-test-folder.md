---
id: s6-02-kind-test-handles-in-a-test-folder
prd: 1030
slice: s6
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The small helper the retro's tests use to feed each kind of finding partial test data cast its inputs. Should it be rewritten to need no cast, or live with the other test helpers?

## The decision, in plain words

It moved into a test folder beside the kinds, where test code may cast its fixtures as every other test does; nothing the App runs imports it.

## The intro, for fun

A helper that only ever works in the rehearsal room was sitting on the stage.

## The punchline, for fun

It now sits backstage with the rest of the crew.

## The options, in plain words

A. A. Move it into a test folder beside the kinds: the option built.
B. B. Rewrite each kind's tests to build full scopes and contexts, so the handles need no cast.
C. C. Move it to the App's top test folder, outside this slice's territory.

## What I had to decide

Whether the kinds' test handles, test support that hands each kind partial fixtures, are rewritten without a cast or moved where the type guard counts them as tests.

## What I did meanwhile

The file moved from beside the kinds into a test folder inside the same place, its three casts unchanged and their exemption comments gone; the five kind tests import it from there.

## What it costs to change later

Moving it back, or rewriting it with a typed fixture per kind, is one file and five imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The guard's rule lets a test folder anywhere cast freely; whether a test folder inside the App's source is welcome is not written down.
