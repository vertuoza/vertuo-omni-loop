---
prd: 812
title: Jev decisions, opt-in per workspace
blocked-by: none
spec: file
---

# Jev decisions, opt-in per workspace

**Date:** 2026-09-30 · **PRD:** #812
**Touches:**
- `supabase/migrations/` (one new file), `supabase/checks/jev.sql` (new), a step for it in
  `.github/workflows/supabase.yml`
- `apps/galaxy/src/jev/` (new: client, registry, resolver, secret box, settings page parts)
- `apps/galaxy/app/app/settings/jev/` (new page), `apps/galaxy/src/nav/sidebar.ts` (one tab)
- `apps/galaxy/app/api/decide/[decision]/route.ts` and `apps/galaxy/app/api/jev/**` (new routes)
- `apps/galaxy/src/ask/classify.ts`, `apps/galaxy/src/ask/api-live.ts` (the category goes through
  the resolver)
- `kit/bin/commands/decide.mjs` (new), `kit/bin/decide.test.mjs`, `kit/dist/omni.mjs`
- `kit/plugin/skills/do-work/SKILL.md`, `kit/plugin/skills/bug-fix/SKILL.md` (one step each)
- `apps/galaxy/.env.example`, `apps/galaxy/README.md` (`SECRETS_MASTER_KEY`)

## Problem

Three decisions in the loop are made by a general model that answers in words:

1. **The question category.** Every question round Claude asks a person is sorted into one of six
   categories (Business, Product, UX/UI, Architecture, Harness, Other) by Claude Haiku through
   OpenRouter (`apps/galaxy/src/ask/classify.ts`, PRD 144).
2. **The outbox item risk.** When a slice records a decision it took alone, the agent sets
   `hardToRevert` on the item (`/omni:do-work` step "Record it"), and the kit turns it into the
   item's rank: `high` waits for a person, `medium` is adopted without asking
   (`kit/lib/policy/outbox-policy.mjs`). A wrong `false` lets a risky decision through unasked; a
   wrong `true` asks a person for nothing.
3. **The bug-fix risk.** `/omni:bug-fix` step 3 sets a risk `critical | high | medium | low` on the
   bug's triage comment and label.

Each one is a pick from a closed set. TypeSafe AI's **Jev** is a model made for exactly that: given a
state and a typed question (a *Choice* among named options, a *Score* on ordered levels, or a *Noul*,
how true a statement is from 0 to 1), it returns the answer with its probabilities and a confidence,
in 70 to 500 ms, for about $0.04 per million input tokens. It writes no text.

The workspace owner has a TypeSafe account and wants to use Jev for these decisions — but decision by
decision, never with one switch for everything, and never at the cost of breaking what works today.

## Solution

A workspace owner opens **Settings › Jev**, switches Jev on and pastes the TypeSafe API key. The key
is tested with one call, stored encrypted, and never shown again (only its last four characters).

Below the key, one row per decision — the three above — each with:

- a **mode**: **Off** (today's path, Jev not called), **Shadow** (today's path decides; Jev answers
  alongside and the answer is only logged), **On** (Jev decides; today's path answers whenever Jev
  cannot);
