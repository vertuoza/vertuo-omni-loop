---
prd: 1342
title: Laws are born with their test
blocked-by: none
spec: file
---

## Problem

A repository that keeps its laws in the knowledge base (`laws.source: knowledge`) has rules and
invariants that say what must stay true. Each carries an `Enforced by:` line, and the outbox gate
already treats a change to a file that line names as risky ground (`law-proof`,
`kit/lib/outbox/decision-coverage.ts`). That protects only the laws that have a test, and most don't.
In this repository, 86 of the 104 rules and invariants say `Enforced by: unenforced`. Three gaps
follow:

1. **Nothing decides whether a decision deserves to be a law.** The harvest
   (`kit/lib/knowledge/pipeline.ts`) writes every decision the classifier calls a rule or an invariant
   into the registers, tested or not, and nothing stops the untested count from growing.
2. **An agent can account for a change to a law by itself.** An account line may be
   `spec <where>`, or name an outbox item ranked `medium`, which the wave adopts without asking. A
   law's test can change, and no person ever sees it.
3. **Fix PRs are never graded.** The server's outbox check (`apps/omni-app`) skips every pull request
   that is not a feature PR, so a `/omni:bug-fix` or `/omni:visual-fix` PR can delete or weaken a
   law's test without anything flagging it.

vnext keeps every law twice, as prose and as a test agents cannot edit. Its laws bite because of that.
This PRD gives omni-loop the same property, generic for every repository that installs the kit.

## Solution

**A law is a decision worth a test, and it carries that test.**

At the harvest, each candidate the classifier calls a rule or an invariant takes one of three paths:

1. **The feature PR already changed a test that proves it.** It becomes a law with that test as its
   `Enforced by:`, as today.
2. **No test, and not worth a law.** A new Jev decision, `law-worth`, answers one Noul: *is this
   decision worth a law, an executable test that fails when it is broken?* It reads the statement, its
   `Why`, the principle it serves, the domain and the PRD's title. A "no" keeps the candidate out of
   the registers: it stays in the PRD's `settled.md` as `stays-here`, its note saying
   `not worth a law (<decided by> <score>)`.
3. **No test, and worth a law.** The knowledge PR writes the law with
   `Enforced by: pending #<issue>`, and the harvest opens a **law issue**: title `Law: <statement>`,
   label `labels.law` (new, default `omni:law`), its body holding the entry's id, register, statement,
   source and where a test of it would live. Agents respect the law from the day the knowledge PR
   merges.

**`/omni:enforce <issue>`** (a new skill) turns one law issue into one pull request:

- it reads the issue and the entry, writes the test where the repository's testing form says tests live;
- it **proves the test**: it breaks the law in the code (the smallest change that violates it), runs the
  test and sees it red, restores the code and sees it green. A test that cannot go red is not a proof;
- it rewrites the entry's `Enforced by: pending #<issue>` to the test's path, on a branch
  `branches.law` (new, default `test/law-{id}`);
- it opens one PR into the default branch that closes the issue, signed, and a person merges it.

When the test cannot be made to go red, it stops, comments on the issue with what is stuck, and leaves
the law `pending`.

**Who answers "worth a law?"** follows every Jev decision (PRD 812):

| where | how it asks | when Jev does not answer |
|---|---|---|
| the app's harvest (`apps/omni-app`) | Galaxy's signed judge route, `POST /api/laws/judge`, under its own secret, like the constituent judge (PRD 871) | the classifier's own answer |
| `omni harvest` and the sweep, in a terminal | `omni decide law-worth`, with the terminal's sign-in | the classifier's own answer |

The classifier's reply gains one field, `worthALaw: boolean`, for every `rule` and `invariant` reply.
It is "today's answer": Off and Shadow keep it, and On replaces it when Jev answers at or above the
decision's floor. The decision starts Off in every workspace. Jev never blocks anything (PRD 812,
decision 6).

**The sweep of the laws already written.** `omni knowledge judge` asks `law-worth` of each rule and
invariant whose `Enforced by:` is `unenforced`, and writes its edits into the working tree:

- **yes:** the entry becomes `pending #<issue>`, and its law issue is opened;
- **no:** the entry leaves its register and is recorded in its source PRD's `settled.md` as
  `stays-here — not worth a law`, and every id that cited it is reported so the person can fix them;
- the run ends by setting `laws.requireProof: true` in `.omni-loop/config.yml`.

A person opens the knowledge PR with those edits (`branches.knowledge`) and reviews it. It is how each
repository moves onto this PRD, on its own day.

**The ratchet is a format rule.** With `laws.requireProof: true`, `omni check knowledge` refuses a
rule or an invariant whose `Enforced by:` is `unenforced`: it must name an existing path, or
`pending #<n>`. With it `false` (the default, for every repository until its sweep), `unenforced`
is accepted as today.

