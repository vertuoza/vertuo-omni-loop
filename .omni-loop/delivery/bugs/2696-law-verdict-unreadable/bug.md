# Bug 2696: the business laws judge gives reds an agent cannot read or trust

## Triage

- **Domain:** business laws: the judge of a PRD's spec, its block on the PRD's page, and the terminal's read of a product PRD
- **Risk:** medium — an agent writing a product PRD gets a red it cannot read from the terminal, sometimes on a sentence that keeps the law, and that red holds the product approval; the workaround is a person sending a screenshot and the agent rewording the spec blind
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/business-laws/judge-why.test.ts`
- **Level:** unit
- **Red:** × keeps the judge's own why for a finding, beside the law's Why

## Fix

The reproduction has two more files, for the page and the terminal:
`apps/galaxy/src/dossier/page/business-laws-judged-render.test.ts` and
`kit/bin/commands/prd-product-laws.test.ts`; the three ran 10 failed, 3 passed before the fix.

The judge dropped the model's own why for a finding and kept only the law's Why, so a red never said what
was judged broken. It now keeps it on each finding (`broken`), the PRD's page shows it under the spec's
words as "The judge says", and the GitHub check's details carry the same line. A finding that does not say
what the design does is dropped, and the judge's prompt says that a sentence which restates a law, cites it
or says how the design keeps it is no finding. The approval route answers a product PRD's verdict as
`laws`, which `omni prd <key>-<n>` prints (and gives whole with `--json`) and `omni dossier push <key>-<n>`
prints once the spec is judged.

## Guard

`apps/galaxy/src/business-laws/judge-why.test.ts`: a finding keeps the judge's why, one without a why
never turns a verdict red, and the prompt carries the rule that a sentence keeping a law is no finding.
`apps/galaxy/src/business-laws/judge-live.test.ts` holds the omni-loop-2 sentences against the real model;
it runs by hand only (`BUSINESS_LAWS_LIVE=1`), since no test in CI calls a model.

## Mutation

mutation: no delivery-core file changed
