---
prd: 2305
title: The code base is safe to be open source
blocked-by: none
spec: file
phase0: server
---

## Problem

Omni Loop is open source (its Statement), and two Never lines now say what that rules out: never#11,
the code base never carries its maintainer's internal delivery, and never#12, it never holds a secret
or a sensitive record. A read-only scan of `main` on 2026-10-21 found:

- **No real secret.** The keys in tests are visible fakes (`sk-or-v1-0123…`, the jwt.io sample token,
  `oma_…` mockups), and the Postgres URLs point at the local stack with Supabase's public default.
- **Internal names in about 1,022 tracked files,** mostly test fixtures: the maintainer's other
  repositories, as `vertuoza/<repo>` and as bare names with the maintainer's `vertuo-` prefix, the
  maintainer's own plan repository used as the sample plan repository (over 1,100 mentions, and the
  root `package.json` name), and the loop's own history (shipped specs, bugs, concepts, ADRs, docs).
- **Real people's emails** on the maintainer's domain, and fictional people given that real domain.
- **A fresh install creates the maintainer's workspace:** the migration that made workspaces inserts
  it, and four later migrations give it the maintainer's repositories, so anyone self-hosting the
  code starts with it. The old "crew" rule on the maintainer's domain is no longer live (it was
  dropped when workspaces came, and sign-up is GitHub-only), but its text is still in two migrations.

Nothing stops any of it from coming back.

## Solution

**1. A guard, `scripts/open-source.ts`,** a repository script beside `scripts/migration-order.ts`,
with its guard test, run in CI and by the pre-push hook. It reads every tracked file (the
generated `kit/dist/` and `apps/omni-app/api/` and the lockfile excepted) with generic rules, so
neither the guard nor this spec lists an internal name:

| rule | flags | allowed |
|---|---|---|
| internal repository | the maintainer's organisation followed by any repository, and any name with the maintainer's `vertuo-` prefix | this repository (`vertuoza/vertuo-omni-loop`, `vertuo-omni-loop`) and its Vercel host (`vertuo-omni-loop-galaxy`) |
| real email | any address on the maintainer's domain | none |
| secret | GitHub tokens, `sk-…` API keys, private-key blocks, `sb_secret_…`, AWS access keys, JWTs other than the jwt.io sample, Postgres URLs whose password is not the local default | each entry of `scripts/open-source.allow.json`: a file, a pattern and its reason |

- A finding prints `<file>:<line>: <rule> — <what to use instead>`, never a secret's value, and the
  guard exits 1; clean, it prints one line and exits 0.
- **A ratchet.** It lands with `scripts/open-source.baseline.json`, today's offending files: a file
  in it is not judged, any other offence fails. The baseline only shrinks: a file in it that is now
  clean fails too (`remove <file> from the baseline`). The last slice deletes the baseline, and the
  rule then holds everywhere.

**2. gitleaks in CI.** A job in the `security` workflow downloads the gitleaks binary (MIT) at a
pinned version, checks its SHA-256, and scans the pull request's commits with `.gitleaks.toml`,
whose allowlist holds the visible fakes. Not `gitleaks-action`, which needs a paid licence for an
organisation's repositories.

**3. The cleanup, by a rule, not a list:**

