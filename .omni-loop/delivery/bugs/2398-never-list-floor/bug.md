# Bug 2398: the briefing's Never rule names a coverage floor that does not exist, and AGENTS.md restates the list

## Triage

- **Domain:** playbook › briefing (what every agent reads before it works)
- **Risk:** low — an agent reading "Never lower a coverage floor" finds no coverage floor to protect; the testing and verification forms already name the mutation floor, so the harm is confusion and drift, not a skipped check (Jev, 0.93)
- **Regression:** new bug — no evidence this ever worked (the wording dates from #352; no coverage floor was ever set)

## Reproduction

- **File:** `scripts/never-list.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected '<!-- slot: never · required -->\n- Ne…' not to match /coverage floor/`

## Fix

The briefing's Never rule named a coverage floor; the floors the repository keeps are the mutation floors of `mutation/floor.json`, and the rule now names them. AGENTS.md restated the briefing's Never list in its own words; its Never section now points to the briefing, which holds the one list.

## Guard

`scripts/never-list.test.ts`: it fails when the briefing's Never list names a floor the repository lacks or drops the mutation floor, and when AGENTS.md's Never section restates rules instead of pointing to the briefing.

## Mutation

mutation: no changed core file against origin/main (6510cb7d): nothing to mutate
