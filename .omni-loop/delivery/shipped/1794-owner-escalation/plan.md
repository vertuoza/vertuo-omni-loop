# Plan: an unanswered owner escalates to a delegate, never to an auto-approve

PRD #1794, built from [spec.md](spec.md). The feature branch `feat/owner-escalation` merges into
`main` through one feature PR (`Closes #1794`); each slice is a sub-PR from
`feat/owner-escalation--<slice>` into the feature branch (`Part of #1794`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `laws.owners` takes `{ login, delegate }` entries beside plain owners, `laws.leadership` and `limits.escalationWorkingDays` parse; `omni kb owners` writes owners and delegates (never leadership), `omni check knowledge` counts delegates, `omni kb laws` names the delegate; the guide says so | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/schema/` `kit/lib/codeowners.ts` `kit/lib/codeowners.test.ts` `kit/lib/codeowners-laws.ts` `kit/lib/knowledge/` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` `docs/guide/loop.md` | — | 1 |
| s2 | a pure module decides, for each held thing, its step, who is asked and when the next step falls due, in working days (Monday to Friday, UTC), and renders and reads the `<!-- omni:escalation -->` record and the `<!-- omni:escalation-ask <thing> <step> -->` ask comments | `kit/lib/escalation/` | — | 1 |
| s3 | after each outbox check run, the App keeps the escalation record on the pull request, one line per held law or held item, first-held time kept across runs; the check's verdict and summary do not change | `apps/omni-app/src/escalation/` `apps/omni-app/src/outbox-check/outbox-check.ts` `apps/omni-app/src/outbox-check/outbox-check.test.ts` `apps/omni-app/src/outbox-check/end-to-end.test.ts` `apps/omni-app/src/outbox-check/fake-github.ts` | s1, s2 | 2 |
| s4 | an hourly `escalation` function moves each due held thing to its next step, posts one ask comment mentioning the newly asked people, never twice, and asks nobody once the thing is answered or the pull request closed | `apps/omni-app/src/escalation/` `apps/omni-app/src/functions.ts` `apps/omni-app/src/functions.test.ts` `apps/omni-app/README.md` | s3 | 3 |
| s5 | the Omni page stores who is asked (`asked`) from the record in `prd_outbox.waiting`, a held law as a `human-action` waiting item, and `GET /api/waiting/outbox` lists the items that ask the signed-in person | `apps/galaxy/src/stages/outbox/` `apps/galaxy/src/stages/sync/` `apps/galaxy/src/outbox-waiting/` `apps/galaxy/src/waiting/` `apps/galaxy/app/api/waiting/outbox/` | s2 | 2 |

Shared ground: `apps/omni-app/src/escalation/` is declared by s3 (the record) and s4 (the sweep);
s4 is blocked by s3, so they sit in waves 2 and 3. The record's text is s2's alone: s3, s4 and s5
render and read it through `kit/lib/escalation/`, so none of them redefines it. The built files
(`kit/dist/`, `apps/omni-app/api/`) are generated and listed by no slice.

## Per slice: done when

**s1**
- `kit/lib/config.test.ts`: a plain owner and a `{ login, delegate }` entry both parse; a team
  delegate, a delegate equal to its owner and a team in `laws.leadership` are refused, each error
  naming the key; `limits.escalationWorkingDays` defaults to 2 and refuses 0 and 11;
  `limits.stallDays` is unchanged.
- A config with no delegate and no leadership reads exactly as before (every existing owners test
  stays green).
- `kit/lib/codeowners.test.ts` and `kit/bin/kb.test.ts` (through `makeRepo()`): the block carries
  each owner and each delegate on every line, never a leader; adding a delegate makes
  `omni check knowledge` report the block stale until `omni kb owners` runs again; `omni kb laws`
  prints `Changing it needs @<owner> (or the delegate @<delegate>) to approve the pull request.`
- `docs/guide/loop.md` explains delegates, leadership and the three steps beside its `laws.owners`
  steps.
- One `human-action` outbox item asks @pierrederval to name a delegate and product leadership for
  this repository; `.omni-loop/config.yml` is not changed.
- `pnpm mutation:changed` holds its floor on `kit/lib/config.ts`.

**s2**
- `kit/lib/escalation/escalation.test.ts` (pure, no file, no request): step 0, 1 and 2 at the right
  instants for a held law (delegates, then leadership) and a held item (owners and delegates, then
  leadership); Friday 15:00 UTC reaches step 1 on Tuesday 15:00 UTC; a Saturday start counts from
  Monday 00:00 UTC; an answered thing asks nobody; no delegate and no leadership asks nobody.
- The output has no field that approves, adopts, labels or sets a verdict.
- The record and the ask comment render and read back unchanged (a round-trip test), and a
  comment without the marker reads as no record.

**s3** (`ui: yes`) (`law: N-PRODUCT-4 · owner @pierrederval`) (`law: BR-PRODUCT-6 · owner @pierrederval`)

`outbox-check.ts` gains one call that hands what still holds to the record, and decides nothing
new. Broken, any change could switch its own gate off, or a risky change nobody explained could
reach `main` with the reviewer never told; so the feature PR waits for @pierrederval's approval on
GitHub.

- `apps/omni-app/src/escalation/escalation.test.ts`, against the stubbed GitHub: a first held run
  creates the record and mentions nobody new; a later run keeps each thing's first-held time and
  drops a thing no longer held; a pull request with nothing held and no record gets no comment.
- A repository with no delegate and no `laws.leadership` gets no escalation comment.
- `apps/omni-app/src/outbox-check/end-to-end.test.ts`: the check's conclusion and summary are the
  same with and without the record.

**s4** (`ui: yes`)
- `apps/omni-app/src/escalation/escalation.test.ts`: 2 working days after first held, the sweep
  posts one ask comment mentioning each delegate (a held law) or each owner and delegate (a held
  item); a second sweep posts nothing; 4 working days after, one ask mentions `laws.leadership`.
- The outbox check stays `failure` and `law-locked` stays red at every step; the sweep makes no
  review, answer, adoption, label or verdict.
- A delegate's approval of the head commit clears `law-locked` when the base CODEOWNERS lists the
  delegate; leadership's approval leaves it red.
- An answered item, a cleared law and a closed pull request are asked about no more.
- `escalation` is served by `/api/inngest` on an hourly cron (`functions.test.ts`), and the App's
  README lists it.

**s5** (`ui: yes`)
- `apps/galaxy/src/stages/outbox/recount.test.ts`: `asked` is stored from the escalation record; a
  held law on a feature PR becomes a waiting item ranked `human-action` with the question
  `Approve the change to <law id> on GitHub, or ask for changes.`
- `apps/galaxy/src/outbox-waiting/outbox.test.ts`: the route returns an item to the delegate's
  login, for a PRD they did not open, and not to a stranger's; a PRD with no record lists as before.
- No migration: `asked` lives inside the existing `prd_outbox.waiting` JSON.
