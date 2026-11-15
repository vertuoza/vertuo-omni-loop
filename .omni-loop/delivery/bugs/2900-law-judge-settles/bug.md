# Bug 2900: the business-law judge never settles on PRD 2898's spec

## Triage

- **Domain:** business laws: the spec judge (`apps/galaxy/src/business-laws/judge.service.ts`), shown on the PRD page and by `omni prd` / `omni dossier push`
- **Risk:** high — a PRD author whose spec is read red by an unstable judge cannot get product approval (BR-PRODUCT-129), and rewording the spec does not settle it: no workaround.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/business-laws/judge-settles.test.ts`
- **Level:** unit
- **Red:** `Tests  12 failed | 3 passed (15)` — e.g. `BL-PRODUCT-1 on "`not finished` (never shown green)": This is consistent. However, the spec does not explicitly forbid showing not finished as a pass.` expected `{ state: 'green', findings: [] }`, got `{ state: 'red', … }`

## Fix

The judge turned a spec red on one reading of a small model (Haiku 4.5), on reasons that hedged ("could", "implies", "however … not explicitly") and on the spec's own sentences that cite the law and say how the design keeps it. Now the prompt asks the model to decide, not to find; a hedged reason and a quote from a paragraph or list item that names the law it is judged on are dropped; what remains stands only when a second reading of the whole spec confirms it as a breach it states (a second reading that fails is not judged, never red); both readings run on Sonnet 5.5, the batches at once, and a reply that ends on its JSON after its prose is read. Live on PRD 2898's six spec versions the old judge read red 12 times out of 12 and the new one green 18 out of 18, while two breaches planted in the latest version read red 6 out of 6.

## Guard

`judge-settles.test.ts` replays recorded model replies shaped like the five verdicts (hedged reasons, the spec citing the law, an unconfirmed or failed second reading) and fails on the old judge; `model.test.ts` pins the judge's model and the unfenced trailing JSON.

## Mutation

mutation: no changed core file against origin/main (72485851): nothing to mutate

## Still open

- A verdict is kept per spec version and pack commit, so a change to the judge never re-judges a spec it already read red: PRD 2898 keeps its red until its spec gets a new version.
