---
id: s1-05-config-rule-tests-list-new-defaults
prd: 2898
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-11-15
wave: 1
---

## The question, in plain words

Two test files that prove rules about the settings file also list every default of some of its sections. The new ready settings add defaults there, so may those lists grow by the new entries, with the rules' own tests left as they are?

## The decision, in plain words

Yes. The lists now name the new defaults, and nothing those files prove about the rules changed: no assertion was removed or weakened.

## The intro, for fun

Adding a chair to the table means counting one more chair.

## The punchline, for fun

The house rules about chairs stay exactly as written.

## The options, in plain words

A. Let the lists name the new defaults, the rules' own tests unchanged: what was built.
B. Make the new settings optional with no default, so these files stay as they were and the defaults are read in code.

## What I had to decide

`kit/lib/config.test.ts` (the proof of BR-PRODUCT-23) and `kit/lib/schema/config.test.ts` (with it, the proof of BR-PRODUCT-117) hold tests that compare whole defaults with `toEqual`: the top-level key list, the `e2e` section and the `acceptance` section. The spec names `acceptance.kind`, `e2e.ci`, `e2e.repo` and a `ready` section, each printed by `omni config` with its default, so those lists change. Making the keys optional, as PRD 2175 did for `labels.released`, would leave the files untouched but `omni config` would print no default, which s1's done-when asks for.

## What I did meanwhile

Added `'ready'` to the key list, `ci: false, repo: null` to the two `e2e` lists and `kind: 'test'` to the `acceptance` list. The new settings' own tests are in `kit/lib/config-ready.test.ts`. No test of BR-PRODUCT-23 or BR-PRODUCT-117 changed.

## What it costs to change later

Four lines in two test files; going the optional way instead is a reader per key and the same four lines reverted.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner of these rules would rather the new keys stay optional, so these files never change