- its **tuning**: a *threshold* (a Noul answer at or above it counts as yes; default 0.5) and a
  *confidence floor* (under it, an On decision falls back to today's answer; default 0.4);
- its **record** over the last 30 days: calls, how often Jev agreed with today's path, and the last
  ten disagreements with both answers and a link to the round, item or issue.

Every decision starts Off. A workspace that never opens the page sees no change.

Galaxy is the only thing that calls Jev. The category is decided in Galaxy already. The outbox risk
and the bug risk are decided inside Claude sessions, so they ask Galaxy through a new kit command,
`omni decide <decision>`, with the terminal's sign-in — the same way `omni business show` reads
the business. The key never reaches a laptop.

## Decisions

1. **Scope: three decisions.** `question-category`, `outbox-risk`, `bug-risk`. The retro verdict, the
   knowledge harvest kind, the PR-care verdict and the fix-to-brainstorm escalation also fit Jev and
   are follow-up PRDs; this PRD's registry makes each one a new entry, not a new mechanism.
2. **Opt-in per workspace, owner only.** Setting the key, removing it, and changing a mode, a
   threshold or a floor are owner actions, as for Settings › Repositories. Members see the page — the
   modes, the tuning and the record — and never the key.
3. **Three modes per decision: Off, Shadow, On.** Shadow exists so an owner can read Jev's record on
   their own data before trusting it with a decision.
4. **On replaces, in both directions.** When a decision is On and Jev answers above its confidence
   floor, Jev's answer counts even when it is lower than the agent's: an outbox item can go from
   `high` to `medium` and a bug from `high` to `low`. (Asked and answered: replace, not raise-only.)
5. **The deterministic rules stay the kit's.** For `outbox-risk`, Jev answers only `hardToRevert`.
   `needsHumanAction`, `breaksNamedLaw`, `principlesConflict` and the law floor (`floorRank`: a
   decision bearing on a law is `high`) stay as they are, and the kit still computes the rank. For
   `bug-risk`, Jev answers only the risk level; Kind, Domain and Regression stay the agent's.
6. **Jev can never block anything.** No key, the mode Off, a timeout (5 s), a non-200 reply, an
   answer outside the question's schema, an answer under the confidence floor, no sign-in in the
   terminal, or a kit or app without the verb: each one means today's answer counts. Nothing retries.
   `omni decide` always exits 0 on a decision outcome and prints `unset` when Jev did not decide.
7. **The key is encrypted by the app.** AES-256-GCM with a per-deployment master key,
   `SECRETS_MASTER_KEY` (32 bytes, base64), in Galaxy's environment. The row is written through a
   security-definer function that checks the caller owns the workspace; no policy lets any client
   read it; only Galaxy's server, with the service role, decrypts it, and only to call Jev. Without
   `SECRETS_MASTER_KEY` the page shows "Jev is not available on this deployment" and nothing can be
   saved. Removing the key sets every decision to Off.
8. **The model version is pinned.** Galaxy asks `jev-1.13.0`, never `jev-latest`, so a TypeSafe
   release cannot move answers under a tuned threshold. Every logged call keeps the `model` Jev
   reports.
9. **Each decision owns its question.** The registry (`apps/galaxy/src/jev/registry.ts`) holds, per
   decision: the Jev question type, its instructions and options, the state it is given, and how the
   answer maps to the loop's value. Tuning or rewording one decision cannot change another.
10. **What is sent, and nothing more.** `question-category`: the round's questions, their options and
    descriptions (never an option's preview) and its context (repository, branch, PRD, skill) — what
    Haiku reads today. `outbox-risk`: the item's decision text, its options, the slice's title and the
    paths the slice touches. `bug-risk`: the issue's title and body, the reproduction's path, the
    domain and the agent's own one-sentence risk. Every token-shaped string is masked first, with the
    kit's `maskSecrets` rules ported to `apps/galaxy/src/jev/mask.ts`. The Settings page lists what
    each decision sends.
11. **Who decided is always visible.** When Jev's answer counts, the outbox item carries
    `Decided by: Jev (hardToRevert 0.82)` and the bug's triage comment carries
    `- **Risk:** high — … (Jev, 0.82)`. When today's path decided, nothing is added.
12. **The record compares like with like.** Every call to Jev logs the old answer next to Jev's:
    Haiku's category (Shadow runs both), the agent's `hardToRevert`, the agent's risk level. The
    agent always makes its own call first and passes it to `omni decide` with `--old`, so the record
    also exists in On mode.

## User stories

- As a workspace owner, I switch Jev on in Settings and paste my TypeSafe key; a wrong key is refused
  on the spot with TypeSafe's reason.
- As a workspace owner, I put `outbox-risk` in Shadow for a week, read that Jev agreed 41 times out of
  44 and the three disagreements, and switch it On.
- As a workspace owner, I raise `outbox-risk`'s threshold from 0.5 to 0.65 because Jev called too many
  decisions hard to revert, and the next item uses 0.65.
- As a workspace owner, I remove the key and every decision is Off at once.
- As a member, I see which decisions Jev makes in my workspace and its record, and I cannot see the key
  or change a mode.
- As a person reading an outbox item or a bug triage, I see when Jev made the call and how sure it was.
- As an agent in `/omni:do-work`, I set `hardToRevert` as today, run `omni decide outbox-risk`, and use
  its answer when it prints one, my own when it prints `unset`.
- As a developer whose terminal is not signed in, nothing changes: `omni decide` prints `unset`.

## Scope

In:

- The migration: `workspace_secrets`, `jev_decisions`, `jev_calls`, their RLS, the owner-only
  security-definer functions to set and remove the key and to set a decision's mode and tuning, and
  `supabase/checks/jev.sql` proving a member can neither read a secret nor change a mode.
- `apps/galaxy/src/jev/`: the secret box (encrypt, decrypt, last four), the Jev client, the registry
  of the three decisions, the resolver (mode × outcome → the answer that counts, and the log row),
  the mask.
- Settings › Jev: the enable switch and key field (with the test call), the three decision rows with
  mode, threshold, floor, the data each sends, and the 30-day record.
- `POST /api/decide/<decision>`: the caller's sign-in, the workspace from the repository, the state
  and the old answer in; `{ answer, confidence, decidedBy: 'jev' | 'old' }` out. It runs for Shadow
  and On; Off answers `{ decidedBy: 'old' }` without calling Jev.
- The question category through the resolver, in `after()` as today.
- `omni decide outbox-risk|bug-risk --state-file <json> --old <value> [--ref <item or issue>]`,
  printing `<answer> <confidence>` or `unset`, with `--json`.
- One step in `/omni:do-work` ("Record it") and one in `/omni:bug-fix` (step 3, "Triage") that run
  `omni decide` and use its answer, with the `Decided by` line.
- `SECRETS_MASTER_KEY` in `.env.example` and the README.

Out:

- The other decisions (retro verdict, harvest kind, PR-care verdict, escalation) — follow-up PRDs.
- Any other provider, and any change to OpenRouter's use.
- Per-repository or per-member Jev settings.
- Billing or usage limits on the Jev account (TypeSafe's console shows usage).
- Rotating `SECRETS_MASTER_KEY` (a rotation re-enters the key; a later PRD may automate it).

## Test seams

Commands: `pnpm test`; one file with `pnpm vitest run <path>`. No test calls TypeSafe, GitHub or
Supabase: the Jev client takes an injected `fetch`, the routes take injected dependencies, as
`src/ask/api.ts` does.

- **Secret box** (`src/jev/secret-box.test.ts`): a round trip; a wrong master key, a changed
  ciphertext and a changed iv all fail to decrypt; the last four; a missing master key.
- **Client** (`src/jev/client.test.ts`): the request (endpoint, bearer, pinned model, question keys
  from the registry) and each outcome — a Choice, a Score, a Noul, a non-200, a timeout, a reply
  outside the schema.
- **Registry** (`src/jev/registry.test.ts`): each decision's question validates; each answer maps to
  the loop's value; a Choice key outside the options is refused.
- **Resolver** (`src/jev/resolve.test.ts`): every mode × every outcome (answered, under the floor,
  failed, no key) gives the right counted answer, `decidedBy`, and log row; the threshold applies to a
  Noul; On with an answer lower than the old one keeps Jev's (decision 4).
- **Decide route** (`app/api/decide/[decision]/route.test.ts`): no sign-in, a repository no
  workspace owns, an unknown decision, a malformed state, Off, Shadow, On.
- **Category**: with the decision Off, `classify` behaves exactly as today (the existing tests pass
  unchanged); Shadow stores Haiku's and logs Jev's; On stores Jev's and falls back to Haiku's.
- **Settings page**: the owner's and the member's views; a refused test call; removing the key sets
  the modes Off; the record's counts from fixture rows.
- **`omni decide`** (`kit/bin/decide.test.mjs`): through `main()` with a stubbed `fetch` and token
  store — an answer, `unset` on every failure outcome, `--json`, a usage error exits 2.
- **Database** (`supabase/checks/jev.sql`): a member reads no secret row and cannot call the owner
  functions; an owner of another workspace cannot either.

## Risks

- **What merging publishes:** one migration applied to production Supabase by the `supabase`
  workflow's `deploy` job (three new tables and their functions; nothing existing changes), the kit
  (`kit/dist/omni.mjs` gains `omni decide`; the two skills gain one step), and Galaxy's new page and
  routes. Every workspace starts with Jev off, so behaviour changes for nobody until an owner opts in.
- **Rollback:** switch every decision Off on the page (or remove the key) — today's paths decide
  again at once. The code rolls back by reverting the feature PR; the tables stay, unused, until a
  later migration drops them.
- **The master key:** losing `SECRETS_MASTER_KEY` makes the stored keys unreadable: every call fails,
  so every decision falls back to today's path (decision 6), and the owner re-enters the key after a
  new master key is set. It must be set on Galaxy's Vercel project before the page can save anything —
  owed after merge.
- **Data sent to TypeSafe:** a workspace that opts in sends the state listed in decision 10 to a new
  provider. The page says so before the key is saved.
- **Jev in On mode lowering a risk:** by decision 4 an On `outbox-risk` can let an item be adopted
  without asking that the agent would have sent to a person. The law floor still holds, and Shadow
  exists to find this before switching On.
- **Adversarial state:** a text that argues for its own classification can move Jev's answer
  (TypeSafe's own caveat). The state is the loop's own text, written by agents and members, so the
  risk is low; the law floor and the owner's threshold bound it.

## Acceptance criteria

1. A workspace without a Jev key behaves exactly as before: every existing test passes unchanged, and
   `omni decide` prints `unset`.
2. An owner saves a valid key after one test call; an invalid key is refused with TypeSafe's reason
   and nothing is stored; the page then shows only the last four characters.
3. A member sees the page's modes, tuning and record, and cannot see the key, save a key, or change a
   mode (proven by `supabase/checks/jev.sql` and a page test).
4. With `question-category` in Shadow, a new round stores Haiku's category and logs Jev's next to it;
   in On, it stores Jev's, and Haiku's when Jev fails or answers under the floor.
5. With `outbox-risk` On, `omni decide outbox-risk` prints Jev's `hardToRevert` as `true` or `false`
   with its confidence, per the decision's threshold, and the item written from it carries the
   `Decided by: Jev` line; the law floor still raises a law-bearing decision to `high`.
6. With `bug-risk` On, `omni decide bug-risk` prints one of `critical | high | medium | low` with its
   confidence, and the triage comment carries `(Jev, <confidence>)`.
7. A timeout, a non-200, a reply outside the schema, no sign-in and the mode Off each make
   `omni decide` print `unset` and exit 0, and the skill keeps its own answer.
8. Changing one decision's mode, threshold or floor changes no other decision's result.
9. Removing the key sets all three decisions to Off.
10. The record shows, per decision over 30 days, the number of calls, the agreement rate and the last
    ten disagreements with both answers and a link.