**A person answers every change to a law.**

- **Feature PRs.** The four law rules, `law-proof`, `law-text`, `test-removed` and a new
  `law-demoted` (an `Enforced by:` path turned back to `pending` or `unenforced`, or a law entry
  removed), are accounted only by `item <id>`: `spec <where>` is refused for them. The item named must
  be ranked `high` or above, or the gate counts the change as unaccounted. A person answers it on the
  PR as today.
- **Fix PRs** (`branches.fix`). The server check grades them instead of skipping them. A range that
  fires none of the four law rules is `success`, and nothing changes for the fix. A range that fires
  one needs the fix's folder (`<paths.delivery>/bugs/<n>/` or `visuals/<n>/`) to hold an `outbox/`
  with one `high` item per change, and an account naming each. The check stays red until a person
  answers through the same reply flow as a feature PR. `/omni:bug-fix` and `/omni:visual-fix` learn
  to raise those items when their range touches a law.
- **Knowledge PRs and enforce PRs** (`branches.knowledge`, `branches.law`) are never blocked: a person
  merging one is the answer. Their check is `success` and lists the laws they touch.

Everything above is off unless `laws.source` is `knowledge`. Branch shapes and labels come from the
config. Nothing is written into a target repository besides its own knowledge, tests and config.

## Decisions

1. **One PRD, not two.** Splitting "laws are born with their test" from "a person answers every change
   to a law" was offered. Asked and answered: one PRD.
2. **Omni-loop decides what is worth a law, not a count.** A raw "unenforced count only goes down",
   compared with the base branch or stored in a file, was offered and set aside: the person asked that
   the knowledge base decide, with Jev when it is on, whether a decision is worth enforcing at all.
3. **"Yes" goes to a skill, not the server.** A test must be run red, then green, in the repository,
   and the server runs no repository's tests. The server and the harvest decide, and `/omni:enforce`
   writes and proves. Asked and answered.
4. **A "yes" law enters the knowledge base at once, as `pending #<issue>`.** Agents respect it from the
   day it is decided, and `/omni:enforce` adds its test later. The alternative, the law entering only
   with its test, was offered. Asked and answered: pending.
5. **"No" is not a law.** It leaves the registers and stays in `settled.md`, so the registers only ever
   hold laws that are, or will be, proven.
6. **Accounts for laws are items ranked `high`.** `spec <where>` and `medium` items stay valid for the
   other risk rules (`stored-shape`, `shared-contract`).
7. **Fix PRs get an outbox only when they touch a law.** Asked and answered, rather than leaving fixes
   out or blocking them on a label.
8. **Knowledge and enforce PRs are never blocked.** A person reviews and merges each one, which is the
   answer the gate would ask for.
9. **Rollout per repository, through `laws.requireProof`,** turned on by the sweep's own PR, so a kit
   update never turns a target repository's checks red.
10. **No proof video.** Asked and answered: no.
11. **The voice: B-E Dev objected** (persona:B-E DEv): *"An LLM writing tests nobody asked for, for
    'laws' it picked itself, sounds like a pile of fluff tests I'll have to maintain."* Settled
    `accepted`: every enforce test must be seen red when its law is broken, a person merges every
    enforce PR, and `law-worth` saying no keeps the registers small.

## User stories

- As a **lead engineer**, I read the registers and know each law there is, or will soon be, proven by
  a test, so I can trust what agents are told.
- As a **back-end developer**, I see a law's test change on a PR only with a person's answer beside it,
  so an agent cannot quietly weaken a rule to turn a check green.
- As a **product manager**, I run `/omni:enforce` on a law issue, or let the loop do it, and get one PR
  a person merges, without writing tests myself.
- As a **workspace owner**, I switch `law-worth` to Shadow on Settings › Jev and read how often Jev
  agrees with the harvest before trusting it.
- As a **fixer**, my bug fix that touches no law sees nothing new; one that touches a law tells me in
  plain words which law, and who must answer.

## Scope

In:

- the classifier's `worthALaw` field, and the harvest's three paths, in the kit and in the app;
- the `law-worth` Jev decision in Galaxy's registry, its signed judge route, and `omni decide law-worth`;
- `Enforced by: pending #<n>`, `laws.requireProof`, `labels.law` and `branches.law` in the kit's config
  and checks;
- `omni knowledge judge`, the sweep;
- the `/omni:enforce` skill;
- `law-demoted`, and the item-only, `high`-floor account for the four law rules;
- the server check grading fix PRs, knowledge PRs and enforce PRs, and the fix's outbox;
- the bug-fix and visual-fix skills raising law items;
- `docs/guide` and the app READMEs: what a law is now, `/omni:enforce`, the sweep.

Out:

