---
id: s21-02-retro-kind-tests-bridge-untyped-helpers
prd: 725
slice: s21
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The retro's tests lean on shared test helpers that another part of this work types later. Should these tests wait for them, or bridge the gap now?

## The decision, in plain words

They bridge the gap now, through one small helper file that states what the tests hand in. Once the shared helpers are typed, the bridge can be removed by the final tightening step.

## The intro, for fun

The tests needed a fake GitHub, and the fake GitHub has not been to type school yet.

## The punchline, for fun

So the tests brought a translator, and promised to send it home later.

## The options, in plain words

A. A. One test-support file bridges the untyped helpers with marked casts, removable once they are typed
B. B. Cast at every call site in each test file instead
C. C. Leave the tests for the slice that types the shared helpers

## What I had to decide

The kinds' tests call the stubbed GitHub (apps/omni-app/test/github-replay.ts), the widget scenario (apps/omni-app/test/retro-scenario.ts) and the retro function (apps/omni-app/src/retro/retro.ts). Those belong to s19 and s22, still untyped in this wave, so their inferred option types accept only empty lists and maps; and the tests hand the kinds partial scopes and contexts.

## What I did meanwhile

apps/omni-app/src/retro/kinds/test-handles.ts gives the tests typed handles on each kind (gather, detect and section, taking any object and reading facts back as present) and three pass-throughs, replay, scenario and retroFunction, each a marked cast onto the untyped helper. The kinds themselves keep their strict types; no test assertion changed.

## What it costs to change later

Cheap: once s19 and s22 land, replace each pass-through with a direct import, or keep the handles; test support only, no output changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which shapes s19 gives the stubbed GitHub's options, so whether the pass-throughs become no-ops or need a tweak (author)