| today | after |
|---|---|
| the maintainer's organisation and a repository other than this one | `demo-org/<the repository's new name>` |
| a name with the `vertuo-` prefix, other than this repository's | `nimbus-<the rest>`; where PR #2304 already chose a name, its choice wins (`nimbus-brain`, `nimbus-app`, `nimbus-plan`, `nimbus-core`, `nimbus-api`, `nimbus-web`) |
| `<name>@` the maintainer's domain | `<name>@example.com` |
| the root `package.json` name | `omni-loop` |

It applies to code, tests and their fixtures, `supabase/checks`, `supabase/config.toml`, the loop's
history (`.omni-loop/delivery`, `.omni-loop/knowledge`, `docs/`, `README.md`, `fallow/`) and the old
migrations. A fixture and the assertion that reads it change together.

**4. The old migrations, edited in place.** Production applied them long ago and Supabase records
applied migrations by version, never by content, so an edit changes nothing there; it changes what a
fresh install builds. The maintainer's workspace insert and the rows that give it repositories are
removed, and the comments and messages naming the maintainer's domain are reworded. A fresh install
creates no workspace. `supabase/seed.sql` creates its own `demo-org` workspace for the demo galaxy,
and each `supabase/checks/` file that relied on the maintainer's workspace makes its own fixture.

**5. Not in this PRD, said in the hand-off:** one full-history scan, `gitleaks git` over every
commit, by a person before the repository is announced; and one read-through of business content no
rule can catch (a product's trade, its region, its features in old concept boards and specs).

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | script | `scripts/open-source.ts` | no written convention: follows `scripts/migration-order.ts` and its guard test |
| vertuo-omni-loop | data | `scripts/open-source.baseline.json`, `scripts/open-source.allow.json` | no written convention: follows `fallow/` baselines (a ratchet that only shrinks) |
| vertuo-omni-loop | CI | the `gitleaks` job of `.github/workflows/security.yml` | no written convention: follows `.github/workflows/security.yml` |
| vertuo-omni-loop | names | `demo-org`, `nimbus-*`, `<name>@example.com` | PR #2304 (`demo-org`, `nimbus-*`); RFC 2606 (`example.com`) |

## Decisions

- **The design was approved section by section** in chat on 2026-10-21: the approach and the guard;
  the cleanup; failures, tests and risks.
- **The loop's history is scrubbed too** (the person's answer), over allowlisting it or deleting it:
  the guard then holds with no folder excepted.
- **The old migrations are edited in place** (the person's answer), over keeping them byte for byte:
  a fresh install starts with no maintainer workspace. A new migration could not remove the seed
  without deleting the real workspace in production.
- **Names follow PR #2304** (the person's answer): `demo-org`, `nimbus-*`, and `example.com`.
- **gitleaks in CI as well** (the person's answer), as a pinned binary, not the action.
- **A generic rule, never a list of internal names,** in the guard, its test and this spec: a list
  would itself be the internal delivery never#11 rules out. Test fixtures build their strings at
  runtime, so they trip neither the guard nor GitHub's push protection.
- **A shrinking baseline** lets the guard land first and the cleanup slices run in parallel without
  a red CI.
- **It builds after PR #2304 merges:** that PR owns `supabase/seed.sql` and the demo world. #2304 is
  not a PRD, so `blocked-by` stays `none`; `/omni:yolo` meets `main` before its first wave.
- **The voice objected (persona:Lead Engineer):** "Rewriting about a thousand files of fixtures,
  history and old migrations in one PRD touches everyone's open branches at once." Settled **none**:
  the person approved; the slices split by folder and merge one at a time, and the known overlap,
  #2304, merges first.
- **No proof video** (the person's answer). E2E validation is off in this repository.

## User stories

- As someone reading the public repository, I find no internal repository, no real colleague's email
  and no secret of the maintainer.
- As someone self-hosting Omni Loop, `supabase db reset` gives me an empty database and the demo
  `demo-org` workspace, never the maintainer's.
- As a contributor, a pull request that adds an internal name, a real email or a secret is red, with
  the file, the line and what to write instead.

## Scope

In: the guard, its test, baseline and allowlist; the pre-push and CI steps; the gitleaks job and its
config; the cleanup of every tracked file the guard flags, the old migrations, `supabase/checks/`,
`supabase/config.toml`, the root package name and the loop's history.

Out: the full-history scan and the business-content read-through (a person's steps); any change to
production data; renaming this repository or its Vercel project; PR #2304's files beyond what this
PRD's rule still finds after it merges.

## Test seams

Following `omni kb show testing` (vitest, one run; never calls GitHub):

- **The guard:** per rule, a fixture that breaks it is red and the fixed one green; this repository's
  own names pass; an allowlist entry needs its reason; a baseline entry whose file is clean fails;
  a finding prints the file, the line and the rule, never the value. Fixture strings are built at
  runtime.
- **Each cleanup slice:** the full `pnpm test` green with the new names, and the slice's files gone
  from the baseline.
- **Supabase:** the `supabase` workflow resets a fresh database from the edited migrations and the
  seed, then runs every check: no maintainer workspace, the `demo-org` one from the seed.
- **gitleaks:** the job runs on this PRD's own pull request and is green.

## Risks

- **Publishes:** renamed fixtures and history, a new CI guard and job, edited old migrations, a
  renamed root package. Rollback: revert the feature PR; production's database is untouched by the
  migration edits (`omni kb show releasing`).
- **Open branches** that edit a renamed file will conflict; most cleaned files are old specs and
  fixtures. PR #2304 merges first.
- **Law proofs:** a test that proves a locked law and holds an internal name is renamed too; the
  `outbox` check then waits for an approving review of the feature PR by the law's CODEOWNER.
- **What no rule catches:** business content and real names written in prose (the read-through), and
  the git history (the full-history scan).
- **The locked laws** `omni kb laws` prints for the paths this design changes:
  - N-PRODUCT-4: a pull request can never change the rules it is judged by. If broken, a change could
    switch its own gate off. The guard and the gitleaks job are new checks that only add findings;
    the baseline only shrinks, which the guard's own test proves. Changing it needs @pierrederval to
    approve the pull request on GitHub.
  - N-PRODUCT-17: no secret is ever sent to the browser. If broken, anyone could read a key. This
    PRD adds a check against committed secrets and changes no code path that serves one. Changing it
    needs @pierrederval to approve the pull request on GitHub.
  - BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39 and BR-PRODUCT-63 (workspace membership and
    isolation): the migration edits remove a seeded workspace from fresh installs and change no
    membership rule or policy. Changing them needs @pierrederval to approve the pull request on
    GitHub.
  - BR-PRODUCT-3, BR-PRODUCT-5, BR-PRODUCT-6, BR-PRODUCT-12, BR-PRODUCT-59, BR-PRODUCT-64,
    BR-PRODUCT-94, N-PRODUCT-3, N-PRODUCT-7, N-PRODUCT-8, N-PRODUCT-13, N-PRODUCT-14, N-PRODUCT-15,
    N-PRODUCT-16: printed for every path, none changed by this design; a law-proof test whose
    fixtures are renamed waits for @pierrederval's approving review on GitHub.

## Acceptance criteria

1. `node scripts/open-source.ts` exits 0 on `main` once the feature merges, with no baseline file
   left, and exits 1 naming the file, the line and the rule for an internal repository name, an
   address on the maintainer's domain, or a secret pattern added anywhere outside the allowlist.
2. This repository's own names (`vertuoza/vertuo-omni-loop`, `vertuo-omni-loop`, its Vercel host)
   never fail it; each allowlist entry carries its reason.
3. The guard runs in CI on every pull request and in the pre-push hook.
4. The `gitleaks` job of the `security` workflow runs a pinned, checksum-verified binary on the pull
   request's commits and is green on this PRD's pull request.
5. A fresh `supabase db reset` creates no maintainer workspace; the seed's `demo-org` workspace holds
   the demo galaxy, and every `supabase/checks/` file passes in CI.
6. The root package is named `omni-loop`, and the full `pnpm test`, `pnpm lint` and `pnpm typecheck`
   are green.
7. The hand-off names the two steps left to a person: the full-history gitleaks scan and the
   business-content read-through.