- writing the tests for this repository's laws: each one is a law issue `/omni:enforce` takes later;
- running the sweep on this repository: a person runs `omni knowledge judge` once this PRD has shipped
  and `law-worth` is deployed, and opens its knowledge PR, as every other repository does;
- `/omni:drive` picking up law issues by itself: a person runs `/omni:enforce` until a later PRD;
- principles: they stay unenforced by design, served by the rules under them;
- any change to how a person answers an outbox item.

## Test seams

- **Kit, pure modules** (`kit/lib/knowledge/`, `kit/lib/outbox/`): the classifier's contract with
  `worthALaw` (valid, missing, on a non-law kind); the harvest's three paths as edits-as-data
  (`finishHarvest`); `pending #<n>` parsing; `check-knowledge` with `requireProof` on and off;
  `law-demoted` on add, flip and removal; `account.ts` refusing `spec` for a law rule and `compare`
  treating a `medium` item as unaccounted; the sweep's edits.
- **Kit, commands** (`kit/bin/`, through `main()` on `makeRepo()` fixtures): `omni knowledge judge` with
  a stubbed decide; `omni decide law-worth`; `omni bug` and `omni visual` naming the outbox a law change
  needs.
- **Galaxy** (`apps/galaxy/src/jev/decisions/`): `law-worth` in Off, Shadow and On, the floor, the
  fallback; the judge route's signature, caps and refusals.
- **omni-app** (`apps/omni-app/src/evaluate/`, the end-to-end test against the stubbed GitHub): a fix PR
  with no law touched, with one touched and unanswered, and answered; a knowledge PR and an enforce PR
  never failing; the harvest opening a law issue on "yes" and none on "no".
- **Skills** (`kit/test/plugin.test.ts` and the skill shape tests): `/omni:enforce`'s steps and footer;
  the bug-fix and visual-fix steps.
- **Mutation**: the changed core files under `kit/lib/outbox/` run through `pnpm mutation:changed` in
  their slices.

No test calls GitHub, Supabase or Jev: everything runs on fixtures and stubs.

## Risks

A merge to `main` publishes:

- **the kit** (`kit/dist/omni.mjs` and `kit/plugin`): every installed repository gets the new rules on
  its next update. Rollback: revert the merge; `laws.requireProof` stays `false` everywhere the sweep
  has not run, so no repository's check turns red by the update alone.
- **the GitHub App** (`apps/omni-app`): fix PRs start being graded. Rollback: revert; the check goes back
  to `skipped` on fix PRs.
- **Galaxy** (`apps/galaxy`): a new Jev decision row, Off by default, and a new route. Rollback: revert;
  no stored data depends on it beyond logged calls.
- **the database**: one additive migration, `jev_decision_names()` gaining `law-worth` as earlier
  decisions did (`supabase/migrations/20261028110000_unknown_worth_asking.sql`). Rollback: a follow-up
  migration that removes the name and any `law-worth` row.

The sweep of this repository writes nothing until a person merges its knowledge PR.

## Acceptance criteria

1. On a merged feature PR whose decision the classifier calls a rule, with no test changed, the
   harvest's knowledge PR either holds the law as `Enforced by: pending #<n>` with law issue `#<n>`
   open, or holds no law and the PRD's `settled.md` says `not worth a law`, depending on `law-worth`'s
   answer.
2. With `law-worth` Off, the classifier's `worthALaw` decides; with it On and Jev answering above the
   floor, Jev decides; with Jev failing, the classifier decides, and the harvest still completes.
3. `/omni:enforce <n>` on a law issue opens one PR into the default branch that adds a test, rewrites
   the entry's `Enforced by:` to that test's path and closes the issue; its report shows the test red
   with the law broken and green with it restored.
4. `/omni:enforce` on a law whose test cannot be made to go red opens no PR, comments on the issue
   with what is stuck, and leaves the entry `pending`.
5. `omni knowledge judge` turns every `unenforced` rule and invariant into `pending #<n>`, with its
   issue, or moves it to its `settled.md`, and sets `laws.requireProof: true`.
6. With `laws.requireProof: true`, `omni check knowledge` refuses an entry whose `Enforced by:` is
   `unenforced`, naming the entry; with it `false`, it accepts it.
7. On a feature PR that changes a law's test, the outbox gate stays red while the account is
   `spec <where>` or names a `medium` item, and goes green once it names a `high` item a person
   answered.
8. A fix PR that touches no law gets a `success` outbox check; one that removes a law's test gets a
   `failure` check naming the law, until its folder's outbox holds a `high` item a person answered.
9. A knowledge PR and an enforce PR never get a `failure` outbox check, and their check lists the laws
   they touch.
10. In a repository whose `laws.source` is not `knowledge`, nothing above runs: no `law-worth` call, no
    law issue, and fix PRs stay `skipped`.
