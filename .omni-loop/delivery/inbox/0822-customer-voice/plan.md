# Plan: The customer voice

PRD #822, spec beside this plan (`spec.md`). The feature branch `feat/customer-voice` goes into
`main` through the feature PR (`Closes #822`). Each slice is a sub-PR from
`feat/customer-voice--<slice>` into the feature branch (`Part of #822`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Covers saving a claim from the terminal. One migration adds the bearer RPC that stores a claim for a repository's business as `proposed` or `confirmed` with source `answer` and a receipt, and adds `voice` to the dossier artifact kinds on `prd` dossiers only. `supabase/checks/business.sql` proves both. `POST /api/business/claims` stores through that RPC, refusing 401, 403, a bad kind and a bad state. `omni business claim add --kind --value --state proposed\|confirmed --ref` posts to it and exits 0 with one skip line on any failure | `supabase/migrations/` `supabase/checks/business.sql` `apps/galaxy/app/api/business/claims/` `apps/galaxy/src/business-api/` `kit/bin/commands/business.mjs` `kit/bin/business.test.mjs` `kit/lib/ask/client.mjs` `kit/lib/help/entries.mjs` `kit/test/fake-ask-server.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | Adds the `voice.json` record. `kit/lib/voice/` holds its schema: rounds `design`, `spec`, `rework-<k>` and `shipped`, each with a date, per-persona name, stance, score 1–5 and a cited reaction of at most two sentences, the objection (persona, text, citations, settled `accepted`, `saved-as-claim`, `just-this-run` or `none`) and the fit line. `omni check inbox` refuses an invalid `voice.json`, and `omni dossier push` sends it as the `voice` artifact, which galaxy's dossier API accepts on a `prd` dossier | `kit/lib/voice/` `kit/lib/inbox/check-inbox` `kit/lib/dossier/` `kit/bin/commands/dossier` `apps/galaxy/src/dossier/api` `apps/galaxy/src/dossier/store` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | Adds the User voice tab on the PRD page. It shows one row per persona (the PRD 799 portrait, name, stance chip, latest reaction), one column per round with the score and its move (▲ ▼ =), and tapping a score shows that round's reaction. Each round's objection is outlined with how it was settled. The Rework with this feedback button copies `/omni:brainstorm --rework <n>`. Without a `voice` artifact it shows "No voice yet: it appears once a brainstorm runs with personas". It works at 393px and in demo mode | `apps/galaxy/src/dossier/page/` `apps/galaxy/app/prd/` | s2 | 3 |
| s4 | Makes the skills speak through the personas. think-big's fuel copies the personas as `persona:<name>`; they become the User panelists (five at most, widest spread of stance and trade), and the worst-fitting persona objects once per concept with citations, followed by a fit line. brainstorm reads the business at step 0 and objects once before the design's approval question; it offers the overrule question (Save as a claim through `omni business claim add --state proposed`, or Just this run) and at most one gap question (`--state confirmed`, Not sure stores nothing), writes `voice.json` rounds `design` and `spec`, and adds `--rework <n>`, which is refused once a sub-PR merged. yolo writes the `shipped` round on its green path. Without personas, both skills run as today | `kit/plugin/skills/think-big/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/yolo/` `kit/test/plugin.test.mjs` | s1, s2 | 3 |

**Shared ground.**
- **`kit/dist/omni.mjs`:** s1 and s2, in waves 1 and 2, each rebuilt with `pnpm kit:build` because
  `kit/test/dist.test.mjs` fails on a stale bundle.
- **The database:** the claim RPC and the `voice` artifact kind both land in s1's single migration,
  so s2 touches no SQL. The migration's date is checked against the latest one on `main` before the
  feature PR merges (the lesson of #771).
- **`apps/galaxy/src/dossier/`:** s2 owns `api*` and `store*` (the artifact kind), and s3 owns
  `page/`; the prefixes do not meet, and s3 waits for s2 anyway.
- **The `voice.json` shape** is written once, in s2's `kit/lib/voice/`. s3 reads it through galaxy's
  own schema, and its render tests use s2's example file shape; s4's skill text names the file and
  its stages, never re-describes its fields.
- s3 and s4 share no prefix, so both run in wave 3.

## Per slice: done when

**s1**
- `supabase/checks/business.sql` proves that an `answer` claim is stored `proposed` or `confirmed`
  with its receipt, that another workspace is refused (`42501`), and that `voice` is accepted on a
  `prd` dossier and refused on a `visual` or `bug` one.
- The claims route's tests cover 401 without a token, 403 on another workspace, `22023` on a bad
  kind or state, and both states stored.
- `kit/bin/business.test.mjs` covers `claim add` against the fake server: each state, exit 0 and one
  skip line on every failure (none, no sign-in, unreachable, refused), and exit 2 on a usage error.

**s2**
- `kit/lib/voice/` tests accept a valid file and refuse a score out of range, a round without
  personas, an unknown stage, a reaction over two sentences and a reaction without a citation.
- `omni check inbox` refuses an invalid `voice.json`, naming the round and the field.
- `omni dossier push` sends `voice` when `voice.json` exists, adding a version only when it changed.
- Galaxy's dossier API accepts `voice` on a `prd` dossier and refuses it on a fix dossier.

**s3**
- Render tests: the empty line; one round; three rounds with ▲, ▼ and =; the outlined objection with
  how it was settled; the Rework button's command for the PRD's number; 393px; demo mode.

**s4**
- `kit/test/plugin.test.mjs` checks:
  - think-big's personas fuel line, its User panelists drawn from personas (five at most), and its
    once-per-concept cited objection and fit line;
  - brainstorm's step 0 read, its objection before the approval question, its overrule question with
    `omni business claim add --state proposed`, its single gap question with `--state confirmed`, its
    `voice.json` rounds `design` and `spec`, and `--rework`'s refusal once a sub-PR merged;
  - yolo's `shipped` round.
- The unknown-command guard finds `business claim` in `COMMAND_TABLE`.
