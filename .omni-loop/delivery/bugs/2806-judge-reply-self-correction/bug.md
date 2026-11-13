# Bug 2806: The business-law judge says 'the reply was not JSON' when the model corrects itself in its reply

## Triage

- **Domain:** business laws judge — `apps/galaxy/src/business-laws/model.ts` (reading the model's reply)
- **Risk:** medium — a person reading a PRD's business-law verdict gets a neutral "the model did not answer: the reply was not JSON" instead of the model's final answer whenever the model revises itself in its reply; pushing again is a workaround only when the model does not revise that time. (Jev, 0.87)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/business-laws/model.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected { ok: false, …(1) } to deeply equal { ok: true, reply: { findings: [] } }` (received `"why": "the reply was not JSON"`)

## Fix

The judge's model sometimes answers in a fenced JSON block, then reconsiders in prose and gives a second fenced JSON block. The reply was read only by stripping one fence at its very start and very end, so `JSON.parse` failed on the whole text. Now a reply that does not parse whole is read from its last fenced block, the model's final answer; a bare reply and a single fenced one read as before, and a reply with no parseable block still says "the reply was not JSON".

## Guard

The reproduction and a second unit test in `model.test.ts`: a self-corrected reply reads its last answer; a bare reply and a plain fence still read; a reply whose last fenced block is broken, or that is prose only, still says not JSON.

## Mutation

mutation: no changed core file against origin/main (f4cb275b): nothing to mutate
